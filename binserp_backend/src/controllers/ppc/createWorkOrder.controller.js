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

export const createWorkOrder = async (req, res) => {
  try {
    const WorkOrder = req.getModel('WorkOrder', workOrderSchema);

    const companyId = getCompanyId(req);
    const { workOrderNumber, component, po, routeCard, operations, quantity, remarks } = req.body;

    if (!workOrderNumber || !component || !po) {
      return res.status(400).json({
        message: "Work order number, component, and PO are required",
      });
    }

    const workOrder = await WorkOrder.create({
      company: companyId,
      workOrderNumber,
      component,
      po,
      routeCard,
      operations: operations || [],
      quantity: quantity || 1,
      remarks,
      status: "Pending",
    });

    res.status(201).json({ message: "Work order created successfully", workOrder });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Work order number already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};
