import { FGQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { fgItemSchema, fgGRNSchema } from "../../models/store/index.js";
import { userSchema } from "../../models/user/index.js";
import { jobSchema } from "../../models/ppc/index.js";

export const getFGQC = asyncHandler(async (req, res) => {
  const companyId = req.company?._id || req.user?.company;

  // Register referenced schemas for Mongoose population
  req.getModel("User", userSchema);
  req.getModel("FGItem", fgItemSchema);
  req.getModel("FGGRN", fgGRNSchema);
  req.getModel("Job", jobSchema);

  const FGQC = req.getModel("FGQC", FGQCSchema);

  const query = { company: companyId };

  if (req.query.status) {
    query.overallStatus = req.query.status;
  }
  if (req.query.fgItemId) {
    query.fgItemId = req.query.fgItemId;
  }
  if (req.query.batchNumber) {
    query.batchNumber = { $regex: req.query.batchNumber, $options: "i" };
  }

  const records = await FGQC.find(query)
    .populate("inspector", "username name email")
    .populate("fgItemId", "name partNumber drawingNumber")
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, records, "Fetched Finished Goods Quality Records"));
});
