import { JobWorkQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { vendorSchema } from "../../models/store/index.js";
import { userSchema } from "../../models/user/index.js";

export const getJobWorkQC = asyncHandler(async (req, res) => {
  const companyId = req.company?._id || req.user?.company;

  // Register schemas for population
  req.getModel("User", userSchema);
  req.getModel("Vendor", vendorSchema);

  const JobWorkQC = req.getModel("JobWorkQC", JobWorkQCSchema);

  const query = { company: companyId };

  if (req.query.status) {
    query.overallStatus = req.query.status;
  }
  if (req.query.vendorId) {
    query.vendor = req.query.vendorId;
  }
  if (req.query.challanNumber) {
    query.challanNumber = { $regex: req.query.challanNumber, $options: "i" };
  }

  const records = await JobWorkQC.find(query)
    .populate("inspector", "username name email")
    .populate("vendor", "name code gstin billingAddress phone email")
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, records, "Fetched Job Work Return Quality Records"));
});
