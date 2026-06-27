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

export const getProcurementDashboard = async (req, res) => {
  const MaterialRequirement = req.getModel('MaterialRequirement', materialRequirementSchema);
  const Inventory = req.getModel('Inventory', inventorySchema); // From Store Module

  try {
    const companyId = getCompanyId(req);

    // 1. Fetch all "Pending" or "Draft" requirements
    // We want to see TOTAL demand, but mostly focus on Shortage for Money Planning
    const requirements = await MaterialRequirement.find({
      company: companyId
    }).populate('order', 'orderNumber targetMonth');

    // 2. Aggregate by Material
    const materialMap = {};

    for (const req of requirements) {
      for (const item of req.items) {
        // Only consider items with Shortage for "Procurement" value
        if (item.shortage > 0 && item.status !== 'Fulfilled' && item.status !== 'PR Raised') {
          if (!materialMap[item.material]) {
            materialMap[item.material] = {
              materialId: item.material,
              materialName: item.materialName,
              unit: item.unit,
              totalShortage: 0,
              orders: [],
              estimatedCost: 0
            };
          }
          materialMap[item.material].totalShortage += item.shortage;
          materialMap[item.material].orders.push(req.order ? req.order.orderNumber : 'Unknown');
        }
      }
    }

    // 3. Fetch Prices from Inventory
    const aggregatedData = Object.values(materialMap);

    for (const data of aggregatedData) {
      const inventory = await Inventory.findOne({
        company: companyId,
        materialId: data.materialId
      });

      const unitPrice = inventory ? inventory.unitPrice : 0;
      data.unitPrice = unitPrice;
      data.estimatedCost = data.totalShortage * unitPrice;
      data.currentStock = inventory ? inventory.currentStock : 0;
    }

    // 4. Calculate Totals
    const totalValue = aggregatedData.reduce((sum, item) => sum + item.estimatedCost, 0);

    res.status(200).json({
      dashboard: aggregatedData,
      totalValue
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// --- Job Work / Outsourcing Controllers ---
