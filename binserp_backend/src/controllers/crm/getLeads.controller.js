import { leadSchema, customerSchema, activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// --- Leads ---

export const getLeads = asyncHandler(async (req, res) => {
    const Lead = req.getModel('Lead', leadSchema);
    const { status, assignedTo } = req.query;

    const query = { company: req.company._id };
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;

    const leads = await Lead.find(query)
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, leads, "Leads fetched successfully"));
});
