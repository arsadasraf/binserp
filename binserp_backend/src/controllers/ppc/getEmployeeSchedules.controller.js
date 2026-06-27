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

export const getEmployeeSchedules = async (req, res) => {
  try {
    const Manpower = req.getModel('Manpower', manpowerSchema);
    const WorkOrder = req.getModel('WorkOrder', workOrderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    // Find manpower record for this employee
    const manpower = await Manpower.findOne({
      company: companyId,
      employee: id,
    });

    if (!manpower) {
      return res.status(404).json({ message: "Manpower record not found for this employee" });
    }

    // Find all work orders with operations assigned to this manpower
    const workOrders = await WorkOrder.find({
      company: companyId,
      "operations.assignedManpower": manpower._id,
    })
      .populate("component", "componentCode componentName")
      .populate("po", "orderNumber customerName")
      .sort({ scheduledStart: 1 });

    // Extract relevant operations for this employee
    const schedules = [];
    workOrders.forEach((wo) => {
      wo.operations.forEach((op) => {
        if (op.assignedManpower && op.assignedManpower.some((m) => m.toString() === manpower._id.toString())) {
          schedules.push({
            workOrder: {
              _id: wo._id,
              workOrderNumber: wo.workOrderNumber,
              component: wo.component,
              po: wo.po,
            },
            operation: op,
          });
        }
      });
    });

    res.status(200).json({ schedules, count: schedules.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== PROCESS MANAGEMENT ==========
