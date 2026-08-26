import { JobWorkQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { 
  jobWorkSchema, vendorSchema, fgItemSchema, 
  rawMaterialSchema, boughtOutSchema, consumableItemSchema, 
  rmBoItemSchema, fgInventoryMonthlySchema, rmInventoryMonthlySchema 
} from "../../models/store/index.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { updateInventoryStock } from "../store/updateInventoryStock.controller.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";

export const createJobWorkQC = asyncHandler(async (req, res) => {
  const companyId = req.company?._id || req.user?.company;
  if (!companyId) {
    throw new ApiError(400, "Company ID is required");
  }

  const {
    jobWorkChallanId,
    challanNumber,
    receiveHistoryId,
    grnNumber,
    vendorDcNumber,
    vendorInvoiceDate,
    vendor,
    vendorName,
    itemId,
    returningItemId,
    itemName,
    itemCode,
    itemType,
    processType,
    jobWorkType = "store-conversion",
    unit,
    quantitySent,
    receivedQuantity,
    inspectedQuantity,
    acceptedQuantity,
    rejectedQuantity,
    reworkQuantity,
    scrapQuantity,
    inspectionResults,
    overallStatus,
    rejectionReason,
    defectCategory,
    dispositionAction,
    remarks
  } = req.body;

  if (!challanNumber || receivedQuantity === undefined) {
    throw new ApiError(400, "Job Work Challan Number and Received Quantity are required");
  }

  const acceptedQtyNum = Math.max(0, Number(acceptedQuantity) || 0);
  const rejectedQtyNum = Math.max(0, Number(rejectedQuantity) || 0);
  const reworkQtyNum = Math.max(0, Number(reworkQuantity) || 0);
  const scrapQtyNum = Math.max(0, Number(scrapQuantity) || 0);
  const recQtyNum = Number(receivedQuantity) || 0;

  const JobWorkQC = req.getModel("JobWorkQC", JobWorkQCSchema);
  const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
  const FGItem = req.getModel("FGItem", fgItemSchema);
  const Component = req.getModel("Component", componentSchema);
  const Job = req.getModel("Job", jobSchema);

  // Generate unique certificate number
  const certNumber = `JW-SCN/${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  let resolvedJobWorkType = jobWorkType || "store-conversion";
  let resolvedRouteCardRef = null;

  if (jobWorkChallanId) {
    try {
      const jwDoc = await JobWorkChallan.findById(jobWorkChallanId);
      if (jwDoc) {
        resolvedJobWorkType = jwDoc.jobWorkType || resolvedJobWorkType;
        resolvedRouteCardRef = jwDoc.routeCardRef;

        if (Array.isArray(jwDoc.receiveHistory)) {
          const histItem = receiveHistoryId 
            ? jwDoc.receiveHistory.id(receiveHistoryId)
            : jwDoc.receiveHistory.find(h => (h.grnNumber && h.grnNumber === grnNumber) || (h.itemId && h.itemId.toString() === itemId?.toString()));

          if (histItem) {
            histItem.acceptedQuantity = (histItem.acceptedQuantity || 0) + acceptedQtyNum;
            histItem.rejectedQuantity = (histItem.rejectedQuantity || 0) + rejectedQtyNum;
            histItem.reworkQuantity = (histItem.reworkQuantity || 0) + reworkQtyNum;
            histItem.rejectionReason = rejectionReason || defectCategory || "";

            const totalProcessed = (histItem.acceptedQuantity || 0) + (histItem.rejectedQuantity || 0) + (histItem.reworkQuantity || 0);
            if (totalProcessed >= histItem.quantity) {
              histItem.qcStatus = histItem.rejectedQuantity > 0 ? (histItem.acceptedQuantity > 0 ? "Partial" : "Rejected") : "Passed";
            } else {
              histItem.qcStatus = "Partial";
            }
          }
        }

        await jwDoc.save();
      }
    } catch (e) {
      console.warn("[createJobWorkQC] Error reconciling JobWorkChallan:", e);
    }
  }

  const jwQCRecord = await JobWorkQC.create({
    company: companyId,
    jobWorkChallanId,
    challanNumber,
    grnNumber,
    vendorDcNumber,
    vendorInvoiceDate,
    vendor,
    vendorName: vendorName || "Subcontractor Vendor",
    itemId,
    itemName: itemName || "Job Work Item",
    itemCode,
    itemType: (itemType || "fg").toLowerCase(),
    processType: processType || "Conversion / Machining",
    jobWorkType: resolvedJobWorkType,
    unit: unit || "PCS",
    quantitySent: Number(quantitySent) || 0,
    receivedQuantity: recQtyNum,
    inspectedQuantity: Number(inspectedQuantity) || recQtyNum,
    acceptedQuantity: acceptedQtyNum,
    rejectedQuantity: rejectedQtyNum,
    reworkQuantity: reworkQtyNum,
    scrapQuantity: scrapQtyNum,
    inspectionResults: Array.isArray(inspectionResults) ? inspectionResults : [],
    overallStatus: overallStatus || (rejectedQtyNum > 0 ? (acceptedQtyNum > 0 ? "Conditional" : "Rejected") : (reworkQtyNum > 0 ? "Rework" : "Accepted")),
    certificateNumber: certNumber,
    rejectionReason,
    defectCategory,
    dispositionAction: dispositionAction || (rejectedQtyNum > 0 ? "Vendor Rework / Debit Note" : "Store Inward"),
    inspector: req.user?._id || req.user?.id,
    remarks
  });

  // ================= 2. SYNCHRONIZE RESPECTIVE STORE / WIP STOCK =================
  if (acceptedQtyNum > 0 && itemId) {
    try {
      const resolvedType = (itemType || "fg").toLowerCase();
      const isStoreConversion = resolvedJobWorkType === "store-conversion" || resolvedJobWorkType === "inventory-conversion" || !resolvedJobWorkType;
      const isWipWorkflow = resolvedJobWorkType === "store-to-wip" || resolvedJobWorkType === "wip-to-wip";
      const isRouteCard = resolvedJobWorkType === "route-card";

      if (isStoreConversion) {
        if (resolvedType === "fg") {
          // Store Conversion to Finished Goods
          const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);
          const existingFG = await FGItem.findById(itemId);
          const previousStock = existingFG ? (Number(existingFG.quantity) || 0) : 0;
          const newStock = previousStock + acceptedQtyNum;

          await FGItem.findByIdAndUpdate(itemId, {
            $set: { quantity: newStock },
            $inc: { currentStock: acceptedQtyNum }
          });

          const currentDate = new Date();
          const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: itemId, month: currentMonthStr },
              { $inc: { totalInwardQuantity: acceptedQtyNum } },
              { new: true, upsert: true }
            );
          } catch (mErr) { }

          await recordStockTransaction(req, {
            itemType: "FGItem",
            item: itemId,
            itemName: itemName || existingFG?.name || "Finished Good",
            unit: unit || existingFG?.unit || "Nos",
            movementType: "INWARD",
            transactionCategory: "JOBWORK_QC_RELEASE_INWARD",
            quantity: acceptedQtyNum,
            previousStock,
            newStock,
            referenceDocType: "JobWorkChallan",
            referenceDocId: jobWorkChallanId,
            referenceDocNumber: challanNumber,
            recipientOrSource: vendorName || "Subcontractor Vendor",
            purpose: remarks || `Job Work QC Release to FG Store (${processType})`,
            performedBy: req.user?._id || req.user?.id
          });
        } else if (resolvedType === "bo" || resolvedType === "rm" || resolvedType === "rawmaterial") {
          // Store Conversion to RM / BO
          await updateInventoryStock(
            req,
            itemId,
            acceptedQtyNum,
            unit || "PCS",
            undefined,
            {
              transactionCategory: "RM_CONVERSION_INWARD",
              referenceDocType: "JobWorkChallan",
              referenceDocId: jobWorkChallanId,
              referenceDocNumber: challanNumber,
              recipientOrSource: vendorName || "Subcontractor Vendor",
              purpose: remarks || `RM Conversion QC Approved Inward from ${vendorName} (Challan #${challanNumber})`,
              performedBy: req.user?._id || req.user?.id
            }
          );

          const currentDate = new Date();
          const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
          try {
            await RMInventoryMonthly.findOneAndUpdate(
              { company: companyId, material: itemId, month: currentMonthStr },
              { $inc: { totalInwardQuantity: acceptedQtyNum } },
              { new: true, upsert: true }
            );
          } catch (mErr) {
            console.error("Error updating RM monthly inward quantity on JW QC:", mErr);
          }
        }
      } else if (isWipWorkflow) {
        // Store-to-WIP or WIP-to-WIP: Always goes to WIP FG Inventory (Component), never Main FG Store
        try {
          const compUpdated = await Component.findByIdAndUpdate(itemId, { $inc: { quantity: acceptedQtyNum } });
          if (!compUpdated) {
            await FGItem.findByIdAndUpdate(itemId, { $inc: { quantity: acceptedQtyNum } });
          }
        } catch (e) { }

        await recordStockTransaction(req, {
          itemType: "Component",
          item: itemId,
          itemName: itemName || "WIP FG Component",
          unit: unit || "Nos",
          movementType: "INWARD",
          transactionCategory: "JOBWORK_QC_WIP_RELEASE",
          quantity: acceptedQtyNum,
          previousStock: 0,
          newStock: acceptedQtyNum,
          referenceDocType: "JobWorkChallan",
          referenceDocId: jobWorkChallanId,
          referenceDocNumber: challanNumber,
          recipientOrSource: `WIP FG Store (${vendorName})`,
          purpose: remarks || `Job Work QC Release to WIP FG (${processType})`,
          performedBy: req.user?._id || req.user?.id
        });
      } else if (isRouteCard && resolvedRouteCardRef?.job) {
        // PPC Route-Card Subcontracting
        try {
          const jobDoc = await Job.findById(resolvedRouteCardRef.job);
          if (jobDoc && Array.isArray(jobDoc.processHistory)) {
            const seq = resolvedRouteCardRef.operationSequence;
            const op = jobDoc.processHistory.find((p) => p.sequence === seq || p.isJobWork);
            if (op) {
              op.status = "Completed";
              op.endTime = new Date();
              await jobDoc.save();
            }
          }
        } catch (jobErr) {
          console.warn("[createJobWorkQC] Error updating PPC Job status:", jobErr);
        }

        await recordStockTransaction(req, {
          itemType: "Component",
          item: itemId || jobWorkChallanId,
          itemName: itemName || "Route Card Component",
          unit: unit || "PCS",
          movementType: "INWARD",
          transactionCategory: "JOBWORK_QC_ROUTE_CARD_RELEASE",
          quantity: acceptedQtyNum,
          previousStock: 0,
          newStock: acceptedQtyNum,
          referenceDocType: "JobWorkChallan",
          referenceDocId: jobWorkChallanId,
          referenceDocNumber: challanNumber,
          recipientOrSource: "Shopfloor Active WIP",
          purpose: remarks || `Job Work QC Passed -> PPC Shopfloor WIP (${processType})`,
          performedBy: req.user?._id || req.user?.id
        });
      }
    } catch (stockErr) {
      console.error("[createJobWorkQC] Error releasing stock:", stockErr);
    }
  }

  // Record Rejection / Scrap in Stock Ledger if any items rejected
  if (rejectedQtyNum > 0 && itemId) {
    try {
      await recordStockTransaction(req, {
        itemType: "Component",
        item: itemId,
        itemName: itemName || "Job Work Item",
        unit: unit || "Nos",
        movementType: "OUTWARD",
        transactionCategory: "JOBWORK_QC_REJECTED",
        quantity: -rejectedQtyNum,
        previousStock: rejectedQtyNum,
        newStock: 0,
        referenceDocType: "JobWorkChallan",
        referenceDocId: jobWorkChallanId,
        referenceDocNumber: challanNumber,
        recipientOrSource: `Vendor Rejection (${vendorName || "Subcontractor"})`,
        purpose: rejectionReason || defectCategory || "Job Work Quality Rejection / Scrap",
        performedBy: req.user?._id || req.user?.id
      });
    } catch (e) { }
  }

  return res.status(201).json(new ApiResponse(201, jwQCRecord, "Job Work Quality Inspection recorded and respective stock synchronized successfully"));
});
