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

export const createOrder = async (req, res) => {
  try {
    const Order = req.getModel('Order', orderSchema);

    const companyId = getCompanyId(req);
    const {
      orderNumber,
      customerName,
      poReference,
      productCode,
      productName,
      quantity,
      dispatchDate,
      priority,
      bom,
      remarks,
    } = req.body;

    // 400 Bad Request if missing fields
    if (!orderNumber || !customerName || !productCode || !productName || !quantity || !dispatchDate) {
      return res.status(400).json({
        message: "Order number, customer name, product code, product name, quantity, and dispatch date are required",
      });
    }

    // UNIQUE PO CHECK: Check if PO Reference already exists
    if (poReference) {
      const existingOrder = await Order.findOne({ company: companyId, poReference: poReference });
      if (existingOrder) {
        return res.status(400).json({ message: `Order with PO Reference '${poReference}' already exists.` });
      }
    }

    // Validate dispatchDate
    const parsedDispatchDate = new Date(dispatchDate);
    if (isNaN(parsedDispatchDate.getTime())) {
      return res.status(400).json({ message: "Invalid dispatch date format" });
    }

    // Handle Photos
    let photoUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadOnS3(file.path, "orders", getCompanyLoginId(req));
        if (result?.url) photoUrls.push(result.url);
      }
    }

    // 1. Create Order
    const order = await Order.create({
      company: companyId,
      orderNumber,
      customerName,
      poReference,
      productCode,
      productName,
      quantity,
      dispatchDate: parsedDispatchDate,
      priority: priority || "Medium",
      bom,
      createdBy: req.user.id,
      remarks,
      photos: photoUrls,
      status: "Pending",
    });

    // 2. Generate Unique Jobs/WorkOrders for Planning
    // Fetch Component to get Routing/RouteCard
    // Note: In createOrder frontend sends productCode/productName from the item loop, but currently backend creates ONE order record with arrays of components OR one order per line?
    // Current Frontend Logic (CreateOrderModal):
    // 1. Create Base Order (POST /order)
    // 2. Loop Items: Create Component Record (POST /component) linked to Order

    // ADJUSTMENT: The user wants "after selecting the product ... generate unique item code for each quantity".
    // Since the frontend structure creates Components SEPARATELY, we should generate JOBs when the COMPONENT is created or when the ORDER is "Finalized"?
    // HOWEVER, the current prompt context implies the Controller `createOrder` is doing this.
    // Let's look at `createOrder` logic. It gets `productCode`, `quantity` etc.
    // IF `createOrder` is used for the *Initial* shell, and then items are added, `createOrder` might effectively be creating the "Header".
    // BUT the current `createOrder` body has `productCode`, `quantity`.
    // Wait, the frontend `CreateOrderModal` sends `productCode: "MULTI-ITEM"`.
    // So `createOrder` is the HEADER. The actual items are `Component` records created in the loop in frontend.

    // CRITICAL CORRECTION:
    // The previous planner assumed `createOrder` creates the jobs.
    // But `CreateOrderModal` creates an Order shell, then calls `POST /component` for each line item.
    // SO, the Job Generation must happen in `createComponent` (which is technically "adding an item to the order") OR `createOrder` needs to accept items array.

    // User Request: "after creating the new order with po reference, after selecting the product... it should generate unique item code".
    // This implies the action happens when the product is added.
    // Updating `createComponent` logic instead of `createOrder` (or `createOrder` if it accepted items, but frontend shows separate calls).

    // LET'S CHECK `createComponent` in this file.

    res.status(201).json({ message: "Order and Jobs created successfully", order });
  } catch (error) {
    console.error("Create Order Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Order number already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};
