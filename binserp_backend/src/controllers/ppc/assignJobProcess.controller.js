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

export const assignJobProcess = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    // team is array of { employeeId, role }
    const { jobId, processId, machineId, startTime, endTime, team } = req.body;

    const job = await Job.findOne({ _id: jobId, company: companyId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const step = job.processHistory.id(processId);
    if (!step) return res.status(404).json({ message: "Process step not found" });

    // Validate logic (Sequence check?) - Skipped for flexibility
    // Handle Job Work Assignment
    const { isJobWork, vendorId } = req.body;
    if (isJobWork && vendorId) {
      step.assignedVendor = vendorId;
      step.status = 'Scheduled'; // or 'Pending' (waiting for challan). Let's say Scheduled for now.
      // potentially clear machine/time if moving to vendor? 
      // step.assignedMachine = undefined; 
    } else {
      // Normal Machine Assignment
      if (machineId) step.assignedMachine = machineId;
      if (startTime) step.startTime = startTime;
      if (endTime) step.endTime = endTime;

      // Handle Gang Assignment
      if (team && Array.isArray(team)) {
        step.assignedTeam = team.map(t => ({
          employee: t.employeeId,
          role: t.role || "Operator"
        }));
        // Legacy Sync
        if (step.assignedTeam.length > 0) {
          step.assignedEmployee = step.assignedTeam[0].employee;
        }
      }
    }


    step.status = 'Scheduled'; // Mark as scheduled when machine is assigned

    await job.save();

    res.status(200).json({ message: "Assigned successfully", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Execution Controllers (Operator View) ---
