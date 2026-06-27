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

export const createSkill = async (req, res) => {
  const { skillSchema } = await import("../models/hr/index.js");
  try {
    const Skill = req.getModel('Skill', skillSchema);

    const companyId = getCompanyId(req);
    const { name, description } = req.body;

    if (!name) return res.status(400).json({ message: "Skill name is required" });

    const skill = await Skill.create({
      company: companyId,
      name,
      description
    });

    res.status(201).json({ message: "Skill created successfully", skill });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Skill with this name already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};
