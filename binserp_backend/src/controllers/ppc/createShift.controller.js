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

export const createShift = async (req, res) => {
  const { shiftSchema } = await import("../models/ppc/index.js");
  try {
    const Shift = req.getModel('Shift', shiftSchema);

    const companyId = getCompanyId(req);
    const { name, startTime, endTime, description } = req.body;

    if (!name || !startTime || !endTime) {
      return res.status(400).json({ message: "Name, Start Time and End Time are required" });
    }

    const shift = await Shift.create({
      company: companyId,
      name,
      startTime,
      endTime,
      description
    });

    res.status(201).json({ message: "Shift created successfully", shift });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Shift name already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};
