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

export const getManpowerMasterList = async (req, res) => {
  const Manpower = req.getModel('Manpower', manpowerSchema);
  try {
    const Employee = req.getModel('Employee', employeeSchema);

    const companyId = getCompanyId(req);

    // 1. Get all employees
    const employees = await Employee.find({ company: companyId }).select('employeeId name designation department status photo');

    // 2. Get all manpower records
    const manpowerRecords = await Manpower.find({ company: companyId }).populate('employee', 'employeeId');

    // Create a map of existing manpower for quick lookup
    const manpowerMap = {};
    manpowerRecords.forEach(mp => {
      if (mp.employee) {
        // Handle populated employee object or ID
        const empId = mp.employee._id ? mp.employee._id.toString() : mp.employee.toString();
        manpowerMap[empId] = mp;
      }
    });

    // 3. Merge data
    const masterList = employees.map(emp => {
      const mpRecord = manpowerMap[emp._id.toString()];
      return {
        // Employee Data
        employeeId: emp._id, // The actual Mongo ID of employee
        empCode: emp.employeeId,
        name: emp.name,
        designation: emp.designation,
        department: emp.department,
        photo: emp.photo,

        // Manpower Data (if exists)
        isShopfloorActive: !!mpRecord,
        manpowerId: mpRecord ? mpRecord._id : null,
        skills: mpRecord ? mpRecord.skills : [],
        currentLoad: mpRecord ? mpRecord.currentLoad : 0,
        availability: mpRecord ? mpRecord.availability : 0,
        shopfloorStatus: mpRecord ? mpRecord.status : 'Inactive'
      };
    });

    res.status(200).json({ manpowerList: masterList });
  } catch (error) {
    console.error("Error in getManpowerMasterList:", error);
    res.status(500).json({ message: error.message });
  }
};

// ========== SKILL MANAGEMENT ==========
