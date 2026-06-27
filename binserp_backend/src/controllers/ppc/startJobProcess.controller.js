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

export const startJobProcess = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    const { jobId, processId } = req.body;

    const job = await Job.findOne({ _id: jobId, company: companyId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const step = job.processHistory.id(processId);
    if (!step) return res.status(404).json({ message: "Process step not found" });

    step.status = 'InProgress';
    step.actualStart = new Date();

    // Also update parent Job status if it's the first step?
    // Maybe keep parent status 'InProgress' broadly.
    job.status = 'InProgress';

    await job.save();
    res.status(200).json({ message: "Process Started", step });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
