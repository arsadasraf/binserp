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

export const getAllOrders = async (req, res) => {
  try {
    const Order = req.getModel('Order', orderSchema);

    const companyId = getCompanyId(req);
    const { status, priority } = req.query;

    const query = { company: companyId };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const orders = await Order.find(query)
      .populate("bom", "bomNumber productName")
      .populate("routeCard", "routeCardNumber")
      .populate("components")
      .populate("jobs") // Added payload for granular tracking
      .populate("createdBy", "name userId")
      .sort({ createdAt: -1 });

    res.status(200).json({ orders, count: orders.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== ENHANCED ORDER MANAGEMENT (New Model) ==========
