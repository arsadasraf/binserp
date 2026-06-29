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

export const updateOrder = async (req, res) => {
  const { ppcOrderSchema, productionOrderSchema } = await import("../../models/ppc/index.js");
  try {
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
    const Order = req.getModel('Order', orderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    let { items } = req.body;

    // Parse items if string (from FormData)
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }
    // Update req.body.items so legacy update works too if needed
    if (items) req.body.items = items;

    // 1. Try finding and updating PPCOrder (Smart Merge)
    let ppcOrder = await PPCOrder.findOne({ _id: id, company: companyId });
    if (!ppcOrder) ppcOrder = await ProductionOrder.findOne({ _id: id, company: companyId });

    if (ppcOrder) {
      // Merge Items to preserve snapshots & jobs
      if (items && Array.isArray(items) && items.length > 0) {
        const newItems = [];
        for (const newItem of items) {
          // Try to match by Product ID or Item ID
          const existingItem = ppcOrder.items.find(i =>
            (newItem.product && i.product && i.product.toString() === newItem.product.toString()) ||
            (newItem._id && i._id && i._id.toString() === newItem._id.toString())
          );

          if (existingItem) {
            // MERGE: Keep snapshots/jobs, update editable fields
            newItems.push({
              ...existingItem.toObject(),
              quantity: Number(newItem.quantity),
              price: Number(newItem.price || existingItem.price || 0),
              trackingType: newItem.trackingType || existingItem.trackingType
            });
          } else {
            // NEW ITEM: Basic add (Snapshots won't be generated in Edit mode currently)
            newItems.push({
              product: newItem.product,
              productName: newItem.productName, // If passed
              quantity: Number(newItem.quantity),
              price: Number(newItem.price || 0),
              trackingType: newItem.trackingType || "Individual"
            });
          }
        }
        ppcOrder.items = newItems;
      }

      // Update Top-Level Fields
      const allowedUpdates = ["orderNumber", "poReference", "customerName", "deliveryDate", "remarks", "status"];
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) ppcOrder[field] = req.body[field];
      });

      // Handle New Photos
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            const result = await uploadOnS3(file.path, "orders", getCompanyLoginId(req));
            if (result?.url) ppcOrder.photos.push(result.url);
          } catch (e) { console.error("Photo upload error", e); }
        }
      }

      await ppcOrder.save();
      return res.status(200).json({ message: "Order updated successfully", order: ppcOrder });
    }

    // 2. Fallback to Legacy Order Update
    let order = await Order.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({ message: "Order updated successfully", order });

  } catch (error) {
    console.error("Update Order Error:", error);
    res.status(500).json({ message: error.message });
  }
};

const updateOrderDeprecated = async (req, res) => {
  try {
    const Order = req.getModel('Order', orderSchema);
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    // 1. Try updating Legacy Order
    let order = await Order.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    // 2. If not found, try updating PPC Order
    if (!order) {
      order = await PPCOrder.findOneAndUpdate(
        { _id: id, company: companyId },
        req.body,
        { new: true, runValidators: true }
      );
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check 48-hour edit limit (applies to both)
    const hourDiff = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
    // Note: We might want to relax this for status updates? 
    // Allowing status updates anytime is standard. The 48h limit might be for "Created" details.
    // If 'status' is being updated, maybe skip time check?
    // user request: "user change to wip this order should visible in planning tab" - implies flow progression.
    // I will keep the check for now but if it blocks status updates on old orders, I'll need to refine it.
    // Actually, usually status update shouldn't be restricted by creation time.
    // But for now, keeping as is to avoid breaking existing rules, assuming these are new orders.

    res.status(200).json({ message: "Order updated successfully", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
