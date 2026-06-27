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

export const getPlanningBacklog = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    // Find active jobs with at least one Pending process
    // We only want the *next* pending process in sequence, but simplicity first: show all pending.
    const jobs = await Job.find({
      company: companyId,
      status: { $in: ['Scheduled', 'InProgress'] },
      'processHistory.status': 'Pending'
    }).select('jobNumber partName quantity processHistory masterProduct order completionPercentage');

    // Flatten to Process Steps
    const backlog = [];
    for (const job of jobs) {
      // Find the first pending process (FIFO)
      // Or filtering all pending? Let's filter all pending to allow flexibility
      const pendingSteps = job.processHistory.filter(p => p.status === 'Pending' && !p.assignedMachine);

      pendingSteps.forEach(step => {
        backlog.push({
          _id: step._id, // Process ID
          jobId: job._id,
          jobNumber: job.jobNumber,
          partName: job.partName,
          quantity: job.quantity,
          processName: step.operationName,
          sequence: step.sequence,
          standardTime: step.standardTime, // per unit
          totalTime: (step.standardTime || 0) * job.quantity,
          assignedMachine: step.assignedMachine,
          orderId: job.order
        });
      });
    }

    res.status(200).json({ backlog });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
