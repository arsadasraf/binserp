import { leadSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const getLeads = asyncHandler(async (req, res) => {
    const Lead = req.getModel("Lead", leadSchema);
    const { 
        status, 
        source, 
        warmth, 
        priority, 
        assignedTo, 
        search, 
        fromDate, 
        toDate,
        followUpFilter,
        followUpFromDate,
        followUpToDate
    } = req.query;

    const query = { company: req.company._id };
    if (status && status !== "All") query.status = status;
    if (source && source !== "All") query.source = source;
    if (warmth && warmth !== "All") query.warmth = warmth;
    if (priority && priority !== "All") query.priority = priority;
    if (assignedTo && assignedTo !== "All") query.assignedTo = assignedTo;

    // Follow-up quick filters
    if (followUpFilter && followUpFilter !== "All") {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const startOfTomorrow = new Date(startOfToday);
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
        const endOfTomorrow = new Date(endOfToday);
        endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

        const endOfWeek = new Date(startOfToday);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        endOfWeek.setHours(23, 59, 59, 999);

        if (followUpFilter === "overdue") {
            query["latestFollowUp.nextFollowUpDate"] = { $lt: now };
        } else if (followUpFilter === "today") {
            query["latestFollowUp.nextFollowUpDate"] = { $gte: startOfToday, $lte: endOfToday };
        } else if (followUpFilter === "tomorrow") {
            query["latestFollowUp.nextFollowUpDate"] = { $gte: startOfTomorrow, $lte: endOfTomorrow };
        } else if (followUpFilter === "this_week") {
            query["latestFollowUp.nextFollowUpDate"] = { $gte: startOfToday, $lte: endOfWeek };
        } else if (followUpFilter === "pending") {
            query["latestFollowUp.nextFollowUpDate"] = { $gte: now };
        } else if (followUpFilter === "none") {
            query.$or = [
                { "latestFollowUp.nextFollowUpDate": { $exists: false } },
                { "latestFollowUp.nextFollowUpDate": null }
            ];
        }
    }

    if (followUpFromDate || followUpToDate) {
        query["latestFollowUp.nextFollowUpDate"] = query["latestFollowUp.nextFollowUpDate"] || {};
        if (followUpFromDate) query["latestFollowUp.nextFollowUpDate"].$gte = new Date(followUpFromDate);
        if (followUpToDate) query["latestFollowUp.nextFollowUpDate"].$lte = new Date(followUpToDate + "T23:59:59.999Z");
    }

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
