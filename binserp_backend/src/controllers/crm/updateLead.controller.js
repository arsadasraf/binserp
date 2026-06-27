import { leadSchema, customerSchema, activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// --- Leads ---

export const updateLead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Lead = req.getModel('Lead', leadSchema);

    const lead = await Lead.findOneAndUpdate(
        { _id: id, company: req.company._id },
        req.body,
        { new: true }
    );

    if (!lead) throw new ApiError(404, "Lead not found");
    return res.status(200).json(new ApiResponse(200, lead, "Lead updated successfully"));
});
