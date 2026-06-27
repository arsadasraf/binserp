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

export const createMachine = async (req, res) => {
  try {
    const Machine = req.getModel('Machine', machineSchema);

    const companyId = getCompanyId(req);
    let { machineCode, machineName, machineType, make, commissionYear, category, processes, location, specifications, hourlyRate, capacity, status } = req.body;

    if (!machineName) {
      return res.status(400).json({
        message: "Machine name is required",
      });
    }

    // Auto-generate code if not provided
    if (!machineCode) {
      const lastMachine = await Machine.findOne({ company: companyId }).sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastMachine && lastMachine.machineCode && lastMachine.machineCode.startsWith("MAC-")) {
        const lastNum = parseInt(lastMachine.machineCode.split("-")[1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      machineCode = `MAC-${nextNum.toString().padStart(4, "0")}`;
    }

    // Handle processes if sent as stringified array or comma separated
    let parsedProcesses = [];
    if (processes) {
      if (Array.isArray(processes)) {
        parsedProcesses = processes;
      } else if (typeof processes === 'string') {
        // Check if it looks like a JSON array
        if (processes.trim().startsWith('[') && processes.trim().endsWith(']')) {
          try {
            parsedProcesses = JSON.parse(processes);
          } catch (e) {
            parsedProcesses = [];
          }
        } else {
          parsedProcesses = processes.split(',');
        }
      }
    }


    let photoUrls = [];
    // Safer check for req.files
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map((file) => uploadOnS3(file.path, "machines", getCompanyLoginId(req)));
        const uploadResults = await Promise.all(uploadPromises);
        photoUrls = uploadResults
          .filter((result) => result !== null && result.url) // ensure url exists
          .map((result) => result.url);
      } catch (uploadError) {
        console.error("Machine photo upload error:", uploadError);
        // Continue without photos to avoid 500
      }
    }

    const machine = await Machine.create({
      company: companyId,
      machineCode,
      machineName,
      machineType,
      make,
      commissionYear,
      category,
      processes: parsedProcesses,
      location,
      hourlyRate,
      capacity,
      status,
      specifications,
      photos: photoUrls,
    });

    res.status(201).json({ message: "Machine created successfully", machine });
  } catch (error) {
    console.error("Create Machine Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Machine code already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};
