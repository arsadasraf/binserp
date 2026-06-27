import { leadSchema, customerSchema, activitySchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// --- Leads ---

export const convertLeadToCustomer = asyncHandler(async (req, res) => {
    const { id } = req.params; // Lead ID
    const Lead = req.getModel('Lead', leadSchema);
    const Customer = req.getModel('Customer', customerSchema);

    const lead = await Lead.findOne({ _id: id, company: req.company._id });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.isConverted) throw new ApiError(400, "Lead is already converted");

    // Create Customer
    const customerData = {
        company: req.company._id,
        name: lead.companyName || lead.name,
        contactPerson: lead.name,
        email: lead.email,
        phone: lead.phone,
        convertedFromLead: lead._id,
        updatedBy: req.user._id
    };

    const customer = await Customer.create(customerData);

    // Update Lead
    lead.isConverted = true;
    lead.status = "Won";
    lead.convertedToCustomer = customer._id;
    await lead.save();

    return res.status(200).json(new ApiResponse(200, { customer, lead }, "Lead converted to Customer successfully"));
});


// --- Customers ---
