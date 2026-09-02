import { activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const getActivities = asyncHandler(async (req, res) => {
    const { leadId, customerId, dealId, type, status, isCompleted } = req.query;
    const Activity = req.getModel("Activity", activitySchema);

    const query = { company: req.company._id };
    if (leadId) query.relatedLead = leadId;
    if (customerId) query.relatedCustomer = customerId;
    if (dealId) query.relatedDeal = dealId;
    if (type && type !== "All") query.type = type;
    if (isCompleted != null) query.isCompleted = isCompleted === "true";

    const activities = await Activity.find(query)
        .populate("createdBy", "name email")
        .populate("assignedTo", "name email")
        .populate("relatedLead", "name companyName phone email")
        .populate("relatedCustomer", "name contactPerson phone email")
        .populate("relatedDeal", "title value stage")
        .sort({ dueDate: 1, date: -1 });

    return res.status(200).json(new ApiResponse(200, activities, "Activities fetched successfully"));
});

export const updateActivity = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Activity = req.getModel("Activity", activitySchema);

    const activity = await Activity.findOne({ _id: id, company: req.company._id });
    if (!activity) throw new ApiError(404, "Activity not found");

    if (req.body.isCompleted && !activity.isCompleted) {
        activity.completedAt = new Date();
    }

    Object.assign(activity, req.body);
    await activity.save();

    return res.status(200).json(new ApiResponse(200, activity, "Activity updated successfully"));
});

export const deleteActivity = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Activity = req.getModel("Activity", activitySchema);

    const activity = await Activity.findOneAndDelete({ _id: id, company: req.company._id });
    if (!activity) throw new ApiError(404, "Activity not found");

    return res.status(200).json(new ApiResponse(200, activity, "Activity deleted successfully"));
});
