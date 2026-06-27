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

export const updateComponent = async (req, res) => {
  try {
    const Component = req.getModel('Component', componentSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    let updateData = { ...req.body };

    // Parse JSON fields
    if (typeof updateData.billOfMaterials === 'string') {
      try { updateData.billOfMaterials = JSON.parse(updateData.billOfMaterials); } catch (e) { updateData.billOfMaterials = []; }
    }
    if (typeof updateData.routing === 'string') {
      try { updateData.routing = JSON.parse(updateData.routing); } catch (e) { updateData.routing = []; }
    }
    // Handle existing photos JSON (top level)
    if (typeof updateData.existingPhotos === 'string') {
      try { updateData.existingPhotos = JSON.parse(updateData.existingPhotos); } catch (e) { updateData.existingPhotos = []; }
    }

    // --- File Upload Handling ---
    const newComponentPhotos = [];
    const routingPhotosMap = {}; // index -> [urls]

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file) => {
        try {
          const result = await uploadOnS3(file.path, "components", getCompanyLoginId(req));
          if (result && result.secure_url) {
            if (file.fieldname === 'photos') {
              newComponentPhotos.push(result.secure_url);
            } else if (file.fieldname.startsWith('routing[')) {
              // routing[0][photos]
              const match = file.fieldname.match(/routing\[(\d+)\]\[photos\]/);
              if (match && match[1]) {
                const index = parseInt(match[1]);
                if (!routingPhotosMap[index]) routingPhotosMap[index] = [];
                routingPhotosMap[index].push(result.secure_url);
              }
            }
          }
        } catch (e) {
          console.error("Upload error", e);
        }
      });
      await Promise.all(uploadPromises);
    }

    // fetch existing to merge photos
    const existingComponent = await Component.findOne({ _id: id, company: companyId });
    if (!existingComponent) return res.status(404).json({ message: "Component not found" });

    // Merge Component Photos
    if (updateData.photos && !Array.isArray(updateData.photos)) {
      // If photos key exists but not array (maybe empty from FormData), ignore?
      // Usually we reconstruct from existingPhotos + newPhotos
    }
    const finalComponentPhotos = [...(updateData.existingPhotos || []), ...newComponentPhotos];
    updateData.photos = finalComponentPhotos;

    // Merge Routing Photos
    if (updateData.routing && Array.isArray(updateData.routing)) {
      updateData.routing = updateData.routing.map((step, idx) => {
        // Existing photos for this step might be in the payload as 'existingPhotos' inside the step object?
        // Frontend should send: routing[i] = { ...step, existingPhotos: [...] }
        // Or routing[i].photos = [...existing] sent from frontend if we treat it as simple array in JSON.
        // BUT, we just added new ones.

        let currentStepPhotos = step.photos || [];
        // If frontend sends 'existingPhotos' (urls) in the step object, use that as base
        if (step.existingPhotos && Array.isArray(step.existingPhotos)) {
          currentStepPhotos = step.existingPhotos;
        } else if (Array.isArray(step.photos)) {
          // If frontend sends photos array directly (assuming it only contains existing urls)
          currentStepPhotos = step.photos.filter(p => typeof p === 'string' && p.startsWith('http'));
        } else {
          currentStepPhotos = [];
        }

        const newPhotosForStep = routingPhotosMap[idx] || [];
        return {
          ...step,
          photos: [...currentStepPhotos, ...newPhotosForStep]
        };
      });
    }

    const component = await Component.findOneAndUpdate(
      { _id: id, company: companyId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!component) {
      return res.status(404).json({ message: "Component not found" });
    }

    res.status(200).json({ message: "Component updated successfully", component });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
