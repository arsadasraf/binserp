import { leadSchema, customerSchema, activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// --- Leads ---

export const createLead = asyncHandler(async (req, res) => {
    const { name, companyName, email } = req.body;
    if (!name) throw new ApiError(400, "Lead Name is required");

    const Lead = req.getModel('Lead', leadSchema);
    const lead = await Lead.create({
        company: req.company._id,
        ...req.body,
        createdBy: req.user._id
    });

    return res.status(201).json(new ApiResponse(201, lead, "Lead created successfully"));
});
