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

export const createManpower = async (req, res) => {
  try {
    const Manpower = req.getModel('Manpower', manpowerSchema);

    const companyId = getCompanyId(req);
    const { employee, employeeId, skills, currentLoad, availability, status } = req.body;

    let employeeObjId = employee;

    // If employeeId is provided (string), find the Employee by employeeId
    if (employeeId && !employee) {
      const { employeeSchema } = await import("../models/hr/index.js");
      const Employee = req.getModel('Employee', employeeSchema);
      const employeeDoc = await Employee.findOne({
        employeeId,
        company: companyId,
      });
      if (!employeeDoc) {
        return res.status(404).json({ message: "Employee not found with the provided employee ID" });
      }
      employeeObjId = employeeDoc._id;
    }

    if (!employeeObjId) {
      return res.status(400).json({ message: "Employee or employeeId is required" });
    }

    const manpower = await Manpower.create({
      company: companyId,
      employee: employeeObjId,
      skills: skills || [],
      currentLoad: currentLoad || 0,
      availability: availability || 100,
      status: status || "Available",
    });

    res.status(201).json({ message: "Manpower created successfully", manpower });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Manpower entry already exists for this employee" });
    }
    res.status(500).json({ message: error.message });
  }
};
