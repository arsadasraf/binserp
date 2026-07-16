import { incomingPOSchema, salesOrderSchema, quotationSchema } from "../../models/sales/index.js";
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
  }

  // 1. Create Incoming PO
  const incomingPO = await IncomingPO.create({
    ...req.body,
    photos: photoUrls,
    pdf: pdfUrl,
    company: companyId,
    receivedBy: req.user.id,
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
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const companyId = getCompanyId(req);
  const pos = await IncomingPO.find({ company: companyId })
    .sort({ createdAt: -1 })
    .populate("customer", "name")
    .populate("quotationReference", "quotationNumber")
    .populate("receivedBy", "name email");
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

  const existingPO = await IncomingPO.findOne({ _id: id, company: companyId });
  if (!existingPO) {
    return res.status(404).json({ message: "Incoming PO not found" });
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
  }

  req.body.photos = photoUrls;

  const incomingPO = await IncomingPO.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true }
  );

  res.status(200).json({ message: "Incoming PO updated successfully", incomingPO });
});

export const deleteIncomingPO = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const incomingPO = await IncomingPO.findOneAndDelete({ _id: id, company: companyId });
  
  if (!incomingPO) {
    return res.status(404).json({ message: "Incoming PO not found" });
  }

  res.status(200).json({ message: "Incoming PO deleted successfully" });
});
