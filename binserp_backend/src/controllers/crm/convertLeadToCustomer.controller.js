import { leadSchema, customerSchema, dealSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const convertLeadToCustomer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { createDeal, dealTitle, dealValue, dealStage } = req.body;

    const Lead = req.getModel("Lead", leadSchema);
    const Customer = req.getModel("Customer", customerSchema);
    const Deal = req.getModel("Deal", dealSchema);

    const lead = await Lead.findOne({ _id: id, company: req.company._id });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.isConverted) throw new ApiError(400, "Lead is already converted");

    // 1. Create or Find Customer
    let customer = await Customer.findOne({
        company: req.company._id,
        $or: [
            { name: { $regex: new RegExp(`^${lead.companyName || lead.name}$`, "i") } },
            ...(lead.email ? [{ email: lead.email }] : []),
            ...(lead.phone ? [{ phone: lead.phone }] : [])
        ]
    });

    if (!customer) {
        customer = await Customer.create({
            company: req.company._id,
            name: lead.companyName || lead.name,
            contactPerson: lead.name,
            designation: lead.designation,
            email: lead.email,
            phone: lead.phone,
            altPhone: lead.altPhone,
            website: lead.website,
            address: {
                street: lead.address,
                city: lead.city,
                state: lead.state,
                country: lead.country || "India",
                zipCode: lead.pincode
            },
            source: lead.source,
            convertedFromLead: lead._id,
            assignedAccountManager: lead.assignedTo,
            createdBy: req.user._id
        });
    }

    // 2. Optionally Create Deal
    let deal = null;
    if (createDeal || req.body.createDeal !== false) {
        deal = await Deal.create({
            company: req.company._id,
            title: dealTitle || `Deal - ${lead.companyName || lead.name}`,
            lead: lead._id,
            customer: customer._id,
            customerName: customer.name,
            contactPerson: customer.contactPerson,
            email: customer.email,
            phone: customer.phone,
            value: Number(dealValue) || lead.estimatedValue || 0,
            currency: lead.currency || "INR",
            stage: dealStage || "Proposal Sent",
            probability: 70,
            assignedTo: lead.assignedTo || req.user._id,
            createdBy: req.user._id
        });
    }

    // 3. Mark Lead as Converted
    lead.isConverted = true;
    lead.convertedAt = new Date();
    lead.status = "Won";
    lead.convertedToCustomer = customer._id;
    if (deal) lead.convertedToDeal = deal._id;
    await lead.save();

    return res.status(200).json(new ApiResponse(200, { customer, deal, lead }, "Lead converted successfully"));
});
