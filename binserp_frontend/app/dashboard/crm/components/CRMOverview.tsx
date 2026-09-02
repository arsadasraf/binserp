"use client";

import React, { useState, useEffect } from "react";
import { 
    Users, Target, DollarSign, ArrowUpRight, TrendingUp, Award, 
    Clock, CheckCircle2, AlertCircle, RefreshCw, BarChart2, Flame, Sun, Snowflake, ArrowRight
} from "lucide-react";
import { apiGet } from "@/src/lib/api";

export default function CRMOverview() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await apiGet("/api/crm/stats", token);
            setStats(res.data || null);
        } catch (err) {
            console.error("Failed to load CRM stats", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const kpis = stats?.kpis || {};
    const stageFunnel = stats?.stageFunnel || [];
    const sourceStats = stats?.sourceStats || [];
    const warmth = stats?.warmthBreakdown || { Hot: 0, Warm: 0, Cold: 0 };
    const recentActivities = stats?.recentActivities || [];

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Header Refresh Bar */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">CRM Performance & Revenue Command Center</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time pipeline velocity, conversion ratios, and lead channel ROI</p>
                </div>
                <button
                    onClick={fetchStats}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh Analytics
                </button>
            </div>

            {/* 6 Top KPI Scorecards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                
                {/* 1. Total Leads */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-center text-slate-400">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Leads</span>
                        <Target size={16} className="text-blue-500" />
                    </div>
                    <div className="mt-2">
                        <strong className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">{kpis.totalLeads || 0}</strong>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{kpis.activeLeads || 0} Active in Funnel</span>
                    </div>
                </div>

                {/* 2. Pipeline Value */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-center text-slate-400">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Pipeline Value</span>
                        <TrendingUp size={16} className="text-indigo-500" />
                    </div>
                    <div className="mt-2">
                        <strong className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                            ₹{Number(kpis.totalPipelineValue || 0).toLocaleString()}
                        </strong>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{kpis.openDealsCount || 0} Active Deals</span>
                    </div>
                </div>

                {/* 3. Won Revenue */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-center text-slate-400">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Won Deals Value</span>
                        <Award size={16} className="text-emerald-500" />
                    </div>
                    <div className="mt-2">
                        <strong className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                            ₹{Number(kpis.totalWonRevenue || 0).toLocaleString()}
                        </strong>
                        <span className="text-[10px] text-emerald-600 block mt-0.5 font-bold">{kpis.wonDealsCount || 0} Won Contracts</span>
                    </div>
                </div>

                {/* 4. Conversion Rate */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-center text-slate-400">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Win Ratio</span>
                        <ArrowUpRight size={16} className="text-amber-500" />
                    </div>
                    <div className="mt-2">
                        <strong className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                            {kpis.conversionRate || 0}%
                        </strong>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{kpis.wonLeads || 0} Won / {kpis.totalLeads || 0} Total</span>
                    </div>
                </div>

                {/* 5. Customer Base */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-center text-slate-400">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Accounts</span>
                        <Users size={16} className="text-purple-500" />
                    </div>
                    <div className="mt-2">
                        <strong className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">{kpis.totalCustomers || 0}</strong>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Active Directory</span>
                    </div>
                </div>

                {/* 6. Overdue Follow-ups */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-center text-slate-400">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Pending Tasks</span>
                        <Clock size={16} className="text-rose-500" />
                    </div>
                    <div className="mt-2">
                        <strong className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">{kpis.overdueActivities || 0}</strong>
                        <span className="text-[10px] text-rose-500 block mt-0.5 font-bold">Overdue Follow-ups</span>
                    </div>
                </div>

            </div>

            {/* Middle Section: Funnel Stages & Source ROI */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Conversion Funnel */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                        <BarChart2 size={16} className="text-blue-600" />
                        Lead Pipeline Funnel
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">Volume distribution across pipeline progression stages</p>

                    <div className="space-y-3">
                        {stageFunnel.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">No lead stage data yet.</p>
                        ) : (
                            stageFunnel.map((item: any) => {
                                const maxCount = Math.max(...stageFunnel.map((f: any) => f.count), 1);
                                const pct = Math.round((item.count / maxCount) * 100);
                                return (
                                    <div key={item.stage} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold">
                                            <span className="text-slate-700 dark:text-slate-300">{item.stage}</span>
                                            <span className="font-mono text-slate-500">{item.count} leads</span>
                                        </div>
                                        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500" 
                                                style={{ width: `${Math.max(pct, 5)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 2. Channel & Source ROI */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                        <TrendingUp size={16} className="text-emerald-600" />
                        Lead Source Performance
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">Inquiry generation and win rate per acquisition channel</p>

                    <div className="space-y-3">
                        {sourceStats.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">No source metrics yet.</p>
                        ) : (
                            sourceStats.map((src: any) => (
                                <div key={src.source} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <div>
                                        <strong className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block">{src.source}</strong>
                                        <span className="text-[10px] text-slate-400">{src.count} inquiries · {src.won} converted</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-mono text-xs font-extrabold text-emerald-600 dark:text-emerald-400 block">{src.conversionRate}%</span>
                                        <span className="text-[10px] text-slate-400">Win Rate</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 3. Warmth Score & Health */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                            <Flame size={16} className="text-rose-500" />
                            Lead Warmth Breakdown
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">Readiness to buy and deal urgency distribution</p>

                        <div className="space-y-3">
                            <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/40 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs">
                                    <Flame size={18} /> Hot (Ready to Buy)
                                </div>
                                <span className="font-mono text-base font-extrabold text-rose-700 dark:text-rose-300">{warmth.Hot || 0}</span>
                            </div>

                            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-xs">
                                    <Sun size={18} /> Warm (Evaluating / Negotiation)
                                </div>
                                <span className="font-mono text-base font-extrabold text-amber-700 dark:text-amber-300">{warmth.Warm || 0}</span>
                            </div>

                            <div className="p-3 bg-sky-50/70 dark:bg-sky-950/30 rounded-2xl border border-sky-100 dark:border-sky-900/40 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-bold text-xs">
                                    <Snowflake size={18} /> Cold (Long Term / Nurturing)
                                </div>
                                <span className="font-mono text-base font-extrabold text-sky-700 dark:text-sky-300">{warmth.Cold || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Bottom: Recent Activity Stream */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <Clock size={16} className="text-blue-600" />
                    Recent CRM Interactions & Follow-up Log
                </h3>
                <p className="text-xs text-slate-400 mb-4">Latest calls, client meetings, demos, and site visits</p>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="p-3">Type</th>
                                <th className="p-3">Subject / Summary</th>
                                <th className="p-3">Related Lead / Client</th>
                                <th className="p-3">Logged By</th>
                                <th className="p-3">Date</th>
                                <th className="p-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {recentActivities.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        No interactions logged yet. Schedule calls or meetings from the Follow-ups tab.
                                    </td>
                                </tr>
                            ) : (
                                recentActivities.map((act: any) => (
                                    <tr key={act._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                {act.type}
                                            </span>
                                        </td>
                                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{act.summary}</td>
                                        <td className="p-3 text-slate-600 dark:text-slate-400">
                                            {act.relatedLead?.companyName || act.relatedLead?.name || act.relatedCustomer?.name || "-"}
                                        </td>
                                        <td className="p-3 text-slate-500">{act.createdBy?.name || "-"}</td>
                                        <td className="p-3 font-mono text-slate-400">
                                            {act.date ? new Date(act.date).toLocaleDateString("en-GB") : "-"}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                act.isCompleted ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                                            }`}>
                                                {act.isCompleted ? "Completed" : "Pending"}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
