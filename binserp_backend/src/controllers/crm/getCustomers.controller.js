import { leadSchema, customerSchema, activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// --- Leads ---

export const getCustomers = asyncHandler(async (req, res) => {
    const Customer = req.getModel('Customer', customerSchema);
    const customers = await Customer.find({ company: req.company._id }).sort({ name: 1 });
    return res.status(200).json(new ApiResponse(200, customers, "Customers fetched successfully"));
});
