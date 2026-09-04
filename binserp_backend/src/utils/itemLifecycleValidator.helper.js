import mongoose from "mongoose";
import {
  inventorySchema,
  grnSchema,
  fgGRNSchema,
  materialIssueSchema,
  jobWorkSchema,
  bomSchema,
  materialRequestSchema,
  fgItemSchema
} from "../models/store/index.js";
import { purchaseOrderSchema } from "../models/purchase/index.js";
import { salesOrderSchema, deliveryChallanSchema, invoiceSchema } from "../models/sales/index.js";

const escapeRegex = (str) => {
  return (str || '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Check if an item is actively attached to any Finished Good's BOM.
 */
export const checkItemAttachedToBOM = async ({ req, companyId, itemId, itemName, itemCode }) => {
  try {
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const BOM = req.getModel("BOM", bomSchema);

    const cleanName = (itemName || '').toString().trim();
    const cleanCode = (itemCode || '').toString().trim();
    const cleanId = itemId ? itemId.toString() : null;

    const matchedFGs = new Set();

    // 1. Check FGItem's embedded BOM array
    const fgItemQuery = {
      company: companyId,
      isActive: { $ne: false },
      status: { $ne: 'Deactivated' }
    };

    const fgItemOrConditions = [];
    if (cleanId && mongoose.isValidObjectId(cleanId)) {
      fgItemOrConditions.push({ "bom.item": new mongoose.Types.ObjectId(cleanId) });
    }
    if (cleanName) {
      fgItemOrConditions.push({ "bom.itemName": { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') } });
    }

    if (fgItemOrConditions.length > 0) {
      fgItemQuery.$or = fgItemOrConditions;
      // Do not match the FG item itself if it's the one being checked
      if (cleanId) {
        fgItemQuery._id = { $ne: cleanId };
      }
      const activeFGs = await FGItem.find(fgItemQuery, { name: 1, code: 1, revisionNumber: 1 }).limit(10).lean();
      activeFGs.forEach(fg => {
        const rev = fg.revisionNumber ? ` (Rev ${fg.revisionNumber})` : '';
        matchedFGs.add(`${fg.name}${rev}`);
      });
    }

    // 2. Check dedicated BOM collection
    const bomQuery = {
      company: companyId,
      status: { $in: ['Active', 'Draft'] }
    };
    const bomOrConditions = [];
    if (cleanName) {
      bomOrConditions.push({ "items.materialName": { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') } });
    }
    if (cleanCode) {
      bomOrConditions.push({ "items.materialCode": { $regex: new RegExp(`^${escapeRegex(cleanCode)}$`, 'i') } });
    }

    if (bomOrConditions.length > 0) {
      bomQuery.$or = bomOrConditions;
      const activeBOMs = await BOM.find(bomQuery, { productName: 1, bomNumber: 1 }).limit(10).lean();
      activeBOMs.forEach(b => {
        matchedFGs.add(`${b.productName} [${b.bomNumber}]`);
      });
    }

    const fgList = Array.from(matchedFGs);
    if (fgList.length > 0) {
      return {
        isAttached: true,
        fgNames: fgList,
        message: `Cannot deactivate "${cleanName || 'this item'}": It is actively used in the BOM of Finished Good(s): ${fgList.join(', ')}. Please remove this component from active BOMs before deactivating.`
      };
    }

    return { isAttached: false, fgNames: [] };
  } catch (err) {
    console.error("checkItemAttachedToBOM error:", err);
    return { isAttached: false, fgNames: [] };
  }
};

/**
 * Check if an item has any historical or active transactions.
 * Brand new items with 0 transactions can be deleted.
 * Items with transactions CANNOT be deleted; they can only be edited or deactivated.
 */
export const checkItemHasTransactions = async ({ req, companyId, itemId, itemName, itemCode }) => {
  try {
    const cleanName = (itemName || '').toString().trim();
    const cleanCode = (itemCode || '').toString().trim();
    const cleanId = itemId ? itemId.toString() : null;
    const isObjId = cleanId && mongoose.isValidObjectId(cleanId);

    const transactionsFound = [];

    // Helper to build match criteria on items array
    const buildItemCriteria = (idField = 'materialId', nameField = 'materialName', codeField = 'materialCode') => {
      const orArr = [];
      if (isObjId) {
        orArr.push({ [`items.${idField}`]: new mongoose.Types.ObjectId(cleanId) });
        orArr.push({ [`items.${idField}`]: cleanId });
      }
      if (nameField && cleanName) {
        orArr.push({ [`items.${nameField}`]: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') } });
      }
      if (codeField && cleanCode) {
        orArr.push({ [`items.${codeField}`]: { $regex: new RegExp(`^${escapeRegex(cleanCode)}$`, 'i') } });
      }
      return orArr.length > 0 ? { $or: orArr } : null;
    };

    // 1. Purchase Orders
    try {
      const PurchaseOrder = req.getModel("PurchaseOrder", purchaseOrderSchema);
      const poCriteria = buildItemCriteria('materialId', 'materialName', 'materialCode');
      if (poCriteria) {
        const poCount = await PurchaseOrder.countDocuments({ company: companyId, ...poCriteria });
        if (poCount > 0) transactionsFound.push(`${poCount} Purchase Order(s)`);
      }
    } catch (e) {}

    // 2. GRN (Goods Receipt Note)
    try {
      const GRN = req.getModel("GRN", grnSchema);
      const grnCriteria = buildItemCriteria('materialId', 'materialName', 'materialCode');
      if (grnCriteria) {
        const grnCount = await GRN.countDocuments({ company: companyId, ...grnCriteria });
        if (grnCount > 0) transactionsFound.push(`${grnCount} GRN Receipt(s)`);
      }
    } catch (e) {}

    // 3. Material Issue (Store to Production/WIP)
    try {
      const MaterialIssue = req.getModel("MaterialIssue", materialIssueSchema);
      const issueCriteria = buildItemCriteria('materialId', 'materialName', 'materialCode');
      if (issueCriteria) {
        const issueCount = await MaterialIssue.countDocuments({ company: companyId, ...issueCriteria });
        if (issueCount > 0) transactionsFound.push(`${issueCount} Store Issue(s)`);
      }
    } catch (e) {}

    // 4. FG GRN
    try {
      const FGGRN = req.getModel("FGGRN", fgGRNSchema);
      const fggrnOr = [];
      if (isObjId) {
        fggrnOr.push({ fgItemId: new mongoose.Types.ObjectId(cleanId) }, { fgItemId: cleanId });
      }
      if (cleanName) {
        fggrnOr.push({ fgItemName: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') } });
      }
      if (fggrnOr.length > 0) {
        const fggrnCount = await FGGRN.countDocuments({ company: companyId, $or: fggrnOr });
        if (fggrnCount > 0) transactionsFound.push(`${fggrnCount} FG Production Receipt(s)`);
      }
    } catch (e) {}

    // 5. Job Work Challans
    try {
      const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
      const jwCriteria = buildItemCriteria('materialId', 'materialName', 'materialCode');
      if (jwCriteria) {
        const jwCount = await JobWorkChallan.countDocuments({ company: companyId, ...jwCriteria });
        if (jwCount > 0) transactionsFound.push(`${jwCount} Job Work Challan(s)`);
      }
    } catch (e) {}

    // 6. Sales Orders / Invoices / DCs (primarily for FG items)
    try {
      const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
      const soCriteria = buildItemCriteria('fgItem', 'productName', 'productCode');
      if (soCriteria) {
        const soCount = await SalesOrder.countDocuments({ company: companyId, ...soCriteria });
        if (soCount > 0) transactionsFound.push(`${soCount} Sales Order(s)`);
      }
    } catch (e) {}

    // 7. Check if part of any BOM
    const bomCheck = await checkItemAttachedToBOM({ req, companyId, itemId, itemName, itemCode });
    if (bomCheck.isAttached) {
      transactionsFound.push(`Active BOM usage (${bomCheck.fgNames.length} Finished Good(s))`);
    }

    if (transactionsFound.length > 0) {
      return {
        hasTransactions: true,
        transactions: transactionsFound,
        message: `Cannot delete "${cleanName || 'this item'}": This item has existing transactions (${transactionsFound.join(', ')}). Master items with transaction history cannot be deleted; they can only be edited or deactivated.`
      };
    }

    return { hasTransactions: false, transactions: [] };
  } catch (err) {
    console.error("checkItemHasTransactions error:", err);
    return { hasTransactions: false, transactions: [] };
  }
};

/**
 * Check stock across Main Store and WIP Store before allowing deactivation.
 * - BOM Attachment check: If attached to an active BOM, deactivation is blocked.
 * - Main Store Stock check: Must be 0 (currentStock == 0 && qcPendingStock == 0).
 * - WIP Store Stock check: Must be 0 (shopfloor WIP == 0 && jobwork WIP == 0).
 */
export const checkItemStockForDeactivation = async ({ req, companyId, itemId, itemName, itemCode, itemType }) => {
  try {
    const cleanName = (itemName || '').toString().trim();
    const cleanCode = (itemCode || '').toString().trim();
    const cleanId = itemId ? itemId.toString() : null;
    const isObjId = cleanId && mongoose.isValidObjectId(cleanId);

    // 1. Check if attached to any Finished Good BOM
    const bomCheck = await checkItemAttachedToBOM({ req, companyId, itemId, itemName, itemCode });
    if (bomCheck.isAttached) {
      return {
        canDeactivate: false,
        reason: 'bom',
        mainStoreStock: 0,
        wipStock: 0,
        unit: 'PCS',
        message: bomCheck.message
      };
    }

    // 2. Check Main Store Inventory
    const Inventory = req.getModel("Inventory", inventorySchema);
    const invQueries = [];
    if (isObjId) {
      invQueries.push({ materialId: new mongoose.Types.ObjectId(cleanId) }, { materialId: cleanId }, { _id: cleanId });
    }
    if (cleanCode) {
      invQueries.push({ materialCode: { $regex: new RegExp(`^${escapeRegex(cleanCode)}$`, 'i') } });
    }
    if (cleanName) {
      invQueries.push({ materialName: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') } });
    }

    let invDoc = null;
    if (invQueries.length > 0) {
      invDoc = await Inventory.findOne({ company: companyId, $or: invQueries }).lean();
    }

    // For FG Item, also check FGItem quantity directly
    let fgStock = 0;
    let unit = invDoc?.unit || "PCS";
    if (itemType === 'fg' || itemType === 'Finished Goods') {
      try {
        const FGItem = req.getModel("FGItem", fgItemSchema);
        if (cleanId) {
          const fgDoc = await FGItem.findById(cleanId).lean();
          if (fgDoc) {
            fgStock = Number(fgDoc.quantity || 0);
            unit = fgDoc.unit || unit;
          }
        }
      } catch (e) {}
    }

    const currentStock = Number(invDoc?.currentStock || 0);
    const qcPendingStock = Number(invDoc?.qcPendingStock || 0);
    const totalMainStoreStock = Math.max(currentStock + qcPendingStock, fgStock);

    // 3. Check WIP Stock
    // An item has WIP stock if it was issued in MaterialIssue minus consumed in FGGRN / returned in JobWork
    let totalWipStock = 0;
    try {
      const MaterialIssue = req.getModel("MaterialIssue", materialIssueSchema);
      const issueCriteria = [];
      if (isObjId) {
        issueCriteria.push({ "items.materialId": new mongoose.Types.ObjectId(cleanId) }, { "items.materialId": cleanId });
      }
      if (cleanName) {
        issueCriteria.push({ "items.materialName": { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') } });
      }

      if (issueCriteria.length > 0) {
        const issues = await MaterialIssue.find({ company: companyId, $or: issueCriteria }).lean();
        let totalIssued = 0;
        issues.forEach(iss => {
          if (iss.type === "consumable") return; // Consumables do not go to WIP
          (iss.items || []).forEach(it => {
            const matchesId = isObjId && (it.materialId?.toString() === cleanId || it.material?.toString() === cleanId);
            const matchesName = cleanName && it.materialName?.trim().toLowerCase() === cleanName.toLowerCase();
            if (matchesId || matchesName) {
              totalIssued += Number(it.quantity || 0);
            }
          });
        });

        if (totalIssued > 0) {
          // If issued, compute net WIP by deducting FG GRN consumption
          let totalConsumed = 0;
          try {
            const FGGRN = req.getModel("FGGRN", fgGRNSchema);
            const BOM = req.getModel("BOM", bomSchema);
            const FGItem = req.getModel("FGItem", fgItemSchema);

            const [fggrns, boms, allFGs] = await Promise.all([
              FGGRN.find({ company: companyId, status: { $in: ["Received", "Accepted"] } }).lean(),
              BOM.find({ company: companyId }).lean(),
              FGItem.find({ company: companyId }).lean()
            ]);

            // Map bom consumption per FG
            fggrns.forEach(grn => {
              const fgName = grn.fgItemName || grn.productName || "";
              const fgQty = Number(grn.acceptedQuantity ?? grn.receivedQuantity ?? 0);
              if (fgQty <= 0) return;

              // Check in FGItem.bom
              const fgDoc = allFGs.find(f => f.name?.trim().toLowerCase() === fgName.trim().toLowerCase());
              if (fgDoc && Array.isArray(fgDoc.bom)) {
                fgDoc.bom.forEach(bItem => {
                  const bMatchesId = isObjId && (bItem.item?.toString() === cleanId);
                  const bMatchesName = cleanName && bItem.itemName?.trim().toLowerCase() === cleanName.toLowerCase();
                  if (bMatchesId || bMatchesName) {
                    totalConsumed += (Number(bItem.quantity || 0) * fgQty);
                  }
                });
              }

              // Check in dedicated BOM
              const bomDoc = boms.find(b => b.productName?.trim().toLowerCase() === fgName.trim().toLowerCase());
              if (bomDoc && Array.isArray(bomDoc.items)) {
                bomDoc.items.forEach(bItem => {
                  const bMatchesName = cleanName && bItem.materialName?.trim().toLowerCase() === cleanName.toLowerCase();
                  if (bMatchesName) {
                    totalConsumed += (Number(bItem.quantity || 0) * fgQty);
                  }
                });
              }
            });
          } catch (e) {}

          totalWipStock = Math.max(0, totalIssued - totalConsumed);
        }
      }
    } catch (e) {}

    if (totalMainStoreStock > 0 || totalWipStock > 0) {
      return {
        canDeactivate: false,
        reason: 'stock',
        mainStoreStock: totalMainStoreStock,
        wipStock: totalWipStock,
        unit,
        message: `Cannot deactivate "${cleanName || 'this item'}": Stock is still present. Main Store: ${totalMainStoreStock} ${unit}, WIP Floor: ${totalWipStock} ${unit}. Please clear, issue, or consume all remaining inventory to 0 before deactivating.`
      };
    }

    return {
      canDeactivate: true,
      mainStoreStock: 0,
      wipStock: 0,
      unit
    };
  } catch (err) {
    console.error("checkItemStockForDeactivation error:", err);
    return { canDeactivate: true, mainStoreStock: 0, wipStock: 0, unit: 'PCS' };
  }
};
