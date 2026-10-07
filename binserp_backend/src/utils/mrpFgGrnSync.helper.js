import mongoose from "mongoose";
import { mrpPlanSchema } from "../models/purchase/index.js";
import { fgGRNSchema } from "../models/store/index.js";

/**
 * Synchronizes MRP Plan Finished Goods receipt progress from all linked FG GRNs.
 * Recalculates receivedQuantity on each FG item and updates overall MRP status:
 * - 0 received: "In Production" (or "Planned")
 * - 0 < received < planned: "Partially Received"
 * - received >= planned: "Completed" (sets completedAt)
 *
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} [params.mrpPlanId] - ID of MRP Plan
 * @param {string} [params.mrpNumber] - Number of MRP Plan
 * @param {string|mongoose.Types.ObjectId} params.companyId - Tenant company ID
 * @param {object} params.req - Express request object for getModel and user context
 */
export const syncMRPPlanFGReceiptStatus = async ({ mrpPlanId, mrpNumber, companyId, req }) => {
  if (!companyId) return null;
  if (!mrpPlanId && !mrpNumber) return null;

  try {
    const MRPPlan = req?.getModel ? req.getModel("MRPPlan", mrpPlanSchema) : mongoose.model("MRPPlan", mrpPlanSchema);
    const FGGRN = req?.getModel ? req.getModel("FGGRN", fgGRNSchema) : mongoose.model("FGGRN", fgGRNSchema);

    const query = { company: companyId };
    if (mrpPlanId && mongoose.Types.ObjectId.isValid(mrpPlanId)) {
      query._id = mrpPlanId;
    } else if (mrpNumber) {
      query.mrpNumber = mrpNumber;
    } else {
      return null;
    }

    const plan = await MRPPlan.findOne(query);
    if (!plan) return null;

    // 1. Fetch all active/valid FG GRNs linked to this MRP Plan
    const grnQuery = {
      company: companyId,
      status: { $in: ["Received", "Accepted"] }
    };

    if (plan._id && plan.mrpNumber) {
      grnQuery.$or = [{ mrpPlan: plan._id }, { mrpNumber: plan.mrpNumber }];
    } else if (plan._id) {
      grnQuery.mrpPlan = plan._id;
    } else {
      grnQuery.mrpNumber = plan.mrpNumber;
    }

    const linkedGrns = await FGGRN.find(grnQuery).lean();

    // 2. Aggregate received quantities by item ID, code, and item name
    const receivedById = new Map();
    const receivedByName = new Map();
    const receivedByCode = new Map();

    linkedGrns.forEach(grn => {
      (grn.items || []).forEach(item => {
        const qty = Number(item.acceptedQuantity ?? item.receivedQuantity ?? item.quantity) || 0;
        if (qty <= 0) return;

        const idKey = item.fgItem ? String(item.fgItem) : null;
        const nameKey = (item.itemName || item.name || "").trim().toLowerCase();
        const codeKey = (item.itemCode || item.code || "").trim().toLowerCase();

        if (idKey) receivedById.set(idKey, (receivedById.get(idKey) || 0) + qty);
        if (nameKey) receivedByName.set(nameKey, (receivedByName.get(nameKey) || 0) + qty);
        if (codeKey) receivedByCode.set(codeKey, (receivedByCode.get(codeKey) || 0) + qty);
      });
    });

    // 3. Update each FG item in the plan
    let totalPlannedQty = 0;
    let totalReceivedQty = 0;

    (plan.fgItems || []).forEach(fg => {
      const planned = Number(fg.quantity) || 0;
      totalPlannedQty += planned;

      const fgIdStr = fg.fgItem ? String(fg.fgItem?._id || fg.fgItem) : "";
      const fgNameStr = (fg.fgItemName || fg.name || "").trim().toLowerCase();
      const fgCodeStr = (fg.fgItemCode || fg.code || "").trim().toLowerCase();

      let matchedReceived = 0;
      if (fgIdStr && receivedById.has(fgIdStr)) {
        matchedReceived = receivedById.get(fgIdStr);
      } else if (fgCodeStr && receivedByCode.has(fgCodeStr)) {
        matchedReceived = receivedByCode.get(fgCodeStr);
      } else if (fgNameStr && receivedByName.has(fgNameStr)) {
        matchedReceived = receivedByName.get(fgNameStr);
      }

      fg.receivedQuantity = matchedReceived;
      totalReceivedQty += matchedReceived;
    });

    // 4. Determine new status
    const previousStatus = plan.status;
    let newStatus = previousStatus;

    if (totalPlannedQty > 0 && totalReceivedQty >= totalPlannedQty) {
      newStatus = "Completed";
      if (!plan.completedAt) plan.completedAt = new Date();
    } else if (totalReceivedQty > 0 && totalReceivedQty < totalPlannedQty) {
      newStatus = "Partially Received";
      plan.completedAt = null;
    } else if (totalReceivedQty === 0) {
      if (previousStatus === "Completed" || previousStatus === "Partially Received") {
        newStatus = "In Production";
      }
      plan.completedAt = null;
    }

    const statusChanged = newStatus !== previousStatus;
    plan.status = newStatus;

    // 5. Add audit history if status changed or receipt quantity changed
    if (statusChanged || totalReceivedQty > 0) {
      if (!plan.editHistory) plan.editHistory = [];
      plan.editHistory.push({
        updatedBy: req?.user?.id || req?.user?._id,
        updatedByName: req?.user?.name || req?.user?.username || "System",
        updatedAt: new Date(),
        action: "FG GRN Synced",
        remarks: `Receipt progress: ${totalReceivedQty}/${totalPlannedQty} FG items. Status: '${previousStatus}' → '${newStatus}'.`
      });
    }

    await plan.save();
    return plan;
  } catch (err) {
    console.error(`Error syncing MRP plan receipt status for ${mrpPlanId || mrpNumber}:`, err);
    return null;
  }
};
