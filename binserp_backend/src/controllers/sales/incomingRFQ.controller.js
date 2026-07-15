import { incomingRFQSchema } from "../../models/sales/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createIncomingRFQ = asyncHandler(async (req, res) => {
  const IncomingRFQ = req.getModel("IncomingRFQ", incomingRFQSchema);
  const companyId = getCompanyId(req);
  
  const rfq = await IncomingRFQ.create({
    ...req.body,
    company: companyId,
    receivedBy: req.user.id,
  });
  
  res.status(201).json({ message: "Incoming RFQ created successfully", rfq });
});

export const getAllIncomingRFQs = asyncHandler(async (req, res) => {
  const IncomingRFQ = req.getModel("IncomingRFQ", incomingRFQSchema);
  const companyId = getCompanyId(req);
  const rfqs = await IncomingRFQ.find({ company: companyId })
    .sort({ createdAt: -1 })
    .populate("receivedBy", "name email")
    .populate("items.fgItem", "name unit");
  res.status(200).json({ rfqs });
});

export const updateIncomingRFQ = asyncHandler(async (req, res) => {
  const IncomingRFQ = req.getModel("IncomingRFQ", incomingRFQSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const rfq = await IncomingRFQ.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true }
  );

  if (!rfq) {
    return res.status(404).json({ message: "Incoming RFQ not found" });
  }

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
