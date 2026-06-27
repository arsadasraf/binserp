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

export const updateMachine = async (req, res) => {
  try {
    const Machine = req.getModel('Machine', machineSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    let updateData = { ...req.body };

    // Handle processes array parsing for update
    if (updateData.processes) {
      if (typeof updateData.processes === 'string') {
        if (updateData.processes.trim().startsWith('[') && updateData.processes.trim().endsWith(']')) {
          try {
            updateData.processes = JSON.parse(updateData.processes);
          } catch (e) {
            updateData.processes = [];
          }
        } else {
          updateData.processes = updateData.processes.split(',');
        }
      }
    }


    // Handle photo uploads
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file) => uploadOnS3(file.path, "machines", getCompanyLoginId(req)));
      const uploadResults = await Promise.all(uploadPromises);
      const newPhotoUrls = uploadResults
        .filter((result) => result !== null)
        .map((result) => result.url);

      const existingMachine = await Machine.findOne({ _id: id, company: companyId });
      if (existingMachine) {
        updateData.photos = [...(existingMachine.photos || []), ...newPhotoUrls];
      } else {
        updateData.photos = newPhotoUrls;
      }
    }

    const machine = await Machine.findOneAndUpdate(
      { _id: id, company: companyId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!machine) {
      return res.status(404).json({ message: "Machine not found" });
    }

    res.status(200).json({ message: "Machine updated successfully", machine });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// ========== MANPOWER MANAGEMENT ==========
