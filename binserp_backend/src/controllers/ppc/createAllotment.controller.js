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

export const createAllotment = async (req, res) => {
  try {
    const ManpowerAllotment = req.getModel('ManpowerAllotment', manpowerAllotmentSchema);

    const companyId = getCompanyId(req);
    const {
      employee, // Employee ID
      date,
      shift,
      startTime,
      endTime,
      machines, // Expecting array
      machine, // Backward compatibility
      remarks
    } = req.body;

    if (!employee || !date || !shift) {
      return res.status(400).json({ message: "Employee, Date and Shift are required" });
    }

    // Handle machines array or fallback to single machine
    let machinesList = [];
    if (machines && Array.isArray(machines)) {
      machinesList = machines;
    } else if (machine) {
      machinesList = [machine];
    }

    // Upsert: If allotment exists for this day/employee, update it. Otherwise create.
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const allotment = await ManpowerAllotment.findOneAndUpdate(
      { company: companyId, employee, date: startOfDay, shift },
      {
        company: companyId,
        employee,
        date: startOfDay,
        shift,
        startTime,
        endTime,
        machines: machinesList,
        remarks
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ message: "Roster updated successfully", allotment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
