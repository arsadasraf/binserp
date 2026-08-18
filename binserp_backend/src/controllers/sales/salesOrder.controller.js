import { customerSchema, fgItemSchema, storeOrderFulfillmentSchema, fgInventoryMonthlySchema, storeMRPSchema } from "../../models/store/index.js";
import { incomingRFQSchema, quotationSchema, incomingPOSchema, salesOrderSchema, salesOrderDispatchHistorySchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js";
import { ppcOrderSchema } from "../../models/ppc/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { uploadOnS3 } from "../../utils/s3.js";

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

// Helper for YYYY-MM string
const getCurrentMonthStr = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// Generate Store Order Number if prefix is available
export const generateOrderNumber = async (req) => {
  const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);
  const companyId = getCompanyId(req);
  
  const settings = await StorePrefix.findOne({ company: companyId });
  const prefix = settings?.SalesOrderPrefix || "SO-";
  
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const count = await SalesOrder.countDocuments({ company: companyId });
  
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
};

export const createSalesOrder = asyncHandler(async (req, res) => {
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const companyId = getCompanyId(req);

  let { orderNumber, poReference, customer, targetDate, items, totalAmount, status, remarks, orderType } = req.body;

  if (!customer || customer === "" || customer === "null" || customer === "undefined") {
    customer = undefined;
  }
  if (poReference === "") {
    poReference = undefined;
  }

  const resolvedOrderType = orderType || (poReference ? "PO_BASED" : "DIRECT");

  if (typeof items === 'string') {
    items = JSON.parse(items);
  }

  // Ensure totalAmount is calculated if not provided correctly and sanitize items
  let calculatedTotalAmount = 0;
  if (items && Array.isArray(items)) {
    items = items.map(item => {
      const itemCopy = { ...item };
      if (!itemCopy.fgItem || itemCopy.fgItem === "") delete itemCopy.fgItem;
      const itemTotal = (itemCopy.quantity || 0) * (itemCopy.pricePerQuantity || 0);
      calculatedTotalAmount += itemTotal;
      return {
        ...itemCopy,
        totalPrice: itemTotal
      };
    });
  }

  if (!orderNumber) {
    if (poReference) {
      orderNumber = `SO-${poReference}`;
    } else {
      orderNumber = await generateOrderNumber(req);
    }
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
    orderType: resolvedOrderType,
    customer,
    targetDate: targetDate || new Date(),
    items,
    totalAmount: totalAmount || calculatedTotalAmount,
    status: status || "Pending",
    createdBy: req.user?._id,
    remarks,
    photos: photoUrls,
    pdf: pdfUrl
  };

  const newOrder = await SalesOrder.create(orderData);

  // Spawn fulfillment records & run automated FG Stock Check -> Purchase MRP -> PPC Order Intake Bucket
  const StoreOrderFulfillment = req.getModel("StoreOrderFulfillment", storeOrderFulfillmentSchema);
  const FGInventoryMonthly = req.getModel("FGInventoryMonthly", fgInventoryMonthlySchema);
  const StoreMRP = req.getModel("StoreMRP", storeMRPSchema);
  const PPCOrder = req.getModel("PPCOrder", ppcOrderSchema);
  const currentMonth = getCurrentMonthStr();

  if (items && items.length > 0) {
    for (const item of items) {
      if (!item.fgItem) continue;

      const orderedQty = Number(item.quantity || 1);

      // Check current monthly inventory
      const invRecord = await FGInventoryMonthly.findOne({
        company: companyId,
        fgItem: item.fgItem,
        month: currentMonth
      });

      const closingStock = invRecord ? Number(invRecord.closingStock || 0) : 0;
      const totalReserved = invRecord ? Number(invRecord.totalReservedQuantity || 0) : 0;
      const availableStock = Math.max(0, closingStock - totalReserved);

      const reservedQuantity = Math.min(orderedQty, availableStock);
      const shortfallQuantity = Math.max(0, orderedQty - reservedQuantity);

      // 1. Create fulfillment record
      await StoreOrderFulfillment.create({
        company: companyId,
        storeOrder: newOrder._id,
        fgItem: item.fgItem,
        orderedQuantity: orderedQty,
        reservedQuantity,
        mrpMovedQuantity: shortfallQuantity,
        status: shortfallQuantity > 0 ? (reservedQuantity > 0 ? 'Partial Stock' : 'Moved MRP') : 'Reserved',
        targetDate: item.targetDate || targetDate || new Date(),
      });

      // 2. Increment stock reservation if in stock
      if (reservedQuantity > 0 && invRecord) {
        invRecord.totalReservedQuantity = (invRecord.totalReservedQuantity || 0) + reservedQuantity;
        await invRecord.save();
      }

      // 3. Push shortfall to Purchase MRP & PPC Order Intake Bucket
      if (shortfallQuantity > 0) {
        // Push to Purchase MRP
        await StoreMRP.create({
          company: companyId,
          storeOrder: newOrder._id,
          fgItem: item.fgItem,
          requiredQuantity: shortfallQuantity,
          dueDate: item.targetDate || targetDate || new Date(),
          status: "Pending",
          createdBy: req.user?._id,
          remarks: `Auto-generated shortfall from Sales Order #${newOrder.orderNumber}`
        });

        // Push to PPC Order Intake Bucket
        const countPpc = await PPCOrder.countDocuments({ company: companyId });
        await PPCOrder.create({
          company: companyId,
          orderNumber: `PPC-INTAKE-${newOrder.orderNumber}-${countPpc + 1}`,
          poReference: newOrder.poReference || newOrder.orderNumber,
          customer: newOrder.customer,
          deliveryDate: item.targetDate || targetDate || new Date(),
          status: "Pending",
          items: [{
            productName: item.name || "FG Item",
            productCode: item.code || "",
            quantity: shortfallQuantity,
            targetDate: item.targetDate || targetDate || new Date(),
          }],
          remarks: `PPC Order Intake Bucket demand from Sales Order #${newOrder.orderNumber}`
        });
      }
    }
  }

  res.status(201).json({ success: true, order: newOrder });
});

export const getSalesOrderStockStatus = asyncHandler(async (req, res) => {
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const FGInventoryMonthly = req.getModel("FGInventoryMonthly", fgInventoryMonthlySchema);
  const companyId = getCompanyId(req);
  const orderId = req.params.id;

  const order = await SalesOrder.findOne({ _id: orderId, company: companyId }).populate("items.fgItem");
  if (!order) {
    return res.status(404).json({ success: false, message: "Sales Order not found" });
  }

  const currentMonth = getCurrentMonthStr();
  const stockDetails = [];

  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      const fgId = item.fgItem?._id || item.fgItem;
      const fgName = item.name || item.fgItem?.name || "FG Product";
      const orderedQty = Number(item.quantity || 1);

      let closingStock = 0;
      let totalReserved = 0;

      if (fgId) {
        const invRecord = await FGInventoryMonthly.findOne({
          company: companyId,
          fgItem: fgId,
          month: currentMonth
        });

        if (invRecord) {
          closingStock = Number(invRecord.closingStock || 0);
          totalReserved = Number(invRecord.totalReservedQuantity || 0);
        }
      }

      const availableStock = Math.max(0, closingStock - totalReserved);
      const suggestedReserve = Math.min(orderedQty, availableStock);
      const suggestedShortfall = Math.max(0, orderedQty - suggestedReserve);

      stockDetails.push({
        fgItem: fgId,
        name: fgName,
        orderedQuantity: orderedQty,
        closingStock,
        totalReserved,
        availableStock,
        suggestedReserve,
        suggestedShortfall
      });
    }
  }

  res.status(200).json({
    success: true,
    orderNumber: order.orderNumber,
    stockDetails
  });
});

export const moveSalesOrderToMRP = asyncHandler(async (req, res) => {
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const StoreOrderFulfillment = req.getModel("StoreOrderFulfillment", storeOrderFulfillmentSchema);
  const FGInventoryMonthly = req.getModel("FGInventoryMonthly", fgInventoryMonthlySchema);
  const FGItem = req.getModel("FGItem", fgItemSchema);
  const StoreMRP = req.getModel("StoreMRP", storeMRPSchema);
  const companyId = getCompanyId(req);
  const orderId = req.params.id;
  const { allocations } = req.body; // Custom allocations from modal form

  const order = await SalesOrder.findOne({ _id: orderId, company: companyId });
  if (!order) {
    return res.status(404).json({ success: false, message: "Sales Order not found" });
  }

  const currentMonth = getCurrentMonthStr();
  let totalReserved = 0;
  let totalShortfall = 0;

  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      if (!item.fgItem) continue;

      const orderedQty = Number(item.quantity || 1);
      const fgId = item.fgItem._id ? item.fgItem._id.toString() : item.fgItem.toString();

      // Check if user provided custom allocation for this FG item
      const customAlloc = Array.isArray(allocations) ? allocations.find(a => String(a.fgItem) === fgId) : null;

      // Check FG stock in FGItem model
      const fgDoc = await FGItem.findById(item.fgItem);
      const totalStock = fgDoc ? Number(fgDoc.quantity || 0) : 0;
      const currentAllocated = fgDoc ? Number(fgDoc.allocatedQuantity || 0) : 0;
      const unreservedStock = Math.max(0, totalStock - currentAllocated);

      const alreadyAllocatedSO = Number(item.allocatedFgQty || 0);
      const remainingNeeded = Math.max(0, orderedQty - alreadyAllocatedSO);

      const reservedQuantity = customAlloc !== null && customAlloc !== undefined
        ? Number(customAlloc.reservedQuantity || 0)
        : Math.min(remainingNeeded, unreservedStock);

      const shortfallQuantity = Math.max(0, remainingNeeded - reservedQuantity);

      totalReserved += reservedQuantity;
      totalShortfall += shortfallQuantity;

      // Update item allocatedFgQty
      item.allocatedFgQty = alreadyAllocatedSO + reservedQuantity;

      // Update FGItem allocatedQuantity in store
      if (reservedQuantity > 0 && fgDoc) {
        fgDoc.allocatedQuantity = (fgDoc.allocatedQuantity || 0) + reservedQuantity;
        await fgDoc.save();
      }

      // Update FGInventoryMonthly
      const invRecord = await FGInventoryMonthly.findOne({
        company: companyId,
        fgItem: item.fgItem,
        month: currentMonth
      });
      if (reservedQuantity > 0 && invRecord) {
        invRecord.totalReservedQuantity = (invRecord.totalReservedQuantity || 0) + reservedQuantity;
        await invRecord.save();
      }

      // Update or create StoreOrderFulfillment
      let fulfillment = await StoreOrderFulfillment.findOne({ storeOrder: order._id, fgItem: item.fgItem });
      if (!fulfillment) {
        fulfillment = await StoreOrderFulfillment.create({
          company: companyId,
          storeOrder: order._id,
          fgItem: item.fgItem,
          orderedQuantity: orderedQty,
          reservedQuantity: item.allocatedFgQty,
          mrpMovedQuantity: shortfallQuantity,
          status: shortfallQuantity > 0 ? (item.allocatedFgQty > 0 ? 'Partial Stock' : 'Moved MRP') : 'Reserved',
          targetDate: item.targetDate || order.targetDate || new Date(),
        });
      } else {
        fulfillment.reservedQuantity = item.allocatedFgQty;
        fulfillment.mrpMovedQuantity = shortfallQuantity;
        fulfillment.status = shortfallQuantity > 0 ? (item.allocatedFgQty > 0 ? 'Partial Stock' : 'Moved MRP') : 'Reserved';
        await fulfillment.save();
      }

      // If there is net shortage, send ONLY this FG item shortfall to Purchase MRP Intake Bucket
      if (shortfallQuantity > 0) {
        let existingMRP = await StoreMRP.findOne({
          company: companyId,
          $or: [{ salesOrder: order._id }, { storeOrder: order._id }],
          fgItem: item.fgItem
        });

        if (!existingMRP) {
          await StoreMRP.create({
            company: companyId,
            salesOrder: order._id,
            storeOrder: order._id,
            fgItem: item.fgItem,
            requiredQuantity: shortfallQuantity,
            dueDate: item.targetDate || order.targetDate || new Date(),
            status: "Pending",
            createdBy: req.user?._id,
            remarks: `Shortage intake from Sales Order #${order.orderNumber}`
          });
        } else {
          existingMRP.requiredQuantity = shortfallQuantity;
          existingMRP.status = "Pending";
          await existingMRP.save();
        }
      }
    }
  }

  const isFullyAllocated = totalShortfall === 0;
  order.allocatedFgQty = (order.allocatedFgQty || 0) + totalReserved;
  order.status = isFullyAllocated ? "Items Allocated" : "Moved MRP";
  order.fulfillmentStatus = isFullyAllocated ? "Fully Allocated" : "Moved to MRP";
  await order.save();

  res.status(200).json({
    success: true,
    message: isFullyAllocated 
      ? `Sales Order #${order.orderNumber} fully allocated from FG stock (${totalReserved} pcs reserved).`
      : `Sales Order #${order.orderNumber}: ${totalReserved} pcs reserved from FG stock, ${totalShortfall} shortage FG item(s) sent to Purchase MRP Intake Bucket.`,
    order,
    totalReserved,
    totalShortfall
  });
});


export const getAllSalesOrders = asyncHandler(async (req, res) => {
  // Register required models for populate
  req.getModel('Customer', customerSchema);
  req.getModel('FGItem', fgItemSchema);
  const FGInventoryMonthly = req.getModel("FGInventoryMonthly", fgInventoryMonthlySchema);
  
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const companyId = getCompanyId(req);

  const rawOrders = await SalesOrder.find({ company: companyId })
    .populate("customer", "name code email phone")
    .populate("items.fgItem", "name code type description quantity allocatedQuantity unit")
    .populate("createdBy", "name")
    .sort({ createdAt: -1 })
    .lean();

  const currentMonth = getCurrentMonthStr();
  const monthlyRecords = await FGInventoryMonthly.find({ company: companyId, month: currentMonth }).lean();
  const monthlyMap = new Map();
  for (const rec of monthlyRecords) {
    if (rec.fgItem) monthlyMap.set(rec.fgItem.toString(), rec);
  }

  const orders = rawOrders.map(order => {
    if (order.items && Array.isArray(order.items)) {
      order.items = order.items.map(item => {
        if (item.fgItem && typeof item.fgItem === 'object') {
          const fgIdStr = item.fgItem._id ? item.fgItem._id.toString() : item.fgItem.toString();
          const monthlyRec = monthlyMap.get(fgIdStr);
          const closingStock = monthlyRec ? Number(monthlyRec.closingStock || 0) : Number(item.fgItem.quantity || 0);
          const reservedQty = monthlyRec ? Number(monthlyRec.totalReservedQuantity || 0) : Number(item.fgItem.allocatedQuantity || 0);
          item.fgItem.quantity = closingStock;
          item.fgItem.allocatedQuantity = reservedQty;
        }
        return item;
      });
    }
    return order;
  });

  res.status(200).json({ success: true, orders, count: orders.length });
});

export const getSalesOrderById = asyncHandler(async (req, res) => {
  req.getModel('Customer', customerSchema);
  req.getModel('FGItem', fgItemSchema);
  const FGInventoryMonthly = req.getModel("FGInventoryMonthly", fgInventoryMonthlySchema);
  const DeliveryChallan = req.getModel('DeliveryChallan', deliveryChallanSchema);
  const Invoice = req.getModel('Invoice', invoiceSchema);
  
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const companyId = getCompanyId(req);

  const rawOrder = await SalesOrder.findOne({ _id: req.params.id, company: companyId })
    .populate("customer", "name code email phone")
    .populate("items.fgItem", "name code type description quantity allocatedQuantity unit")
    .lean();

  if (!rawOrder) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  const currentMonth = getCurrentMonthStr();
  const monthlyRecords = await FGInventoryMonthly.find({ company: companyId, month: currentMonth }).lean();
  const monthlyMap = new Map();
  for (const rec of monthlyRecords) {
    if (rec.fgItem) monthlyMap.set(rec.fgItem.toString(), rec);
  }

  const order = { ...rawOrder };
  if (order.items && Array.isArray(order.items)) {
    order.items = order.items.map(item => {
      if (item.fgItem && typeof item.fgItem === 'object') {
        const fgIdStr = item.fgItem._id ? item.fgItem._id.toString() : item.fgItem.toString();
        const monthlyRec = monthlyMap.get(fgIdStr);
        const closingStock = monthlyRec ? Number(monthlyRec.closingStock || 0) : Number(item.fgItem.quantity || 0);
        const reservedQty = monthlyRec ? Number(monthlyRec.totalReservedQuantity || 0) : Number(item.fgItem.allocatedQuantity || 0);
        item.fgItem.quantity = closingStock;
        item.fgItem.allocatedQuantity = reservedQty;
      }
      return item;
    });
  }

  const deliveryChallans = await DeliveryChallan.find({ salesOrderReference: order._id }).lean();
  const invoices = await Invoice.find({ salesOrderReference: order._id }).lean();

  res.status(200).json({ success: true, order, deliveryChallans, invoices });
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
