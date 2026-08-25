import mongoose from "mongoose";
import { 
  jobWorkSchema, vendorSchema, fgItemSchema, 
  fgInventoryMonthlySchema, rmInventoryMonthlySchema 
} from "../../models/store/index.js";
import { updateInventoryStock } from "./updateInventoryStock.controller.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import { jobSchema, componentSchema } from "../../models/ppc/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const receiveJobWorkItems = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
    const Vendor = req.getModel("Vendor", vendorSchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const Job = req.getModel("Job", jobSchema);
    const Component = req.getModel("Component", componentSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    let { 
      items: receivedItems,
      grnNumber: customGrnNumber,
      vendorDcNumber,
      vendorInvoiceDate,
      vehicleNo,
      qcRequired = true,
      qcStatus,
      remarks,
      documents = []
    } = req.body;

    if (qcRequired === 'true') qcRequired = true;
    else if (qcRequired === 'false') qcRequired = false;
    else qcRequired = !!qcRequired;

    const jobWork = await JobWorkChallan.findById(id).populate("vendor");
    if (!jobWork) return res.status(404).json({ message: "Job Work Challan not found" });

    const vendorName = jobWork.vendor?.name || "Subcontractor Vendor";
    const now = new Date();
    const generatedGrnNumber = customGrnNumber || `JWGRN-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const isRouteCard = jobWork.jobWorkType === "route-card";
    const isStoreConversion = jobWork.jobWorkType === "store-conversion" || jobWork.jobWorkType === "inventory-conversion" || !jobWork.jobWorkType;
    const isWipWorkflow = jobWork.jobWorkType === "store-to-wip" || jobWork.jobWorkType === "wip-to-wip";

    for (const recItem of receivedItems || []) {
      const { 
        itemId, 
        returningItemId, 
        quantity, 
        acceptedQuantity, 
        rejectedQuantity, 
        reworkQuantity, 
        rejectionReason, 
        batchNumber 
      } = recItem;

      const qtyNum = Number(quantity) || 0;
      if (qtyNum <= 0) continue;

      let matchedItemName = "Returned Item";
      let targetItemDoc = null;
      let targetItemType = "fg";

      // 1. Locate returning item and update inward counters on Challan
      for (const jwItem of jobWork.items) {
        if (jwItem.returningItems && jwItem.returningItems.length > 0) {
          const retDoc = jwItem.returningItems.id(returningItemId || itemId);
          if (retDoc) {
            matchedItemName = retDoc.receivedItemName || jwItem.itemName || matchedItemName;
            targetItemDoc = retDoc.receivedItem;
            targetItemType = (retDoc.receivedItemType || "fg").toLowerCase();

            retDoc.quantityReceived = (retDoc.quantityReceived || 0) + qtyNum;
            if (retDoc.quantityReceived >= retDoc.quantityToBeReceived) {
              retDoc.status = "Completed";
            } else {
              retDoc.status = "Partial";
            }

            const allRetCompleted = jwItem.returningItems.every(
              r => r.status === "Completed" || (r.quantityReceived || 0) >= r.quantityToBeReceived
            );
            jwItem.quantityReceived = (jwItem.quantityReceived || 0) + qtyNum;
            jwItem.status = allRetCompleted ? "Completed" : "Partial";
            break;
          }
        }

        if (String(jwItem._id) === String(itemId)) {
          matchedItemName = jwItem.itemName || matchedItemName;
          targetItemDoc = jwItem.receivedItem || jwItem.item;
          targetItemType = (jwItem.receivedItemType || jwItem.itemType || "fg").toLowerCase();

          jwItem.quantityReceived = (jwItem.quantityReceived || 0) + qtyNum;
          const targetQty = jwItem.quantityToBeReceived || jwItem.quantitySent;
          if (jwItem.quantityReceived >= targetQty) {
            jwItem.status = "Completed";
          } else {
            jwItem.status = "Partial";
          }
          break;
        }
      }

      // 2. STOCK UPDATE LOGIC:
      // If QC is required: hold in QC Pending state, DO NOT increment available stock yet!
      // If QC is not required: immediately increment available stock.
      if (!qcRequired) {
        // QC SKIPPED: Direct Stock Release
        const directAcceptedQty = Number(acceptedQuantity !== undefined ? acceptedQuantity : qtyNum) || qtyNum;

        if (isStoreConversion) {
          if (targetItemType === "bo" || targetItemType === "rm") {
            if (targetItemDoc && mongoose.Types.ObjectId.isValid(targetItemDoc)) {
              await updateInventoryStock(
                req,
                targetItemDoc,
                directAcceptedQty,
                "PCS",
                undefined,
                {
                  transactionCategory: "RM_CONVERSION_INWARD",
                  referenceDocType: "GRN",
                  referenceDocId: jobWork._id,
                  referenceDocNumber: generatedGrnNumber,
                  recipientOrSource: vendorName,
                  purpose: `RM Conversion Direct Inward from ${vendorName} (Challan #${jobWork.challanNumber})`,
                  performedBy: req.user?.id || req.user?._id,
                }
              );

              const currentDate = new Date();
              const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
              const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
              try {
                await RMInventoryMonthly.findOneAndUpdate(
                  { company: companyId, material: targetItemDoc, month: currentMonthStr },
                  { $inc: { totalInwardQuantity: directAcceptedQty } },
                  { new: true, upsert: true }
                );
              } catch (mErr) {
                console.error("Error updating RM monthly inward quantity on JW GRN:", mErr);
              }
            }
          } else {
            // FG Item Direct Inward
            if (targetItemDoc && mongoose.Types.ObjectId.isValid(targetItemDoc)) {
              const fgDoc = await FGItem.findById(targetItemDoc);
              if (fgDoc) {
                const previousStock = fgDoc.quantity || 0;
                const newStock = previousStock + directAcceptedQty;

                await FGItem.findByIdAndUpdate(targetItemDoc, { $set: { quantity: newStock } });

                const currentDate = new Date();
                const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);
                
                try {
                  await FGInventoryMonthly.findOneAndUpdate(
                    { company: companyId, fgItem: targetItemDoc, month: currentMonthStr },
                    { $inc: { totalInwardQuantity: directAcceptedQty } },
                    { new: true, upsert: true }
                  );
                } catch (mErr) {
                  console.error("Error updating FG monthly inward quantity on JW GRN:", mErr);
                }

                await recordStockTransaction(req, {
                  itemType: "FGItem",
                  item: targetItemDoc,
                  itemName: matchedItemName,
                  unit: fgDoc.unit || "Nos",
                  movementType: "INWARD",
                  transactionCategory: "JOB_WORK_FG_INWARD",
                  quantity: directAcceptedQty,
                  previousStock,
                  newStock,
                  referenceDocType: "JobWorkChallan",
                  referenceDocId: jobWork._id,
                  referenceDocNumber: generatedGrnNumber,
                  recipientOrSource: vendorName,
                  purpose: `Job Work FG Return Direct Inward to Main Store (Challan #${jobWork.challanNumber})`,
                  performedBy: req.user?.id || req.user?._id,
                });
              }
            }
          }
        } else if (isWipWorkflow) {
          // Direct WIP Release
          if (targetItemDoc && mongoose.Types.ObjectId.isValid(targetItemDoc)) {
            try {
              await Component.findByIdAndUpdate(targetItemDoc, { $inc: { quantity: directAcceptedQty } });
            } catch (e) { }
          }

          await recordStockTransaction(req, {
            itemType: "Component",
            item: targetItemDoc || jobWork._id,
            itemName: matchedItemName,
            unit: "Nos",
            movementType: "INWARD",
            transactionCategory: "JOB_WORK_WIP_RETURN",
            quantity: directAcceptedQty,
            previousStock: 0,
            newStock: directAcceptedQty,
            referenceDocType: "JobWorkChallan",
            referenceDocId: jobWork._id,
            referenceDocNumber: jobWork.challanNumber,
            recipientOrSource: `WIP Return (${jobWork.mrpNumber || 'In-Process'})`,
            purpose: `Returned to WIP under MRP ${jobWork.mrpNumber || 'Production'} from ${vendorName}`,
            performedBy: req.user?.id || req.user?._id,
          });
        } else if (isRouteCard) {
          // Route-Card Subcontracting direct release
          try {
            const jobId = jobWork.routeCardRef?.job;
            if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
              const jobDoc = await Job.findById(jobId);
              if (jobDoc && Array.isArray(jobDoc.processHistory)) {
                const seq = jobWork.routeCardRef?.operationSequence;
                const op = jobDoc.processHistory.find((p) => p.sequence === seq || p.isJobWork);
                if (op) {
                  op.status = "Completed";
                  op.endTime = now;
                  await jobDoc.save();
                }
              }
            }
          } catch (jobErr) {
            console.error("Error updating PPC Job processHistory for Job Work return:", jobErr);
          }

          await recordStockTransaction(req, {
            itemType: "Component",
            item: targetItemDoc && mongoose.Types.ObjectId.isValid(targetItemDoc) ? targetItemDoc : jobWork._id,
            itemName: matchedItemName,
            unit: "PCS",
            movementType: "INWARD",
            transactionCategory: "JOB_WORK_RETURN_INWARD",
            quantity: directAcceptedQty,
            previousStock: 0,
            newStock: directAcceptedQty,
            referenceDocType: "JobWorkChallan",
            referenceDocId: jobWork._id,
            referenceDocNumber: generatedGrnNumber,
            recipientOrSource: "Shop Floor Production Line",
            purpose: `PPC Route-Card Subcontracting Direct Return (Challan #${jobWork.challanNumber})`,
            performedBy: req.user?.id || req.user?._id,
          });
        }
      } else {
        // QC REQUIRED: Log Pending Quality Inward (Does NOT touch available stock)
        await recordStockTransaction(req, {
          itemType: targetItemType === "fg" ? "FGItem" : (targetItemType === "bo" || targetItemType === "rm" ? "RawMaterial" : "Component"),
          item: targetItemDoc && mongoose.Types.ObjectId.isValid(targetItemDoc) ? targetItemDoc : jobWork._id,
          itemName: matchedItemName,
          unit: "PCS",
          movementType: "INWARD",
          transactionCategory: "JOB_WORK_QC_PENDING_INWARD",
          quantity: qtyNum,
          previousStock: 0,
          newStock: 0,
          referenceDocType: "JobWorkChallan",
          referenceDocId: jobWork._id,
          referenceDocNumber: generatedGrnNumber,
          recipientOrSource: vendorName,
          purpose: `Job Work Return Awaiting QC Inspection (Challan #${jobWork.challanNumber})`,
          performedBy: req.user?.id || req.user?._id,
        });
      }

      // 3. Record Inward Entry in receiveHistory
      if (!jobWork.receiveHistory) jobWork.receiveHistory = [];
      
      jobWork.receiveHistory.push({
        date: now,
        grnNumber: generatedGrnNumber,
        vendorDcNumber: vendorDcNumber || "",
        vendorInvoiceDate: vendorInvoiceDate ? new Date(vendorInvoiceDate) : undefined,
        vehicleNo: vehicleNo || "",
        itemId: itemId,
        returningItemId: returningItemId || undefined,
        itemName: matchedItemName,
        quantity: qtyNum,
        acceptedQuantity: qcRequired ? 0 : qtyNum,
        rejectedQuantity: 0,
        reworkQuantity: 0,
        rejectionReason: rejectionReason || "",
        qcRequired: qcRequired,
        qcStatus: qcRequired ? "Pending" : "Skipped",
        batchNumber: batchNumber || "",
        documents: documents || [],
        photos: (req.body.photos && Array.isArray(req.body.photos)) ? req.body.photos : [],
        remarks: remarks || "",
        receivedBy: req.user?.id || req.user?._id
      });
    }

    // Update Main Job Work Status
    const anyPending = jobWork.items.some(i => i.status !== "Completed");
    jobWork.status = anyPending ? "Partial" : "Closed";

    await jobWork.save();

    res.status(200).json({
      message: qcRequired 
        ? "Job Work Inward Receipt created and queued for Quality QC inspection" 
        : "Job Work Return GRN processed & stock updated successfully",
      grnNumber: generatedGrnNumber,
      jobWork
    });

  } catch (error) {
    console.error("Receive JobWork GRN Error:", error);
    res.status(500).json({ message: error.message || "Failed to process WIP Return GRN" });
  }
};
