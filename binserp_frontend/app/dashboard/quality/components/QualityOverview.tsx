/**
 * Quality Control Overview Dashboard
 * Mobile-optimized, high-density ERP interface with Horizontally Sliding Tabs
 * and Bottom Floating Action Refresh Button
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import {
    ClipboardList, CheckCircle2, AlertTriangle, RotateCcw,
    Layers, Package, Cog, FlaskConical, RefreshCw,
    TrendingUp, ShieldCheck, Clock, Search, Globe
} from "lucide-react";
import { motion } from "framer-motion";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';

export type QCTabType = "all" | "incoming" | "process" | "jobwork" | "fg";

interface QualityStatsData {
    overview: {
        totalInspections: number;
        totalUnitsInspected: number;
        totalUnitsPassed: number;
        totalUnitsRejected: number;
        totalUnitsRework: number;
        overallPassRate: number;
        overallRejectionRate: number;
        todayInspectionsCount: number;
    };
    categories: {
        incoming: {
            totalReports: number;
            receivedQuantity: number;
            inspectedQuantity: number;
            acceptedQuantity: number;
            rejectedQuantity: number;
            pendingCount: number;
            passRate: number;
            rejectionRate: number;
        };
        process: {
            totalReports: number;
            checkedQuantity: number;
            okQuantity: number;
            rejectedQuantity: number;
            reworkQuantity: number;
            passRate: number;
            rejectionRate: number;
            todayCount?: number;
        };
        jobwork: {
            totalReports: number;
            receivedQuantity: number;
            inspectedQuantity: number;
            acceptedQuantity: number;
            rejectedQuantity: number;
            reworkQuantity: number;
            scrapQuantity: number;
            pendingCount: number;
            passRate: number;
            rejectionRate: number;
        };
        fg: {
            totalReports: number;
            lotQuantity: number;
            inspectedQuantity: number;
            acceptedQuantity: number;
            rejectedQuantity: number;
            reworkQuantity: number;
            pendingCount: number;
            passRate: number;
            rejectionRate: number;
        };
    };
    dailyTrends: Array<{
        date: string;
        day: string;
        inspected: number;
        passed: number;
        rejected: number;
        passRate: number;
        rejectionRate: number;
    }>;
    dailyTrendsByCategory?: {
        incoming: Array<any>;
        process: Array<any>;
        jobwork: Array<any>;
        fg: Array<any>;
    };
    defectPareto: Array<{
        defect: string;
        count: number;
    }>;
    defectParetoByCategory?: {
        incoming: Array<any>;
        process: Array<any>;
        jobwork: Array<any>;
        fg: Array<any>;
    };
    recentReports: Array<{
        id: string;
        qcType: string;
        categoryKey: "incoming" | "process" | "jobwork" | "fg";
        docNumber: string;
        itemName: string;
        itemCode: string;
        inspectedQty: number;
        passedQty: number;
        rejectedQty: number;
        reworkQty: number;
        status: string;
        inspectorName: string;
        createdAt: string;
    }>;
}

export default function QualityOverview() {
    const [stats, setStats] = useState<QualityStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<QCTabType>("all");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setIsRefreshing(true);
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/api/quality/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success && response.data.data) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch quality stats:", error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const overview = stats?.overview || {
        totalInspections: 0,
        totalUnitsInspected: 0,
        totalUnitsPassed: 0,
        totalUnitsRejected: 0,
        totalUnitsRework: 0,
        overallPassRate: 0,
        overallRejectionRate: 0,
        todayInspectionsCount: 0
    };

    const categories = stats?.categories || {
        incoming: { totalReports: 0, receivedQuantity: 0, inspectedQuantity: 0, acceptedQuantity: 0, rejectedQuantity: 0, pendingCount: 0, passRate: 0, rejectionRate: 0 },
        process: { totalReports: 0, checkedQuantity: 0, okQuantity: 0, rejectedQuantity: 0, reworkQuantity: 0, passRate: 0, rejectionRate: 0 },
        jobwork: { totalReports: 0, receivedQuantity: 0, inspectedQuantity: 0, acceptedQuantity: 0, rejectedQuantity: 0, reworkQuantity: 0, scrapQuantity: 0, pendingCount: 0, passRate: 0, rejectionRate: 0 },
        fg: { totalReports: 0, lotQuantity: 0, inspectedQuantity: 0, acceptedQuantity: 0, rejectedQuantity: 0, reworkQuantity: 0, pendingCount: 0, passRate: 0, rejectionRate: 0 },
    };

    // Dynamic Top KPI Cards according to selected tab
    const dynamicKPIs = useMemo(() => {
        if (activeTab === "incoming") {
            const inc = categories.incoming;
            return [
                {
                    title: "Incoming Reports",
                    value: inc.totalReports.toLocaleString(),
                    subValue: `${inc.inspectedQuantity.toLocaleString()} Inspected`,
                    icon: ClipboardList,
                    color: "text-blue-600 dark:text-blue-400",
                    bg: "bg-blue-50 dark:bg-blue-950/50",
                    border: "border-blue-200 dark:border-blue-800"
                },
                {
                    title: "Accepted Qty",
                    value: inc.acceptedQuantity.toLocaleString(),
                    subValue: `${inc.passRate}% Acceptance Rate`,
                    icon: CheckCircle2,
                    color: "text-emerald-600 dark:text-emerald-400",
                    bg: "bg-emerald-50 dark:bg-emerald-950/50",
                    border: "border-emerald-200 dark:border-emerald-800",
                    badge: `${inc.passRate}% Pass`,
                    badgeColor: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                },
                {
                    title: "Rejected Qty",
                    value: inc.rejectedQuantity.toLocaleString(),
                    subValue: `${inc.rejectionRate}% Rejection Rate`,
                    icon: AlertTriangle,
                    color: "text-rose-600 dark:text-rose-400",
                    bg: "bg-rose-50 dark:bg-rose-950/50",
                    border: "border-rose-200 dark:border-rose-800",
                    badge: `${inc.rejectionRate}% Reject`,
                    badgeColor: "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300"
                },
                {
                    title: "Pending GRNs",
                    value: inc.pendingCount.toLocaleString(),
                    subValue: `${inc.receivedQuantity.toLocaleString()} Received Qty`,
                    icon: Clock,
                    color: "text-amber-600 dark:text-amber-400",
                    bg: "bg-amber-50 dark:bg-amber-950/50",
                    border: "border-amber-200 dark:border-amber-800"
                }
            ];
        }

        if (activeTab === "process") {
            const prc = categories.process;
            return [
                {
                    title: "Process Reports",
                    value: prc.totalReports.toLocaleString(),
                    subValue: `${prc.checkedQuantity.toLocaleString()} Checked`,
                    icon: ClipboardList,
                    color: "text-purple-600 dark:text-purple-400",
                    bg: "bg-purple-50 dark:bg-purple-950/50",
                    border: "border-purple-200 dark:border-purple-800"
                },
                {
                    title: "OK / Passed Qty",
                    value: prc.okQuantity.toLocaleString(),
                    subValue: `${prc.passRate}% Stage Pass Rate`,
                    icon: CheckCircle2,
                    color: "text-emerald-600 dark:text-emerald-400",
                    bg: "bg-emerald-50 dark:bg-emerald-950/50",
                    border: "border-emerald-200 dark:border-emerald-800",
                    badge: `${prc.passRate}% Pass`,
                    badgeColor: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                },
                {
                    title: "Rejected Qty",
                    value: prc.rejectedQuantity.toLocaleString(),
                    subValue: `${prc.rejectionRate}% Rejection Rate`,
                    icon: AlertTriangle,
                    color: "text-rose-600 dark:text-rose-400",
                    bg: "bg-rose-50 dark:bg-rose-950/50",
                    border: "border-rose-200 dark:border-rose-800",
                    badge: `${prc.rejectionRate}% Reject`,
                    badgeColor: "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300"
                },
                {
                    title: "Rework Qty",
                    value: prc.reworkQuantity.toLocaleString(),
                    subValue: `${prc.todayCount || 0} Checks Today`,
                    icon: RotateCcw,
                    color: "text-amber-600 dark:text-amber-400",
                    bg: "bg-amber-50 dark:bg-amber-950/50",
                    border: "border-amber-200 dark:border-amber-800"
                }
            ];
        }

        if (activeTab === "jobwork") {
            const jw = categories.jobwork;
            return [
                {
                    title: "Job-Work Reports",
                    value: jw.totalReports.toLocaleString(),
                    subValue: `${jw.inspectedQuantity.toLocaleString()} Inspected`,
                    icon: ClipboardList,
                    color: "text-amber-600 dark:text-amber-400",
                    bg: "bg-amber-50 dark:bg-amber-950/50",
                    border: "border-amber-200 dark:border-amber-800"
                },
                {
                    title: "Accepted Qty",
                    value: jw.acceptedQuantity.toLocaleString(),
                    subValue: `${jw.passRate}% Subcontract Pass Rate`,
                    icon: CheckCircle2,
                    color: "text-emerald-600 dark:text-emerald-400",
                    bg: "bg-emerald-50 dark:bg-emerald-950/50",
                    border: "border-emerald-200 dark:border-emerald-800",
                    badge: `${jw.passRate}% Pass`,
                    badgeColor: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                },
                {
                    title: "Rejected Qty",
                    value: jw.rejectedQuantity.toLocaleString(),
                    subValue: `${jw.rejectionRate}% Rejection Rate`,
                    icon: AlertTriangle,
                    color: "text-rose-600 dark:text-rose-400",
                    bg: "bg-rose-50 dark:bg-rose-950/50",
                    border: "border-rose-200 dark:border-rose-800",
                    badge: `${jw.rejectionRate}% Reject`,
                    badgeColor: "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300"
                },
                {
                    title: "Rework / Scrap",
                    value: (jw.reworkQuantity + jw.scrapQuantity).toLocaleString(),
                    subValue: `${jw.pendingCount} Pending JW Challans`,
                    icon: RotateCcw,
                    color: "text-amber-600 dark:text-amber-400",
                    bg: "bg-amber-50 dark:bg-amber-950/50",
                    border: "border-amber-200 dark:border-amber-800"
                }
            ];
        }

        if (activeTab === "fg") {
            const fg = categories.fg;
            return [
                {
                    title: "FG QC Reports",
                    value: fg.totalReports.toLocaleString(),
                    subValue: `${fg.inspectedQuantity.toLocaleString()} Inspected`,
                    icon: ClipboardList,
                    color: "text-teal-600 dark:text-teal-400",
                    bg: "bg-teal-50 dark:bg-teal-950/50",
                    border: "border-teal-200 dark:border-teal-800"
                },
                {
                    title: "Passed / Stock Qty",
                    value: fg.acceptedQuantity.toLocaleString(),
                    subValue: `${fg.passRate}% Final Pass Rate`,
                    icon: CheckCircle2,
                    color: "text-emerald-600 dark:text-emerald-400",
                    bg: "bg-emerald-50 dark:bg-emerald-950/50",
                    border: "border-emerald-200 dark:border-emerald-800",
                    badge: `${fg.passRate}% Pass`,
                    badgeColor: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                },
                {
                    title: "Rejected Qty",
                    value: fg.rejectedQuantity.toLocaleString(),
                    subValue: `${fg.rejectionRate}% Rejection Rate`,
                    icon: AlertTriangle,
                    color: "text-rose-600 dark:text-rose-400",
                    bg: "bg-rose-50 dark:bg-rose-950/50",
                    border: "border-rose-200 dark:border-rose-800",
                    badge: `${fg.rejectionRate}% Reject`,
                    badgeColor: "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300"
                },
                {
                    title: "Rework Qty",
                    value: fg.reworkQuantity.toLocaleString(),
                    subValue: `${fg.pendingCount} Pending Final PDI`,
                    icon: RotateCcw,
                    color: "text-amber-600 dark:text-amber-400",
                    bg: "bg-amber-50 dark:bg-amber-950/50",
                    border: "border-amber-200 dark:border-amber-800"
                }
            ];
        }

        // Default: ALL QC
        return [
            {
                title: "Total QC Reports",
                value: overview.totalInspections.toLocaleString(),
                subValue: `${overview.totalUnitsInspected.toLocaleString()} Total Units Inspected`,
                icon: ClipboardList,
                color: "text-blue-600 dark:text-blue-400",
                bg: "bg-blue-50 dark:bg-blue-950/50",
                border: "border-blue-200 dark:border-blue-800"
            },
            {
                title: "Passed Units",
                value: overview.totalUnitsPassed.toLocaleString(),
                subValue: `${overview.overallPassRate}% First-Time Pass Yield`,
                icon: CheckCircle2,
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-50 dark:bg-emerald-950/50",
                border: "border-emerald-200 dark:border-emerald-800",
                badge: `${overview.overallPassRate}% Pass`,
                badgeColor: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
            },
            {
                title: "Rejected Units",
                value: overview.totalUnitsRejected.toLocaleString(),
                subValue: `${overview.overallRejectionRate}% Overall Rejection Rate`,
                icon: AlertTriangle,
                color: "text-rose-600 dark:text-rose-400",
                bg: "bg-rose-50 dark:bg-rose-950/50",
                border: "border-rose-200 dark:border-rose-800",
                badge: `${overview.overallRejectionRate}% Reject`,
                badgeColor: "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300"
            },
            {
                title: "Units in Rework",
                value: overview.totalUnitsRework.toLocaleString(),
                subValue: `${overview.todayInspectionsCount} Inspections Conducted Today`,
                icon: RotateCcw,
                color: "text-amber-600 dark:text-amber-400",
                bg: "bg-amber-50 dark:bg-amber-950/50",
                border: "border-amber-200 dark:border-amber-800"
            }
        ];
    }, [activeTab, overview, categories]);

    // Active Trends & Pareto data based on active tab
    const activeDailyTrends = useMemo(() => {
        if (activeTab === "all" || !stats?.dailyTrendsByCategory) {
            return stats?.dailyTrends || [];
        }
        return stats.dailyTrendsByCategory[activeTab] || stats?.dailyTrends || [];
    }, [activeTab, stats]);

    const activeDefectPareto = useMemo(() => {
        if (activeTab === "all" || !stats?.defectParetoByCategory) {
            return stats?.defectPareto || [];
        }
        return stats.defectParetoByCategory[activeTab] || stats?.defectPareto || [];
    }, [activeTab, stats]);

    // Filtered Report Ledger
    const filteredReports = useMemo(() => {
        if (!stats?.recentReports) return [];
        return stats.recentReports.filter(r => {
            const matchesTab = activeTab === "all" || r.categoryKey === activeTab;
            if (!matchesTab) return false;
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                r.docNumber.toLowerCase().includes(q) ||
                r.itemName.toLowerCase().includes(q) ||
                r.itemCode.toLowerCase().includes(q) ||
                r.inspectorName.toLowerCase().includes(q) ||
                r.status.toLowerCase().includes(q)
            );
        });
    }, [stats?.recentReports, activeTab, searchQuery]);

    const tabsConfig: Array<{ key: QCTabType; label: string; icon: any; count: number; activeColor: string }> = [
        { key: "all", label: "All QC (Overview)", icon: Globe, count: overview.totalInspections, activeColor: "bg-blue-600 text-white shadow-sm" },
        { key: "incoming", label: "Incoming Material QC", icon: Package, count: categories.incoming.totalReports, activeColor: "bg-blue-600 text-white shadow-sm" },
        { key: "process", label: "In-Process Line QC", icon: Cog, count: categories.process.totalReports, activeColor: "bg-purple-600 text-white shadow-sm" },
        { key: "jobwork", label: "Job-Work QC", icon: Layers, count: categories.jobwork.totalReports, activeColor: "bg-amber-600 text-white shadow-sm" },
        { key: "fg", label: "Finished Goods QC", icon: FlaskConical, count: categories.fg.totalReports, activeColor: "bg-teal-600 text-white shadow-sm" },
    ];

    if (loading) {
        return (
            <div className="p-12 flex flex-col items-center justify-center space-y-4">
                <RefreshCw size={36} className="animate-spin text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-semibold text-slate-500 animate-pulse">Loading Quality Dashboard...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 relative pb-32 sm:pb-20">
            {/* HORIZONTALLY SLIDING SUB TABS BAR (Mobile Swipe Optimized) */}
            <div className="overflow-x-auto no-scrollbar scrollbar-none touch-pan-x -mx-1 sm:mx-0 px-1 py-1">
                <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner flex-nowrap min-w-max">
                    {tabsConfig.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 snap-start ${
                                    isActive
                                        ? tab.activeColor
                                        : "text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/60"
                                }`}
                            >
                                <Icon size={14} className="shrink-0" />
                                <span>{tab.label}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                    isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* DYNAMIC TOP 4 KPI SCORECARDS (2x2 on mobile, 4x1 on desktop) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {dynamicKPIs.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <motion.div
                            key={`${activeTab}-${index}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                            className={`p-3.5 sm:p-4 rounded-2xl border ${card.border} bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all relative overflow-hidden`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-0.5 pr-2">
                                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{card.title}</p>
                                    <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">{card.value}</h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">{card.subValue}</p>
                                </div>
                                <div className={`p-2 sm:p-2.5 rounded-xl ${card.bg} shrink-0`}>
                                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color}`} />
                                </div>
                            </div>
                            {card.badge && (
                                <div className="mt-2">
                                    <span className={`text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                                        {card.badge}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* SECTOR CARDS: 4-GRID ON ALL QC */}
            {activeTab === "all" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
                    {/* 1. Incoming QC Card */}
                    <div 
                        onClick={() => setActiveTab("incoming")} 
                        className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5 cursor-pointer hover:border-blue-400 transition-all active:scale-[0.99]"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-xl">
                                    <Package size={15} />
                                </div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Incoming QC</h4>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                                {categories.incoming.totalReports}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl text-[11px]">
                            <div>
                                <span className="text-[9px] text-slate-400 block font-bold">INSPECTED</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{categories.incoming.inspectedQuantity.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-emerald-600 block font-bold">PASSED</span>
                                <span className="font-extrabold text-emerald-600">{categories.incoming.acceptedQuantity.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-rose-600 block font-bold">REJECTED</span>
                                <span className="font-extrabold text-rose-600">{categories.incoming.rejectedQuantity.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-emerald-600">Pass: {categories.incoming.passRate}%</span>
                                <span className="text-rose-600">Reject: {categories.incoming.rejectionRate}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full" style={{ width: `${categories.incoming.passRate}%` }} />
                                <div className="bg-rose-500 h-full" style={{ width: `${categories.incoming.rejectionRate}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* 2. In-Process Line QC Card */}
                    <div 
                        onClick={() => setActiveTab("process")} 
                        className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5 cursor-pointer hover:border-purple-400 transition-all active:scale-[0.99]"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-purple-50 dark:bg-purple-950/60 text-purple-600 rounded-xl">
                                    <Cog size={15} />
                                </div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">In-Process QC</h4>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                                {categories.process.totalReports}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl text-[11px]">
                            <div>
                                <span className="text-[9px] text-slate-400 block font-bold">CHECKED</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{categories.process.checkedQuantity.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-emerald-600 block font-bold">OK QTY</span>
                                <span className="font-extrabold text-emerald-600">{categories.process.okQuantity.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-rose-600 block font-bold">REJECTED</span>
                                <span className="font-extrabold text-rose-600">{categories.process.rejectedQuantity.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-emerald-600">Pass: {categories.process.passRate}%</span>
                                <span className="text-rose-600">Reject: {categories.process.rejectionRate}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full" style={{ width: `${categories.process.passRate}%` }} />
                                <div className="bg-rose-500 h-full" style={{ width: `${categories.process.rejectionRate}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* 3. Job-Work QC Card */}
                    <div 
                        onClick={() => setActiveTab("jobwork")} 
                        className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5 cursor-pointer hover:border-amber-400 transition-all active:scale-[0.99]"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 rounded-xl">
                                    <Layers size={15} />
                                </div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Job-Work QC</h4>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                                {categories.jobwork.totalReports}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl text-[11px]">
                            <div>
                                <span className="text-[9px] text-slate-400 block font-bold">INSPECTED</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{categories.jobwork.inspectedQuantity.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-emerald-600 block font-bold">ACCEPTED</span>
                                <span className="font-extrabold text-emerald-600">{categories.jobwork.acceptedQuantity.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-rose-600 block font-bold">REJECTED</span>
                                <span className="font-extrabold text-rose-600">{categories.jobwork.rejectedQuantity.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-emerald-600">Pass: {categories.jobwork.passRate}%</span>
                                <span className="text-rose-600">Reject: {categories.jobwork.rejectionRate}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full" style={{ width: `${categories.jobwork.passRate}%` }} />
                                <div className="bg-rose-500 h-full" style={{ width: `${categories.jobwork.rejectionRate}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* 4. Finished Goods QC Card */}
                    <div 
                        onClick={() => setActiveTab("fg")} 
                        className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5 cursor-pointer hover:border-teal-400 transition-all active:scale-[0.99]"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-teal-50 dark:bg-teal-950/60 text-teal-600 rounded-xl">
                                    <FlaskConical size={15} />
                                </div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Finished Goods QC</h4>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                                {categories.fg.totalReports}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl text-[11px]">
                            <div>
                                <span className="text-[9px] text-slate-400 block font-bold">INSPECTED</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{categories.fg.inspectedQuantity.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-emerald-600 block font-bold">PASSED</span>
                                <span className="font-extrabold text-emerald-600">{categories.fg.acceptedQuantity.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-rose-600 block font-bold">REJECTED</span>
                                <span className="font-extrabold text-rose-600">{categories.fg.rejectedQuantity.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-emerald-600">Pass: {categories.fg.passRate}%</span>
                                <span className="text-rose-600">Reject: {categories.fg.rejectionRate}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full" style={{ width: `${categories.fg.passRate}%` }} />
                                <div className="bg-rose-500 h-full" style={{ width: `${categories.fg.rejectionRate}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Dynamic Time-Series Trend */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-64 sm:h-72">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp size={15} className="text-blue-600" />
                            Inspection Volume (Last 7 Days)
                        </h3>
                        <div className="flex items-center gap-2.5 text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Passed</span>
                            <span className="flex items-center gap-1 text-rose-600"><span className="w-2 h-2 rounded-full bg-rose-500" /> Rejected</span>
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activeDailyTrends} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPassed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorRejected" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <RechartsTooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                                <Area type="monotone" dataKey="passed" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPassed)" name="Passed Qty" />
                                <Area type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorRejected)" name="Rejected Qty" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Defect Pareto Analysis */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-64 sm:h-72">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <AlertTriangle size={15} className="text-amber-600" />
                            Defect & Parameter Failure Distribution
                        </h3>
                    </div>

                    <div className="flex-1 w-full min-h-0">
                        {activeDefectPareto.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={activeDefectPareto} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="defect" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 9 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                    <RechartsTooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                                    <Bar dataKey="count" radius={[5, 5, 0, 0]} barSize={26} name="Failed Count">
                                        {activeDefectPareto.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : index === 1 ? '#f97316' : '#6366f1'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-1">
                                <CheckCircle2 size={24} className="text-emerald-500" />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Zero Test Failures Logged</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* DYNAMIC REPORTS TABLE */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-3 p-3.5 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Clock size={14} className="text-blue-600" />
                        Quality Inspection Ledger ({filteredReports.length})
                    </h3>

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-64">
                        <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search document, item, inspector..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-3 py-2">Department</th>
                                <th className="px-3 py-2">Doc / Reference</th>
                                <th className="px-3 py-2">Item Name & Code</th>
                                <th className="px-3 py-2 text-center">Inspected</th>
                                <th className="px-3 py-2 text-center text-emerald-600">Passed</th>
                                <th className="px-3 py-2 text-center text-rose-600">Rejected</th>
                                <th className="px-3 py-2">Inspector</th>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredReports.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-medium">
                                        No inspection reports found.
                                    </td>
                                </tr>
                            ) : (
                                filteredReports.map((report, idx) => (
                                    <tr key={report.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-3 py-2 font-bold whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-black ${
                                                report.categoryKey === 'incoming' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                                                report.categoryKey === 'process' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                                                report.categoryKey === 'jobwork' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                                                'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                                            }`}>
                                                {report.qcType}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                            {report.docNumber}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{report.itemName}</div>
                                            {report.itemCode && <div className="text-[10px] text-slate-400 font-mono">{report.itemCode}</div>}
                                        </td>
                                        <td className="px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-300">
                                            {report.inspectedQty}
                                        </td>
                                        <td className="px-3 py-2 text-center font-black text-emerald-600 dark:text-emerald-400">
                                            {report.passedQty}
                                        </td>
                                        <td className="px-3 py-2 text-center font-black text-rose-600 dark:text-rose-400">
                                            {report.rejectedQty > 0 ? report.rejectedQty : "-"}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            {report.inspectorName}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap">
                                            {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "-"}
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] inline-flex items-center gap-1 ${
                                                report.status === 'Accepted' || report.status === 'Pass' || report.status === 'Passed'
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200'
                                                    : report.status === 'Rejected' || report.status === 'Fail'
                                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200'
                                                    : report.status === 'Rework'
                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                            }`}>
                                                {report.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BOTTOM FLOATING ACTION REFRESH BUTTON (Positioned cleanly above mobile bottom navigation bar) */}
            <div className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-[110]">
                <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={fetchStats}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-full shadow-2xl shadow-blue-500/50 border border-white/20 backdrop-blur-md transition-all disabled:opacity-60 cursor-pointer active:scale-95"
                    title="Refresh Quality Overview Data"
                >
                    <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
                    <span className="hidden sm:inline">{isRefreshing ? "Refreshing..." : "Refresh Overview"}</span>
                </motion.button>
            </div>
        </div>
    );
}
