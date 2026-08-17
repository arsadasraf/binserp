import { incomingPOSchema, salesOrderSchema, quotationSchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js";
import { customerSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { uploadOnS3 } from "../../utils/s3.js";
import { generateOrderNumber } from "./salesOrder.controller.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createIncomingPO = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const companyId = getCompanyId(req);
  
  if (req.body.quotationReference === "") {
    delete req.body.quotationReference;
  }
  
  if (typeof req.body.items === 'string') {
    req.body.items = JSON.parse(req.body.items);
  }

  if (Array.isArray(req.body.items)) {
    req.body.items = req.body.items.map(item => {
      const cleaned = { ...item };
      if (!cleaned.fgItem || cleaned.fgItem === "") delete cleaned.fgItem;
      if (!cleaned.expectedDeliveryDate || cleaned.expectedDeliveryDate === "") delete cleaned.expectedDeliveryDate;
      return cleaned;
    });
  }

  let photoUrls = [];
  let pdfUrl = null;

  if (req.files) {
    if (req.files['photos'] && req.files['photos'].length > 0) {
      for (const file of req.files['photos']) {
        const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
        if (result?.url) photoUrls.push(result.url);
      }
    }
    if (req.files['pdf'] && req.files['pdf'].length > 0) {
      const file = req.files['pdf'][0];
      const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
      if (result?.url) pdfUrl = result.url;
    }
    if (req.files['document'] && req.files['document'].length > 0) {
      const file = req.files['document'][0];
      const isPdf = file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype === 'application/pdf';
      const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
      if (result?.url) {
        if (isPdf) {
          pdfUrl = result.url;
        } else {
          photoUrls.push(result.url);
        }
      }
    }
  }

  // 1. Create Incoming PO
  const userId = req.user?.id || req.user?._id;
  const initialStatus = req.body.status || "Received";

  const incomingPO = await IncomingPO.create({
    ...req.body,
    photos: photoUrls,
    pdf: pdfUrl,
    company: companyId,
    receivedBy: userId,
    createdBy: userId,
    updatedBy: userId,
    statusHistory: [
      {
        status: initialStatus,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    ],
  });
  
  // 2. Update Quotation status if quotationReference is provided
  if (incomingPO.quotationReference) {
    const Quotation = req.getModel("Quotation", quotationSchema);
    await Quotation.findOneAndUpdate(
      { _id: incomingPO.quotationReference, company: companyId },
      { status: "Accepted" }
    );
  }

  res.status(201).json({ 
    message: "Incoming PO created successfully", 
    incomingPO 
  });
});

export const generateSalesOrderFromPO = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const incomingPO = await IncomingPO.findOne({ _id: id, company: companyId });
  if (!incomingPO) {
    return res.status(404).json({ message: "Incoming PO not found" });
  }

  if (incomingPO.status === "Sales Order Generated") {
    return res.status(400).json({ message: "Sales Order already generated for this PO" });
  }

  const orderNumber = await generateOrderNumber(req);
  
  const salesOrder = await SalesOrder.create({
    company: companyId,
    orderNumber,
    orderType: "PO_BASED",
    poReference: incomingPO.poNumber,
    customer: incomingPO.customer,
    targetDate: incomingPO.items[0]?.expectedDeliveryDate || incomingPO.date,
    items: incomingPO.items.map(item => ({
      fgItem: item.fgItem,
      name: item.productName,
      description: item.description,
      quantity: item.quantity,
      pricePerQuantity: item.rate,
      totalPrice: item.amount,
      targetDate: item.expectedDeliveryDate,
    })),
    totalAmount: incomingPO.totalAmount,
    status: "Pending",
    createdBy: req.user.id,
    remarks: `Auto-generated from PO: ${incomingPO.poNumber}`,
  });

  incomingPO.status = "Sales Order Generated";
  await incomingPO.save();

  res.status(201).json({ 
    message: "Sales Order generated successfully", 
    salesOrder,
    incomingPO
  });
});

export const getAllIncomingPOs = asyncHandler(async (req, res) => {
  req.getModel("Customer", customerSchema);
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const DeliveryChallan = req.getModel("DeliveryChallan", deliveryChallanSchema);
  const Invoice = req.getModel("Invoice", invoiceSchema);
  const companyId = getCompanyId(req);

  const pos = await IncomingPO.find({ company: companyId })
    .sort({ createdAt: -1 })
    .populate("customer", "name companyName code email phone city")
    .populate("quotationReference", "quotationNumber")
    .populate("receivedBy", "name email")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate("statusHistory.updatedBy", "name email")
    .populate("items.fgItem", "name code unit");

  // Sync real-time fulfillment status for each PO based on DCs & Invoices
  for (const po of pos) {
    if (po.status === "Cancelled") continue;

    const dcs = await DeliveryChallan.find({ customerPoReference: po._id, company: companyId });
    const invoices = await Invoice.find({ customerPoReference: po._id, company: companyId });

    const totalOrdered = (po.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);

    let totalDispatched = (po.items || []).reduce((sum, i) => sum + Number(i.dispatchedQuantity || 0), 0);
    if (dcs.length > 0) {
      const dcSum = dcs.reduce((acc, dc) => acc + (dc.items || []).reduce((iSum, it) => iSum + Number(it.quantity || 0), 0), 0);
      totalDispatched = Math.max(totalDispatched, dcSum);
    }

    let totalBilled = (po.items || []).reduce((sum, i) => sum + Number(i.billedQuantity || 0), 0);
    if (invoices.length > 0) {
      const invSum = invoices.reduce((acc, inv) => acc + (inv.items || []).reduce((iSum, it) => iSum + Number(it.quantity || 0), 0), 0);
      totalBilled = Math.max(totalBilled, invSum);
    }

    const effectiveFulfilled = Math.max(totalDispatched, totalBilled);

    if (totalOrdered > 0 && effectiveFulfilled > 0) {
      let expectedStatus = po.status;
      if (effectiveFulfilled >= totalOrdered) {
        expectedStatus = "Completed";
      } else {
        expectedStatus = "Partially Dispatched";
      }

      if (po.status !== expectedStatus) {
        po.status = expectedStatus;
        await IncomingPO.updateOne({ _id: po._id }, { status: expectedStatus });
      }
    }
  }

  res.status(200).json({ pos });
});

export const updateIncomingPO = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  if (req.body.quotationReference === "") {
    delete req.body.quotationReference;
  }
  
  if (typeof req.body.items === 'string') {
    req.body.items = JSON.parse(req.body.items);
  }

  if (Array.isArray(req.body.items)) {
    req.body.items = req.body.items.map(item => {
      const cleaned = { ...item };
      if (!cleaned.fgItem || cleaned.fgItem === "") delete cleaned.fgItem;
      if (!cleaned.expectedDeliveryDate || cleaned.expectedDeliveryDate === "") delete cleaned.expectedDeliveryDate;
      return cleaned;
    });
  }

  const existingPO = await IncomingPO.findOne({ _id: id, company: companyId });
  if (!existingPO) {
    return res.status(404).json({ message: "Incoming PO not found" });
  }

  // 24-hour edit restriction
  const createdTime = new Date(existingPO.createdAt || existingPO.date).getTime();
  const hoursDiff = (Date.now() - createdTime) / (1000 * 60 * 60);
  if (hoursDiff > 24) {
    return res.status(403).json({ message: "Customer PO can only be edited or deleted within 24 hours of creation" });
  }

  let photoUrls = req.body.existingPhotos || existingPO.photos;
  if (typeof photoUrls === 'string') photoUrls = JSON.parse(photoUrls);

  if (req.files) {
    if (req.files['photos'] && req.files['photos'].length > 0) {
      photoUrls = []; // If new photos are uploaded, replace old ones
      for (const file of req.files['photos']) {
        const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
        if (result?.url) photoUrls.push(result.url);
      }
    }
    if (req.files['pdf'] && req.files['pdf'].length > 0) {
      const file = req.files['pdf'][0];
      const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
      if (result?.url) req.body.pdf = result.url;
    }
    if (req.files['document'] && req.files['document'].length > 0) {
      const file = req.files['document'][0];
      const isPdf = file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype === 'application/pdf';
      const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
      if (result?.url) {
        if (isPdf) {
          req.body.pdf = result.url;
        } else {
          photoUrls.push(result.url);
        }
      }
    }
  }

  req.body.photos = photoUrls;
  const userId = req.user?.id || req.user?._id;
  req.body.updatedBy = userId;

  if (req.body.status && req.body.status !== existingPO.status) {
    req.body.$push = {
      statusHistory: {
        status: req.body.status,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    };
  }

  const incomingPO = await IncomingPO.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true }
  )
    .populate("customer", "name companyName code email phone city")
    .populate("quotationReference", "quotationNumber")
    .populate("receivedBy", "name email")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate("statusHistory.updatedBy", "name email")
    .populate("items.fgItem", "name code unit");

  // Auto-sync linked Sales Order if one was already generated for this PO
  try {
    const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
    const linkedSO = await SalesOrder.findOne({
      company: companyId,
      $or: [
        { poReference: incomingPO.poNumber },
        { remarks: `Auto-generated from PO: ${incomingPO.poNumber}` }
      ]
    });

    if (linkedSO) {
      linkedSO.customer = incomingPO.customer?._id || incomingPO.customer;
      if (Array.isArray(incomingPO.items)) {
        linkedSO.items = incomingPO.items.map((item) => ({
          fgItem: item.fgItem?._id || item.fgItem,
          name: item.productName || item.fgItem?.name || "Product Item",
          description: item.description,
          quantity: item.quantity,
          pricePerQuantity: item.rate,
          totalPrice: item.amount || (item.quantity * item.rate),
          targetDate: item.expectedDeliveryDate || incomingPO.date,
        }));
      }
      linkedSO.totalAmount = incomingPO.totalAmount || incomingPO.subtotal || 0;
      await linkedSO.save();
    }
  } catch (soErr) {
    console.error("Auto-sync Sales Order error:", soErr);
  }

  res.status(200).json({ message: "Incoming PO updated successfully", incomingPO });
});

export const deleteIncomingPO = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const existingPO = await IncomingPO.findOne({ _id: id, company: companyId });
  if (!existingPO) {
    return res.status(404).json({ message: "Incoming PO not found" });
  }

  // 24-hour delete restriction
  const createdTime = new Date(existingPO.createdAt || existingPO.date).getTime();
  const hoursDiff = (Date.now() - createdTime) / (1000 * 60 * 60);
  if (hoursDiff > 24) {
    return res.status(403).json({ message: "Customer PO can only be edited or deleted within 24 hours of creation" });
  }

  await IncomingPO.deleteOne({ _id: id, company: companyId });

  res.status(200).json({ message: "Incoming PO deleted successfully" });
});
