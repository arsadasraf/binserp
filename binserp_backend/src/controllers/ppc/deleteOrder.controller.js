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

export const deleteOrder = async (req, res) => {
  const { ppcOrderSchema, productionOrderSchema } = await import("../../models/ppc/index.js");
  try {
    const Order = req.getModel('Order', orderSchema);
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
    const Job = req.getModel('Job', jobSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    // 1. Try deleting from legacy Order Collection
    const legacyOrder = await Order.findOne({ _id: id, company: companyId });
    if (legacyOrder) {
      const hourDiff = (Date.now() - new Date(legacyOrder.createdAt).getTime()) / (1000 * 60 * 60);
      if (hourDiff > 24) {
        return res.status(403).json({ message: "Cannot delete order after 24 hours" });
      }

      // Delete photos from S3
      if (legacyOrder.photos && legacyOrder.photos.length > 0) {
        for (const photo of legacyOrder.photos) {
          await deleteFromS3(photo);
        }
      }
      await legacyOrder.deleteOne();
      return res.status(200).json({ message: "Order deleted successfully" });
    }

    // 2. Try finding in PPCOrder or ProductionOrder Collection
    let ppcOrder = await PPCOrder.findOne({ _id: id, company: companyId });
    if (!ppcOrder) {
      ppcOrder = await ProductionOrder.findOne({ _id: id, company: companyId });
    }

    if (ppcOrder) {
      const hourDiff = (Date.now() - new Date(ppcOrder.createdAt).getTime()) / (1000 * 60 * 60);
      if (hourDiff > 24) {
        return res.status(403).json({ message: "Cannot delete order after 24 hours" });
      }

      // Delete photos from S3
      if (ppcOrder.photos && ppcOrder.photos.length > 0) {
        for (const photo of ppcOrder.photos) {
          await deleteFromS3(photo);
        }
      }

      // Cleanup Linked Jobs
      if (ppcOrder.items && ppcOrder.items.length > 0) {
        try {
          const jobIds = ppcOrder.items.reduce((acc, item) => {
            if (item.jobs && item.jobs.length > 0) return [...acc, ...item.jobs];
            return acc;
          }, []);

          if (jobIds.length > 0) {
            await Job.deleteMany({ _id: { $in: jobIds } });
          }
        } catch (e) {
          console.error("Error deleting linked jobs:", e);
          // Proceed to delete order anyway
        }
      }

      await ppcOrder.deleteOne();
      return res.status(200).json({ message: "PPC Order deleted successfully" });
    }

    return res.status(404).json({ message: "Order not found" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== ROUTE CARD MANAGEMENT ==========
