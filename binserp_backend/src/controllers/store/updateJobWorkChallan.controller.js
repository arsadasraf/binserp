import mongoose from "mongoose";
import { 
  jobWorkSchema, vendorSchema, rmBoItemSchema, 
  rmInventoryMonthlySchema, fgItemSchema, inventorySchema,
  stockTransactionSchema
} from "../../models/store/index.js";
import { updateInventoryStock } from './updateInventoryStock.controller.js';
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { userSchema } from "../../models/user/index.js";
import { checkTimeLockGovernance } from "../../utils/timeLockGovernance.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const updateJobWorkChallan = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
    const Material = req.getModel("RmBoItem", rmBoItemSchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const Inventory = req.getModel("Inventory", inventorySchema);
    const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
    const Vendor = req.getModel("Vendor", vendorSchema);
    req.getModel("User", userSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    const existingChallan = await JobWorkChallan.findOne({ _id: id, company: companyId });
    if (!existingChallan) {
      return res.status(404).json({ message: "Job Work Challan not found" });
    }

    // 1. Dynamic time lock governance
    const lockCheck = await checkTimeLockGovernance(req, 'jobWorkChallan', existingChallan.createdAt, 'edit');
    if (!lockCheck.allowed) {
      return res.status(403).json({ message: lockCheck.message });
    }

    // 2. Block edit if fully closed
    if (existingChallan.status === "Closed") {
      return res.status(400).json({ message: "Cannot edit a fully closed Job Work Challan." });
    }

    // Preserve inward receipt history if already partially received
    if (Array.isArray(existingChallan.receiveHistory) && existingChallan.receiveHistory.length > 0) {
      req.body.receiveHistory = existingChallan.receiveHistory;
      if (existingChallan.status === "Partial") {
        req.body.status = "Partial";
      }
    }

    // Lock jobWorkType to prevent cross-store ledger discrepancies
    req.body.jobWorkType = existingChallan.jobWorkType;

    // 3. Sanitize empty string fields to prevent BSON cast errors
    if (req.body.mrpPlan === "" || !req.body.mrpPlan) {
      req.body.mrpPlan = undefined;
    }
    if (req.body.mrpNumber === "") {
      req.body.mrpNumber = undefined;
    }
    if (req.body.vendor === "" || !req.body.vendor) {
      delete req.body.vendor;
    }
    if (req.body.routeCardRef && (!req.body.routeCardRef.job || req.body.routeCardRef.job === "")) {
      req.body.routeCardRef = undefined;
    }
    if (req.body.notes !== undefined) {
      req.body.notes = Array.isArray(req.body.notes)
        ? req.body.notes.filter(n => n && typeof n === 'string' && n.trim())
        : (req.body.notes ? [req.body.notes] : []);
    }

    const cleanId = (val) => {
      if (!val) return null;
      const s = String(val).trim();
      return s.includes('_') ? s.split('_').slice(1).join('_') : s;
    };
    const isValidObjectId = (val) => {
      const c = cleanId(val);
      return c && mongoose.Types.ObjectId.isValid(c) ? c : null;
    };

    if (req.body.mrpPlan && !isValidObjectId(req.body.mrpPlan)) {
      req.body.mrpPlan = undefined;
    }

    // Sanitize assemblyOutputItem and assemblyGroups to prevent BSON cast errors on empty item IDs
    const opMode = req.body.operationMode || existingChallan.operationMode || "discrete";
    if (opMode !== "assembly") {
      req.body.assemblyOutputItem = undefined;
      req.body.assemblyGroups = undefined;
    } else {
      if (req.body.assemblyOutputItem) {
        req.body.assemblyOutputItem.item = isValidObjectId(req.body.assemblyOutputItem.item) || undefined;
      }
      if (Array.isArray(req.body.assemblyGroups)) {
        req.body.assemblyGroups = req.body.assemblyGroups.map(grp => {
          const out = grp.assemblyOutputItem ? {
            ...grp.assemblyOutputItem,
            item: isValidObjectId(grp.assemblyOutputItem.item) || undefined
          } : undefined;
          const items = Array.isArray(grp.items) ? grp.items.map(it => ({
            ...it,
            item: isValidObjectId(it.item) || undefined
          })) : [];
          return {
            ...grp,
            items,
            assemblyOutputItem: out
          };
        });
      }
    }

    // 4. Reconcile Stock Adjustments if items were edited
    const newItems = req.body.items;
    const vendorDoc = await Vendor.findById(req.body.vendor || existingChallan.vendor);
    const vendorName = vendorDoc ? vendorDoc.name : "Subcontractor Vendor";

    if (Array.isArray(newItems) && newItems.length > 0) {
      const jobWorkType = req.body.jobWorkType || existingChallan.jobWorkType;

      // STEP A: Restore stock for all old items first (temporary reset)
      for (const oldItem of (existingChallan.items || [])) {
        if (jobWorkType !== "route-card" && jobWorkType !== "wip-to-wip" && (oldItem.itemType === "bo" || oldItem.itemType === "rm") && oldItem.item) {
          try {
            await updateInventoryStock(
              req,
              oldItem.item,
              Number(oldItem.quantitySent), // Restore
              oldItem.unit || "PCS",
              undefined,
              {
                transactionCategory: "RETURNABLE_DC_EDIT_ADJUSTMENT",
                referenceDocType: "JobWorkChallan",
                referenceDocId: existingChallan._id,
                referenceDocNumber: existingChallan.challanNumber,
                recipientOrSource: vendorName,
                purpose: `Edit Adjustment Reversal (${existingChallan.challanNumber})`,
                performedBy: req.user?.id || req.user?._id,
              }
            );
          } catch (e) {
            console.error("Error restoring old stock during DC edit:", e);
          }
        }
      }

      // STEP B: Validate availability for new items
      const processedItems = [];
      for (const item of newItems) {
        let itemName = item.itemName || "";
        let validItemId = isValidObjectId(item.item);

        if ((item.itemType === "bo" || item.itemType === "rm") && validItemId) {
          const materialDoc = await Material.findById(validItemId);
          if (materialDoc) itemName = materialDoc.name;

          if (jobWorkType !== "wip-to-wip" && jobWorkType !== "route-card") {
            const invDoc = await Inventory.findOne({
              company: companyId,
              $or: [{ materialId: validItemId }, { _id: validItemId }]
            });

            let availStock = 0;
            if (invDoc) {
              availStock = Number(invDoc.currentStock !== undefined ? invDoc.currentStock : invDoc.quantity) || 0;
            } else if (materialDoc) {
              availStock = Number(materialDoc.quantity !== undefined ? materialDoc.quantity : materialDoc.currentStock) || 0;
            }

            const reqQty = Number(item.quantitySent) || 0;
            if (reqQty > availStock) {
              // Rollback: Re-apply old items stock deduction
              for (const oldItem of (existingChallan.items || [])) {
                if ((oldItem.itemType === "bo" || oldItem.itemType === "rm") && oldItem.item) {
                  await updateInventoryStock(req, oldItem.item, -Number(oldItem.quantitySent), oldItem.unit || "PCS");
                }
              }
              return res.status(400).json({
                message: `Cannot dispatch "${itemName}": Requested quantity (${reqQty}) exceeds available stock (${availStock} ${item.unit || 'PCS'}).`
              });
            }
          }
        } else if ((item.itemType === "inhouse" || item.itemType === "fg" || item.itemType === "component" || item.itemType === "subassembly" || item.itemType === "assembly") && validItemId) {
          const Component = req.getModel("Component", componentSchema);
          let fgDoc = await FGItem.findById(validItemId);
          if (!fgDoc) {
            fgDoc = await Component.findById(validItemId);
          }
          if (fgDoc) itemName = fgDoc.name || fgDoc.componentName;
        }

        // Process returning items
        const processedReturningItems = [];
        if (Array.isArray(item.returningItems) && item.returningItems.length > 0) {
          for (const ret of item.returningItems) {
            const retRate = Number(ret.processRate != null ? ret.processRate : (ret.rate != null ? ret.rate : 0)) || 0;
            const retQty = Number(ret.quantityToBeReceived) || 1;
            const hasRetSec = Boolean(ret.hasSecondaryUnit);
            const secRetUnit = ret.secondaryUnit || "";
            const isRetSecActive = Boolean(hasRetSec && secRetUnit && (ret.selectedUnit === secRetUnit || (!ret.selectedUnit && item.selectedUnit === secRetUnit)));
            const secRetQty = Number(ret.secondaryQuantityToBeReceived) || (hasRetSec ? (retQty * (Number(ret.conversionFactor) || 1)) : 0);
            const activeRetQty = isRetSecActive ? secRetQty : retQty;

            const retAmount = Number(ret.processAmount) != null && !isNaN(Number(ret.processAmount)) && Number(ret.processAmount) > 0 
              ? Number(ret.processAmount) 
              : (activeRetQty * retRate);

            const retDoc = {
              receivedItemName: ret.receivedItemName || ret.itemName || itemName || "Returning Material",
              receivedItemType: ret.receivedItemType || "fg",
              quantityToBeReceived: retQty,
              quantityReceived: Number(ret.quantityReceived) || 0,
              receivingUnit: ret.receivingUnit || "PCS",
              hasSecondaryUnit: hasRetSec,
              secondaryUnit: secRetUnit,
              conversionFactor: Number(ret.conversionFactor) || 1,
              secondaryQuantityToBeReceived: secRetQty,
              secondaryQuantityReceived: Number(ret.secondaryQuantityReceived) || 0,
              selectedUnit: ret.selectedUnit || (isRetSecActive ? secRetUnit : (ret.receivingUnit || "PCS")),
              processRate: retRate,
              processAmount: retAmount,
              description: ret.description || "",
              status: ret.status || "Sent"
            };
            const validRetId = isValidObjectId(ret.receivedItem);
            if (validRetId) {
              retDoc.receivedItem = validRetId;
            }
            processedReturningItems.push(retDoc);
          }
        }

        const rateValue = Number(item.processRate != null ? item.processRate : item.unitPrice) || 0;
        const sentQtyNum = Number(item.quantitySent) || 0;

        const hasSec = Boolean(item.hasSecondaryUnit);
        const secUnit = item.secondaryUnit || "";
        const convFactor = Number(item.conversionFactor) || 1;
        const secQtySent = Number(item.secondaryQuantitySent) || (hasSec ? (sentQtyNum * convFactor) : 0);

        const isSentSec = Boolean(hasSec && secUnit && item.selectedUnit === secUnit);
        const activeSentQty = isSentSec ? secQtySent : sentQtyNum;

        const totalReturningCharges = processedReturningItems.reduce((acc, r) => acc + (Number(r.processAmount) || 0), 0);
        const effectiveProcAmount = totalReturningCharges > 0 ? totalReturningCharges : (activeSentQty * rateValue);

        const processedItem = {
          itemName: itemName || item.itemName || "Sent Item",
          itemType: item.itemType || "rm",
          quantitySent: sentQtyNum,
          quantityReceived: Number(item.quantityReceived) || 0,
          unit: item.unit || "PCS",
          hasSecondaryUnit: hasSec,
          secondaryUnit: secUnit,
          conversionFactor: convFactor,
          secondaryQuantitySent: secQtySent,
          secondaryQuantityReceived: Number(item.secondaryQuantityReceived) || 0,
          selectedUnit: item.selectedUnit || (isSentSec ? secUnit : (item.unit || "PCS")),
          unitPrice: rateValue,
          processRate: rateValue,
          processAmount: effectiveProcAmount,
          processType: item.processType || (req.body.purpose === "Others" && req.body.otherPurpose ? req.body.otherPurpose : req.body.purpose) || existingChallan.purpose || "Machining",
          purpose: item.purpose || (req.body.purpose === "Others" && req.body.otherPurpose ? req.body.otherPurpose : req.body.purpose) || existingChallan.purpose || "Machining",
          description: item.description || "",
          returningItems: processedReturningItems,
          status: item.status || "Sent"
        };
        if (validItemId) processedItem.item = validItemId;
        processedItems.push(processedItem);
      }

      // STEP C: Deduct stock for new items
      const currentDate = new Date();
      const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      for (const item of processedItems) {
        if (jobWorkType !== "route-card" && jobWorkType !== "wip-to-wip" && (item.itemType === "bo" || item.itemType === "rm") && item.item) {
          await updateInventoryStock(
            req,
            item.item,
            -Number(item.quantitySent), // Decrement
            item.unit || "PCS",
            undefined,
            {
              transactionCategory: "RETURNABLE_DC_JOB_WORK_OUTWARD",
              referenceDocType: "JobWorkChallan",
              referenceDocId: existingChallan._id,
              referenceDocNumber: existingChallan.challanNumber,
              recipientOrSource: vendorName,
              purpose: item.processType || `Subcontractor Outward Dispatch (Updated)`,
              performedBy: req.user?.id || req.user?._id,
              hasSecondaryUnit: item.hasSecondaryUnit || false,
              secondaryUnit: item.secondaryUnit || "",
              secondaryQuantity: item.hasSecondaryUnit ? -Number(item.secondaryQuantitySent || (item.quantitySent * (item.conversionFactor || 1))) : 0,
              conversionFactor: item.conversionFactor || 1,
            }
          );
        } else if (jobWorkType === "wip-to-wip") {
          // Handled in bulk below
        }
      }

      // If WIP-to-WIP: Re-synchronize WIP outward stock transactions
      if (jobWorkType === "wip-to-wip") {
        try {
          const StockTransaction = req.getModel("StockTransaction", stockTransactionSchema);
          await StockTransaction.deleteMany({
            company: companyId,
            referenceDocType: "JobWorkChallan",
            referenceDocId: existingChallan._id,
            transactionCategory: "WIP_JOB_WORK_OUTWARD"
          });

          for (const item of processedItems) {
            const sentQtyNum = Number(item.quantitySent) || 0;
            await recordStockTransaction(req, {
              itemType: (item.itemType === "fg" || item.itemType === "inhouse" || item.itemType === "Component" || item.itemType === "component" || item.itemType === "SubAssembly" || item.itemType === "Assembly") ? "FGItem" : "RawMaterial",
              item: item.item && mongoose.Types.ObjectId.isValid(item.item) ? item.item : existingChallan._id,
              itemName: item.itemName,
              unit: item.unit || "PCS",
              movementType: "OUTWARD",
              transactionCategory: "WIP_JOB_WORK_OUTWARD",
              quantity: sentQtyNum,
              previousStock: 0,
              newStock: 0,
              referenceDocType: "JobWorkChallan",
              referenceDocId: existingChallan._id,
              referenceDocNumber: existingChallan.challanNumber,
              recipientOrSource: vendorName,
              purpose: item.processType || `WIP-to-WIP Subcontractor Dispatch to ${vendorName} (Challan #${existingChallan.challanNumber})`,
              performedBy: req.user?.id || req.user?._id,
              hasSecondaryUnit: item.hasSecondaryUnit || false,
              secondaryUnit: item.secondaryUnit || "",
              secondaryQuantity: item.hasSecondaryUnit ? -Number(item.secondaryQuantitySent || (sentQtyNum * (item.conversionFactor || 1))) : 0,
              conversionFactor: item.conversionFactor || 1,
            });
          }
        } catch (wipErr) {
          console.error("Error updating WIP_JOB_WORK_OUTWARD StockTransaction on edit:", wipErr);
        }
      }

      req.body.items = processedItems;
      if (req.body.operationMode === "assembly" && Array.isArray(req.body.assemblyGroups) && req.body.assemblyGroups.length > 0) {
        req.body.totalJobWorkCharges = req.body.assemblyGroups.reduce((acc, g) => acc + (Number(g.assemblyOutputItem?.processAmount) || 0), 0);
      } else {
        req.body.totalJobWorkCharges = processedItems.reduce((acc, it) => acc + (Number(it.processAmount) || 0), 0);
      }
    }

    const updatePayload = {
      ...req.body,
      updatedBy: req.user?.id || req.user?._id
    };
    if (!existingChallan.createdBy) {
      updatePayload.createdBy = req.user?.id || req.user?._id;
    } else {
      delete updatePayload.createdBy;
    }

    const challan = await JobWorkChallan.findOneAndUpdate(
      { _id: id, company: companyId },
      updatePayload,
      { new: true }
    )
      .populate("vendor")
      .populate("createdBy", "name userId email username")
      .populate("updatedBy", "name userId email username");

    res.status(200).json({ message: "Job Work Challan updated and stock synchronized successfully", challan });
  } catch (error) {
    console.error("Update JobWork Error:", error);
    res.status(500).json({ message: error.message });
  }
};
