import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, fgItemSchema, fgInventoryMonthlySchema, rmInventoryMonthlySchema } from "../../models/store/index.js";
import { updateInventoryStock } from "./updateInventoryStock.controller.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import { jobSchema } from "../../models/ppc/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const receiveJobWorkItems = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
    const Vendor = req.getModel("Vendor", vendorSchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const Job = req.getModel("Job", jobSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { 
      items: receivedItems,
      grnNumber: customGrnNumber,
      vendorDcNumber,
      vendorInvoiceDate,
      vehicleNo,
      qcRequired = true,
      qcStatus = "Passed",
      remarks,
      documents = []
    } = req.body;

    const jobWork = await JobWorkChallan.findById(id).populate("vendor");
    if (!jobWork) return res.status(404).json({ message: "Job Work Challan not found" });

    const vendorName = jobWork.vendor?.name || "Subcontractor Vendor";
    const now = new Date();
    const generatedGrnNumber = customGrnNumber || `JWGRN-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const isRouteCard = jobWork.jobWorkType === "route-card";

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
      const acceptedNum = Number(acceptedQuantity !== undefined ? acceptedQuantity : quantity) || 0;
      const rejectedNum = Number(rejectedQuantity) || 0;
      const reworkNum = Number(reworkQuantity) || 0;

      if (qtyNum <= 0) continue;

      let matchedItemName = "Returned Item";
      let targetItemDoc = null;

      let targetItemType = "fg";

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

      // Stock & Inventory Update Logic for Conversion Job Work vs Route Card Job Work
      if (!isRouteCard && acceptedNum > 0) {
        const isPendingQC = Boolean(qcRequired) && (qcStatus === "Pending" || qcStatus === "Partial");
        const effectiveQty = isPendingQC ? acceptedNum : acceptedNum;

        if (targetItemType === "bo" || targetItemType === "rm") {
          // Update RM/BO Inventory Stock
          if (targetItemDoc && mongoose.Types.ObjectId.isValid(targetItemDoc)) {
            await updateInventoryStock(
              req,
              targetItemDoc,
              effectiveQty,
              "PCS",
              undefined,
              {
                isPending: isPendingQC,
                transactionCategory: isPendingQC ? "GRN_QC_PENDING_INWARD" : "JOB_WORK_RETURN_INWARD",
                referenceDocType: "GRN",
                referenceDocId: jobWork._id,
                referenceDocNumber: generatedGrnNumber,
                recipientOrSource: vendorName,
                purpose: `Job Work Return GRN Inward (Challan #${jobWork.challanNumber})`,
                performedBy: req.user?.id || req.user?._id,
              }
            );
          }
        } else {
          // Update FG Item Stock (FG/Component/InHouse)
          if (targetItemDoc && mongoose.Types.ObjectId.isValid(targetItemDoc)) {
            const fgDoc = await FGItem.findById(targetItemDoc);
            if (fgDoc) {
              const previousStock = fgDoc.quantity || 0;
              const newStock = previousStock + effectiveQty;

              if (!isPendingQC) {
                await FGItem.findByIdAndUpdate(targetItemDoc, { $set: { quantity: newStock } });
              }

              const currentDate = new Date();
              const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
              const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);
              
              try {
                await FGInventoryMonthly.findOneAndUpdate(
                  { company: companyId, fgItem: targetItemDoc, month: currentMonthStr },
                  { $inc: { totalInwardQuantity: effectiveQty } },
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
                transactionCategory: isPendingQC ? "GRN_QC_PENDING_INWARD" : "JOB_WORK_FG_INWARD",
                quantity: effectiveQty,
                previousStock,
                newStock,
                referenceDocType: "FGGRN",
                referenceDocId: jobWork._id,
                referenceDocNumber: generatedGrnNumber,
                recipientOrSource: vendorName,
                purpose: `Job Work FG Return GRN Inward (Challan #${jobWork.challanNumber})`,
                performedBy: req.user?.id || req.user?._id,
              });
            }
          }
        }
      } else if (isRouteCard && acceptedNum > 0) {
        // Route-Card Subcontracting: Update PPC Job Operation Status to Completed
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

        // Log transaction entry returning item back to Shopfloor Active WIP
        await recordStockTransaction(req, {
          itemType: "Component",
          item: targetItemDoc && mongoose.Types.ObjectId.isValid(targetItemDoc) ? targetItemDoc : jobWork._id,
          itemName: matchedItemName,
          unit: "PCS",
          movementType: "INWARD",
          transactionCategory: "JOB_WORK_RETURN_INWARD",
          quantity: acceptedNum,
          previousStock: 0,
          newStock: acceptedNum,
          referenceDocType: "JobWorkChallan",
          referenceDocId: jobWork._id,
          referenceDocNumber: generatedGrnNumber,
          recipientOrSource: "Shop Floor Production Line",
          purpose: `PPC Route-Card Subcontracting Return (Challan #${jobWork.challanNumber})`,
          performedBy: req.user?.id || req.user?._id,
        });
      }

      if (!jobWork.receiveHistory) jobWork.receiveHistory = [];
      
      jobWork.receiveHistory.push({
        date: now,
        grnNumber: generatedGrnNumber,
        vendorDcNumber: vendorDcNumber || "",
        vendorInvoiceDate: vendorInvoiceDate ? new Date(vendorInvoiceDate) : undefined,
        vehicleNo: vehicleNo || "",
        itemId: itemId,
        itemName: matchedItemName,
        quantity: qtyNum,
        acceptedQuantity: acceptedNum,
        rejectedQuantity: rejectedNum,
        reworkQuantity: reworkNum,
        rejectionReason: rejectionReason || "",
        qcRequired: Boolean(qcRequired),
        qcStatus: qcRequired ? (qcStatus || "Pending") : "Passed",
        batchNumber: batchNumber || "",
        documents: documents || [],
        remarks: remarks || "",
        receivedBy: req.user?.id || req.user?._id
      });
    }

    // Update Main Job Work Status
    const anyPending = jobWork.items.some(i => i.status !== "Completed");
    jobWork.status = anyPending ? "Partial" : "Closed";

    await jobWork.save();

    res.status(200).json({
      message: "Job Work Return GRN processed & stock updated successfully",
      grnNumber: generatedGrnNumber,
      jobWork
    });

  } catch (error) {
    console.error("Receive JobWork GRN Error:", error);
    res.status(500).json({ message: error.message || "Failed to process WIP Return GRN" });
  }
};
