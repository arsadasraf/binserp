import mongoose from "mongoose";
import { 
  jobWorkSchema, vendorSchema, rmBoItemSchema, 
  rmInventoryMonthlySchema, fgItemSchema, inventorySchema 
} from "../../models/store/index.js";
import { updateInventoryStock } from './updateInventoryStock.controller.js';
import { componentSchema, jobSchema } from "../../models/ppc/index.js";

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

    // 2. Enforce 2-hour edit window
    const createdAt = new Date(existingChallan.createdAt);
    const diffInHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    if (diffInHours > 2) {
      return res.status(400).json({ 
        message: "Job Work Challan cannot be edited after 2 hours from creation to preserve audit integrity." 
      });
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

    const isValidObjectId = (val) => val && mongoose.Types.ObjectId.isValid(val);

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
        let validItemId = isValidObjectId(item.item) ? item.item : null;

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
        }

        // Process returning items
        const processedReturningItems = [];
        if (Array.isArray(item.returningItems) && item.returningItems.length > 0) {
          for (const ret of item.returningItems) {
            const retDoc = {
              receivedItemName: ret.receivedItemName || ret.itemName || itemName || "Returning Material",
              receivedItemType: ret.receivedItemType || "fg",
              quantityToBeReceived: Number(ret.quantityToBeReceived) || 1,
              quantityReceived: Number(ret.quantityReceived) || 0,
              receivingUnit: ret.receivingUnit || "PCS",
              status: ret.status || "Sent"
            };
            if (isValidObjectId(ret.receivedItem)) {
              retDoc.receivedItem = ret.receivedItem;
            }
            processedReturningItems.push(retDoc);
          }
        }

        const processedItem = {
          itemName: itemName || item.itemName || "Sent Item",
          itemType: item.itemType || "rm",
          quantitySent: Number(item.quantitySent) || 0,
          quantityReceived: Number(item.quantityReceived) || 0,
          unit: item.unit || "PCS",
          unitPrice: Number(item.unitPrice) || 0,
          processType: item.processType || "Job Work",
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
            }
          );
        }
      }

      req.body.items = processedItems;
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
