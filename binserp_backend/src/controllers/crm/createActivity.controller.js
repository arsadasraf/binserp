import { leadSchema, customerSchema, activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// --- Leads ---

export const createActivity = asyncHandler(async (req, res) => {
    const { type, summary } = req.body;
    if (!type || !summary) throw new ApiError(400, "Type and Summary are required");

    const Activity = req.getModel('Activity', activitySchema);
    const activity = await Activity.create({
        company: req.company._id,
        ...req.body,
        createdBy: req.user._id
    });

    return res.status(201).json(new ApiResponse(201, activity, "Activity logged successfully"));
});
