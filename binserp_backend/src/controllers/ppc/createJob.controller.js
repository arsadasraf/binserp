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

export const createJob = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    const {
      jobNumber,
      order,
      routeCard,
      operation,
      assignedMachine,
      assignedManpower,
      scheduledStart,
      scheduledEnd,
      quantity,
      status,
    } = req.body;

    if (!jobNumber) {
      return res.status(400).json({
        message: "Job number is required",
      });
    }

    const job = await Job.create({
      company: companyId,
      jobNumber,
      order,
      routeCard,
      operation,
      assignedMachine,
      assignedManpower: assignedManpower || [],
      scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
      scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
      quantity: quantity || 1,
      status: status || "Scheduled",
    });

    res.status(201).json({ message: "Job created successfully", job });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Job number already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};
