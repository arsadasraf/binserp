import { leadSchema, customerSchema, activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// --- Leads ---

export const getCRMStats = asyncHandler(async (req, res) => {
    const Lead = req.getModel('Lead', leadSchema);
    const Customer = req.getModel('Customer', customerSchema);

    const totalLeads = await Lead.countDocuments({ company: req.company._id });
    const newLeads = await Lead.countDocuments({ company: req.company._id, status: 'New' });
    const totalCustomers = await Customer.countDocuments({ company: req.company._id });
    const wonLeads = await Lead.countDocuments({ company: req.company._id, status: 'Won' });

    // Conversion Rate
    const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : 0;

    return res.status(200).json(new ApiResponse(200, {
        totalLeads,
        newLeads,
        totalCustomers,
        conversionRate
    }, "CRM Stats Fetched"));
});
