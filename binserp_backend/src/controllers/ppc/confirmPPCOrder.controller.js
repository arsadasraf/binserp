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
  machineDayPlanSchema,
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

export const confirmPPCOrder = async (req, res) => {
  const { ppcOrderSchema, productionOrderSchema } = await import("../../models/ppc/index.js");
  const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
  const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
  const Job = req.getModel('Job', jobSchema);
  const Inventory = req.getModel('Inventory', inventorySchema);

  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);

    let order = await PPCOrder.findOne({ _id: id, company: companyId });
    if (!order) order = await ProductionOrder.findOne({ _id: id, company: companyId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== 'Pending') {
      return res.status(400).json({ message: "Only Pending orders can be confirmed" });
    }

    // 1. Clean up any orphaned jobs from previous failed confirmation attempts
    await Job.deleteMany({ order: order._id });

    // 2. Generate Jobs (Moved from Create)
    const updatedItems = []; // To update order with job IDs
    const materialMap = new Map(); // For Material Requirements aggregation
    const FGItemModel = req.getModel('FGItem', fgItemSchema);

    async function resolveBOM(bomArray, multiplierQuantity, materialMap) {
      if (!bomArray || bomArray.length === 0) return;
      for (const bomItem of bomArray) {
        if (!bomItem || !bomItem.item) continue;
        const requiredQty = bomItem.quantity * multiplierQuantity;
        const matId = bomItem.item.toString();
        
        if (materialMap.has(matId)) {
          materialMap.get(matId).requiredQuantity += requiredQty;
        } else {
          materialMap.set(matId, {
            material: bomItem.item,
            materialName: bomItem.itemName,
            unit: bomItem.unit,
            requiredQuantity: requiredQty,
            itemModel: bomItem.itemModel || bomItem.itemType || 'Material'
          });
        }

        const itemModel = bomItem.itemModel || bomItem.itemType;
        if (itemModel === 'FGItem') {
          const fgItem = await FGItemModel.findById(bomItem.item).lean();
          if (fgItem && fgItem.bom && fgItem.bom.length > 0) {
            await resolveBOM(fgItem.bom, requiredQty, materialMap);
          }
        }
      }
    }

    for (let itemIndex = 0; itemIndex < order.items.length; itemIndex++) {
      const item = order.items[itemIndex];
      if (!item.product) continue; // Should have product ID
      const productCode = item.productCode || "UNK";

      // Use Snapshot logic for consistency
      const processSnapshot = item.processSnapshot || [];
      const quantity = item.quantity;
      const trackingType = item.trackingType || 'Individual';

      // --- Job Generation ---
      const createdJobs = [];
      const initialProcessHistory = processSnapshot.map((step, idx) => ({
        operationName: step.processName,
        sequence: idx + 1,
        standardTime: step.standardTime,
        status: 'Pending',
        assignedMachine: step.machine,
        isJobWork: step.isJobWork,
        qcRequired: step.qcRequired
      }));

      // Generate Jobs logic
      if (trackingType === 'Batch') {
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const batchId = `${order.orderNumber}-${productCode}-${itemIndex}-B-${randomSuffix}`;
        const job = await Job.create({
          company: companyId,
          jobNumber: batchId,
          customerName: order.customerName,
          partName: item.productName,
          poNumber: order.orderNumber,
          order: order._id,
          masterProduct: item.product,
          quantity: quantity,
          completedQuantity: 0,
          status: 'Scheduled',
          processHistory: initialProcessHistory
        });
        createdJobs.push(job._id);
      } else {
        for (let i = 1; i <= quantity; i++) {
          const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          const uniqueId = `${order.orderNumber}-${productCode}-${itemIndex}-${String(i).padStart(3, '0')}-${randomSuffix}`;
          const job = await Job.create({
            company: companyId,
            jobNumber: uniqueId,
            customerName: order.customerName,
            partName: item.productName,
            poNumber: order.orderNumber,
            order: order._id,
            masterProduct: item.product,
            quantity: 1,
            completedQuantity: 0,
            status: 'Scheduled',
            processHistory: initialProcessHistory
          });
          createdJobs.push(job._id);
        }
      }

      // Update item with job references
      item.jobs = createdJobs;

      // --- Material Requirement Calculation ---
      // Recursively traverse BOM Snapshot to plan for all sub-components and RM/BO
      if (item.bomSnapshot && item.bomSnapshot.length > 0) {
        await resolveBOM(item.bomSnapshot, quantity, materialMap);
      }
    }

    // 2. Save Jobs to Order Items
    await order.save(); // Mongoose handles subdoc array update

    // Old Material Requirement Calculation removed - now shifted to Sales Order approval in purchase module.

    // 4. Update Order Status
    order.status = 'Planning'; // Or 'Confirmed' -> 'Planning'
    await order.save();

    res.status(200).json({ message: "Order Confirmed. Jobs and Material Requirements generated.", order });

  } catch (error) {
    console.error("Confirm Order Error:", error);
    res.status(500).json({ message: error.message });
  }
};
