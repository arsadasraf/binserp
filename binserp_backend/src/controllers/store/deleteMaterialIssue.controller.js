import { updateInventoryStock } from './updateInventoryStock.controller.js';
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import mongoose from "mongoose";
import {
  materialIssueSchema,
  materialRequestSchema,
  fgItemSchema,
  rmInventoryMonthlySchema,
  fgInventoryMonthlySchema
} from "../../models/store/index.js";
import { componentSchema } from "../../models/ppc/index.js";
import { checkTimeLockGovernance } from "../../utils/timeLockGovernance.js";

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
      const newStock = Math.max(0, (fgDoc.quantity || 0) + quantityDelta);
      await FGItem.findByIdAndUpdate(componentId, { $set: { quantity: newStock } });
      return { doc: fgDoc, previousStock: fgDoc.quantity || 0, newStock, model: 'FGItem' };
    }

    const component = await Component.findById(componentId);
    if (component) {
      const newStock = Math.max(0, (component.quantity || 0) + quantityDelta);
      await Component.findByIdAndUpdate(componentId, { $set: { quantity: newStock } });
      return { doc: component, previousStock: component.quantity || 0, newStock, model: 'Component' };
    }

    console.warn(`[deleteMaterialIssue] Component / FG Item not found: ${componentId}`);
    return null;
  } catch (error) {
    console.error("Error updating component stock:", error);
    throw error;
  }
};

export const deleteMaterialIssue = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const MaterialIssue = req.getModel('MaterialIssue', materialIssueSchema);
    const materialIssue = await MaterialIssue.findOne({ _id: id, company: companyId });

    if (!materialIssue) {
      return res.status(404).json({ message: "Material issue not found" });
    }

    // Dynamic time lock governance
    const lockCheck = await checkTimeLockGovernance(req, 'materialIssue', materialIssue.createdAt || materialIssue.date, 'delete');
    if (!lockCheck.allowed) {
      return res.status(403).json({ message: lockCheck.message });
    }

    // Reverse inventory update if status was "Issued"
    if (materialIssue.status === "Issued" && Array.isArray(materialIssue.items) && materialIssue.items.length > 0) {
      const currentDate = new Date();
      const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
      const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);

      for (const item of materialIssue.items) {
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;

        const isInhouse = materialIssue.type === 'inhouse' || item.component || item.fgItem;

        if (isInhouse) {
          const compId = item.component?._id || item.component || item.fgItem?._id || item.fgItem || item.material;
          const stockResult = await updateComponentStock(req, compId, qty);

          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: compId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: -qty } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error reversing FG monthly outward quantity:", monthlyErr);
          }

          if (stockResult) {
            await recordStockTransaction(req, {
              itemType: stockResult.model,
              item: compId,
              itemName: item.materialName,
              unit: item.unit || "Nos",
              movementType: "INWARD",
              transactionCategory: "STOCK_ADJUSTMENT_INWARD",
              quantity: qty,
              previousStock: stockResult.previousStock,
              newStock: stockResult.newStock,
              referenceDocType: "MaterialIssue",
              referenceDocId: materialIssue._id,
              referenceDocNumber: materialIssue.issueNumber,
              recipientOrSource: `Store (Reversal from Deleted Issue #${materialIssue.issueNumber})`,
              purpose: `Issue Deleted / Reversed #${materialIssue.issueNumber}`,
              hasSecondaryUnit: item.hasSecondaryUnit || false,
              secondaryUnit: item.secondaryUnit || "",
              secondaryQuantity: item.secondaryQuantity || 0,
              conversionFactor: item.conversionFactor || 1,
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
            qty, // Positive to restore stock
            item.unit || "PCS",
            undefined,
            {
              itemType: issueItemType,
              transactionCategory: "STOCK_ADJUSTMENT_INWARD",
              referenceDocType: "MaterialIssue",
              referenceDocId: materialIssue._id,
              referenceDocNumber: materialIssue.issueNumber,
              recipientOrSource: `Store (Reversal from Deleted Issue #${materialIssue.issueNumber})`,
              purpose: `Issue Deleted / Reversed #${materialIssue.issueNumber}`,
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
              { $inc: { totalOutwardQuantity: -qty } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error reversing RM monthly outward quantity:", monthlyErr);
          }
        }
      }

      // Revert fulfillment quantities and status on linked MaterialRequest
      if (materialIssue.materialRequest || materialIssue.requestNumber) {
        try {
          const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
          const reqQuery = materialIssue.materialRequest && mongoose.Types.ObjectId.isValid(materialIssue.materialRequest.toString())
            ? { _id: materialIssue.materialRequest, company: companyId }
            : { requestNumber: materialIssue.requestNumber, company: companyId };

          const reqDoc = await MaterialRequest.findOne(reqQuery);
          if (reqDoc) {
            let anyItemStillIssued = false;

            reqDoc.items.forEach(rItem => {
              const matchingIssueItem = materialIssue.items.find(issIt => {
                if (issIt.materialRequestItemId && String(issIt.materialRequestItemId) === String(rItem._id)) return true;
                if (issIt.material && rItem.material && String(issIt.material) === String(rItem.material)) return true;
                if (issIt.component && rItem.component && String(issIt.component) === String(rItem.component)) return true;
                if (issIt.consumable && rItem.consumable && String(issIt.consumable) === String(rItem.consumable)) return true;
                if (issIt.materialName && rItem.materialName) {
                  return issIt.materialName.trim().toLowerCase() === rItem.materialName.trim().toLowerCase();
                }
                return false;
              });

              if (matchingIssueItem) {
                const issuedToRemove = Number(matchingIssueItem.quantity) || 0;
                rItem.issuedQuantity = Math.max(0, (rItem.issuedQuantity || 0) - issuedToRemove);
                rItem.pendingQuantity = Math.max(0, (rItem.quantity || 0) - rItem.issuedQuantity);
              }

              if ((rItem.issuedQuantity || 0) > 0) {
                anyItemStillIssued = true;
              }
            });

            // Recalculate status
            if (anyItemStillIssued) {
              reqDoc.status = "Partially Issued";
            } else {
              reqDoc.status = reqDoc.approvedBy ? "Approved" : "Pending";
            }

            // Remove this issue from linkedIssues and issueNumbers
            reqDoc.linkedIssues = (reqDoc.linkedIssues || []).filter(
              lId => String(lId) !== String(materialIssue._id)
            );
            reqDoc.issueNumbers = (reqDoc.issueNumbers || []).filter(
              num => num !== materialIssue.issueNumber
            );

            await reqDoc.save();
          }
        } catch (reqSyncErr) {
          console.error("Error reverting linked MaterialRequest on issue deletion:", reqSyncErr);
        }
      }
    }

    // Delete the issue record
    await MaterialIssue.findByIdAndDelete(materialIssue._id);

    res.status(200).json({
      success: true,
      message: `Material issue #${materialIssue.issueNumber} deleted successfully and warehouse inventory reversed.`,
      issueNumber: materialIssue.issueNumber
    });
  } catch (error) {
    console.error("Error in deleteMaterialIssue:", error);
    res.status(500).json({ message: error.message });
  }
};
