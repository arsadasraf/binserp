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

export const getDispatchQueue = async (req, res) => {
  const Order = req.getModel('Order', orderSchema);
  const Job = req.getModel('Job', jobSchema); // Import Job Model locally or use req.getModel

  try {
    const companyId = getCompanyId(req);

    // 1. Fetch Active Orders (Planning, InProgress, Completed(but not dispatched))
    // Assuming Order Status flow: Pending -> Planning -> InProgress -> Completed -> Dispatched
    // We want to find orders that are "Ready for Dispatch" (i.e., All Jobs Completed)

    const orders = await Order.find({
      company: companyId,
      status: { $in: ['Planning', 'InProgress', 'Produced'] } // 'Produced' might be a new intermediate status, or we just check Jobs
    }).select('orderNumber customerName productCode quantity dispatchDate status');

    const readyForDispatch = [];

    for (const order of orders) {
      // Check Jobs
      const jobs = await Job.find({ company: companyId, order: order._id }).select('status quantity completedQuantity');

      if (jobs.length > 0) {
        const allJobsCompleted = jobs.every(j => j.status === 'Completed');
        const totalProduced = jobs.reduce((sum, j) => sum + (j.completedQuantity || 0), 0);

        // If all jobs are completed OR total produced >= order quantity (for partial dispatch handling, maybe just strict for now)

        if (allJobsCompleted) {
          readyForDispatch.push({
            ...order.toObject(),
            totalJobs: jobs.length,
            totalProduced
          });
        }
      }
    }

    res.status(200).json({ dispatchQueue: readyForDispatch });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
