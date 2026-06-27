import { leadSchema, customerSchema, activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// --- Leads ---

export const updateCustomer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Customer = req.getModel('Customer', customerSchema);
    const customer = await Customer.findOneAndUpdate(
        { _id: id, company: req.company._id },
        req.body,
        { new: true }
    );
    if (!customer) throw new ApiError(404, "Customer not found");
    return res.status(200).json(new ApiResponse(200, customer, "Customer updated successfully"));
});
