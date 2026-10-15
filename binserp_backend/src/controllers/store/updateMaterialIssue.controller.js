import { updateInventoryStock } from './updateInventoryStock.controller.js';
import { getItemAvailableStock } from './createMaterialIssue.controller.js';
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import { checkTimeLockGovernance } from "../../utils/timeLockGovernance.js";
import mongoose from "mongoose";
import {
  materialIssueSchema,
  materialRequestSchema,
  rawMaterialSchema,
  boughtOutSchema,
  consumableItemSchema,
  rmBoItemSchema,
  rmInventoryMonthlySchema,
  fgInventoryMonthlySchema,
  fgItemSchema
} from "../../models/store/index.js";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { componentSchema } from "../../models/ppc/index.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

// Helper function to update FGItem / Component stock (InHouse)
const updateComponentStock = async (req, componentId, quantityDelta) => {
  try {
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const Component = req.getModel("Component", componentSchema);

    let fgDoc = await FGItem.findById(componentId);
    if (fgDoc) {
      const previousStock = fgDoc.quantity || 0;
      const newStock = Math.max(0, previousStock + quantityDelta);
      await FGItem.findByIdAndUpdate(componentId, { $set: { quantity: newStock } });
      return { doc: fgDoc, previousStock, newStock, model: 'FGItem' };
    }

    const component = await Component.findById(componentId);
    if (component) {
      const previousStock = component.quantity || 0;
      const newStock = Math.max(0, previousStock + quantityDelta);
      await Component.findByIdAndUpdate(componentId, { $set: { quantity: newStock } });
      return { doc: component, previousStock, newStock, model: 'Component' };
    }

    console.warn(`[updateMaterialIssue] Component / FG Item not found: ${componentId}`);
    return null;
  } catch (error) {
    console.error("Error updating component stock:", error);
    throw error;
  }
};

export const updateMaterialIssue = async (req, res) => {
  try {
    const MaterialIssue = req.getModel('MaterialIssue', materialIssueSchema);
    const MRPPlan = req.getModel('MRPPlan', mrpPlanSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { status, items, department, issuedTo, remarks, date } = req.body;

    const materialIssue = await MaterialIssue.findOne({ _id: id, company: companyId });
    if (!materialIssue) {
      return res.status(404).json({ message: "Material issue not found" });
    }

    // Dynamic time lock governance validation
    const lockCheck = await checkTimeLockGovernance(req, 'materialIssue', materialIssue.createdAt || materialIssue.date, 'edit');
    if (!lockCheck.allowed) {
      return res.status(403).json({ message: lockCheck.message });
    }

    const oldStatus = materialIssue.status;
    const newStatus = status || materialIssue.status;
    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
    const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);

    // Case 1: Status remains "Issued", but items/quantities are modified
    if (oldStatus === "Issued" && newStatus === "Issued" && Array.isArray(items)) {
      const oldItems = materialIssue.items || [];
      const newItems = items;

      // Identify differences and validate stock for quantity increases
      const shortages = [];
      const itemAdjustments = [];

      for (const nItem of newItems) {
        const matchingOld = oldItems.find(o => {
          if (nItem._id && o._id && String(nItem._id) === String(o._id)) return true;
          if (nItem.material && o.material && String(nItem.material) === String(o.material)) return true;
          if (nItem.component && o.component && String(nItem.component) === String(o.component)) return true;
          if (nItem.consumable && o.consumable && String(nItem.consumable) === String(o.consumable)) return true;
          if (nItem.materialName && o.materialName && nItem.materialName.trim().toLowerCase() === o.materialName.trim().toLowerCase()) return true;
          return false;
        });

        const oldQty = matchingOld ? Number(matchingOld.quantity) || 0 : 0;
        const newQty = Number(nItem.quantity) || 0;
        const delta = newQty - oldQty; // positive means more issued (deduct stock), negative means less issued (restore stock)

        if (delta > 0) {
          // Check if warehouse has sufficient stock for the additional quantity
          const stockInfo = await getItemAvailableStock(req, nItem, materialIssue.type);
          if (stockInfo.availableStock < delta) {
            shortages.push({
              materialId: nItem.material || nItem.component || nItem.consumable || nItem.fgItem,
              materialName: nItem.materialName || 'Unnamed Item',
              materialCode: nItem.materialCode || '',
              materialDescription: stockInfo.description || nItem.materialDescription || nItem.description || '',
              unit: nItem.unit || stockInfo.unit || 'PCS',
              requestedQuantity: delta,
              availableStock: stockInfo.availableStock,
              shortageQuantity: Number((delta - stockInfo.availableStock).toFixed(4))
            });
          }
        }

        itemAdjustments.push({
          item: nItem,
          oldItem: matchingOld,
          delta,
          oldQty,
          newQty,
          isNew: !matchingOld
        });
      }

      // Check for removed items (items in oldItems not in newItems)
      const removedItems = oldItems.filter(o => !newItems.some(n => {
        if (n._id && o._id && String(n._id) === String(o._id)) return true;
        if (n.material && o.material && String(n.material) === String(o.material)) return true;
        if (n.component && o.component && String(n.component) === String(o.component)) return true;
        if (n.consumable && o.consumable && String(n.consumable) === String(o.consumable)) return true;
        if (n.materialName && o.materialName && n.materialName.trim().toLowerCase() === o.materialName.trim().toLowerCase()) return true;
        return false;
      }));

      if (shortages.length > 0) {
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_STOCK',
          message: `Cannot update material issue: Insufficient stock for ${shortages.length} item(s) to fulfill quantity increase.`,
          shortages
        });
      }

      // Execute stock adjustments for updated/new items
      for (const adj of itemAdjustments) {
        const { item, delta, oldItem } = adj;
        if (delta === 0) continue;

        const isInhouse = materialIssue.type === 'inhouse' || item.component || item.fgItem;

        if (isInhouse) {
          const compId = item.component?._id || item.component || item.fgItem?._id || item.fgItem || item.material;
          const stockResult = await updateComponentStock(req, compId, -delta);

          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: compId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: delta } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error updating FG monthly outward quantity on edit:", monthlyErr);
          }

          if (stockResult) {
            await recordStockTransaction(req, {
              itemType: stockResult.model,
              item: compId,
              itemName: item.materialName,
              unit: item.unit || "Nos",
              movementType: delta > 0 ? "OUTWARD" : "INWARD",
              transactionCategory: delta > 0 ? "MATERIAL_ISSUE_FG_OUTWARD" : "STOCK_ADJUSTMENT_INWARD",
              quantity: Math.abs(delta),
              previousStock: stockResult.previousStock,
              newStock: stockResult.newStock,
              referenceDocType: "MaterialIssue",
              referenceDocId: materialIssue._id,
              referenceDocNumber: materialIssue.issueNumber,
              recipientOrSource: `Shop Floor (${department || materialIssue.department || 'Store'})`,
              purpose: `Issue #${materialIssue.issueNumber} Modified (${delta > 0 ? '+' : ''}${delta} ${item.unit || 'Nos'})`,
              performedBy: req.user?.id || req.user?._id,
            });
          }
        } else {
          const isConsumable = materialIssue.type === 'consumable' || item.consumable || item.itemType === 'Consumable';
          const targetMatId = isConsumable ? (item.consumable?._id || item.consumable || item.material?._id || item.material) : (item.material?._id || item.material);
          const issueItemType = isConsumable ? 'Consumable' : (materialIssue.type === 'bo' || item.itemType === 'Bought Out' ? 'BoughtOut' : 'RawMaterial');

          await updateInventoryStock(
            req,
            targetMatId,
            -delta, // Negative to decrement if delta > 0, positive to restore if delta < 0
            item.unit || "PCS",
            undefined,
            {
              itemType: issueItemType,
              transactionCategory: delta > 0
                ? (isConsumable ? "MATERIAL_ISSUE_CONSUMABLE_OUTWARD" : "MATERIAL_ISSUE_SHOPFLOOR_OUTWARD")
                : "STOCK_ADJUSTMENT_INWARD",
              referenceDocType: "MaterialIssue",
              referenceDocId: materialIssue._id,
              referenceDocNumber: materialIssue.issueNumber,
              recipientOrSource: `Shop Floor (${department || materialIssue.department || 'Store'})`,
              purpose: `Issue #${materialIssue.issueNumber} Modified (${delta > 0 ? '+' : ''}${delta} ${item.unit || 'PCS'})`,
              hasSecondaryUnit: item.hasSecondaryUnit || false,
              secondaryUnit: item.secondaryUnit || "",
              secondaryQuantity: item.secondaryQuantity || 0,
              conversionFactor: item.conversionFactor || 1,
              performedBy: req.user?.id || req.user?._id,
            }
          );

          try {
            await RMInventoryMonthly.findOneAndUpdate(
              { company: companyId, material: targetMatId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: delta } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error updating RM monthly outward quantity on edit:", monthlyErr);
          }
        }
      }

      // Restore stock for completely removed items
      for (const rem of removedItems) {
        const remQty = Number(rem.quantity) || 0;
        if (remQty <= 0) continue;

        const isInhouse = materialIssue.type === 'inhouse' || rem.component || rem.fgItem;
        if (isInhouse) {
          const compId = rem.component?._id || rem.component || rem.fgItem?._id || rem.fgItem || rem.material;
          await updateComponentStock(req, compId, remQty);
          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: compId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: -remQty } },
              { new: true, upsert: true }
            );
          } catch (e) {}
        } else {
          const isConsumable = materialIssue.type === 'consumable' || rem.consumable || rem.itemType === 'Consumable';
          const targetMatId = isConsumable ? (rem.consumable?._id || rem.consumable || rem.material?._id || rem.material) : (rem.material?._id || rem.material);
          const issueItemType = isConsumable ? 'Consumable' : (materialIssue.type === 'bo' || rem.itemType === 'Bought Out' ? 'BoughtOut' : 'RawMaterial');

          await updateInventoryStock(
            req,
            targetMatId,
            remQty,
            rem.unit || "PCS",
            undefined,
            {
              itemType: issueItemType,
              transactionCategory: "STOCK_ADJUSTMENT_INWARD",
              referenceDocType: "MaterialIssue",
              referenceDocId: materialIssue._id,
              referenceDocNumber: materialIssue.issueNumber,
              recipientOrSource: `Store (Item Removed from Issue #${materialIssue.issueNumber})`,
              purpose: `Item Removed from Issue #${materialIssue.issueNumber}`,
              performedBy: req.user?.id || req.user?._id,
            }
          );

          try {
            await RMInventoryMonthly.findOneAndUpdate(
              { company: companyId, material: targetMatId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: -remQty } },
              { new: true, upsert: true }
            );
          } catch (e) {}
        }
      }

      // Sync linked MaterialRequest if linked
      if (materialIssue.materialRequest || materialIssue.requestNumber) {
        try {
          const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
          const reqQuery = materialIssue.materialRequest && mongoose.Types.ObjectId.isValid(materialIssue.materialRequest.toString())
            ? { _id: materialIssue.materialRequest, company: companyId }
            : { requestNumber: materialIssue.requestNumber, company: companyId };

          const reqDoc = await MaterialRequest.findOne(reqQuery);
          if (reqDoc) {
            let anyItemIssued = false;
            let allItemsFullyIssued = true;

            reqDoc.items.forEach(rItem => {
              const matchingNew = newItems.find(issIt => {
                if (issIt.materialRequestItemId && String(issIt.materialRequestItemId) === String(rItem._id)) return true;
                if (issIt.material && rItem.material && String(issIt.material) === String(rItem.material)) return true;
                if (issIt.component && rItem.component && String(issIt.component) === String(rItem.component)) return true;
                if (issIt.consumable && rItem.consumable && String(issIt.consumable) === String(rItem.consumable)) return true;
                if (issIt.materialName && rItem.materialName && issIt.materialName.trim().toLowerCase() === rItem.materialName.trim().toLowerCase()) return true;
                return false;
              });

              const matchingOld = oldItems.find(o => {
                if (o.materialRequestItemId && String(o.materialRequestItemId) === String(rItem._id)) return true;
                if (o.material && rItem.material && String(o.material) === String(rItem.material)) return true;
                if (o.component && rItem.component && String(o.component) === String(rItem.component)) return true;
                if (o.consumable && rItem.consumable && String(o.consumable) === String(rItem.consumable)) return true;
                if (o.materialName && rItem.materialName && o.materialName.trim().toLowerCase() === rItem.materialName.trim().toLowerCase()) return true;
                return false;
              });

              const oldQty = matchingOld ? Number(matchingOld.quantity) || 0 : 0;
              const newQty = matchingNew ? Number(matchingNew.quantity) || 0 : 0;
              const delta = newQty - oldQty;

              rItem.issuedQuantity = Math.max(0, (rItem.issuedQuantity || 0) + delta);
              rItem.pendingQuantity = Math.max(0, (rItem.quantity || 0) - rItem.issuedQuantity);

              if (rItem.issuedQuantity < (rItem.quantity || 0)) {
                allItemsFullyIssued = false;
              }
              if (rItem.issuedQuantity > 0) {
                anyItemIssued = true;
              }
            });

            if (allItemsFullyIssued) {
              reqDoc.status = "Issued";
            } else if (anyItemIssued) {
              reqDoc.status = "Partially Issued";
            } else {
              reqDoc.status = reqDoc.approvedBy ? "Approved" : "Pending";
            }

            await reqDoc.save();
          }
        } catch (reqSyncErr) {
          console.error("Error updating linked MaterialRequest on issue edit:", reqSyncErr);
        }
      }
    } else if (oldStatus !== "Issued" && newStatus === "Issued") {
      // Case 2: Status transition from Draft/Other to Issued
      const itemsToProcess = items || materialIssue.items;

      const shortages = [];
      for (const item of itemsToProcess) {
        const stockInfo = await getItemAvailableStock(req, item, materialIssue.type);
        const reqQty = Number(item.quantity) || 0;
        const availStock = stockInfo.availableStock;

        if (availStock < reqQty) {
          shortages.push({
            materialId: item.material || item.component || item.consumable || item.fgItem,
            materialName: item.materialName || 'Unnamed Item',
            materialCode: item.materialCode || '',
            materialDescription: stockInfo.description || item.materialDescription || item.description || '',
            unit: item.unit || stockInfo.unit || 'PCS',
            requestedQuantity: reqQty,
            availableStock: availStock,
            shortageQuantity: Number((reqQty - availStock).toFixed(4))
          });
        }
      }

      if (shortages.length > 0) {
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_STOCK',
          message: `Cannot issue material: Insufficient stock for ${shortages.length} item(s).`,
          shortages
        });
      }

      for (const item of itemsToProcess) {
        const qty = Number(item.quantity) || 0;
        if (materialIssue.type === 'inhouse') {
          const compId = item.component?._id || item.component || item.material;
          await updateComponentStock(req, compId, -qty);
          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: compId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: qty } },
              { new: true, upsert: true }
            );
          } catch (e) {}
        } else {
          const materialId = item.material?._id || item.material;
          await updateInventoryStock(
            req,
            materialId,
            -qty,
            item.unit || "PCS",
            undefined,
            {
              itemType: materialIssue.type === 'consumable' ? 'Consumable' : (materialIssue.type === 'bo' ? 'BoughtOut' : 'RawMaterial'),
              transactionCategory: materialIssue.type === 'consumable' ? 'MATERIAL_ISSUE_CONSUMABLE_OUTWARD' : 'MATERIAL_ISSUE_SHOPFLOOR_OUTWARD',
              referenceDocType: "MaterialIssue",
              referenceDocId: materialIssue._id,
              referenceDocNumber: materialIssue.issueNumber,
              recipientOrSource: `Shop Floor (${department || materialIssue.department || 'Store'})`,
            }
          );
          try {
            await RMInventoryMonthly.findOneAndUpdate(
              { company: companyId, material: materialId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: qty } },
              { new: true, upsert: true }
            );
          } catch (e) {}
        }
      }
    } else if (oldStatus === "Issued" && newStatus !== "Issued") {
      // Case 3: Status transition from Issued to Cancelled/Draft -> Revert stock
      for (const item of materialIssue.items) {
        const qty = Number(item.quantity) || 0;
        if (materialIssue.type === 'inhouse') {
          const compId = item.component?._id || item.component || item.material;
          await updateComponentStock(req, compId, qty);
          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: compId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: -qty } },
              { new: true, upsert: true }
            );
          } catch (e) {}
        } else {
          const materialId = item.material?._id || item.material;
          await updateInventoryStock(
            req,
            materialId,
            qty,
            item.unit || "PCS",
            undefined,
            {
              itemType: materialIssue.type === 'consumable' ? 'Consumable' : (materialIssue.type === 'bo' ? 'BoughtOut' : 'RawMaterial'),
              transactionCategory: "STOCK_ADJUSTMENT_INWARD",
              referenceDocType: "MaterialIssue",
              referenceDocId: materialIssue._id,
              referenceDocNumber: materialIssue.issueNumber,
              recipientOrSource: `Store (Reversal from ${department || materialIssue.department || 'Shop Floor'})`,
            }
          );
          try {
            await RMInventoryMonthly.findOneAndUpdate(
              { company: companyId, material: materialId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: -qty } },
              { new: true, upsert: true }
            );
          } catch (e) {}
        }
      }
    }

    const { userId, userName } = getUserAudit(req);
    const updatedIssue = await MaterialIssue.findOneAndUpdate(
      { _id: id, company: companyId },
      { ...req.body, updatedBy: userId, updatedByName: userName },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Material issue updated successfully and inventory stock synchronized",
      materialIssue: updatedIssue
    });
  } catch (error) {
    console.error("Error in updateMaterialIssue:", error);
    res.status(500).json({ message: error.message });
  }
};
