import { leadSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const getLeads = asyncHandler(async (req, res) => {
    const Lead = req.getModel("Lead", leadSchema);
    const { status, source, warmth, priority, assignedTo, search, fromDate, toDate } = req.query;

    const query = { company: req.company._id };
    if (status && status !== "All") query.status = status;
    if (source && source !== "All") query.source = source;
    if (warmth && warmth !== "All") query.warmth = warmth;
    if (priority && priority !== "All") query.priority = priority;
    if (assignedTo && assignedTo !== "All") query.assignedTo = assignedTo;

    if (fromDate || toDate) {
        query.createdAt = {};
        if (fromDate) query.createdAt.$gte = new Date(fromDate);
        if (toDate) query.createdAt.$lte = new Date(toDate + "T23:59:59.999Z");
    }

    if (search && search.trim()) {
        const regex = { $regex: search.trim(), $options: "i" };
        query.$or = [
            { name: regex },
            { companyName: regex },
            { phone: regex },
            { email: regex },
            { city: regex },
            { requirements: regex }
        ];
    }

    const leads = await Lead.find(query)
        .populate("assignedTo", "name email")
        .populate("convertedToCustomer", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, leads, "Leads fetched successfully"));
});
