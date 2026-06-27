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

export const createPPCOrder = async (req, res) => {
  try {
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
    const Component = req.getModel('Component', componentSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    let {
      orderNumber,
      customer,
      customerName,
      deliveryDate,
      items, // JSON String or Object
      remarks,
      poReference,
      targetMonth
    } = req.body;

    // Parse items if string
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }

    if (!orderNumber || !items || items.length === 0 || !deliveryDate || !poReference) {
      return res.status(400).json({ message: "Order number, PO reference, delivery date, and items are required" });
    }

    // Handle Photos
    let photoUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadOnS3(file.path, "orders", getCompanyLoginId(req));
          if (result?.url) photoUrls.push(result.url);
        } catch (e) {
          console.error("Photo upload failed", e);
        }
      }
    }

    // Check uniqueness

    // Check uniqueness
    const existing = await PPCOrder.findOne({ company: companyId, orderNumber });
    if (existing) {
      return res.status(400).json({ message: "Order number already exists" });
    }

    const existingPO = await PPCOrder.findOne({ company: companyId, poReference });
    if (existingPO) {
      return res.status(400).json({ message: "PO Number already exists" });
    }

    // 1. Create Shell Order
    const newOrder = await PPCOrder.create({
      company: companyId,
      orderNumber,
      poReference,
      targetMonth, // Saved here
      customer,
      customerName,
      deliveryDate,
      items: [], // Will populate
      remarks,
      photos: photoUrls, // Save Photos
      createdBy: req.user.id,
      status: 'Pending'
    });

    // 2. Process Items
    const updatedItems = [];

    for (const item of items) {
      const { product: productId, quantity, price, trackingType, targetDate } = item;
      let masterProduct = await Component.findById(productId).populate('routing.process'); // Populate if needed for names
      let isFGItem = false;

      if (!masterProduct) {
        masterProduct = await FGItem.findById(productId).populate('bom.item');
        isFGItem = true;
      }

      if (!masterProduct) continue; // Skip or error?

      const productCode = isFGItem ? masterProduct.code : masterProduct.componentCode;
      const productName = isFGItem ? masterProduct.name : masterProduct.componentName;
      const description = masterProduct.description;
      const unit = masterProduct.unit;

      // Prepare Snapshots
      const bomSnapshot = isFGItem ? (masterProduct.bom || []).map(b => ({
        item: b.item?._id || b.item,
        itemModel: b.itemType,
        itemName: b.itemName,
        quantity: b.quantity,
        unit: b.unit
      })) : masterProduct.billOfMaterials;

      const processSnapshot = isFGItem ? [] : masterProduct.routing.map(r => ({
        processName: r.processName || (r.process && r.process.processName) || 'Unnamed Process',
        standardTime: r.standardTime,
        description: r.description,
        machine: r.machine,
        isJobWork: r.isOutsourced || r.isJobWork || false // Capture Job Work flag
      }));
      const photosSnapshot = masterProduct.photos;

      updatedItems.push({
        product: masterProduct._id,
        productName: productName,
        productCode: productCode,
        description: description,
        unit: unit,
        quantity,
        price: price || 0,
        trackingType: trackingType || 'Individual',
        targetDate: targetDate || undefined,
        bomSnapshot,
        processSnapshot,
        photosSnapshot,
        jobs: [] // Jobs generated on Confirm
      });
    }

    // 3. Update Order with Items
    newOrder.items = updatedItems;
    await newOrder.save();

    res.status(201).json({ message: "PPC Order created successfully", order: newOrder });

  } catch (error) {
    console.error("Create PPC Order Error:", error);
    res.status(500).json({ message: error.message });
  }
};
