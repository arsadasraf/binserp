import mongoose from "mongoose";
import { fgItemSchema, fgInventoryMonthlySchema, categorySchema, locationSchema, customerSchema, rmBoItemSchema, rawMaterialSchema, boughtOutSchema, storeOrderFulfillmentSchema, storePrefixSchema, stockTransactionSchema, inventorySchema } from "../../models/store/index.js";
import { salesOrderSchema, priceListSchema } from "../../models/sales/index.js";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { recalculateMRPWithLatestBOM } from "../purchase/mrpPlan.controller.js";
import { uploadOnS3 } from "../../utils/s3.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";
import { validateMasterUniqueness, formatDuplicateKeyError } from "../../utils/duplicateValidator.helper.js";
import { checkItemHasTransactions, checkItemStockForDeactivation } from "../../utils/itemLifecycleValidator.helper.js";
import { resolveBackendUomRatios } from "../../utils/dualUomHelper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

/**
 * Resolves canonical master units for BOM components by looking up their underlying master documents
 */
const resolveBomComponentUnits = async (req, bomList) => {
  if (!Array.isArray(bomList) || bomList.length === 0) return [];

  const componentIds = bomList
    .filter(b => b && b.item && mongoose.Types.ObjectId.isValid(b.item))
    .map(b => b.item);

  const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
  const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
  const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
  const FGItem = req.getModel('FGItem', fgItemSchema);

  const [rms, bos, rmBos, fgs] = await Promise.all([
    RawMaterial.find({ _id: { $in: componentIds } }).select('_id unit hasSecondaryUnit secondaryUnit conversionFactor').lean().catch(() => []),
    BoughtOut.find({ _id: { $in: componentIds } }).select('_id unit hasSecondaryUnit secondaryUnit conversionFactor').lean().catch(() => []),
    RmBoItem.find({ _id: { $in: componentIds } }).select('_id unit hasSecondaryUnit secondaryUnit conversionFactor').lean().catch(() => []),
    FGItem.find({ _id: { $in: componentIds } }).select('_id unit hasSecondaryUnit secondaryUnit conversionFactor').lean().catch(() => [])
  ]);

  const compMap = new Map();
  [...rms, ...bos, ...rmBos, ...fgs].forEach(item => {
    if (item && item._id) compMap.set(item._id.toString(), item);
  });

  return bomList.filter(b => b && b.item && mongoose.Types.ObjectId.isValid(b.item)).map(b => {
    const normType = b.itemType || 'RawMaterial';
    const isRM = normType === 'RawMaterial' || normType === 'Material';
    const defaultUom = isRM ? 'KG' : 'NOS';
    const masterComp = compMap.get(b.item.toString());
    const canonicalUom = (masterComp?.unit || b.unit || defaultUom).toString().trim();
    const hasSec = Boolean(masterComp?.hasSecondaryUnit ?? b.hasSecondaryUnit);
    const secUnit = (masterComp?.secondaryUnit ?? b.secondaryUnit ?? '').toString().trim();
    const factor = Number(masterComp?.conversionFactor ?? b.conversionFactor) || 1;
    const priQty = Number(b.quantity) || 1;
    const secQty = b.secondaryQuantity !== undefined && b.secondaryQuantity !== null && b.secondaryQuantity !== ''
      ? Number(b.secondaryQuantity)
      : (hasSec && secUnit && factor > 0 ? Number((priQty * factor).toFixed(4)) : undefined);

    const isSecSelected = Boolean(hasSec && secUnit && b.selectedUnit && b.selectedUnit.toString().trim().toUpperCase() === secUnit.toUpperCase());
    const isSecByQty = Boolean(!isSecSelected && hasSec && secUnit && b.inputQuantity !== undefined && secQty !== undefined && Math.abs(Number(b.inputQuantity) - secQty) < 0.0001 && Math.abs(Number(b.inputQuantity) - priQty) > 0.0001);
    const resolvedSelectedUnit = (isSecSelected || isSecByQty)
      ? secUnit
      : (b.selectedUnit && b.selectedUnit.toString().trim().toUpperCase() === canonicalUom.toUpperCase() ? canonicalUom : (b.selectedUnit ? b.selectedUnit.toString().trim() : canonicalUom));
    const resolvedInputQty = b.inputQuantity !== undefined && b.inputQuantity !== null && b.inputQuantity !== ''
      ? Number(b.inputQuantity)
      : ((isSecSelected || isSecByQty) && secQty !== undefined ? secQty : priQty);

    return {
      itemType: normType,
      item: b.item,
      itemName: b.itemName || '',
      quantity: priQty,
      unit: canonicalUom,
      hasSecondaryUnit: hasSec,
      secondaryUnit: secUnit,
      conversionFactor: factor,
      primaryRatio: Number(masterComp?.primaryRatio ?? b.primaryRatio) || 1,
      secondaryRatio: Number(masterComp?.secondaryRatio ?? b.secondaryRatio) || 1,
      secondaryQuantity: secQty,
      selectedUnit: resolvedSelectedUnit,
      inputQuantity: resolvedInputQty,
      fgType: b.fgType,
      itemClassification: b.itemClassification
    };
  });
};

export const createFGItem = async (req, res) => {
  try {
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const companyId = getCompanyId(req);
    const { userId, userName } = getUserAudit(req);
    let { name, code, type, description, location, category, categoryId, unit, bom, revisionNumber, reorderLevel, hsnCode, hasSecondaryUnit, secondaryUnit, conversionFactor, primaryRatio, secondaryRatio } = req.body;

    const uomRatios = resolveBackendUomRatios({ hasSecondaryUnit, secondaryUnit, conversionFactor, primaryRatio, secondaryRatio });
    const parsedHasSecondary = uomRatios.hasSecondaryUnit;
    const parsedSecondaryUnit = uomRatios.secondaryUnit;
    const parsedConversionFactor = uomRatios.conversionFactor;
    const parsedPrimaryRatio = uomRatios.primaryRatio;
    const parsedSecondaryRatio = uomRatios.secondaryRatio;

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
      cleanedBom = await resolveBomComponentUnits(req, bom);
    }

    const validLocation = (location && mongoose.Types.ObjectId.isValid(location)) ? location : undefined;
    const validCategory = (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) 
      ? categoryId 
      : ((category && mongoose.Types.ObjectId.isValid(category)) ? category : undefined);

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
      category: validCategory,
      categoryId: validCategory,
      unit: (unit && unit.toString().trim()) || "NOS",
      hasSecondaryUnit: parsedHasSecondary,
      secondaryUnit: parsedSecondaryUnit,
      conversionFactor: parsedConversionFactor,
      primaryRatio: parsedPrimaryRatio,
      secondaryRatio: parsedSecondaryRatio,
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
      .populate('category', 'name code unit')
      .populate('categoryId', 'name code unit')
      .populate('bom.item', 'name componentName code componentCode unit rate descriptions description type hasSecondaryUnit secondaryUnit conversionFactor') 
      .sort({ createdAt: -1 })
      .lean();

    // Fetch active Sales Price List to ensure sellingPrice & currency are up to date
    const PriceList = req.getModel('PriceList', priceListSchema);
    const priceLists = await PriceList.find({ company: companyId }).lean().catch(() => []);
    const priceListMap = new Map();
    priceLists.forEach(pl => {
      if (pl.fgItem) priceListMap.set(pl.fgItem.toString(), pl);
    });

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

        const matchedPL = priceListMap.get(itemIdStr);
        const resolvedSellingPrice = Number(item.sellingPrice || matchedPL?.price || 0);
        const resolvedTaxRate = Number(item.taxRate != null ? item.taxRate : (matchedPL?.taxRate != null ? matchedPL.taxRate : 18));
        const resolvedCurrency = (item.currency || matchedPL?.currency || 'INR').trim().toUpperCase();

        const sanitizedBom = Array.isArray(item.bom) ? item.bom.map(b => {
            const isRM = b.itemType === 'RawMaterial' || b.itemType === 'Material';
            const canonicalUnit = isRM ? 'KG' : 'NOS';
            const masterUnit = (typeof b.item === 'object' && b.item !== null) ? b.item.unit : null;
            const finalUnit = (masterUnit || b.unit || canonicalUnit).toString().trim();
            const secUnit = ((typeof b.item === 'object' && b.item !== null ? b.item.secondaryUnit : '') || b.secondaryUnit || '').toString().trim();
            const hasSec = Boolean((typeof b.item === 'object' && b.item !== null ? b.item.hasSecondaryUnit : false) || b.hasSecondaryUnit);
            const priQty = Number(b.quantity) || 1;
            const secQty = b.secondaryQuantity !== undefined && b.secondaryQuantity !== null && b.secondaryQuantity !== '' ? Number(b.secondaryQuantity) : undefined;

            // Preserve secondary unit if selectedUnit matches secUnit (case-insensitive & trimmed)
            const isSecSelected = Boolean(hasSec && secUnit && b.selectedUnit && b.selectedUnit.toString().trim().toUpperCase() === secUnit.toUpperCase());
            // Smart recovery for legacy records where selectedUnit was corrupted but inputQuantity matches secondaryQuantity
            const isSecByQty = Boolean(!isSecSelected && hasSec && secUnit && b.inputQuantity !== undefined && secQty !== undefined && Math.abs(Number(b.inputQuantity) - secQty) < 0.0001 && Math.abs(Number(b.inputQuantity) - priQty) > 0.0001);

            const resolvedSelUnit = (isSecSelected || isSecByQty)
                ? secUnit
                : (b.selectedUnit && b.selectedUnit.toString().trim().toUpperCase() === finalUnit.toUpperCase() ? finalUnit : (b.selectedUnit ? b.selectedUnit.toString().trim() : finalUnit));

            return {
                ...b,
                unit: finalUnit,
                secondaryUnit: secUnit,
                hasSecondaryUnit: hasSec,
                selectedUnit: resolvedSelUnit
            };
        }) : [];

        return {
            ...item,
            bom: sanitizedBom,
            quantity: stock,
            currentStock: stock,
            sellingPrice: resolvedSellingPrice,
            taxRate: resolvedTaxRate,
            currency: resolvedCurrency,
            salesPriceListPrice: matchedPL ? Number(matchedPL.price || 0) : undefined,
            salesPriceListCurrency: matchedPL ? matchedPL.currency : undefined,
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
    
    let { name, code, type, description, location, category, categoryId, unit, bom, revisionNumber, reorderLevel, hsnCode, hasSecondaryUnit, secondaryUnit, conversionFactor, primaryRatio, secondaryRatio } = req.body;

    let updateData = { name, code, type, description, revisionNumber };
    if (unit && unit.toString().trim()) {
      updateData.unit = unit.toString().trim();
    }
    if (hsnCode !== undefined) updateData.hsnCode = (hsnCode || "").toString().trim();

    const currentDoc = await FGItem.findOne({ _id: id, company: companyId }).lean();
    if (!currentDoc) return res.status(404).json({ message: "FG Item not found" });

    if (hasSecondaryUnit !== undefined || secondaryUnit !== undefined || conversionFactor !== undefined || primaryRatio !== undefined || secondaryRatio !== undefined) {
      const uomRatios = resolveBackendUomRatios({
        hasSecondaryUnit: hasSecondaryUnit !== undefined ? hasSecondaryUnit : currentDoc?.hasSecondaryUnit,
        secondaryUnit: secondaryUnit !== undefined ? secondaryUnit : currentDoc?.secondaryUnit,
        conversionFactor: conversionFactor !== undefined ? conversionFactor : currentDoc?.conversionFactor,
        primaryRatio: primaryRatio !== undefined ? primaryRatio : currentDoc?.primaryRatio,
        secondaryRatio: secondaryRatio !== undefined ? secondaryRatio : currentDoc?.secondaryRatio,
        unit: unit !== undefined ? unit : currentDoc?.unit
      });
      updateData.hasSecondaryUnit = uomRatios.hasSecondaryUnit;
      updateData.secondaryUnit = uomRatios.secondaryUnit;
      updateData.conversionFactor = uomRatios.conversionFactor;
      updateData.primaryRatio = uomRatios.primaryRatio;
      updateData.secondaryRatio = uomRatios.secondaryRatio;
    }

    if (reorderLevel !== undefined) {
      updateData.reorderLevel = isNaN(Number(reorderLevel)) ? 0 : Number(reorderLevel);
    }

    if (location !== undefined) {
      updateData.location = (location && mongoose.Types.ObjectId.isValid(location)) ? location : null;
    }

    if (category !== undefined || categoryId !== undefined) {
      const validCategory = (categoryId && mongoose.Types.ObjectId.isValid(categoryId))
        ? categoryId
        : ((category && mongoose.Types.ObjectId.isValid(category)) ? category : null);
      updateData.category = validCategory;
      updateData.categoryId = validCategory;
    }

    // Parse bom if it's a string
    if (typeof bom === 'string') {
      try { bom = JSON.parse(bom); } catch(e) { console.error("Failed to parse bom", e); }
    }
    if (Array.isArray(bom)) {
      updateData.bom = await resolveBomComponentUnits(req, bom);
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
      const finalName = name !== undefined ? name : currentDoc.name;
      const finalRev = revisionNumber !== undefined ? revisionNumber : (currentDoc.revisionNumber || "");

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

    // Lifecycle check: if deactivating/inactivating
    const isDeactivating = req.body.status === 'Inactive' || req.body.status === 'Deactivated' || req.body.isActive === false;
    if (isDeactivating) {
      const checkResult = await checkItemStockForDeactivation({
        req,
        companyId,
        itemId: id,
        itemName: currentDoc?.name || req.body.name,
        itemCode: currentDoc?.code || req.body.code,
        itemType: 'fg'
      });
      if (!checkResult.canDeactivate) {
        return res.status(400).json({ message: checkResult.message });
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

    // Sync to Inventory for FG item
    try {
      const Inventory = req.getModel('Inventory', inventorySchema);
      const invUpdates = {};
      if (updateData.name) invUpdates.materialName = updateData.name.toString().trim();
      if (updateData.unit) invUpdates.unit = updateData.unit.toString().trim();
      if (updateData.reorderLevel !== undefined) invUpdates.reorderLevel = Number(updateData.reorderLevel);
      if (updateData.hasSecondaryUnit !== undefined) invUpdates.hasSecondaryUnit = updateData.hasSecondaryUnit;
      if (updateData.secondaryUnit !== undefined) invUpdates.secondaryUnit = updateData.secondaryUnit;
      if (updateData.conversionFactor !== undefined) invUpdates.conversionFactor = updateData.conversionFactor;
      if (updateData.primaryRatio !== undefined) invUpdates.primaryRatio = updateData.primaryRatio;
      if (updateData.secondaryRatio !== undefined) invUpdates.secondaryRatio = updateData.secondaryRatio;

      if (Object.keys(invUpdates).length > 0) {
        const idMatches = [{ materialId: id }];
        if (mongoose.Types.ObjectId.isValid(id)) {
          idMatches.push({ materialId: new mongoose.Types.ObjectId(id) });
        }
        if (fgItem.code) {
          idMatches.push({ materialCode: fgItem.code });
        }
        if (fgItem.name) {
          idMatches.push({ materialName: fgItem.name });
        }
        if (currentDoc?.name && currentDoc.name !== fgItem.name) {
          idMatches.push({ materialName: currentDoc.name });
        }

        await Inventory.updateMany(
          { company: companyId, $or: idMatches },
          { $set: invUpdates }
        );
      }
    } catch (invErr) {
      console.warn("Inventory sync error on updateFGItem:", invErr.message);
    }

    // If BOM was modified, automatically sync all active MRP plans referencing this FG item
    if (Array.isArray(bom)) {
      try {
        const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
        const linkedPlans = await MRPPlan.find({
          company: companyId,
          status: { $in: ["Planned", "In Procurement", "Draft", "Partially Completed"] },
          $or: [
            { "fgItems.fgItem": id },
            { "fgItems.fgItemCode": fgItem.code },
            { "fgItems.fgItemName": fgItem.name },
            { "fgItems.nestedMaterials.materialName": fgItem.name },
            { "fgItems.nestedMaterials.materialCode": fgItem.code },
            { "subAssemblyRequirements.material": id },
            { "subAssemblyRequirements.materialName": fgItem.name },
            { "subAssemblyRequirements.materialCode": fgItem.code }
          ]
        });

        for (const plan of linkedPlans) {
          await recalculateMRPWithLatestBOM(plan, req).catch((err) => {
            console.warn(`Auto-sync MRP Plan ${plan.mrpNumber} failed:`, err);
          });
        }
      } catch (syncErr) {
        console.warn("Auto-syncing linked MRP plans failed:", syncErr);
      }
    }

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

    const existing = await FGItem.findOne({ _id: id, company: companyId }).lean();
    if (!existing) return res.status(404).json({ message: "FG Item not found" });

    // 1. Transaction Check: Items with transactions CANNOT be deleted
    const txCheck = await checkItemHasTransactions({
      req,
      companyId,
      itemId: id,
      itemName: existing.name,
      itemCode: existing.code
    });
    if (txCheck.hasTransactions) {
      return res.status(400).json({ message: txCheck.message });
    }

    // 2. Stock Check: Cannot delete if stock exists
    const stockCheck = await checkItemStockForDeactivation({
      req,
      companyId,
      itemId: id,
      itemName: existing.name,
      itemCode: existing.code,
      itemType: 'fg'
    });
    if (!stockCheck.canDeactivate) {
      return res.status(400).json({ 
        message: `Cannot delete "${existing.name}": Stock is still present (Warehouse Stock: ${stockCheck.mainStoreStock} ${stockCheck.unit}, WIP: ${stockCheck.wipStock} ${stockCheck.unit}). Please clear all inventory first.` 
      });
    }

    await FGItem.findOneAndDelete({ _id: id, company: companyId });
    res.status(200).json({ message: "FG Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
