import { purchaseBillSchema } from "../../models/purchase/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createPurchaseBill = asyncHandler(async (req, res) => {
  const PurchaseBill = req.getModel("PurchaseBill", purchaseBillSchema);
  const companyId = getCompanyId(req);

  const { billNumber, date, vendorName, vendor, poReference, grnReference, items, subtotal, totalTax, grandTotal, paymentTerms, dueDate, remarks } = req.body;

  const existingBill = await PurchaseBill.findOne({ billNumber, company: companyId });
  if (existingBill) {
    throw new ApiError(400, "Purchase Bill with this number already exists");
  }

  const newBill = await PurchaseBill.create({
    company: companyId,
    billNumber,
    date,
    vendorName,
    vendor,
    poReference,
    grnReference,
    items,
    subtotal,
    totalTax,
    grandTotal,
    paymentTerms,
    dueDate,
    remarks,
    createdBy: req.user.id,
  });

  return res.status(201).json(new ApiResponse(201, newBill, "Purchase Bill created successfully"));
});

export const getPurchaseBills = asyncHandler(async (req, res) => {
  const PurchaseBill = req.getModel("PurchaseBill", purchaseBillSchema);
  const companyId = getCompanyId(req);

  const bills = await PurchaseBill.find({ company: companyId })
    .populate('vendor', 'name email phone address')
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, bills, "Purchase Bills fetched successfully"));
});

export const updatePurchaseBill = asyncHandler(async (req, res) => {
  const PurchaseBill = req.getModel("PurchaseBill", purchaseBillSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const updatedBill = await PurchaseBill.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true, runValidators: true }
  );

  if (!updatedBill) {
    throw new ApiError(404, "Purchase Bill not found");
  }

  return res.status(200).json(new ApiResponse(200, updatedBill, "Purchase Bill updated successfully"));
});

export const deletePurchaseBill = asyncHandler(async (req, res) => {
  const PurchaseBill = req.getModel("PurchaseBill", purchaseBillSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const deletedBill = await PurchaseBill.findOneAndDelete({ _id: id, company: companyId });

  if (!deletedBill) {
    throw new ApiError(404, "Purchase Bill not found");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Purchase Bill deleted successfully"));
});
