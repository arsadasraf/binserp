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
        Lead.find({ company: companyId }).populate("assignedTo", "name email"),
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

    // 5. Sales Executive Performance Matrix (Requirement #10)
    const execMap = {};
    leads.forEach(l => {
        const execId = l.assignedTo?._id?.toString() || l.assignedTo?.toString() || "unassigned";
        const execName = l.assignedTo?.name || (execId === "unassigned" ? "Unassigned Pool" : "Field Executive");

        if (!execMap[execId]) {
            execMap[execId] = {
                id: execId,
                executiveId: execId,
                name: execName,
                leadsAssigned: 0,
                quotedValue: 0,
                valueQuoted: 0,
                orderedWonCount: 0,
                orderedWonValue: 0,
                lostCount: 0,
                lossesRecorded: 0
            };
        }

        execMap[execId].leadsAssigned++;
        execMap[execId].quotedValue += (l.estimatedValue || 0);
        execMap[execId].valueQuoted += (l.estimatedValue || 0);

        if (l.status === "Won") {
            execMap[execId].orderedWonCount++;
            execMap[execId].orderedWonValue += (l.estimatedValue || 0);
        } else if (l.status === "Lost") {
            execMap[execId].lostCount++;
            execMap[execId].lossesRecorded += (l.estimatedValue || 0);
        }
    });

    const executivePerformance = Object.values(execMap).map(exec => ({
        ...exec,
        conversionRate: exec.leadsAssigned > 0 
            ? ((exec.orderedWonCount / exec.leadsAssigned) * 100).toFixed(1) 
            : "0.0"
    }));

    // 6. Month-wise Lead Source Analytics (Requirement #11)
    const monthMap = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        monthMap[key] = { month: key, IndiaMART: 0, TradeIndia: 0, Direct: 0, Website: 0, Other: 0, Total: 0 };
    }

    leads.forEach(l => {
        const d = new Date(l.createdAt);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        if (monthMap[key]) {
            monthMap[key].Total++;
            const src = l.source || "Other";
            if (src.includes("IndiaMART")) monthMap[key].IndiaMART++;
            else if (src.includes("TradeIndia")) monthMap[key].TradeIndia++;
            else if (src.includes("Direct")) monthMap[key].Direct++;
            else if (src.includes("Web")) monthMap[key].Website++;
            else monthMap[key].Other++;
        }
    });

    const monthWiseSourceTrends = Object.values(monthMap);

    // 7. Product Sales & Inquiry Analytics (Requirement #12)
    const prodMap = {};
    leads.forEach(l => {
        const products = l.productInterest && l.productInterest.length > 0 
            ? l.productInterest 
            : ["General Machinery / Spares"];

        products.forEach(p => {
            const trimmed = p.trim();
            if (!prodMap[trimmed]) {
                prodMap[trimmed] = { product: trimmed, inquiriesCount: 0, wonCount: 0, quotedValue: 0, wonRevenue: 0 };
            }
            prodMap[trimmed].inquiriesCount++;
            prodMap[trimmed].quotedValue += (l.estimatedValue || 0);
            if (l.status === "Won") {
                prodMap[trimmed].wonCount++;
                prodMap[trimmed].wonRevenue += (l.estimatedValue || 0);
            }
        });
    });

    const productAnalytics = Object.values(prodMap).sort((a, b) => b.inquiriesCount - a.inquiriesCount).slice(0, 10);

    // 8. Recent Activity Feed (Top 10)
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
        executivePerformance,
        monthWiseSourceTrends,
        productAnalytics,
        recentActivities
    }, "CRM Analytics Stats fetched successfully"));
});
