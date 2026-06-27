import { leadSchema, customerSchema, activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// --- Leads ---

export const createCustomer = asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) throw new ApiError(400, "Company/Customer Name is required");

    const Customer = req.getModel('Customer', customerSchema);
    const customer = await Customer.create({
        company: req.company._id,
        ...req.body
    });

    return res.status(201).json(new ApiResponse(201, customer, "Customer created successfully"));
});
