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

export const promoteToInventory = async (req, res) => {
  try {
    const Component = req.getModel('Component', componentSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    const { location, category } = req.body;

    if (!location || !category) {
      return res.status(400).json({ message: "Location and Category are required to add to inventory" });
    }

    const component = await Component.findOne({ _id: id, company: companyId });
    if (!component) {
      return res.status(404).json({ message: "Component not found" });
    }

    component.isInventoryItem = true;
    component.location = location;
    component.category = category;
    await component.save();

    res.status(200).json({ message: "Component added to inventory successfully", component });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== WORK ORDER MANAGEMENT ==========
