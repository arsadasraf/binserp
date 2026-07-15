import { purchaseRFQSchema } from "../../models/purchase/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createPurchaseRFQ = asyncHandler(async (req, res) => {
  const PurchaseRFQ = req.getModel("PurchaseRFQ", purchaseRFQSchema);
  const companyId = getCompanyId(req);

  const { rfqNumber, date, vendorName, vendorEmail, vendorPhone, items, remarks } = req.body;

  const existingRFQ = await PurchaseRFQ.findOne({ rfqNumber, company: companyId });
  if (existingRFQ) {
    throw new ApiError(400, "RFQ with this number already exists");
  }

  const newRFQ = await PurchaseRFQ.create({
    company: companyId,
    rfqNumber,
    date,
    vendorName,
    vendorEmail,
    vendorPhone,
    items,
    remarks,
    createdBy: req.user.id,
  });

  return res.status(201).json(new ApiResponse(201, newRFQ, "Purchase RFQ created successfully"));
});

export const getPurchaseRFQs = asyncHandler(async (req, res) => {
  const PurchaseRFQ = req.getModel("PurchaseRFQ", purchaseRFQSchema);
  const companyId = getCompanyId(req);

  const rfqs = await PurchaseRFQ.find({ company: companyId }).sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, rfqs, "Purchase RFQs fetched successfully"));
});

export const updatePurchaseRFQ = asyncHandler(async (req, res) => {
  const PurchaseRFQ = req.getModel("PurchaseRFQ", purchaseRFQSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const updatedRFQ = await PurchaseRFQ.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true, runValidators: true }
  );

  if (!updatedRFQ) {
    throw new ApiError(404, "Purchase RFQ not found");
  }

  return res.status(200).json(new ApiResponse(200, updatedRFQ, "Purchase RFQ updated successfully"));
});

export const deletePurchaseRFQ = asyncHandler(async (req, res) => {
  const PurchaseRFQ = req.getModel("PurchaseRFQ", purchaseRFQSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const deletedRFQ = await PurchaseRFQ.findOneAndDelete({ _id: id, company: companyId });

  if (!deletedRFQ) {
    throw new ApiError(404, "Purchase RFQ not found");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Purchase RFQ deleted successfully"));
});
