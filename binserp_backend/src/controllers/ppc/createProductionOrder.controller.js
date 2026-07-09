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
  productionOrderSchema,
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

export const createProductionOrder = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { orderNumber, customerName, customer, poReference, deliveryDate, deadlineDate, targetMonth, remarks } = req.body;
    let { items } = req.body;

    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    // Notice: We use productionOrderSchema here, which is essentially the new dedicated schema
    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
    const Component = req.getModel('Component', componentSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);

    const photoUrls = req.files ? req.files.map((file) => `/${file.path.replace(/\\\\/g, '/')}`) : [];

    const orderItems = [];

    for (const item of items) {
      const productId = item.product || item.componentId;
      if (!productId) continue;

      let masterProduct = await Component.findById(productId).populate('routing.process');
      let isFGItem = false;

      if (!masterProduct) {
        masterProduct = await FGItem.findById(productId).populate('bom.item');
        isFGItem = true;
      }

      if (!masterProduct) continue;

      const productCode = isFGItem ? masterProduct.code : masterProduct.componentCode;
      const productName = isFGItem ? masterProduct.name : masterProduct.componentName;
      const description = masterProduct.description;
      const unit = masterProduct.unit;

      const bomSnapshot = isFGItem ? (masterProduct.bom || []).map(b => ({
        item: b.item?._id || b.item,
        itemModel: b.itemType,
        itemName: b.itemName,
        quantity: b.quantity,
        unit: b.unit
      })) : (masterProduct.billOfMaterials || []);

      const processSnapshot = isFGItem ? [] : (masterProduct.routing || []).map(r => ({
        processName: r.processName || (r.process && r.process.processName) || 'Unnamed Process',
        standardTime: r.standardTime,
        description: r.description,
        machine: r.machine,
        isJobWork: r.isOutsourced || r.isJobWork || false
      }));
      const photosSnapshot = masterProduct.photos || [];

      orderItems.push({
        product: productId,
        productName,
        productCode,
        description,
        unit,
        price: item.price || 0,
        quantity: item.quantity,
        trackingType: item.trackingType || 'Individual',
        targetDate: item.targetDate ? new Date(item.targetDate) : undefined,
        bomSnapshot,
        processSnapshot,
        photosSnapshot,
        jobs: []
      });
    }

    const order = await ProductionOrder.create({
      company: companyId,
      orderNumber,
      poReference,
      targetMonth,
      customer,
      customerName,
      deliveryDate: (deliveryDate || deadlineDate) ? new Date(deliveryDate || deadlineDate) : undefined,
      items: orderItems,
      createdBy: req.user.id,
      remarks,
      photos: photoUrls,
      status: 'Pending'
    });

    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('Error creating Production Order:', error);
    res.status(500).json({ message: error.message });
  }
};
