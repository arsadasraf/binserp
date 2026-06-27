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

export const updateMaterialRequirementStatus = async (req, res) => {
  try {
    const MaterialRequirement = req.getModel('MaterialRequirement', materialRequirementSchema);

    const { id, itemId } = req.params;
    const { status } = req.body;
    const companyId = getCompanyId(req);

    const plan = await MaterialRequirement.findOne({ _id: id, company: companyId });
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const item = plan.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.status = status;
    await plan.save();

    res.status(200).json({ message: "Status updated", plan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Planning Board Controllers ---
