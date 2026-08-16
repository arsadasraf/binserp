import { purchaseRFQSchema } from "../../models/purchase/index.js";
import { userSchema } from "../../models/user/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createPurchaseRFQ = asyncHandler(async (req, res) => {
  const PurchaseRFQ = req.getModel("PurchaseRFQ", purchaseRFQSchema);
  req.getModel("User", userSchema);
  const companyId = getCompanyId(req);
  const userId = req.user?._id || req.user?.id;

  const { rfqNumber, date, dueDate, vendorName, vendorEmail, vendorPhone, vendorIds, items, remarks } = req.body;

  if (!rfqNumber) {
    throw new ApiError(400, "RFQ Number is required");
  }

  const existingRFQ = await PurchaseRFQ.findOne({ rfqNumber, company: companyId });
  if (existingRFQ) {
    throw new ApiError(400, "RFQ with this number already exists");
  }

  const newRFQ = await PurchaseRFQ.create({
    company: companyId,
    rfqNumber,
    date: date || new Date(),
    dueDate,
    vendorName: vendorName || "Multiple Vendors",
    vendorEmail,
    vendorPhone,
    vendorIds: Array.isArray(vendorIds) ? vendorIds : [],
    items: Array.isArray(items) ? items : [],
    remarks,
    status: "Sent",
    createdBy: userId,
    updatedBy: userId,
    statusHistory: [{ status: "Sent", updatedBy: userId, updatedAt: new Date() }],
  });

  const populatedRFQ = await PurchaseRFQ.findById(newRFQ._id)
    .populate("vendorIds")
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role");

  return res.status(201).json(new ApiResponse(201, populatedRFQ, "Purchase RFQ created successfully"));
});

export const getPurchaseRFQs = asyncHandler(async (req, res) => {
  const PurchaseRFQ = req.getModel("PurchaseRFQ", purchaseRFQSchema);
  req.getModel("User", userSchema);
  const companyId = getCompanyId(req);

  const rfqs = await PurchaseRFQ.find({ company: companyId })
    .populate("vendorIds")
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .populate("statusHistory.updatedBy", "name email role")
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, rfqs, "Purchase RFQs fetched successfully"));
});

export const updatePurchaseRFQ = asyncHandler(async (req, res) => {
  const PurchaseRFQ = req.getModel("PurchaseRFQ", purchaseRFQSchema);
  req.getModel("User", userSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);
  const userId = req.user?._id || req.user?.id;

  const existingRFQ = await PurchaseRFQ.findOne({ _id: id, company: companyId });
  if (!existingRFQ) {
    throw new ApiError(404, "Purchase RFQ not found");
  }

  const updatePayload = { ...req.body, updatedBy: userId };

  // Track status change audit history
  if (req.body.status && req.body.status !== existingRFQ.status) {
    updatePayload.$push = {
      statusHistory: {
        status: req.body.status,
        updatedBy: userId,
        updatedAt: new Date(),
      }
    };
  }

  const updatedRFQ = await PurchaseRFQ.findOneAndUpdate(
    { _id: id, company: companyId },
    updatePayload,
    { new: true, runValidators: true }
  )
    .populate("vendorIds")
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .populate("statusHistory.updatedBy", "name email role");

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
