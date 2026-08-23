import { updateInventoryStock } from './updateInventoryStock.controller.js';
import mongoose from "mongoose";
import { 
  grnSchema, 
  vendorSchema, 
  customerSchema, 
  locationSchema, 
  categorySchema, 
  rmBoItemSchema, 
  rawMaterialSchema, 
  boughtOutSchema, 
  consumableItemSchema, 
  rmInventoryMonthlySchema, 
  fgInventoryMonthlySchema, 
  fgItemSchema 
} from "../../models/store/index.js";
import { purchaseOrderSchema, mrpPlanSchema } from "../../models/purchase/index.js";
import { componentSchema } from "../../models/ppc/index.js";
import { uploadOnS3 } from "../../utils/s3.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

export const createGRN = async (req, res) => {
  const GRN = req.getModel('GRN', grnSchema);
  const Vendor = req.getModel('Vendor', vendorSchema);
  const Customer = req.getModel('Customer', customerSchema);
  const Material = req.getModel('RmBoItem', rmBoItemSchema);
  const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
  const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
  const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
  const FGItem = req.getModel('FGItem', fgItemSchema);
  const Component = req.getModel('Component', componentSchema);

  try {
    const companyId = getCompanyId(req);
    const { userId, userName } = getUserAudit(req);
    let { 
      grnNumber, 
      date, 
      supplier, 
      customer, 
      type, 
      material, 
      quantity, 
      status, 
      items, 
      poReference, 
      purchaseOrder, 
      mrpPlan,
      mrpNumber,
      qcRequired 
    } = req.body;

    // Parse qcRequired explicitly
    if (qcRequired === 'true') qcRequired = true;
    else if (qcRequired === 'false') qcRequired = false;
    else qcRequired = !!qcRequired;

    // Normalize type
    const normalizedType = (type || 'rm').toLowerCase();
    const isFG = normalizedType === 'inhouse' || normalizedType === 'fg';
    const isConsumable = normalizedType === 'consumable';
    const isBO = normalizedType === 'bo' || normalizedType === 'bought-out';
    const isRM = normalizedType === 'rm' || normalizedType === 'raw-material';

    status = status || "Received";

    if (!grnNumber) {
      return res.status(400).json({ message: "GRN number is required" });
    }

    let supplierName = "";
    let supplierAddress = "";

    const rawSupplierId = typeof supplier === 'object' && supplier !== null 
      ? (supplier._id || supplier.id) 
      : (supplier && supplier !== 'undefined' && supplier !== 'null' ? supplier : null);

    const rawCustomerId = typeof customer === 'object' && customer !== null 
      ? (customer._id || customer.id) 
      : (customer && customer !== 'undefined' && customer !== 'null' ? customer : null);

    if (isFG) {
      if (rawCustomerId && isValidObjectId(rawCustomerId.toString())) {
        const customerData = await Customer.findOne({ _id: rawCustomerId, company: companyId });
        if (customerData) {
          supplierName = customerData.name || "";
          supplierAddress = customerData.address || "";
        }
      }
    } else {
      if (!rawSupplierId) {
        return res.status(400).json({ message: "Supplier / Vendor is required" });
      }
      if (isValidObjectId(rawSupplierId.toString())) {
        const vendorData = await Vendor.findOne({ _id: rawSupplierId, company: companyId });
        if (vendorData) {
          supplierName = vendorData.name || "";
          supplierAddress = vendorData.address || "";
        }
      }
    }

    // Handle PDF upload if provided
    let pdfUrl = null;
    if (req.files && req.files['pdf'] && req.files['pdf'][0]) {
      try {
        const uploadResult = await uploadOnS3(req.files['pdf'][0].path, "grn/pdf", getCompanyLoginId(req));
        if (uploadResult) {
          pdfUrl = uploadResult.secure_url;
        }
      } catch (uploadError) {
        console.error("PDF upload error:", uploadError);
      }
    }

    // Handle photo uploads if provided
    const photoUrls = [];
    if (req.files && req.files['photos'] && req.files['photos'].length > 0) {
      try {
        for (const file of req.files['photos']) {
          const uploadResult = await uploadOnS3(file.path, "grn/photos", companyId);
          if (uploadResult) {
            photoUrls.push(uploadResult.secure_url);
          }
        }
      } catch (uploadError) {
        console.error("Photo upload error:", uploadError);
      }
    }

    // Handle items array
    let itemsArray = [];
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        console.error("Failed to parse items JSON in createGRN:", e);
      }
    }

    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        let itemName = item.materialName || item.name || '';
        let componentId = null;
        let materialId = null;
        let consumableId = null;
        let fgItemId = null;
        let itemUnit = item.unit || "PCS";
        let itemLocationId = item.locationId || null;

        const targetId = item.material || item.consumable || item.fgItem || item.component || item._id;
        const validId = targetId && isValidObjectId(targetId.toString()) ? targetId.toString() : null;

        if (isConsumable) {
          // Consumable item
          let doc = null;
          if (validId) doc = await ConsumableItem.findOne({ _id: validId, company: companyId });
          if (!doc && itemName) {
            doc = await ConsumableItem.findOne({ company: companyId, name: itemName });
          }

          if (doc) {
            consumableId = doc._id;
            materialId = doc._id;
            itemName = doc.name;
            itemUnit = doc.unit || itemUnit;
            itemLocationId = doc.locationId || itemLocationId;
          } else {
            consumableId = validId;
            materialId = validId;
          }
        } else if (isFG) {
          // Finished Goods / Component
          let doc = null;
          if (validId) {
            doc = await FGItem.findOne({ _id: validId, company: companyId });
            if (!doc) doc = await Component.findOne({ _id: validId, company: companyId });
          }
          if (!doc && itemName) {
            doc = await FGItem.findOne({ company: companyId, name: itemName });
            if (!doc) doc = await Component.findOne({ company: companyId, name: itemName });
          }

          if (doc) {
            fgItemId = doc._id;
            componentId = doc._id;
            materialId = doc._id;
            itemName = doc.name || doc.componentName || itemName;
            itemUnit = doc.unit || "Nos";
          } else {
            fgItemId = validId;
            componentId = validId;
            materialId = validId;
          }
        } else {
          // RM or BO Material
          let doc = null;
          if (validId) {
            if (isRM) doc = await RawMaterial.findOne({ _id: validId, company: companyId });
            else if (isBO) doc = await BoughtOut.findOne({ _id: validId, company: companyId });
            if (!doc) doc = await Material.findOne({ _id: validId, company: companyId });
          }
          if (!doc && itemName) {
            if (isRM) doc = await RawMaterial.findOne({ company: companyId, name: itemName });
            else if (isBO) doc = await BoughtOut.findOne({ company: companyId, name: itemName });
            if (!doc) doc = await Material.findOne({ company: companyId, name: itemName });
          }

          if (doc) {
            materialId = doc._id;
            itemName = doc.name;
            itemUnit = doc.unit || itemUnit;
            itemLocationId = doc.locationId || itemLocationId;
          } else {
            materialId = validId;
          }
        }

        const qty = parseFloat(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ message: "Valid quantity is required for each item" });
        }

        itemsArray.push({
          material: materialId || undefined,
          consumable: consumableId || undefined,
          fgItem: fgItemId || undefined,
          component: componentId || undefined,
          materialName: itemName || 'Received Item',
          description: item.description || item.descriptions || undefined,
          quantity: qty,
          unit: itemUnit,
          locationId: itemLocationId || undefined,
          receivedQuantity: qty,
          acceptedQuantity: qcRequired ? 0 : qty,
          rate: parseFloat(item.rate) || 0,
        });
      }
    } else if (material && quantity) {
      // Single material fallback
      const qty = parseFloat(quantity);
      itemsArray.push({
        material: isValidObjectId(material.toString()) ? material : undefined,
        materialName: req.body.materialName || 'Material Item',
        description: req.body.description || req.body.descriptions || undefined,
        quantity: qty,
        unit: req.body.unit || 'PCS',
        locationId: req.body.locationId || undefined,
        receivedQuantity: qty,
        acceptedQuantity: qcRequired ? 0 : qty,
        rate: parseFloat(req.body.rate) || 0,
      });
    }

    if (itemsArray.length === 0) {
      return res.status(400).json({ message: "At least one item is required for GRN" });
    }

    const grn = await GRN.create({
      company: companyId,
      type: normalizedType,
      grnNumber,
      date: date || new Date(),
      supplier: rawSupplierId && isValidObjectId(rawSupplierId.toString()) ? rawSupplierId : undefined,
      supplierName: supplierName || undefined,
      supplierAddress: supplierAddress || undefined,
      customer: rawCustomerId && isValidObjectId(rawCustomerId.toString()) ? rawCustomerId : undefined,
      purchaseOrder: purchaseOrder && isValidObjectId(purchaseOrder.toString()) ? purchaseOrder : undefined,
      poNumber: poReference || "",
      poReference: poReference || "",
      mrpPlan: mrpPlan && isValidObjectId(mrpPlan.toString()) ? mrpPlan : undefined,
      mrpNumber: mrpNumber || "",
      items: itemsArray,
      pdf: pdfUrl,
      photos: photoUrls,
      receivedBy: userId,
      status: status || "Received",
      qcRequired: qcRequired || false,
      qcStatus: qcRequired ? "Pending" : "Skipped",
      createdBy: userId,
      createdByName: userName,
      updatedBy: userId,
      updatedByName: userName
    });

    // Update Linked Purchase Order Item Quantities & Status if linked
    if (purchaseOrder || poReference) {
      try {
        const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);
        const poQuery = purchaseOrder && isValidObjectId(purchaseOrder.toString())
          ? { _id: purchaseOrder, company: companyId } 
          : { poNumber: poReference, company: companyId };
        
        const poDoc = await PurchaseOrder.findOne(poQuery);
        if (poDoc && Array.isArray(poDoc.items) && poDoc.items.length > 0) {
          let poUpdated = false;
          let allItemsCompleted = true;
          let anyItemReceived = false;

          poDoc.items.forEach(poItem => {
            const matchingGrnItem = itemsArray.find(gItem => 
              (gItem.material && poItem.material && gItem.material.toString() === poItem.material.toString()) ||
              (gItem.materialName && poItem.materialName && gItem.materialName.toLowerCase().trim() === poItem.materialName.toLowerCase().trim())
            );

            if (matchingGrnItem) {
              const addedQty = parseFloat(matchingGrnItem.quantity || matchingGrnItem.receivedQuantity || 0);
              poItem.receivedQuantity = (poItem.receivedQuantity || 0) + addedQty;
              poItem.pendingQuantity = Math.max(0, (poItem.quantity || 0) - poItem.receivedQuantity);
              if (poItem.receivedQuantity >= poItem.quantity) {
                poItem.itemStatus = "Completed";
              } else if (poItem.receivedQuantity > 0) {
                poItem.itemStatus = "Partially Received";
              }
              poUpdated = true;
            }

            if ((poItem.receivedQuantity || 0) < (poItem.quantity || 0)) {
              allItemsCompleted = false;
            }
            if ((poItem.receivedQuantity || 0) > 0) {
              anyItemReceived = true;
            }
          });

          if (poUpdated) {
            if (allItemsCompleted) poDoc.status = "Completed";
            else if (anyItemReceived) poDoc.status = "Partially Received";
            await poDoc.save();
          }
        }
      } catch (poErr) {
        console.error("Error updating linked purchase order from GRN:", poErr);
      }
    }

    // Update Linked Purchase MRP Plan Item Quantities & Status if linked (FG / InHouse)
    if (isFG && (mrpPlan || mrpNumber)) {
      try {
        const MRPPlan = req.getModel('MRPPlan', mrpPlanSchema);
        const planQuery = mrpPlan && isValidObjectId(mrpPlan.toString())
          ? { _id: mrpPlan, company: companyId } 
          : { mrpNumber: mrpNumber, company: companyId };
        
        const planDoc = await MRPPlan.findOne(planQuery);
        if (planDoc && Array.isArray(planDoc.fgItems) && planDoc.fgItems.length > 0) {
          let planUpdated = false;
          let allItemsCompleted = true;
          let anyItemReceived = false;

          planDoc.fgItems.forEach(fgItem => {
            const matchingGrnItem = itemsArray.find(gItem => 
              (gItem.material && fgItem.fgItem && gItem.material.toString() === fgItem.fgItem.toString()) ||
              (gItem.fgItem && fgItem.fgItem && gItem.fgItem.toString() === fgItem.fgItem.toString()) ||
              (gItem.materialName && fgItem.fgItemName && gItem.materialName.toLowerCase().trim() === fgItem.fgItemName.toLowerCase().trim())
            );

            if (matchingGrnItem) {
              const addedQty = parseFloat(matchingGrnItem.quantity || matchingGrnItem.receivedQuantity || 0);
              fgItem.receivedQuantity = (fgItem.receivedQuantity || 0) + addedQty;
              planUpdated = true;
            }

            const itemReceived = fgItem.receivedQuantity || 0;
            const itemTarget = fgItem.quantity || 0;
            if (itemReceived < itemTarget) {
              allItemsCompleted = false;
            }
            if (itemReceived > 0) {
              anyItemReceived = true;
            }
          });

          if (planUpdated) {
            if (allItemsCompleted) {
              planDoc.status = "Completed";
            } else if (anyItemReceived) {
              planDoc.status = "Partially Completed";
            }
            await planDoc.save();
          }
        }
      } catch (mrpErr) {
        console.error("Error updating linked MRP Plan from GRN:", mrpErr);
      }
    }

    // Auto-update inventory (RM, BO, Consumables)
    if (!isFG && (status === "Accepted" || status === "Received" || !status)) {
      try {
        const currentDate = new Date();
        const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);

        let itemTypeOption = "RawMaterial";
        if (isBO) itemTypeOption = "BoughtOut";
        else if (isConsumable) itemTypeOption = "Consumable";
        else if (isRM) itemTypeOption = "RawMaterial";

        for (const item of itemsArray) {
          if (item.material) {
            await updateInventoryStock(
              req,
              item.material,
              parseFloat(item.quantity),
              item.unit,
              item.locationId,
              {
                isPending: !!qcRequired,
                itemType: itemTypeOption,
                transactionCategory: qcRequired ? "GRN_QC_PENDING_INWARD" : "GRN_PURCHASE_INWARD",
                referenceDocType: "GRN",
                referenceDocId: grn._id,
                referenceDocNumber: grnNumber,
                recipientOrSource: supplierName || "Supplier",
                purpose: `Goods Receipt Note (${itemTypeOption})`,
                performedBy: userId,
                performedByName: userName
              }
            );

            try {
              await RMInventoryMonthly.findOneAndUpdate(
                { company: companyId, material: item.material, month: currentMonthStr },
                { $inc: { totalInwardQuantity: parseFloat(item.quantity) } },
                { new: true, upsert: true }
              );
            } catch (monthlyErr) {
              console.error("Error updating RM monthly inward quantity:", monthlyErr);
            }
          }
        }
      } catch (err) {
        console.error("Error updating inventory in createGRN:", err);
      }
    }

    // Auto-update inventory for InHouse / FG
    if (isFG && (status === "Accepted" || status === "Received" || !status)) {
      try {
        const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);
        const currentDate = new Date();
        const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

        for (const item of itemsArray) {
          const compId = item.fgItem || item.component || item.material;
          const qty = parseFloat(item.quantity);
          if (compId && !isNaN(qty)) {
            await updateInventoryStock(
              req,
              compId,
              qty,
              item.unit || "PCS",
              item.locationId,
              {
                isPending: !!qcRequired,
                itemType: "FinishedGoods",
                transactionCategory: qcRequired ? "GRN_QC_PENDING_INWARD" : "GRN_PURCHASE_INWARD",
                referenceDocType: "GRN",
                referenceDocId: grn._id,
                referenceDocNumber: grnNumber,
                recipientOrSource: supplierName || "In-House Production",
                purpose: "Goods Receipt Note (Finished Goods)",
                performedBy: userId,
                performedByName: userName
              }
            );

            try {
              await FGInventoryMonthly.findOneAndUpdate(
                { company: companyId, fgItem: compId, month: currentMonthStr },
                { $inc: { totalInwardQuantity: qty } },
                { new: true, upsert: true }
              );
            } catch (monthlyErr) {
              console.error("Error updating FG monthly inward quantity:", monthlyErr);
            }
          }
        }
      } catch (invError) {
        console.error("Error updating FG stock in createGRN:", invError);
      }
    }

    res.status(201).json({ message: "GRN created successfully", grn });
  } catch (error) {
    console.error("GRN Creation Error:", error);
    res.status(500).json({
      message: error.message || "Failed to create GRN",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
};
