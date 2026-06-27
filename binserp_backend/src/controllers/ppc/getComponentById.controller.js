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

export const getComponentById = async (req, res) => {
  try {
    const Component = req.getModel('Component', componentSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const component = await Component.findOne({ _id: id, company: companyId })
      .populate("po")
      .populate("routeCard")
      .populate({
        path: "billOfMaterials.item",
        select: "materialName componentName materialCode componentCode unit type name"
      })
      .populate({
        path: "routing.machine",
        select: "machineName machineCode"
      })
      .populate({
        path: "routing.process",
        select: "processName processCode"
      })
      .populate({
        path: "routing.requiredItems.item",
        select: "materialName componentName name unit type"
      });

    if (!component) {
      return res.status(404).json({ message: "Component not found" });
    }

    const componentObj = component.toObject();
    if (componentObj.photos) componentObj.photos = await signPhotos(componentObj.photos);
    if (componentObj.routing) {
      componentObj.routing = await Promise.all(componentObj.routing.map(async (step) => {
        if (step.photos) step.photos = await signPhotos(step.photos);
        return step;
      }));
    }

    res.status(200).json(componentObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
