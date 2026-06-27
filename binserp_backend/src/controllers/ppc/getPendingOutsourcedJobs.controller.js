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

export const getPendingOutsourcedJobs = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);

    // Find jobs where the *current* pending step is marked as isJobWork
    // Logic: Find jobs with status InProgress/Scheduled
    // Filter those where the *first* Pending step has isJobWork: true

    const jobs = await Job.find({
      company: companyId,
      status: { $in: ['Scheduled', 'InProgress'] },
      'processHistory.status': 'Pending',
      'processHistory.isJobWork': true
    }).populate('order', 'orderNumber').populate('masterProduct', 'componentName');

    const outsourcedList = [];

    for (const job of jobs) {
      // Get the specific pending step
      // Note: We only care if the *next immediate* step is outsourced.
      // If step 1 is pending internal, and step 2 is pending outsourced, we shouldn't show step 2 yet.
      // So we find the FIRST pending step.
      const currentStep = job.processHistory.find(p => p.status === 'Pending');

      if (currentStep && currentStep.isJobWork) {
        outsourcedList.push({
          jobId: job._id,
          jobNumber: job.jobNumber,
          partName: job.partName,
          processId: currentStep._id,
          processName: currentStep.operationName,
          quantity: job.quantity,
          orderNumber: job.order ? job.order.orderNumber : '-'
        });
      }
    }

    res.status(200).json({ jobs: outsourcedList });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Dispatch Management ---
