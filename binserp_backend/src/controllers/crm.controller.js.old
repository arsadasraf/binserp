import { leadSchema, customerSchema, activitySchema } from "../models/crm/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export const getLeads = asyncHandler(async (req, res) => {
    const Lead = req.getModel('Lead', leadSchema);
    const { status, assignedTo } = req.query;

    const query = { company: req.company._id };
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;

    const leads = await Lead.find(query)
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, leads, "Leads fetched successfully"));
});

export const updateLead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Lead = req.getModel('Lead', leadSchema);

    const lead = await Lead.findOneAndUpdate(
        { _id: id, company: req.company._id },
        req.body,
        { new: true }
    );

    if (!lead) throw new ApiError(404, "Lead not found");
    return res.status(200).json(new ApiResponse(200, lead, "Lead updated successfully"));
});

export const deleteLead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Lead = req.getModel('Lead', leadSchema);
    await Lead.findOneAndDelete({ _id: id, company: req.company._id });
    return res.status(200).json(new ApiResponse(200, null, "Lead deleted successfully"));
});

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

export const getCustomers = asyncHandler(async (req, res) => {
    const Customer = req.getModel('Customer', customerSchema);
    const customers = await Customer.find({ company: req.company._id }).sort({ name: 1 });
    return res.status(200).json(new ApiResponse(200, customers, "Customers fetched successfully"));
});

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

export const deleteCustomer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Customer = req.getModel('Customer', customerSchema);
    await Customer.findOneAndDelete({ _id: id, company: req.company._id });
    return res.status(200).json(new ApiResponse(200, null, "Customer deleted successfully"));
});

// --- Activities ---

export const createActivity = asyncHandler(async (req, res) => {
    const { type, summary } = req.body;
    if (!type || !summary) throw new ApiError(400, "Type and Summary are required");

    const Activity = req.getModel('Activity', activitySchema);
    const activity = await Activity.create({
        company: req.company._id,
        ...req.body,
        createdBy: req.user._id
    });

    return res.status(201).json(new ApiResponse(201, activity, "Activity logged successfully"));
});

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
