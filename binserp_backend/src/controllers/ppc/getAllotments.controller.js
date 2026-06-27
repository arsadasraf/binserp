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

export const getAllotments = async (req, res) => {
  try {
    const ManpowerAllotment = req.getModel('ManpowerAllotment', manpowerAllotmentSchema);
    const Machine = req.getModel('Machine', machineSchema);
    const Employee = req.getModel('Employee', employeeSchema);

    const companyId = getCompanyId(req);
    const { startDate, endDate, employee } = req.query;

    const query = { company: companyId };

    if (employee) query.employee = employee;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const allotments = await ManpowerAllotment.find(query)
      .populate('machines', 'machineCode machineName')
      .populate('employee', 'name employeeId')
      .sort({ date: 1 });

    res.status(200).json({ allotments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
