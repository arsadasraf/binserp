import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { jobWorkSchema, vendorSchema } from "../../models/store/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user?.company?._id || req.user?.company);
};

export const getPendingJobWorkQC = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  req.getModel("Vendor", vendorSchema);
  const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);

  const pendingLots = [];

  try {
    // Find all Job Work Challans for the company that have receiveHistory or are active
    const query = companyId ? { company: companyId } : {};
    const jobWorks = await JobWorkChallan.find(query)
      .populate("vendor", "name code gstin billingAddress phone email")
      .sort({ updatedAt: -1 })
      .lean();

    jobWorks.forEach((jw) => {
      const vendorName = jw.vendor?.name || "Subcontractor Vendor";
      const vendorCode = jw.vendor?.code || "-";
      const challanNumber = jw.challanNumber;
      const jobWorkType = jw.jobWorkType || "store-conversion";
      const mrpNumber = jw.mrpNumber || "-";
      const mrpPlan = jw.mrpPlan;

      // 1. Check receiveHistory entries that require QC
      if (Array.isArray(jw.receiveHistory) && jw.receiveHistory.length > 0) {
        jw.receiveHistory.forEach((hist) => {
          const totalQty = Number(hist.quantity) || 0;
          const accepted = Number(hist.acceptedQuantity) || 0;
          const rejected = Number(hist.rejectedQuantity) || 0;
          const rework = Number(hist.reworkQuantity) || 0;
          const remaining = Math.max(0, totalQty - accepted - rejected - rework);

          // If QC is required and not yet passed/skipped, or remaining uninspected qty > 0
          const isPending = hist.qcRequired !== false && 
            hist.qcStatus !== "Skipped" && 
            hist.qcStatus !== "Passed" && 
            (hist.qcStatus === "Pending" || hist.qcStatus === "Partial" || !hist.qcStatus || remaining > 0);

          if (isPending && (remaining > 0 || (accepted === 0 && rejected === 0 && totalQty > 0))) {
            // Find matched item in items array or returning items
            let matchedItem = (jw.items || []).find(i => 
              i._id?.toString() === hist.itemId?.toString() ||
              (hist.returningItemId && Array.isArray(i.returningItems) && i.returningItems.some(r => r._id?.toString() === hist.returningItemId?.toString())) ||
              (Array.isArray(i.returningItems) && i.returningItems.some(r => r._id?.toString() === hist.itemId?.toString()))
            );

            let matchedRet = null;
            if (matchedItem?.returningItems && matchedItem.returningItems.length > 0) {
              matchedRet = (hist.returningItemId && matchedItem.returningItems.find(r => r._id?.toString() === hist.returningItemId?.toString())) ||
                matchedItem.returningItems.find(r => r._id?.toString() === hist.itemId?.toString()) || 
                matchedItem.returningItems[0];
            }

            let processType = matchedItem?.processType || "Job Work Processing";
            let targetItemId = matchedRet?.receivedItem || matchedItem?.receivedItem || matchedItem?.item || hist.itemId;
            let targetItemName = matchedRet?.receivedItemName || hist.itemName || matchedItem?.receivedItemName || matchedItem?.itemName || "Processed Item";
            let targetItemType = matchedRet?.receivedItemType || matchedItem?.receivedItemType || matchedItem?.itemType || "fg";

            pendingLots.push({
              sourceType: "JOBWORK_RECEIPT",
              jobWorkChallanId: jw._id,
              receiveHistoryId: hist._id,
              challanNumber,
              grnNumber: hist.grnNumber || `JWGRN-${jw._id.toString().slice(-4)}`,
              vendorDcNumber: hist.vendorDcNumber || "-",
              vendorInvoiceDate: hist.vendorInvoiceDate || hist.date,
              date: hist.date || jw.date,
              vendorId: jw.vendor?._id || jw.vendor,
              vendorName,
              vendorCode,
              vendorGst: jw.vendor?.gstin || "-",
              itemId: targetItemId,
              returningItemId: matchedRet?._id,
              itemName: targetItemName,
              itemType: targetItemType,
              processType,
              jobWorkType,
              mrpNumber,
              mrpPlan,
              quantitySent: matchedItem?.quantitySent || totalQty,
              receivedQuantity: remaining > 0 ? remaining : totalQty,
              totalReceivedQuantity: totalQty,
              unit: matchedRet?.receivingUnit || matchedItem?.receivingUnit || matchedItem?.unit || "PCS"
            });
          }
        });
      }

      // 2. Also check returningItems with quantityReceived > 0 if no receiveHistory present
      if (!jw.receiveHistory || jw.receiveHistory.length === 0) {
        (jw.items || []).forEach((item) => {
          if (Array.isArray(item.returningItems) && item.returningItems.length > 0) {
            item.returningItems.forEach((ret) => {
              const recQty = Number(ret.quantityReceived) || 0;
              if (recQty > 0) {
                pendingLots.push({
                  sourceType: "JOBWORK_RETURNING_ITEM",
                  jobWorkChallanId: jw._id,
                  challanNumber,
                  grnNumber: `JWGRN-${jw._id.toString().slice(-4)}`,
                  vendorDcNumber: "-",
                  date: jw.date,
                  vendorId: jw.vendor?._id || jw.vendor,
                  vendorName,
                  vendorCode,
                  vendorGst: jw.vendor?.gstin || "-",
                  itemId: ret.receivedItem || item.item,
                  returningItemId: ret._id,
                  itemName: ret.receivedItemName || item.itemName || "Returned Item",
                  itemType: ret.receivedItemType || "fg",
                  processType: item.processType || "Conversion",
                  jobWorkType,
                  mrpNumber,
                  mrpPlan,
                  quantitySent: item.quantitySent || recQty,
                  receivedQuantity: recQty,
                  totalReceivedQuantity: recQty,
                  unit: ret.receivingUnit || item.unit || "PCS"
                });
              }
            });
          }
        });
      }
    });
  } catch (e) {
    console.warn("Could not query Job Works for pending QC:", e.message);
  }

  return res.status(200).json(new ApiResponse(200, pendingLots, "Fetched Pending Job Work QC Lots"));
});
