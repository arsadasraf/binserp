import { FGQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { fgGRNSchema, fgItemSchema, fgInventoryMonthlySchema, rmBoItemSchema } from "../../models/store/index.js";
import { jobSchema } from "../../models/ppc/index.js";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";

export const createFGQC = asyncHandler(async (req, res) => {
  const companyId = req.company?._id || req.user?.company;
  if (!companyId) {
    throw new ApiError(400, "Company ID is required");
  }

  const {
    fgItemId,
    fgItemName,
    fgItemCode,
    productionJobId,
    jobCardNumber,
    fgGrnId,
    fgGrnItemId,
    fgGrnNumber,
    customerName,
    customerPoReference,
    batchNumber,
    heatNumber,
    unit,
    lotQuantity,
    inspectedQuantity,
    acceptedQuantity,
    rejectedQuantity,
    reworkQuantity,
    inspectionResults,
    overallStatus,
    remarks
  } = req.body;

  if (!fgItemName || lotQuantity === undefined) {
    throw new ApiError(400, "FG Item Name and Lot Quantity are required");
  }

  const acceptedQtyNum = Math.max(0, Number(acceptedQuantity) || 0);
  const rejectedQtyNum = Math.max(0, Number(rejectedQuantity) || 0);
  const reworkQtyNum = Math.max(0, Number(reworkQuantity) || 0);
  const lotQtyNum = Number(lotQuantity) || 0;

  const FGQC = req.getModel("FGQC", FGQCSchema);
  const FGItem = req.getModel("FGItem", fgItemSchema);
  const FGGRN = req.getModel("FGGRN", fgGRNSchema);
  const FGInventoryMonthly = req.getModel("FGInventoryMonthly", fgInventoryMonthlySchema);
  const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
  const Job = req.getModel("Job", jobSchema);

  // Generate certificate number
  const certNumber = `PDI/${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const fgQCRecord = await FGQC.create({
    company: companyId,
    fgItemId,
    fgItemName,
    fgItemCode,
    productionJobId,
    jobCardNumber,
    fgGrnId,
    fgGrnNumber,
    customerName,
    customerPoReference,
    batchNumber: batchNumber || `BATCH-${Date.now().toString().slice(-6)}`,
    heatNumber,
    unit: unit || "PCS",
    lotQuantity: lotQtyNum,
    inspectedQuantity: Number(inspectedQuantity) || lotQtyNum,
    acceptedQuantity: acceptedQtyNum,
    rejectedQuantity: rejectedQtyNum,
    reworkQuantity: reworkQtyNum,
    inspectionResults: Array.isArray(inspectionResults) ? inspectionResults : [],
    overallStatus: overallStatus || (rejectedQtyNum > 0 ? (acceptedQtyNum > 0 ? "Conditional" : "Rejected") : (reworkQtyNum > 0 ? "Rework" : "Accepted")),
    certificateNumber: certNumber,
    inspector: req.user?._id || req.user?.id,
    remarks
  });

  // ================= 1. RECONCILE STORE FG GRN =================
  let linkedMrpPlanId = null;
  let linkedMrpNumber = null;

  if (fgGrnId) {
    try {
      const fgGrnDoc = await FGGRN.findById(fgGrnId);
      if (fgGrnDoc) {
        linkedMrpPlanId = fgGrnDoc.mrpPlan;
        linkedMrpNumber = fgGrnDoc.mrpNumber;

        // Locate item in items array
        let itemIndex = -1;
        if (fgGrnItemId) {
          itemIndex = fgGrnDoc.items.findIndex(i => i._id.toString() === fgGrnItemId.toString());
        }
        if (itemIndex === -1 && fgItemId) {
          itemIndex = fgGrnDoc.items.findIndex(i => i.fgItem?.toString() === fgItemId.toString());
        }

        if (itemIndex > -1) {
          fgGrnDoc.items[itemIndex].acceptedQuantity = (fgGrnDoc.items[itemIndex].acceptedQuantity || 0) + acceptedQtyNum;
          fgGrnDoc.items[itemIndex].rejectedQuantity = (fgGrnDoc.items[itemIndex].rejectedQuantity || 0) + rejectedQtyNum;
        }

        // Check if all items in FG GRN are inspected
        const allInspected = fgGrnDoc.items.every(i => {
          const processed = (Number(i.acceptedQuantity) || 0) + (Number(i.rejectedQuantity) || 0);
          const target = Number(i.quantity) || Number(i.receivedQuantity) || 0;
          return processed >= target;
        });

        const anyInspected = fgGrnDoc.items.some(i => (Number(i.acceptedQuantity) || 0) + (Number(i.rejectedQuantity) || 0) > 0);

        if (allInspected) {
          fgGrnDoc.qcStatus = "Completed";
          fgGrnDoc.status = "Accepted";
        } else if (anyInspected) {
          fgGrnDoc.qcStatus = "Partial";
        }

        await fgGrnDoc.save();
      }
    } catch (e) {
      console.warn("[createFGQC] Error reconciling FG GRN:", e);
    }
  }

  // ================= 2. RECONCILE PPC PRODUCTION JOB =================
  if (productionJobId) {
    try {
      await Job.findByIdAndUpdate(productionJobId, {
        qaStatus: overallStatus || "Accepted",
        qaInspectionId: fgQCRecord._id
      });
    } catch (e) {
      console.warn("[createFGQC] Error updating PPC Job QA status:", e);
    }
  }

  // ================= 3. SYNCHRONIZE FINISHED GOODS STOCK =================
  if (acceptedQtyNum > 0 && fgItemId) {
    try {
      const existingFG = await FGItem.findById(fgItemId);
      const previousStock = existingFG ? (Number(existingFG.quantity) || 0) : 0;
      const newStock = previousStock + acceptedQtyNum;

      // Update FGItem Stock
      await FGItem.findByIdAndUpdate(fgItemId, {
        $set: { quantity: newStock },
        $inc: { currentStock: acceptedQtyNum }
      });

      // Update Monthly Inventory Inward
      const currentDate = new Date();
      const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      try {
        await FGInventoryMonthly.findOneAndUpdate(
          { company: companyId, fgItem: fgItemId, month: currentMonthStr },
          { $inc: { totalInwardQuantity: acceptedQtyNum } },
          { new: true, upsert: true }
        );
      } catch (mErr) {
        console.warn("[createFGQC] Error updating FG monthly inventory:", mErr);
      }

      // Record Stock Transaction in Ledger
      try {
        await recordStockTransaction(req, {
          itemType: "FGItem",
          item: fgItemId,
          itemName: fgItemName || existingFG?.name || "Finished Good",
          unit: unit || existingFG?.unit || "Nos",
          movementType: "INWARD",
          transactionCategory: "FG_QC_RELEASE_INWARD",
          quantity: acceptedQtyNum,
          previousStock,
          newStock,
          referenceDocType: "FGQC",
          referenceDocId: fgQCRecord._id,
          referenceDocNumber: certNumber,
          recipientOrSource: customerName || "Finished Goods QC Clearance",
          purpose: remarks || `FG Quality Inspection Clearance (${overallStatus || 'Accepted'})`,
          performedBy: req.user?._id || req.user?.id
        });
      } catch (txErr) {
        console.warn("[createFGQC] Error logging stock transaction:", txErr);
      }

      // ================= 4. RECONCILE MRP PLAN RECEIPTS IF LINKED =================
      if (linkedMrpPlanId || linkedMrpNumber) {
        try {
          const query = { company: companyId };
          if (linkedMrpPlanId) query._id = linkedMrpPlanId;
          else if (linkedMrpNumber) query.mrpNumber = linkedMrpNumber;

          const plan = await MRPPlan.findOne(query);
          if (plan && Array.isArray(plan.fgItems)) {
            const matchedFg = plan.fgItems.find(f => f.fgItem?.toString() === fgItemId.toString() || f.name === fgItemName);
            if (matchedFg) {
              matchedFg.receivedQuantity = (matchedFg.receivedQuantity || 0) + acceptedQtyNum;
              matchedFg.pendingQuantity = Math.max(0, (matchedFg.plannedQuantity || 0) - matchedFg.receivedQuantity);

              const allFgComplete = plan.fgItems.every(f => (f.receivedQuantity || 0) >= (f.plannedQuantity || 0));
              const anyFgStarted = plan.fgItems.some(f => (f.receivedQuantity || 0) > 0);

              if (allFgComplete) {
                plan.status = "Completed";
              } else if (anyFgStarted && plan.status === "Pending") {
                plan.status = "In Progress";
              }
              await plan.save();
            }
          }
        } catch (mrpErr) {
          console.warn("[createFGQC] Error updating MRP plan status:", mrpErr);
        }
      }
    } catch (stockErr) {
      console.error("[createFGQC] Error updating FG stock:", stockErr);
    }
  }

  return res.status(201).json(new ApiResponse(201, fgQCRecord, "Finished Goods Quality Inspection recorded and stock synchronized successfully"));
});
