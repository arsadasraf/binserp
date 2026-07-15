import { customerSchema, fgItemSchema, storeOrderFulfillmentSchema, fgInventoryMonthlySchema } from "../../models/store/index.js";
import { incomingRFQSchema, quotationSchema, incomingPOSchema, salesOrderSchema, salesOrderDispatchHistorySchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { prefixSettingsSchema } from "../../models/prefix/index.js";
import { uploadOnS3 } from "../../utils/s3.js";
import mongoose from "mongoose";

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const generateDispatchNumber = async (req) => {
  const PrefixSettings = req.getModel("PrefixSettings", prefixSettingsSchema);
  const companyId = getCompanyId(req);
  
  const settings = await PrefixSettings.findOne({ company: companyId });
  const prefix = settings?.dispatchPrefix || "DSP-";
  
  const StoreDispatch = req.getModel("SalesOrderDispatchHistory", salesOrderDispatchHistorySchema);
  const count = await StoreDispatch.countDocuments({ company: companyId });
  
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
};

export const createSalesDispatch = asyncHandler(async (req, res) => {
  const StoreDispatch = req.getModel("SalesOrderDispatchHistory", salesOrderDispatchHistorySchema);
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const companyId = getCompanyId(req);

  const { SalesOrderId } = req.params;
  let { items, dispatchDate, remarks, vehicleNumber, driverName, dispatchNumber } = req.body;

  if (typeof items === 'string') {
    items = JSON.parse(items);
  }

  const order = await SalesOrder.findOne({ _id: SalesOrderId, company: companyId });
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  // Validate items and quantities
  for (const dispatchItem of items) {
    const orderItem = order.items.find(i => i.fgItem.toString() === dispatchItem.fgItem);
    if (!orderItem) {
      return res.status(400).json({ success: false, message: `Item ${dispatchItem.fgItem} not found in order` });
    }
    const remaining = orderItem.quantity - (orderItem.dispatchedQuantity || 0);
    if (dispatchItem.dispatchedQuantity > remaining) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot dispatch ${dispatchItem.dispatchedQuantity} of ${orderItem.name}. Only ${remaining} remaining.` 
      });
    }
  }

  if (!dispatchNumber) {
    dispatchNumber = await generateDispatchNumber(req);
  }

  // Handle files
  let photoUrls = [];
  let pdfUrl = null;
  if (req.files) {
    if (req.files['photos'] && req.files['photos'].length > 0) {
      for (const file of req.files['photos']) {
        const result = await uploadOnS3(file.path, "storeDispatches", getCompanyLoginId(req));
        if (result?.url) photoUrls.push(result.url);
      }
    }
    if (req.files['pdf'] && req.files['pdf'].length > 0) {
      const file = req.files['pdf'][0];
      const result = await uploadOnS3(file.path, "storeDispatches", getCompanyLoginId(req));
      if (result?.url) pdfUrl = result.url;
    }
  }

  // Create dispatch record
  const dispatchData = {
    company: companyId,
    SalesOrder: SalesOrderId,
    dispatchNumber,
    dispatchDate: dispatchDate || new Date(),
    items,
    remarks,
    vehicleNumber,
    driverName,
    pdf: pdfUrl,
    photos: photoUrls,
    createdBy: req.user._id,
  };

  try {
    const newDispatch = await StoreDispatch.create(dispatchData);

    const StoreOrderFulfillment = req.getModel("StoreOrderFulfillment", storeOrderFulfillmentSchema);
    const FGInventoryMonthly = req.getModel("FGInventoryMonthly", fgInventoryMonthlySchema);
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // Update Order quantities
    let allFulfilled = true;
    for (const dispatchItem of items) {
      const qty = Number(dispatchItem.dispatchedQuantity);
      const orderItem = order.items.find(i => i.fgItem.toString() === dispatchItem.fgItem);
      orderItem.dispatchedQuantity = (orderItem.dispatchedQuantity || 0) + qty;
      
      // Update fulfillment record
      const fulfillment = await StoreOrderFulfillment.findOne({
        company: companyId,
        SalesOrder: SalesOrderId,
        fgItem: dispatchItem.fgItem
      });
      
      if (fulfillment) {
        fulfillment.dispatchedQuantity = (fulfillment.dispatchedQuantity || 0) + qty;
        
        // Consume reserved stock if available
        if (fulfillment.reservedQuantity > 0) {
           const consumeReserved = Math.min(fulfillment.reservedQuantity, qty);
           fulfillment.reservedQuantity -= consumeReserved;
           
           const inventory = await FGInventoryMonthly.findOne({ company: companyId, fgItem: dispatchItem.fgItem, month: currentMonth });
           if (inventory) {
             inventory.totalReservedQuantity = Math.max(0, (inventory.totalReservedQuantity || 0) - consumeReserved);
             await inventory.save();
           }
        }
        await fulfillment.save();
      }
    }

    // Check if fully dispatched
    for (const orderItem of order.items) {
      if ((orderItem.dispatchedQuantity || 0) < orderItem.quantity) {
        allFulfilled = false;
        break;
      }
    }

    order.status = allFulfilled ? "Dispatched" : "Partially Dispatched";
    await order.save();

    res.status(201).json({ success: true, dispatch: newDispatch, order });
  } catch (error) {
    throw error;
  }
});

export const getDispatchHistory = asyncHandler(async (req, res) => {
  req.getModel('Customer', customerSchema);
  req.getModel('FGItem', fgItemSchema);
  req.getModel('SalesOrder', salesOrderSchema);
  
  const StoreDispatch = req.getModel("SalesOrderDispatchHistory", salesOrderDispatchHistorySchema);
  const companyId = getCompanyId(req);
  const { SalesOrderId } = req.params;

  const dispatches = await StoreDispatch.find({ company: companyId, SalesOrder: SalesOrderId })
    .populate("items.fgItem", "name type description")
    .populate("createdBy", "name")
    .sort({ dispatchDate: -1, createdAt: -1 });

  res.status(200).json({ success: true, dispatches, count: dispatches.length });
});
