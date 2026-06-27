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

export const createRouteCard = async (req, res) => {
  try {
    const RouteCard = req.getModel('RouteCard', routeCardSchema);
    const Order = req.getModel('Order', orderSchema);

    const companyId = getCompanyId(req);
    const {
      routeCardNumber,
      order,
      productCode,
      productName,
      bom,
      operations,
      status,
    } = req.body;

    if (!routeCardNumber || !productCode || !productName || !operations || operations.length === 0) {
      return res.status(400).json({
        message: "Route card number, product code, product name, and operations are required",
      });
    }

    const routeCard = await RouteCard.create({
      company: companyId,
      routeCardNumber,
      order,
      productCode,
      productName,
      bom,
      operations,
      createdBy: req.user.id,
      status: status || "Draft",
    });

    // Link route card to order if provided
    if (order) {
      await Order.findByIdAndUpdate(order, { routeCard: routeCard._id });
    }

    res.status(201).json({ message: "Route card created successfully", routeCard });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Route card number already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};
