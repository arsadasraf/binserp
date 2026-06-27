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

export const createMachineCategory = async (req, res) => {
  try {
    const MachineCategory = req.getModel('MachineCategory', machineCategorySchema);

    const companyId = getCompanyId(req);
    let { categoryCode, categoryName, description } = req.body;

    if (!categoryName) {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Auto-generate code if not provided
    if (!categoryCode) {
      const lastCategory = await MachineCategory.findOne({ company: companyId }).sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastCategory && lastCategory.categoryCode && lastCategory.categoryCode.startsWith("MCAT-")) {
        const lastNum = parseInt(lastCategory.categoryCode.split("-")[1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      categoryCode = `MCAT-${nextNum.toString().padStart(4, "0")}`;
    }

    const category = await MachineCategory.create({
      company: companyId,
      categoryCode,
      categoryName,
      description,
    });

    res.status(201).json({ message: "Machine Category created successfully", category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Category code already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};
