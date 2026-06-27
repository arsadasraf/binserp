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

export const createProcess = async (req, res) => {
  try {
    const Process = req.getModel('Process', processSchema);

    const companyId = getCompanyId(req);
    let { processCode, processName, description } = req.body;

    if (!processName) {
      return res.status(400).json({ message: "Process name is required" });
    }

    // Auto-generate code if not provided
    if (!processCode) {
      const lastProcess = await Process.findOne({ company: companyId }).sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastProcess && lastProcess.processCode && lastProcess.processCode.startsWith("PRC-")) {
        const lastNum = parseInt(lastProcess.processCode.split("-")[1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      processCode = `PRC-${nextNum.toString().padStart(4, "0")}`;
    }

    const process = await Process.create({
      company: companyId,
      processCode,
      processName,
      description,
    });

    res.status(201).json({ message: "Process created successfully", process });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Process code already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};
