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

export const deleteMachineLocation = async (req, res) => {
  try {
    const MachineLocation = req.getModel('MachineLocation', machineLocationSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    const location = await MachineLocation.findOneAndDelete({ _id: id, company: companyId });

    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.status(200).json({ message: "Location deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== HELPER FUNCTIONS ==========

async function updatePOCompletionPercentage(poId, Order, Component) {
  try {
    const components = await Component.find({ po: poId });

    if (components.length === 0) {
      await Order.findByIdAndUpdate(poId, { completionPercentage: 0 });
      return;
    }

    const totalCompletion = components.reduce((sum, comp) => sum + (comp.completionPercentage || 0), 0);
    const avgCompletion = totalCompletion / components.length;

    await Order.findByIdAndUpdate(poId, { completionPercentage: Math.round(avgCompletion) });
  } catch (error) {
    console.error("Error updating PO completion percentage:", error);
  }
}


// Delete Machine
