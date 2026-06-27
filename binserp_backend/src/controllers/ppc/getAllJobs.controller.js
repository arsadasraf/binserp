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

export const getAllJobs = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    const { status, order, assignedMachine, search, startDate, endDate } = req.query;

    const query = { company: companyId };
    if (status) query.status = status;
    if (order) query.order = order;
    if (assignedMachine) query.assignedMachine = assignedMachine;

    // Date range filtering
    if (startDate || endDate) {
      query.scheduledStart = {};
      if (startDate) query.scheduledStart.$gte = new Date(startDate);
      if (endDate) query.scheduledStart.$lte = new Date(endDate);
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { jobNumber: searchRegex },
        { poNumber: searchRegex },
        { partName: searchRegex },
        { customerName: searchRegex }
      ];
    }

    const jobs = await Job.find(query)
      .populate("order", "orderNumber customerName productName quantity dispatchDate")
      .populate("routeCard", "routeCardNumber")
      .populate("assignedMachine", "machineCode machineName machineType")
      .populate("assignedManpower", "employee")
      .populate("processHistory.assignedMachine", "machineCode machineName")
      .populate("processHistory.assignedEmployee", "name employeeId")
      .sort({ scheduledStart: 1, createdAt: -1 });

    res.status(200).json({ jobs, count: jobs.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
