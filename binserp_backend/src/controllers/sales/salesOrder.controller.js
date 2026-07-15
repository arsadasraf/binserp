import { customerSchema, fgItemSchema, storeOrderFulfillmentSchema } from "../../models/store/index.js";
import { incomingRFQSchema, quotationSchema, incomingPOSchema, salesOrderSchema, salesOrderDispatchHistorySchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { prefixSettingsSchema } from "../../models/prefix/index.js";
import { uploadOnS3 } from "../../utils/s3.js";

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

// Generate Store Order Number if prefix is available
export const generateOrderNumber = async (req) => {
  const PrefixSettings = req.getModel("PrefixSettings", prefixSettingsSchema);
  const companyId = getCompanyId(req);
  
  const settings = await PrefixSettings.findOne({ company: companyId });
  const prefix = settings?.SalesOrderPrefix || "SO-";
  
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const count = await SalesOrder.countDocuments({ company: companyId });
  
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
};

export const createSalesOrder = asyncHandler(async (req, res) => {
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const companyId = getCompanyId(req);

  let { orderNumber, poReference, customer, targetDate, items, totalAmount, status, remarks } = req.body;
  if (typeof items === 'string') {
    items = JSON.parse(items);
  }

  if (!orderNumber) {
    orderNumber = await generateOrderNumber(req);
  }

  // Ensure totalAmount is calculated if not provided correctly
  let calculatedTotalAmount = 0;
  if (items && Array.isArray(items)) {
    items = items.map(item => {
      const itemTotal = (item.quantity || 0) * (item.pricePerQuantity || 0);
      calculatedTotalAmount += itemTotal;
      return {
        ...item,
        totalPrice: itemTotal
      };
    });
  }

  let photoUrls = [];
  let pdfUrl = null;

  if (req.files) {
    if (req.files['photos'] && req.files['photos'].length > 0) {
      for (const file of req.files['photos']) {
        const result = await uploadOnS3(file.path, "SalesOrders", getCompanyLoginId(req));
        if (result?.url) photoUrls.push(result.url);
      }
    }
    if (req.files['pdf'] && req.files['pdf'].length > 0) {
      const file = req.files['pdf'][0];
      const result = await uploadOnS3(file.path, "SalesOrders", getCompanyLoginId(req));
      if (result?.url) pdfUrl = result.url;
    }
  }

  const orderData = {
    company: companyId,
    orderNumber,
    poReference,
    customer,
    targetDate,
    items,
    totalAmount: totalAmount || calculatedTotalAmount,
    status: status || "Pending",
    createdBy: req.user._id,
    remarks,
    photos: photoUrls,
    pdf: pdfUrl
  };

  const newOrder = await SalesOrder.create(orderData);

  // Spawn fulfillment records for each item in the order
  const StoreOrderFulfillment = req.getModel("StoreOrderFulfillment", storeOrderFulfillmentSchema);
  if (items && items.length > 0) {
    const fulfillments = items.map(item => ({
      company: companyId,
      SalesOrder: newOrder._id,
      fgItem: item.fgItem,
      orderedQuantity: item.quantity,
      targetDate: targetDate || new Date(),
    }));
    await StoreOrderFulfillment.insertMany(fulfillments);
  }

  res.status(201).json({ success: true, order: newOrder });
});

export const getAllSalesOrders = asyncHandler(async (req, res) => {
  // Register required models for populate
  req.getModel('Customer', customerSchema);
  req.getModel('FGItem', fgItemSchema);
  
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const companyId = getCompanyId(req);

  const orders = await SalesOrder.find({ company: companyId })
    .populate("customer", "name code email phone")
    .populate("items.fgItem", "name type description")
    .populate("createdBy", "name")
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, orders, count: orders.length });
});

export const getSalesOrderById = asyncHandler(async (req, res) => {
  req.getModel('Customer', customerSchema);
  req.getModel('FGItem', fgItemSchema);
  
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const order = await SalesOrder.findById(req.params.id)
    .populate("customer", "name code email phone")
    .populate("items.fgItem", "name type description");

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  res.status(200).json({ success: true, order });
});

export const updateSalesOrder = asyncHandler(async (req, res) => {
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const orderId = req.params.id;
  const companyId = getCompanyId(req);

  const existingOrder = await SalesOrder.findOne({ _id: orderId, company: companyId });
  if (!existingOrder) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  let { items, totalAmount, remarks, status } = req.body;
  if (typeof items === 'string') {
    items = JSON.parse(items);
  }

  // Recalculate amounts if items are updated
  if (items && Array.isArray(items)) {
    let calculatedTotalAmount = 0;
    req.body.items = items.map(item => {
      const itemTotal = (item.quantity || 0) * (item.pricePerQuantity || 0);
      calculatedTotalAmount += itemTotal;
      return {
        ...item,
        totalPrice: itemTotal
      };
    });
    if (!totalAmount) {
      req.body.totalAmount = calculatedTotalAmount;
    }
  }

  if (req.files) {
    let photoUrls = existingOrder.photos || [];
    if (req.files['photos'] && req.files['photos'].length > 0) {
      for (const file of req.files['photos']) {
        const result = await uploadOnS3(file.path, "SalesOrders", getCompanyLoginId(req));
        if (result?.url) photoUrls.push(result.url);
      }
      req.body.photos = photoUrls.slice(-3); // Keep at most 3
    }
    if (req.files['pdf'] && req.files['pdf'].length > 0) {
      const file = req.files['pdf'][0];
      const result = await uploadOnS3(file.path, "SalesOrders", getCompanyLoginId(req));
      if (result?.url) req.body.pdf = result.url;
    }
  }

  const updatedOrder = await SalesOrder.findByIdAndUpdate(
    orderId,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  res.status(200).json({ success: true, order: updatedOrder });
});

export const deleteSalesOrder = asyncHandler(async (req, res) => {
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const companyId = getCompanyId(req);

  const deletedOrder = await SalesOrder.findOneAndDelete({ _id: req.params.id, company: companyId });

  if (!deletedOrder) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  res.status(200).json({ success: true, message: "Order deleted successfully" });
});
