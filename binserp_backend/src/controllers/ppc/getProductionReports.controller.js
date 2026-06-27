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

export const getProductionReports = asyncHandler(async (req, res) => {
  const Job = req.getModel('Job', jobSchema);

  // 1. Job Status Distribution
  const statusStats = await Job.aggregate([
    { $match: { company: req.company._id, isArchived: false } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  // 2. Outsourcing Tracking
  // Find jobs where at least one active process step is assigned to a vendor
  const outsourcedJobs = await Job.aggregate([
    { $match: { company: req.company._id } },
    { $unwind: "$processHistory" },
    {
      $match: {
        "processHistory.assignedVendor": { $ne: null },
        "processHistory.status": { $in: ["Pending", "Scheduled", "InProgress", "QC_Pending"] }
      }
    },
    {
      $lookup: {
        from: "vendorstores", // Assuming model name is VendorStore in Mongoose
        localField: "processHistory.assignedVendor",
        foreignField: "_id",
        as: "vendor"
      }
    },
    { $unwind: "$vendor" },
    {
      $project: {
        jobNumber: 1,
        partName: 1,
        processName: "$processHistory.processName",
        vendorName: "$vendor.name",
        status: "$processHistory.status",
        startDate: "$processHistory.plannedStart"
      }
    }
  ]);

  return res.status(200).json(new ApiResponse(200, {
    statusStats,
    outsourcedJobs
  }, "Production Reports Fetched"));
});

// ==========================================
// NEW PRODUCTION ORDER API (For PPC Tab only)
// ==========================================
