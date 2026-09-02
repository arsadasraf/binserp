import { leadSchema, customerSchema, activitySchema, dealSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const getCRMStats = asyncHandler(async (req, res) => {
    const Lead = req.getModel("Lead", leadSchema);
    const Customer = req.getModel("Customer", customerSchema);
    const Activity = req.getModel("Activity", activitySchema);
    const Deal = req.getModel("Deal", dealSchema);

    const companyId = req.company._id;

    const [leads, customers, deals, activities] = await Promise.all([
        Lead.find({ company: companyId }),
        Customer.find({ company: companyId }),
        Deal.find({ company: companyId }),
        Activity.find({ company: companyId })
    ]);

    // 1. Core KPIs
    const totalLeads = leads.length;
    const activeLeads = leads.filter(l => l.status !== "Won" && l.status !== "Lost").length;
    const wonLeads = leads.filter(l => l.status === "Won").length;
    const lostLeads = leads.filter(l => l.status === "Lost").length;
    const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : 0;

    const totalCustomers = customers.length;
    const totalDeals = deals.length;
    const openDeals = deals.filter(d => d.status === "Open");
    const wonDeals = deals.filter(d => d.status === "Won");
    const totalPipelineValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const totalWonRevenue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);

    const now = new Date();
    const overdueActivities = activities.filter(a => !a.isCompleted && a.dueDate && new Date(a.dueDate) < now).length;
    const pendingActivities = activities.filter(a => !a.isCompleted).length;

    // 2. Stage Funnel Distribution
    const stageMap = {};
    leads.forEach(l => {
        const s = l.status || "New";
        stageMap[s] = (stageMap[s] || 0) + 1;
    });
    const stageFunnel = Object.entries(stageMap).map(([stage, count]) => ({ stage, count }));

    // 3. Source ROI & Distribution
    const sourceMap = {};
    leads.forEach(l => {
        const src = l.source || "Other";
        if (!sourceMap[src]) sourceMap[src] = { count: 0, won: 0, estimatedValue: 0 };
        sourceMap[src].count++;
        sourceMap[src].estimatedValue += (l.estimatedValue || 0);
        if (l.status === "Won") sourceMap[src].won++;
    });
    const sourceStats = Object.entries(sourceMap).map(([source, data]) => ({
        source,
        ...data,
        conversionRate: data.count > 0 ? ((data.won / data.count) * 100).toFixed(1) : 0
    }));

    // 4. Warmth Breakdown
    const warmthBreakdown = {
        Hot: leads.filter(l => l.warmth === "Hot").length,
        Warm: leads.filter(l => l.warmth === "Warm" || !l.warmth).length,
        Cold: leads.filter(l => l.warmth === "Cold").length
    };

    // 5. Recent Activity Feed (Top 10)
    const recentActivities = await Activity.find({ company: companyId })
        .populate("createdBy", "name email")
        .populate("relatedLead", "name companyName")
        .populate("relatedCustomer", "name")
        .sort({ createdAt: -1 })
        .limit(10);

    return res.status(200).json(new ApiResponse(200, {
        kpis: {
            totalLeads,
            activeLeads,
            wonLeads,
            lostLeads,
            conversionRate: Number(conversionRate),
            totalCustomers,
            totalDeals,
            openDealsCount: openDeals.length,
            wonDealsCount: wonDeals.length,
            totalPipelineValue,
            totalWonRevenue,
            overdueActivities,
            pendingActivities
        },
        stageFunnel,
        sourceStats,
        warmthBreakdown,
        recentActivities
    }, "CRM Analytics Stats fetched successfully"));
});
