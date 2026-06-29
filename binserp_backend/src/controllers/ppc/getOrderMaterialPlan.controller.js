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

export const getOrderMaterialPlan = async (req, res) => {
  const { ppcOrderSchema, productionOrderSchema } = await import("../../models/ppc/index.js");
  try {
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
    const MaterialRequirement = req.getModel('MaterialRequirement', materialRequirementSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    
    let order = await PPCOrder.findOne({ _id: id, company: companyId });
    if (!order) order = await ProductionOrder.findOne({ _id: id, company: companyId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Find requirement linked to this order
    const plan = await MaterialRequirement.findOne({ order: id, company: companyId })
      .populate('items.material');

    if (!plan) return res.status(200).json({ items: [] }); // Empty plan if not yet generated
    res.status(200).json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
