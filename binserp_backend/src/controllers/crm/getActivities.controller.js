import { leadSchema, customerSchema, activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// --- Leads ---

export const getActivities = asyncHandler(async (req, res) => {
    const { leadId, customerId } = req.query;
    const Activity = req.getModel('Activity', activitySchema);

    const query = { company: req.company._id };
    if (leadId) query.relatedLead = leadId;
    if (customerId) query.relatedCustomer = customerId;

    const activities = await Activity.find(query)
        .populate('createdBy', 'name')
        .sort({ date: -1 });

    return res.status(200).json(new ApiResponse(200, activities, "Activities fetched successfully"));
});

// --- Stats for Dashboard ---
