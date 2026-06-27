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

export const getAllManpower = async (req, res) => {
  try {
    const Manpower = req.getModel('Manpower', manpowerSchema);

    const companyId = getCompanyId(req);
    const { status, skills } = req.query;

    const query = { company: companyId };
    if (status) query.status = status;

    let manpowers = await Manpower.find(query)
      .populate("employee", "employeeId name department designation skills")
      .sort({ createdAt: -1 });

    // Filter by skills if provided
    if (skills) {
      const requiredSkills = skills.split(",");
      manpowers = manpowers.filter((manpower) => {
        const manpowerSkills = manpower.skills.map((s) => s.name);
        return requiredSkills.some((skill) => manpowerSkills.includes(skill));
      });
    }

    res.status(200).json({ manpower: manpowers, count: manpowers.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
