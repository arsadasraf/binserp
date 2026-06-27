import {
  orderSchema,
  ppcOrderSchema,
  routeCardSchema,
  machineSchema,
  manpowerSchema,
  jobSchema,
  componentSchema,
  workOrderSchema,
  processSchema,
  machineCategorySchema,
  machineLocationSchema,
  manpowerAllotmentSchema,
  machineDayPlanSchema, // Added machineDayPlanSchema
  materialRequirementSchema,
  machineAssignmentSchema,
  machineMaintenanceSchema,
} from "../../models/ppc/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { bomSchema, inventorySchema, fgItemSchema } from "../../models/store/index.js";
import { autoScheduleOrder } from "../../services/planning.service.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  return req.userType === "company" ? req.user.id : req.user.company?._id;
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// ========== ORDER MANAGEMENT ==========

export const completeJobProcess = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    const { jobId, processId, producedQty, rejectedQty } = req.body;

    const job = await Job.findOne({ _id: jobId, company: companyId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const step = job.processHistory.id(processId);
    if (!step) return res.status(404).json({ message: "Process step not found" });

    step.actualEnd = new Date();
    // Use producedQty / rejectedQty if needed for records (maybe add fields to schema later if missing)

    // QC Check Logic
    if (step.qcRequired) {
      step.status = 'QC_Pending';
      // Do NOT start next step yet.
    } else {
      step.status = 'Completed';

      // Auto-Activate Next Step?
      // Find next sequence
      const nextStep = job.processHistory.find(s => s.sequence === step.sequence + 1);
      if (nextStep) {
        // nextStep.status = 'Pending'; // It should already be pending.
        // Maybe useful to mark "Ready"
      } else {
        // All steps done?
        const allDone = job.processHistory.every(s => s.status === 'Completed');
        if (allDone) job.status = 'Completed';
      }
    }

    await job.save();
    res.status(200).json({ message: step.qcRequired ? "Sent for QC" : "Process Completed", step });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Procurement Dashboard Controller ---
