import mongoose from "mongoose";
import { fgItemSchema, fgInventoryMonthlySchema, categorySchema, locationSchema, customerSchema, rmBoItemSchema, rawMaterialSchema, boughtOutSchema, storeOrderFulfillmentSchema, storePrefixSchema, stockTransactionSchema } from "../../models/store/index.js";
import { salesOrderSchema } from "../../models/sales/index.js";
import { uploadOnS3 } from "../../utils/s3.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";
import { validateMasterUniqueness, formatDuplicateKeyError } from "../../utils/duplicateValidator.helper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createFGItem = async (req, res) => {
  try {
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const companyId = getCompanyId(req);
    const { userId, userName } = getUserAudit(req);
    let { name, code, type, description, location, unit, bom, revisionNumber, reorderLevel, hsnCode } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: "Name and Type are required" });
    }

    // Pre-validate compound uniqueness on { name, revisionNumber } per company
    const uniqueness = await validateMasterUniqueness({
      Model: FGItem,
      companyId,
      name,
      revisionNumber: revisionNumber || "",
      masterLabel: "FG Item"
    });
    if (uniqueness.isDuplicate) {
      return res.status(400).json({ message: uniqueness.message });
    }

    // Quick fix: Drop the deprecated unique index on `code` if it exists for this tenant
    try {
      await FGItem.collection.dropIndex('company_1_code_1');
    } catch (e) {
      // Ignore error if index doesn't exist
    }

    // Autogenerate code if missing
    let finalCode = (code || "").toString().trim();
    if (!finalCode) {
      try {
        const StorePrefix = req.getModel('StorePrefix', storePrefixSchema);
        const prefixSettings = await StorePrefix.findOne({ company: companyId });
        const prefix = prefixSettings?.finishedGoodsPrefix || "FG";
        const count = await FGItem.countDocuments({ company: companyId });
        finalCode = `${prefix}-${String(count + 1).padStart(4, '0')}`;
      } catch {
        finalCode = `FG-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    // Parse and sanitize bom if provided
    let cleanedBom = [];
    if (typeof bom === 'string') {
      try { bom = JSON.parse(bom); } catch(e) { console.error("Failed to parse bom", e); }
    }
    if (Array.isArray(bom)) {
      cleanedBom = bom.filter(b => b && b.item && mongoose.Types.ObjectId.isValid(b.item)).map(b => ({
        itemType: b.itemType || 'RawMaterial',
        item: b.item,
        itemName: b.itemName || '',
        quantity: Number(b.quantity) || 1,
        unit: b.unit || 'Nos'
      }));
    }

    const validLocation = (location && mongoose.Types.ObjectId.isValid(location)) ? location : undefined;

    // Handle photo uploads
    const photoUrls = [];
    let filesToUpload = [];
    if (Array.isArray(req.files)) {
      filesToUpload = req.files;
    } else if (req.files && req.files['photos']) {
      filesToUpload = req.files['photos'];
    }

    if (filesToUpload.length > 0) {
      for (const file of filesToUpload) {
        try {
          const uploadResult = await uploadOnS3(file.path, "fg-items", companyId);
          if (uploadResult) photoUrls.push(uploadResult.secure_url);
        } catch (e) { console.error("Photo upload error", e); }
      }
    }

    const newFGItem = await FGItem.create({
      company: companyId,
      name: name.toString().trim(),
      code: finalCode,
      type,
      description: description || "",
      location: validLocation,
      unit: (unit || "Nos").toString().trim(),
      hsnCode: (hsnCode || "").toString().trim(),
      reorderLevel: isNaN(Number(reorderLevel)) ? 0 : Number(reorderLevel),
      bom: cleanedBom,
      revisionNumber: revisionNumber || "",
      photos: photoUrls,
      createdBy: userId,
      createdByName: userName,
      updatedBy: userId,
      updatedByName: userName
    });

    res.status(201).json({ message: "FG Item created successfully", fgItem: newFGItem });
  } catch (error) {
    console.error("createFGItem error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        message: formatDuplicateKeyError(error, { masterLabel: "FG Item", cleanName: req.body?.name, cleanRev: req.body?.revisionNumber })
      });
    }
    res.status(500).json({ message: error.message || "Failed to create FG Item" });
  }
};

export const getAllFGItems = async (req, res) => {
  try {
    const FGItem = req.getModel('FGItem', fgItemSchema);
    req.getModel('Location', locationSchema);
    req.getModel('Category', categorySchema);
    req.getModel('RawMaterial', rawMaterialSchema);
    req.getModel('BoughtOut', boughtOutSchema);
    req.getModel('RmBoItem', rmBoItemSchema);
    req.getModel('Material', rmBoItemSchema);
    const companyId = getCompanyId(req);

    const fgItems = await FGItem.find({ company: companyId })
      .populate('location', 'name')
      .populate('bom.item', 'name componentName code componentCode unit rate descriptions description type') 
      .sort({ createdAt: -1 })
      .lean();

    // Fetch active StoreOrderFulfillment to compute PO & Sales Order reserved breakdown
    const StoreOrderFulfillment = req.getModel('StoreOrderFulfillment', storeOrderFulfillmentSchema);
    req.getModel('SalesOrder', salesOrderSchema);
    req.getModel('Customer', customerSchema);

    const activeFulfillments = await StoreOrderFulfillment.find({
      company: companyId,
      reservedQuantity: { $gt: 0 }
    }).populate({
      path: 'storeOrder',
      select: 'orderNumber poReference orderType customer',
      populate: { path: 'customer', select: 'name customerName' }
    }).lean();

    const reservedMap = new Map();
    for (const ful of activeFulfillments) {
      if (!ful.fgItem) continue;
      const fgIdStr = ful.fgItem.toString();
      const soObj = ful.storeOrder || {};
      const custName = soObj.customer?.name || soObj.customer?.customerName || 'Customer';
      const entry = {
        salesOrderId: soObj._id,
        orderNumber: soObj.orderNumber || 'SO-Direct',
        poReference: soObj.poReference || '',
        customerName: custName,
        reservedQuantity: Number(ful.reservedQuantity || 0),
        dispatchedQuantity: Number(ful.dispatchedQuantity || 0)
      };
      if (!reservedMap.has(fgIdStr)) {
        reservedMap.set(fgIdStr, []);
      }
      reservedMap.get(fgIdStr).push(entry);
    }

    // Fetch monthly tracking for the current month
    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);
    const monthlyRecords = await FGInventoryMonthly.find({ company: companyId, month: currentMonthStr }).lean();
    const monthlyMap = new Map();
    for (const rec of monthlyRecords) {
        if (rec.fgItem) {
            monthlyMap.set(rec.fgItem.toString(), rec);
        }
    }

    // Fetch FG Stock Transactions for the current month
    const StockTransaction = req.getModel('StockTransaction', stockTransactionSchema);
    const currentMonthTx = await StockTransaction.find({
      company: companyId,
      timestamp: { $gte: startOfMonth, $lte: endOfMonth },
      itemType: { $in: ["FGItem", "Component", "InHouse"] }
    }).lean();

    const txInwardMap = new Map();
    const txOutwardMap = new Map();

    for (const tx of currentMonthTx) {
      const qty = Number(tx.quantity || 0);
      if (qty > 0 && tx.item) {
        const itemKey = tx.item.toString();
        const nameKey = tx.itemName ? tx.itemName.toLowerCase().trim() : null;

        if (tx.movementType === "INWARD") {
          txInwardMap.set(itemKey, (txInwardMap.get(itemKey) || 0) + qty);
          if (nameKey) txInwardMap.set(nameKey, (txInwardMap.get(nameKey) || 0) + qty);
        } else if (tx.movementType === "OUTWARD") {
          txOutwardMap.set(itemKey, (txOutwardMap.get(itemKey) || 0) + qty);
          if (nameKey) txOutwardMap.set(nameKey, (txOutwardMap.get(nameKey) || 0) + qty);
        }
      }
    }

    const fgItemsWithMonthly = fgItems.map(item => {
        const itemIdStr = item._id.toString();
        const nameKey = item.name ? item.name.toLowerCase().trim() : null;

        const itemMonthly = monthlyMap.get(itemIdStr);
        const breakdown = reservedMap.get(itemIdStr) || [];
        const totalReservedFromBreakdown = breakdown.reduce((acc, curr) => acc + curr.reservedQuantity, 0);
        const stock = Number(item.quantity || 0);
        const hasTransactions = stock > 0 || totalReservedFromBreakdown > 0 || Boolean(item.hasTransactions);

        const txInward = txInwardMap.get(itemIdStr) || (nameKey && txInwardMap.get(nameKey)) || 0;
        const txOutward = txOutwardMap.get(itemIdStr) || (nameKey && txOutwardMap.get(nameKey)) || 0;

        const totalInward = Math.max(itemMonthly?.totalInwardQuantity || 0, txInward);
        const totalOutward = Math.max(itemMonthly?.totalOutwardQuantity || 0, txOutward);

        return {
            ...item,
            quantity: stock,
            currentStock: stock,
            hasTransactions,
            status: item.status || (item.isActive === false ? 'Inactive' : 'Active'),
            isActive: item.isActive !== false && item.status !== 'Inactive' && item.status !== 'Deactivated',
            allocatedQuantity: totalReservedFromBreakdown || item.allocatedQuantity || 0,
            reservedBreakdown: breakdown,
            monthlyData: {
                openingStock: itemMonthly?.openingStock || 0,
                totalInwardQuantity: totalInward,
                totalOutwardQuantity: totalOutward,
                received: totalInward,
                issued: totalOutward
            }
        };
    });

    res.status(200).json({ fgItems: fgItemsWithMonthly, count: fgItemsWithMonthly.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateFGItem = async (req, res) => {
  try {
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;
    
    let { name, code, type, description, location, unit, bom, revisionNumber, reorderLevel, hsnCode } = req.body;

    let updateData = { name, code, type, description, revisionNumber };
    if (unit !== undefined) updateData.unit = (unit || "Nos").toString().trim();
    if (hsnCode !== undefined) updateData.hsnCode = (hsnCode || "").toString().trim();

    if (reorderLevel !== undefined) {
      updateData.reorderLevel = isNaN(Number(reorderLevel)) ? 0 : Number(reorderLevel);
    }

    if (location !== undefined) {
      updateData.location = (location && mongoose.Types.ObjectId.isValid(location)) ? location : null;
    }

    // Parse bom if it's a string
    if (typeof bom === 'string') {
      try { bom = JSON.parse(bom); } catch(e) { console.error("Failed to parse bom", e); }
    }
    if (Array.isArray(bom)) {
      updateData.bom = bom.filter(b => b && b.item && mongoose.Types.ObjectId.isValid(b.item)).map(b => ({
        itemType: b.itemType || 'RawMaterial',
        item: b.item,
        itemName: b.itemName || '',
        quantity: Number(b.quantity) || 1,
        unit: b.unit || 'Nos'
      }));
    }
    
    // Handle photo uploads
    let filesToUpload = [];
    if (Array.isArray(req.files)) {
      filesToUpload = req.files;
    } else if (req.files && req.files['photos']) {
      filesToUpload = req.files['photos'];
    }

    if (filesToUpload.length > 0) {
      const photoUrls = [];
      for (const file of filesToUpload) {
        try {
          const uploadResult = await uploadOnS3(file.path, "fg-items", companyId);
          if (uploadResult) photoUrls.push(uploadResult.secure_url);
        } catch (e) { console.error("Photo upload error", e); }
      }
      updateData.photos = photoUrls;
    }

    const { userId, userName } = getUserAudit(req);
    updateData.updatedBy = userId;
    updateData.updatedByName = userName;

    // Pre-validate compound uniqueness if name or revisionNumber is changed
    if (name !== undefined || revisionNumber !== undefined) {
      const currentItem = await FGItem.findOne({ _id: id, company: companyId }).lean();
      if (!currentItem) return res.status(404).json({ message: "FG Item not found" });

      const finalName = name !== undefined ? name : currentItem.name;
      const finalRev = revisionNumber !== undefined ? revisionNumber : (currentItem.revisionNumber || "");

      const uniqueness = await validateMasterUniqueness({
        Model: FGItem,
        companyId,
        excludeId: id,
        name: finalName,
        revisionNumber: finalRev,
        masterLabel: "FG Item"
      });
      if (uniqueness.isDuplicate) {
        return res.status(400).json({ message: uniqueness.message });
      }
    }

    // Clean up undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const fgItem = await FGItem.findOneAndUpdate(
      { _id: id, company: companyId },
      updateData,
      { new: true }
    );

    if (!fgItem) return res.status(404).json({ message: "FG Item not found" });

    res.status(200).json({ message: "FG Item updated successfully", fgItem });
  } catch (error) {
    console.error("updateFGItem error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        message: formatDuplicateKeyError(error, { masterLabel: "FG Item", cleanName: req.body?.name, cleanRev: req.body?.revisionNumber })
      });
    }
    res.status(500).json({ message: error.message || "Failed to update FG Item" });
  }
};

export const deleteFGItem = async (req, res) => {
  try {
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const fgItem = await FGItem.findOneAndDelete({ _id: id, company: companyId });
    if (!fgItem) return res.status(404).json({ message: "FG Item not found" });

    res.status(200).json({ message: "FG Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
