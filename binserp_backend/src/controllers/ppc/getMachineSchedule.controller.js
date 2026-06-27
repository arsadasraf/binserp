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

export const getMachineSchedule = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    const { start, end } = req.query; // YYYY-MM-DD ISO strings

    // Find jobs with processes assigned in this range
    // processHistory.startTime exists
    const jobs = await Job.find({
      company: companyId,
      'processHistory.startTime': {
        $gte: new Date(start),
        $lte: new Date(end)
      }
    }).select('jobNumber partName processHistory quantity');

    const assignments = [];
    jobs.forEach(job => {
      job.processHistory.forEach(step => {
        if (step.startTime && step.endTime && step.assignedMachine) {
          // Check intersection with requested range (optional, optimization)
          assignments.push({
            _id: step._id, // Process ID (unique)
            jobId: job._id,
            jobNumber: job.jobNumber,
            partName: job.partName,
            machineId: step.assignedMachine,
            processName: step.operationName,
            start: step.startTime,
            end: step.endTime,
            status: step.status
          });
        }
      });
    });

    res.status(200).json({ assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
