import { customerSchema, dealSchema, activitySchema, leadSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const getCustomers = asyncHandler(async (req, res) => {
    const Customer = req.getModel("Customer", customerSchema);
    const { industry, tier, search } = req.query;

    const query = { company: req.company._id };
    if (industry && industry !== "All") query.industry = industry;
    if (tier && tier !== "All") query.tier = tier;

    if (search && search.trim()) {
        const regex = { $regex: search.trim(), $options: "i" };
        query.$or = [
            { name: regex },
            { customerCode: regex },
            { contactPerson: regex },
            { email: regex },
            { phone: regex },
            { gstin: regex }
        ];
    }

    const customers = await Customer.find(query)
        .populate("assignedAccountManager", "name email")
        .populate("convertedFromLead", "name source createdAt")
        .sort({ name: 1 });

    return res.status(200).json(new ApiResponse(200, customers, "Customers fetched successfully"));
});

// Customer 360 Degree Profile & Timeline
export const getCustomer360 = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Customer = req.getModel("Customer", customerSchema);
    const Deal = req.getModel("Deal", dealSchema);
    const Activity = req.getModel("Activity", activitySchema);

    const customer = await Customer.findOne({ _id: id, company: req.company._id })
        .populate("assignedAccountManager", "name email");

    if (!customer) throw new ApiError(404, "Customer not found");

    const deals = await Deal.find({ customer: id, company: req.company._id }).sort({ createdAt: -1 });
    const activities = await Activity.find({ relatedCustomer: id, company: req.company._id })
        .populate("createdBy", "name email")
        .sort({ date: -1 });

    const totalRevenue = deals.filter(d => d.status === "Won").reduce((acc, cur) => acc + (cur.value || 0), 0);
    const activePipeline = deals.filter(d => d.status === "Open").reduce((acc, cur) => acc + (cur.value || 0), 0);

    return res.status(200).json(new ApiResponse(200, {
        customer,
        deals,
        activities,
        analytics: {
            totalDealsCount: deals.length,
            wonDealsCount: deals.filter(d => d.status === "Won").length,
            totalRevenue,
            activePipeline
        }
    }, "Customer 360 profile fetched successfully"));
});
