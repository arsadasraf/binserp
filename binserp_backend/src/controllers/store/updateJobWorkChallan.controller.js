import mongoose from "mongoose";
import { 
  jobWorkSchema, vendorSchema, rmBoItemSchema, 
  rmInventoryMonthlySchema, fgItemSchema, inventorySchema 
} from "../../models/store/index.js";
import { updateInventoryStock } from './updateInventoryStock.controller.js';
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
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

    const companyId = getCompanyId(req);
    const { id } = req.params;

    const existingChallan = await JobWorkChallan.findOne({ _id: id, company: companyId });
    if (!existingChallan) {
      return res.status(404).json({ message: "Job Work Challan not found" });
    }

    // 1. Block edit if already partially or fully received
    if (existingChallan.status === "Partial" || existingChallan.status === "Closed" || (Array.isArray(existingChallan.receiveHistory) && existingChallan.receiveHistory.length > 0)) {
      return res.status(400).json({ message: "Cannot edit a challan that has received items" });
    }

    // 2. Dynamic time lock governance
    const lockCheck = await checkTimeLockGovernance(req, 'jobWorkChallan', existingChallan.createdAt, 'edit');
    if (!lockCheck.allowed) {
      return res.status(403).json({ message: lockCheck.message });
    }

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

    const cleanId = (val) => {
      if (!val) return null;
      const s = String(val).trim();
      return s.includes('_') ? s.split('_').slice(1).join('_') : s;
    };
    const isValidObjectId = (val) => {
      const c = cleanId(val);
      return c && mongoose.Types.ObjectId.isValid(c) ? c : null;
    };

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
            const retAmount = Number(ret.processAmount) != null && !isNaN(Number(ret.processAmount)) && Number(ret.processAmount) > 0 
              ? Number(ret.processAmount) 
              : (retQty * retRate);

            const retDoc = {
              receivedItemName: ret.receivedItemName || ret.itemName || itemName || "Returning Material",
              receivedItemType: ret.receivedItemType || "fg",
              quantityToBeReceived: retQty,
              quantityReceived: Number(ret.quantityReceived) || 0,
              receivingUnit: ret.receivingUnit || "PCS",
              hasSecondaryUnit: Boolean(ret.hasSecondaryUnit),
              secondaryUnit: ret.secondaryUnit || "",
              conversionFactor: Number(ret.conversionFactor) || 1,
              secondaryQuantityToBeReceived: Number(ret.secondaryQuantityToBeReceived) || (ret.hasSecondaryUnit ? (retQty * (Number(ret.conversionFactor) || 1)) : 0),
              secondaryQuantityReceived: Number(ret.secondaryQuantityReceived) || 0,
              selectedUnit: ret.selectedUnit || ret.receivingUnit || "PCS",
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

        const totalReturningCharges = processedReturningItems.reduce((acc, r) => acc + (Number(r.processAmount) || 0), 0);
        const effectiveProcAmount = totalReturningCharges > 0 ? totalReturningCharges : (sentQtyNum * rateValue);

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
          selectedUnit: item.selectedUnit || item.unit || "PCS",
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
        }
      }

      req.body.items = processedItems;
      req.body.totalJobWorkCharges = processedItems.reduce((acc, it) => acc + (Number(it.processAmount) || 0), 0);
    }

    const challan = await JobWorkChallan.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true }
    ).populate("vendor");

    res.status(200).json({ message: "Job Work Challan updated and stock synchronized successfully", challan });
  } catch (error) {
    console.error("Update JobWork Error:", error);
    res.status(500).json({ message: error.message });
  }
};
