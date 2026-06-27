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

export const markOrderAsDispatched = async (req, res) => {
  try {
    const Order = req.getModel('Order', orderSchema);

    const companyId = getCompanyId(req);
    const { orderId } = req.body;

    const order = await Order.findOne({ _id: orderId, company: companyId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = 'Dispatched';
    // Optional: Update actualDispatchDate?

    await order.save();

    res.status(200).json({ message: "Order Dispatched Successfully", order });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
