import { rfqSchema } from "../../models/sales/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createRFQ = asyncHandler(async (req, res) => {
  const RFQ = req.getModel("RFQ", rfqSchema);
  const companyId = getCompanyId(req);
  
  const rfq = await RFQ.create({
    ...req.body,
    company: companyId,
    receivedBy: req.user.id,
  });
  
  res.status(201).json({ message: "RFQ created successfully", rfq });
});

export const getAllRFQs = asyncHandler(async (req, res) => {
  const RFQ = req.getModel("RFQ", rfqSchema);
  const companyId = getCompanyId(req);
  const rfqs = await RFQ.find({ company: companyId }).sort({ createdAt: -1 }).populate("receivedBy", "name email");
  res.status(200).json({ rfqs });
});

export const updateRFQ = asyncHandler(async (req, res) => {
  const RFQ = req.getModel("RFQ", rfqSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const rfq = await RFQ.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true }
  );

  if (!rfq) {
    return res.status(404).json({ message: "RFQ not found" });
  }

  res.status(200).json({ message: "RFQ updated successfully", rfq });
});

export const deleteRFQ = asyncHandler(async (req, res) => {
  const RFQ = req.getModel("RFQ", rfqSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const rfq = await RFQ.findOneAndDelete({ _id: id, company: companyId });
  
  if (!rfq) {
    return res.status(404).json({ message: "RFQ not found" });
  }

  res.status(200).json({ message: "RFQ deleted successfully" });
});
