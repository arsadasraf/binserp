import { incomingPOSchema, salesOrderSchema, quotationSchema } from "../../models/sales/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { generateOrderNumber } from "./salesOrder.controller.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createIncomingPO = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const companyId = getCompanyId(req);
  
  // 1. Create Incoming PO
  const incomingPO = await IncomingPO.create({
    ...req.body,
    company: companyId,
    receivedBy: req.user.id,
  });
  
  // 2. Automatically generate a Sales Order
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

  // 3. Update incoming PO status
  incomingPO.status = "Sales Order Generated";
  await incomingPO.save();

  // 4. Update Quotation status if quotationReference is provided
  if (incomingPO.quotationReference) {
    const Quotation = req.getModel("Quotation", quotationSchema);
    await Quotation.findOneAndUpdate(
      { _id: incomingPO.quotationReference, company: companyId },
      { status: "Accepted" }
    );
  }

  res.status(201).json({ 
    message: "Incoming PO and Sales Order created successfully", 
    incomingPO, 
    salesOrder 
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

  const incomingPO = await IncomingPO.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true }
  );

  if (!incomingPO) {
    return res.status(404).json({ message: "Incoming PO not found" });
  }

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
