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

export const getAllComponents = async (req, res) => {
  try {
    const Component = req.getModel('Component', componentSchema);

    const companyId = getCompanyId(req);
    const { po, status } = req.query;

    const query = { company: companyId };
    if (po) query.po = po;
    if (status) query.status = status;

    // Filter by Inventory Status if provided
    if (req.query.isInventoryItem !== undefined) {
      query.isInventoryItem = req.query.isInventoryItem === 'true';
    }

    // Filter Master Products (Exclude items linked to a PO)
    if (req.query.isMaster === 'true') {
      query.po = { $exists: false };
    }


    // Use deep populate for routing requiredItems
    const queryObj = Component.find(query)
      .populate("po", "orderNumber customerName")
      .populate("routeCard", "routeCardNumber operations")
      .populate("category", "name")
      .populate("location", "name")
      .populate({
        path: "routing.requiredItems.item",
        select: "materialName componentName name unit"
      })
      .populate({
        path: "routing.process",
        select: "processName processCode"
      })
      .populate({
        path: "routing.machine",
        select: "machineName machineCode"
      })
      .sort({ createdAt: -1 });

    const components = await queryObj;

    // Sign photos for preview
    const signedComponents = await Promise.all(components.map(async (comp) => {
      const compObj = comp.toObject();
      if (compObj.photos) compObj.photos = await signPhotos(compObj.photos);
      if (compObj.routing) {
        compObj.routing = await Promise.all(compObj.routing.map(async (step) => {
          if (step.photos) step.photos = await signPhotos(step.photos);
          return step;
        }));
      }
      return compObj;
    }));

    res.status(200).json({ components: signedComponents, count: signedComponents.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
