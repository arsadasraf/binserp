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

export const getAllWorkOrders = async (req, res) => {
  try {
    const WorkOrder = req.getModel('WorkOrder', workOrderSchema);

    const companyId = getCompanyId(req);
    const { component, po, status } = req.query;

    const query = { company: companyId };
    if (component) query.component = component;
    if (po) query.po = po;
    if (status) query.status = status;

    const workOrders = await WorkOrder.find(query)
      .populate("component", "componentCode componentName")
      .populate("po", "orderNumber customerName")
      .populate("routeCard", "routeCardNumber")
      .populate("operations.assignedMachine", "machineCode machineName")
      .populate({
        path: "operations.assignedManpower",
        populate: { path: "employee", select: "employeeId name" },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ workOrders, count: workOrders.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
