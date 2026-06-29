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

export const getOrderJobs = async (req, res) => {
  const { ppcOrderSchema, productionOrderSchema } = await import("../../models/ppc/index.js");
  try {
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
    const Job = req.getModel('Job', jobSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    
    let order = await PPCOrder.findOne({ _id: id, company: companyId });
    if (!order) order = await ProductionOrder.findOne({ _id: id, company: companyId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const jobs = await Job.find({ order: id, company: companyId })
      .populate('masterProduct')
      .sort({ sequence: 1 }); // Sort logic?
    res.status(200).json({ jobs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
