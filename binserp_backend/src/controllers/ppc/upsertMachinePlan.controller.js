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

export const upsertMachinePlan = async (req, res) => {
  const { machineDayPlanSchema } = await import("../../models/ppc/index.js");
  try {
    const MachineDayPlan = req.getModel('MachineDayPlan', machineDayPlanSchema);

    const companyId = getCompanyId(req);
    const { date, machine, shifts, status } = req.body;

    if (!date || !machine) {
      return res.status(400).json({ message: "Date and Machine are required" });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const plan = await MachineDayPlan.findOneAndUpdate(
      { company: companyId, date: startOfDay, machine },
      {
        company: companyId,
        date: startOfDay,
        machine,
        shifts: shifts || [],
        status: status || 'Active'
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ message: "Machine Plan updated", plan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
