import { incomingRFQSchema } from "../../models/sales/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createIncomingRFQ = asyncHandler(async (req, res) => {
  const IncomingRFQ = req.getModel("IncomingRFQ", incomingRFQSchema);
  const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);
  const companyId = getCompanyId(req);
  
  let settings = await StorePrefix.findOne();
  const prefix = settings?.incomingRfqPrefix || "RFQ";
  const currentYear = new Date().getFullYear();
  const count = await IncomingRFQ.countDocuments({ company: companyId });
  const rfqNumber = req.body.rfqNumber || `${prefix}-${currentYear}-${(count + 1).toString().padStart(3, '0')}`;

  const initialStatus = req.body.status || "Open";
  const rfq = await IncomingRFQ.create({
    ...req.body,
    rfqNumber,
    company: companyId,
    receivedBy: req.user?.id,
    createdBy: req.user?.id,
    updatedBy: req.user?.id,
    statusHistory: [
      {
        status: initialStatus,
        updatedBy: req.user?.id,
        updatedAt: new Date(),
      },
    ],
  });
  
  res.status(201).json({ message: "Incoming RFQ created successfully", rfq });
});

export const getAllIncomingRFQs = asyncHandler(async (req, res) => {
  const IncomingRFQ = req.getModel("IncomingRFQ", incomingRFQSchema);
  const companyId = getCompanyId(req);
  const rfqs = await IncomingRFQ.find({ company: companyId })
    .sort({ createdAt: -1 })
    .populate("customer", "name code city email phone gst")
    .populate("receivedBy", "name email")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate("statusHistory.updatedBy", "name email")
    .populate("items.fgItem", "name unit code");
  res.status(200).json({ rfqs });
});

export const updateIncomingRFQ = asyncHandler(async (req, res) => {
  const IncomingRFQ = req.getModel("IncomingRFQ", incomingRFQSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const existing = await IncomingRFQ.findOne({ _id: id, company: companyId });
  if (!existing) {
    return res.status(404).json({ message: "Incoming RFQ not found" });
  }

  const updateData = {
    ...req.body,
    updatedBy: req.user?.id,
  };

  if (req.body.status && req.body.status !== existing.status) {
    updateData.$push = {
      statusHistory: {
        status: req.body.status,
        updatedBy: req.user?.id,
        updatedAt: new Date(),
      },
    };
  }

  const rfq = await IncomingRFQ.findOneAndUpdate(
    { _id: id, company: companyId },
    updateData,
    { new: true }
  )
    .populate("customer", "name code city email phone gst")
    .populate("receivedBy", "name email")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate("statusHistory.updatedBy", "name email")
    .populate("items.fgItem", "name unit code");

  res.status(200).json({ message: "Incoming RFQ updated successfully", rfq });
});

export const deleteIncomingRFQ = asyncHandler(async (req, res) => {
  const IncomingRFQ = req.getModel("IncomingRFQ", incomingRFQSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const rfq = await IncomingRFQ.findOneAndDelete({ _id: id, company: companyId });
  
  if (!rfq) {
    return res.status(404).json({ message: "Incoming RFQ not found" });
  }

  res.status(200).json({ message: "Incoming RFQ deleted successfully" });
});
