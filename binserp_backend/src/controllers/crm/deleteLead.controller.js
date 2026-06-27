import { leadSchema, customerSchema, activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// --- Leads ---

export const deleteLead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Lead = req.getModel('Lead', leadSchema);
    await Lead.findOneAndDelete({ _id: id, company: req.company._id });
    return res.status(200).json(new ApiResponse(200, null, "Lead deleted successfully"));
});
