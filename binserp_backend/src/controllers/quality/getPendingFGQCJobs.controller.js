import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { fgGRNSchema, fgItemSchema } from "../../models/store/index.js";
import { jobSchema } from "../../models/ppc/index.js";

export const getPendingFGQCJobs = asyncHandler(async (req, res) => {
  const companyId = req.company?._id || req.user?.company;

  // Register schemas for population
  req.getModel("FGItem", fgItemSchema);
  req.getModel("Job", jobSchema);

  const pendingLots = [];

  // 1. Fetch Pending FG GRNs from Store
  try {
    const FGGRN = req.getModel("FGGRN", fgGRNSchema);
    const pendingFGGRNs = await FGGRN.find({
      company: companyId,
      $or: [
        { qcStatus: "Pending" },
        { qcStatus: "Partial" },
        { qcRequired: true, qcStatus: { $ne: "Completed" } },
        { qcStatus: { $exists: false } }
      ]
    })
    .populate("items.fgItem", "name partNumber drawingNumber unit")
    .sort({ createdAt: -1 })
    .lean();

    pendingFGGRNs.forEach((grn) => {
      // If qcStatus is explicitly Completed or Skipped without qcRequired, skip
      if (grn.qcStatus === "Completed" || (grn.qcStatus === "Skipped" && !grn.qcRequired)) {
        return;
      }

      (grn.items || []).forEach((item, idx) => {
        const totalQty = Number(item.quantity) || Number(item.receivedQuantity) || 0;
        const accepted = Number(item.acceptedQuantity) || 0;
        const rejected = Number(item.rejectedQuantity) || 0;
        const remainingQty = Math.max(0, totalQty - accepted - rejected);

        // Only include if there is pending quantity to inspect
        if (remainingQty > 0 || (accepted === 0 && rejected === 0 && totalQty > 0)) {
          const resolvedItemName = item.itemName || item.fgItem?.name || item.name || "Finished Good";
          const resolvedItemCode = item.fgItem?.partNumber || item.partNumber || item.fgItemCode || item.code || "-";
          const resolvedItemId = item.fgItem?._id || item.fgItem || item._id;

          pendingLots.push({
            sourceType: "FG_GRN",
            sourceId: grn._id,
            grnItemId: item._id,
            sourceNumber: grn.grnNumber || grn.fgGrnNumber || `FG-GRN-${grn._id.toString().slice(-4)}`,
            date: grn.date || grn.createdAt,
            customerName: grn.customerName || grn.customer?.name || "Store Inward FG",
            customerPoReference: grn.customerPoReference || grn.poReference || grn.mrpNumber || "-",
            itemId: resolvedItemId,
            itemName: resolvedItemName,
            itemCode: resolvedItemCode,
            batchNumber: item.batchNo || item.heatNo || grn.batchNumber || "-",
            quantity: remainingQty > 0 ? remainingQty : totalQty,
            totalLotQuantity: totalQty,
            unit: item.unit || item.fgItem?.unit || "PCS",
            itemIndex: idx
          });
        }
      });
    });
  } catch (e) {
    console.warn("Could not query FG GRNs for pending QC:", e.message);
  }

  // 2. Fetch Completed PPC Production Jobs awaiting final QA signoff
  try {
    const Job = req.getModel("Job", jobSchema);
    const completedJobs = await Job.find({
      company: companyId,
      status: "Completed",
      $or: [
        { qaStatus: "Pending" },
        { qaStatus: { $exists: false } }
      ]
    }).populate("fgItem", "name partNumber drawingNumber unit").sort({ createdAt: -1 }).lean();

    completedJobs.forEach((job) => {
      pendingLots.push({
        sourceType: "PRODUCTION_JOB",
        sourceId: job._id,
        sourceNumber: job.jobCardNumber || job.jobNumber || `JOB-${job._id.toString().slice(-4)}`,
        date: job.updatedAt || job.createdAt,
        customerName: job.customerName || job.customer?.name || "Production Line",
        customerPoReference: job.salesOrderNumber || "-",
        itemId: job.fgItem?._id || job.fgItem,
        itemName: job.fgItem?.name || job.partName || "Finished Product",
        itemCode: job.fgItem?.partNumber || job.partNumber || "-",
        batchNumber: job.batchNumber || job.jobCardNumber || "-",
        quantity: Number(job.producedQuantity) || Number(job.targetQuantity) || 0,
        unit: job.unit || job.fgItem?.unit || "PCS"
      });
    });
  } catch (e) {
    console.warn("Could not query PPC Jobs for pending QC:", e.message);
  }

  return res.status(200).json(new ApiResponse(200, pendingLots, "Fetched Pending FG QC Lots"));
});
