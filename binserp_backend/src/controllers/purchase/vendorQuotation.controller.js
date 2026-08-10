import { vendorQuotationSchema } from "../../models/purchase/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createVendorQuotation = asyncHandler(async (req, res) => {
  const VendorQuotation = req.getModel("VendorQuotation", vendorQuotationSchema);
  const companyId = getCompanyId(req);

  let { 
    quotationNumber, 
    rfq, 
    rfqNumber, 
    vendor, 
    vendorName, 
    vendorAddress, 
    vendorEmail, 
    vendorPhone, 
    vendorGst, 
    date, 
    items, 
    subtotal, 
    totalTax, 
    grandTotal, 
    validUntil, 
    termsAndConditions,
    status
  } = req.body;

  if (!quotationNumber) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    quotationNumber = `VQ-${dateStr}-${randomNum}`;
  }

  const existingQuotation = await VendorQuotation.findOne({ quotationNumber, company: companyId });
  if (existingQuotation) {
    throw new ApiError(400, "Vendor Quotation with this number already exists");
  }

  const newQuotation = await VendorQuotation.create({
    company: companyId,
    quotationNumber,
    rfq: rfq || undefined,
    rfqNumber: rfqNumber || "",
    vendor: vendor || undefined,
    vendorName: vendorName || "Supplier",
    vendorAddress,
    vendorEmail,
    vendorPhone,
    vendorGst,
    date: date || new Date(),
    items: Array.isArray(items) ? items : [],
    subtotal,
    totalTax,
    grandTotal,
    validUntil,
    status: status || "Pending Approval",
    termsAndConditions,
    createdBy: req.user?._id || req.user?.id,
  });

  return res.status(201).json(new ApiResponse(201, newQuotation, "Vendor Quotation created successfully"));
});

export const getVendorQuotations = asyncHandler(async (req, res) => {
  const VendorQuotation = req.getModel("VendorQuotation", vendorQuotationSchema);
  const companyId = getCompanyId(req);

  const quotations = await VendorQuotation.find({ company: companyId })
    .populate("vendor")
    .populate("rfq")
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, quotations, "Vendor Quotations fetched successfully"));
});

export const updateVendorQuotation = asyncHandler(async (req, res) => {
  const VendorQuotation = req.getModel("VendorQuotation", vendorQuotationSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const updatedQuotation = await VendorQuotation.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true, runValidators: true }
  );

  if (!updatedQuotation) {
    throw new ApiError(404, "Vendor Quotation not found");
  }

  return res.status(200).json(new ApiResponse(200, updatedQuotation, "Vendor Quotation updated successfully"));
});

export const deleteVendorQuotation = asyncHandler(async (req, res) => {
  const VendorQuotation = req.getModel("VendorQuotation", vendorQuotationSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const deletedQuotation = await VendorQuotation.findOneAndDelete({ _id: id, company: companyId });

  if (!deletedQuotation) {
    throw new ApiError(404, "Vendor Quotation not found");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Vendor Quotation deleted successfully"));
});
