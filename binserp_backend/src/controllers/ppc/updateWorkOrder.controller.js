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

export const updateWorkOrder = async (req, res) => {
  try {
    const WorkOrder = req.getModel('WorkOrder', workOrderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    // Handle date conversions
    if (req.body.scheduledStart) req.body.scheduledStart = new Date(req.body.scheduledStart);
    if (req.body.scheduledEnd) req.body.scheduledEnd = new Date(req.body.scheduledEnd);
    if (req.body.actualStart) req.body.actualStart = new Date(req.body.actualStart);
    if (req.body.actualEnd) req.body.actualEnd = new Date(req.body.actualEnd);

    const workOrder = await WorkOrder.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    res.status(200).json({ message: "Work order updated successfully", workOrder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
