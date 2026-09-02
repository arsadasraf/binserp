import { leadSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const updateLead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Lead = req.getModel("Lead", leadSchema);

    const lead = await Lead.findOne({ _id: id, company: req.company._id });
    if (!lead) throw new ApiError(404, "Lead not found");

    const previousStatus = lead.status;
    const newStatus = req.body.status;

    if (newStatus && newStatus !== previousStatus) {
        lead.stageHistory.push({
            fromStage: previousStatus,
            toStage: newStatus,
            changedBy: req.user._id,
            changedAt: new Date(),
            remarks: req.body.stageRemarks || `Lead status moved from ${previousStatus} to ${newStatus}`
        });
    }

    Object.assign(lead, req.body);
    lead.updatedBy = req.user._id;
    await lead.save();

    const updated = await Lead.findById(lead._id).populate("assignedTo", "name email");
    return res.status(200).json(new ApiResponse(200, updated, "Lead updated successfully"));
});
