import mongoose from "mongoose";
import { 
  jobWorkSchema, vendorSchema, rmBoItemSchema, 
  rmInventoryMonthlySchema, fgItemSchema 
} from "../../models/store/index.js";
import { updateInventoryStock } from './updateInventoryStock.controller.js';
import { componentSchema, jobSchema } from "../../models/ppc/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const deleteJobWorkChallan = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const existingChallan = await JobWorkChallan.findOne({ _id: id, company: companyId });
    if (!existingChallan) {
      return res.status(404).json({ message: "Job Work Challan not found" });
    }

    // 1. Block delete if already partially or fully received
    if (existingChallan.status === "Partial" || existingChallan.status === "Closed" || (Array.isArray(existingChallan.receiveHistory) && existingChallan.receiveHistory.length > 0)) {
      return res.status(400).json({ message: "Cannot delete a challan that has received items" });
    }

    // 2. Enforce 2-hour deletion window
    const createdAt = new Date(existingChallan.createdAt);
    const diffInHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    if (diffInHours > 2) {
      return res.status(400).json({ 
        message: "Job Work Challan cannot be deleted after 2 hours from creation to preserve audit integrity." 
      });
    }

    // 3. Revert outward stock for all sent items
    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
    const vendorDoc = await req.getModel("Vendor", vendorSchema).findById(existingChallan.vendor);
    const vendorName = vendorDoc ? vendorDoc.name : "Subcontractor Vendor";

    for (const item of (existingChallan.items || [])) {
      if (existingChallan.jobWorkType !== "route-card" && existingChallan.jobWorkType !== "wip-to-wip" && (item.itemType === "bo" || item.itemType === "rm") && item.item) {
        try {
          // Revert stock (+quantitySent)
          await updateInventoryStock(
            req,
            item.item,
            Number(item.quantitySent), // Positive to restore stock
            item.unit || "PCS",
            undefined,
            {
              transactionCategory: "RETURNABLE_DC_DELETE_REVERSAL",
              referenceDocType: "JobWorkChallan",
              referenceDocId: existingChallan._id,
              referenceDocNumber: existingChallan.challanNumber,
              recipientOrSource: vendorName,
              purpose: `Reverted Returnable DC Deletion (${existingChallan.challanNumber})`,
              performedBy: req.user?.id || req.user?._id,
            }
          );

          // Decrement monthly outward metrics
          await RMInventoryMonthly.findOneAndUpdate(
            { company: companyId, material: item.item, month: currentMonthStr },
            { $inc: { totalOutwardQuantity: -Number(item.quantitySent) } }
          );
        } catch (stockErr) {
          console.error("[deleteJobWorkChallan] Error reverting stock:", stockErr);
        }
      }
    }

    // 4. Reset PPC Job route card operation if linked
    if (existingChallan.jobWorkType === "route-card" && existingChallan.routeCardRef?.job) {
      try {
        const Job = req.getModel("Job", jobSchema);
        const jobDoc = await Job.findById(existingChallan.routeCardRef.job);
        if (jobDoc && Array.isArray(jobDoc.processHistory)) {
          const op = jobDoc.processHistory.find(
            (p) => p.sequence === existingChallan.routeCardRef.operationSequence || p.isJobWork
          );
          if (op) {
            op.status = "Pending";
            op.isJobWork = false;
            op.assignedVendor = undefined;
            await jobDoc.save();
          }
        }
      } catch (jobErr) {
        console.error("[deleteJobWorkChallan] Error resetting PPC Job:", jobErr);
      }
    }

    // 5. Delete document
    await JobWorkChallan.findOneAndDelete({ _id: id, company: companyId });

    res.status(200).json({ message: "Job Work Challan deleted and stock restored successfully" });
  } catch (error) {
    console.error("Delete JobWork Error:", error);
    res.status(500).json({ message: error.message });
  }
};
