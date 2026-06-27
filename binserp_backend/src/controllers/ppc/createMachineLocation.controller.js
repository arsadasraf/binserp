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

export const createMachineLocation = async (req, res) => {
  try {
    const MachineLocation = req.getModel('MachineLocation', machineLocationSchema);

    const companyId = getCompanyId(req);
    let { locationCode, locationName, description } = req.body;

    if (!locationName) {
      return res.status(400).json({ message: "Location name is required" });
    }

    // Auto-generate code if not provided
    if (!locationCode) {
      const lastLocation = await MachineLocation.findOne({ company: companyId }).sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastLocation && lastLocation.locationCode && lastLocation.locationCode.startsWith("MLOC-")) {
        const lastNum = parseInt(lastLocation.locationCode.split("-")[1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      locationCode = `MLOC-${nextNum.toString().padStart(4, "0")}`;
    }

    const location = await MachineLocation.create({
      company: companyId,
      locationCode,
      locationName,
      description,
    });

    res.status(201).json({ message: "Machine Location created successfully", location });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Location code already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};
