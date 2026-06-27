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

export const deleteComponent = async (req, res) => {
  try {
    const Component = req.getModel('Component', componentSchema);
    const Order = req.getModel('Order', orderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const component = await Component.findOneAndDelete({ _id: id, company: companyId });

    if (!component) {
      return res.status(404).json({ message: "Component not found" });
    }

    // Delete photos from S3
    if (component.photos && component.photos.length > 0) {
      for (const photo of component.photos) {
        await deleteFromS3(photo);
      }
    }
    // Delete routing photos from S3
    if (component.routing && component.routing.length > 0) {
      for (const step of component.routing) {
        if (step.photos && step.photos.length > 0) {
          for (const photo of step.photos) {
            await deleteFromS3(photo);
          }
        }
      }
    }

    // Remove component from order's components array
    await Order.findByIdAndUpdate(component.po, {
      $pull: { components: component._id },
    });

    // Recalculate PO completion percentage
    await updatePOCompletionPercentage(component.po, Order, Component);

    res.status(200).json({ message: "Component deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
