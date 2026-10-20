"use client";

import React, { useState, useEffect } from "react";
import { 
    Users, Target, DollarSign, ArrowUpRight, TrendingUp, Award, 
    Clock, CheckCircle2, AlertCircle, RefreshCw, BarChart2, Flame, Sun, Snowflake, 
    ArrowRight, Download, FileSpreadsheet, Package, Layers, Briefcase, ChevronRight
} from "lucide-react";
import { apiGet } from "@/src/lib/api";
import * as XLSX from "xlsx";

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
    const executivePerformance: any[] = stats?.executivePerformance || [];
    const monthWiseSourceTrends: any[] = stats?.monthWiseSourceTrends || [];
    const productAnalytics: any[] = stats?.productAnalytics || [];

    // Export Sales Executive Performance to Excel (.xlsx) - Requirement #10
    const handleExportExecutiveExcel = () => {
        if (!executivePerformance || executivePerformance.length === 0) {
            alert("No executive performance data available to export.");
            return;
        }

        const rows = executivePerformance.map(exec => ({
            "Sales Executive": exec.name,
            "Leads Assigned": exec.leadsAssigned,
            "Value Quoted (INR)": exec.quotedValue ?? exec.valueQuoted ?? 0,
            "Won Orders Count": exec.orderedWonCount,
            "Won Revenue (INR)": exec.orderedWonValue,
            "Lost Count": exec.lostCount,
            "Losses Value (INR)": exec.lossesRecorded,
            "Conversion Win Rate (%)": `${exec.conversionRate}%`
        }));

        // Calculate Totals row
        const totalAssigned = executivePerformance.reduce((a, b) => a + (b.leadsAssigned || 0), 0);
        const totalQuoted = executivePerformance.reduce((a, b) => a + (b.quotedValue || b.valueQuoted || 0), 0);
        const totalWonCount = executivePerformance.reduce((a, b) => a + (b.orderedWonCount || 0), 0);
        const totalWonValue = executivePerformance.reduce((a, b) => a + (b.orderedWonValue || 0), 0);
        const totalLostCount = executivePerformance.reduce((a, b) => a + (b.lostCount || 0), 0);
        const totalLosses = executivePerformance.reduce((a, b) => a + (b.lossesRecorded || 0), 0);
        const avgConversion = totalAssigned > 0 ? ((totalWonCount / totalAssigned) * 100).toFixed(1) : "0.0";

        rows.push({
            "Sales Executive": "TOTAL SUMMARY",
            "Leads Assigned": totalAssigned,
            "Value Quoted (INR)": totalQuoted,
            "Won Orders Count": totalWonCount,
            "Won Revenue (INR)": totalWonValue,
            "Lost Count": totalLostCount,
            "Losses Value (INR)": totalLosses,
            "Conversion Win Rate (%)": `${avgConversion}%`
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Executive Performance");
        XLSX.writeFile(workbook, `Sales_Executive_Performance_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Header Refresh Bar */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">CRM Executive Intelligence & Overview</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time commercial KPIs, sales matrices, pipeline trends & source analytics</p>
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
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Inquiries</span>
                        <Target size={16} className="text-blue-500" />
                    </div>
                    <div className="mt-2">
                        <strong className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">{kpis.totalLeads || 0}</strong>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{kpis.activeLeads || 0} In Funnel</span>
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
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Won Revenue</span>
                        <Award size={16} className="text-emerald-500" />
                    </div>
                    <div className="mt-2">
                        <strong className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                            ₹{Number(kpis.totalWonRevenue || 0).toLocaleString()}
                        </strong>
                        <span className="text-[10px] text-emerald-600 block mt-0.5 font-bold">{kpis.wonDealsCount || 0} Closed Orders</span>
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
                        <span className="text-[10px] text-slate-500 block mt-0.5">{kpis.wonLeads || 0} Won / {kpis.totalLeads || 0} Leads</span>
                    </div>
                </div>

                {/* 5. Customer Base */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-center text-slate-400">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Customer Accounts</span>
                        <Users size={16} className="text-purple-500" />
                    </div>
                    <div className="mt-2">
                        <strong className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">{kpis.totalCustomers || 0}</strong>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Directory Base</span>
                    </div>
                </div>

                {/* 6. Overdue Follow-ups */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-center text-slate-400">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Pending Action</span>
                        <Clock size={16} className="text-rose-500" />
                    </div>
                    <div className="mt-2">
                        <strong className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">{kpis.overdueActivities || 0}</strong>
                        <span className="text-[10px] text-rose-500 block mt-0.5 font-bold">Overdue Tasks</span>
                    </div>
                </div>

            </div>

            {/* REQUIREMENT #10: SALES EXECUTIVE PERFORMANCE MATRIX WITH EXCEL EXPORT */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            <Briefcase size={17} className="text-indigo-600" />
                            Sales Executive Performance Matrix
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Track individual quoting velocity, won contracts, drop-off losses, and conversion percentages</p>
                    </div>

                    <button
                        onClick={handleExportExecutiveExcel}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
                        title="Download Sales Executive Matrix as Excel"
                    >
                        <FileSpreadsheet size={14} />
                        <span>Export Excel (.xlsx)</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="p-3.5">Sales Executive</th>
                                <th className="p-3.5 text-center">Assigned Leads</th>
                                <th className="p-3.5">Value Quoted (INR)</th>
                                <th className="p-3.5">Orders Won (Count & Value)</th>
                                <th className="p-3.5">Losses (Count & Value)</th>
                                <th className="p-3.5">Conversion Rate %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {executivePerformance.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        No sales executive performance data logged yet.
                                    </td>
                                </tr>
                            ) : (
                                executivePerformance.map((exec, idx) => {
                                    const conv = parseFloat(exec.conversionRate || "0");
                                    const rowKey = exec.id || exec.executiveId || exec._id || exec.name || `exec-${idx}`;
                                    const quotedVal = exec.quotedValue ?? exec.valueQuoted ?? 0;
                                    return (
                                        <tr key={rowKey} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="p-3.5">
                                                <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-[11px]">
                                                        {exec.name?.charAt(0)?.toUpperCase() || "E"}
                                                    </div>
                                                    {exec.name}
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                                {exec.leadsAssigned}
                                            </td>
                                            <td className="p-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                                                ₹{Number(quotedVal).toLocaleString()}
                                            </td>
                                            <td className="p-3.5">
                                                <strong className="text-emerald-600 dark:text-emerald-400 font-mono block">
                                                    ₹{Number(exec.orderedWonValue || 0).toLocaleString()}
                                                </strong>
                                                <span className="text-[10px] text-emerald-600 font-bold">
                                                    {exec.orderedWonCount} won orders
                                                </span>
                                            </td>
                                            <td className="p-3.5">
                                                <span className="text-rose-600 dark:text-rose-400 font-mono block">
                                                    ₹{Number(exec.lossesRecorded || 0).toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {exec.lostCount} dropped
                                                </span>
                                            </td>
                                            <td className="p-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`font-mono font-extrabold text-xs ${
                                                        conv >= 30 ? "text-emerald-600" : conv >= 15 ? "text-amber-600" : "text-slate-600 dark:text-slate-400"
                                                    }`}>
                                                        {exec.conversionRate}%
                                                    </span>
                                                    <div className="w-20 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${
                                                                conv >= 30 ? "bg-emerald-500" : conv >= 15 ? "bg-amber-500" : "bg-slate-400"
                                                            }`}
                                                            style={{ width: `${Math.min(conv, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* REQUIREMENT #11: MONTH-WISE LEAD SOURCE ANALYTICS (PAST 6 MONTHS) */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            <Layers size={17} className="text-teal-600" />
                            Month-wise Lead Source Analytics (Past 6 Months)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Monthly inquiry origin velocity across B2B platforms, website, and direct interactions</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="p-3.5">Month / Period</th>
                                <th className="p-3.5 text-center">IndiaMART</th>
                                <th className="p-3.5 text-center">TradeIndia</th>
                                <th className="p-3.5 text-center">Direct Inquiries</th>
                                <th className="p-3.5 text-center">Website Portal</th>
                                <th className="p-3.5 text-center">Other Channels</th>
                                <th className="p-3.5 text-right font-black">Total Inquiries</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {monthWiseSourceTrends.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400">
                                        No monthly lead source history available.
                                    </td>
                                </tr>
                            ) : (
                                monthWiseSourceTrends.map((row, idx) => (
                                    <tr key={row.month || `month-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="p-3.5 font-bold text-slate-900 dark:text-white font-mono">
                                            {row.month}
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <span className="px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-mono font-bold">
                                                {row.IndiaMART}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono font-bold">
                                                {row.TradeIndia}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                                                {row.Direct}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <span className="px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-mono font-bold">
                                                {row.Website}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-center font-mono text-slate-500">
                                            {row.Other}
                                        </td>
                                        <td className="p-3.5 text-right font-mono font-extrabold text-slate-900 dark:text-white text-sm">
                                            {row.Total}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* REQUIREMENT #12: PRODUCT SALES & INQUIRY ANALYTICS */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            <Package size={17} className="text-amber-600" />
                            Product Inquiry & Sales Realization Analytics
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Top in-demand equipment, quoted pipelines, closed sales volume and revenue generation</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="p-3.5">Product Name & Category</th>
                                <th className="p-3.5 text-center">Total Inquiries</th>
                                <th className="p-3.5">Quoted Pipeline (INR)</th>
                                <th className="p-3.5 text-center">Closed Orders</th>
                                <th className="p-3.5">Realized Revenue (INR)</th>
                                <th className="p-3.5">Win Rate %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {productAnalytics.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        No product inquiry trends registered yet.
                                    </td>
                                </tr>
                            ) : (
                                productAnalytics.map((p, idx) => {
                                    const winRate = p.inquiriesCount > 0 ? ((p.wonCount / p.inquiriesCount) * 100).toFixed(1) : "0.0";
                                    const rowKey = `${p.product || "prod"}-${idx}`;
                                    return (
                                        <tr key={rowKey} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="p-3.5">
                                                <strong className="text-slate-900 dark:text-white block font-bold">{p.product}</strong>
                                                <span className="text-[11px] text-slate-500 italic mt-0.5 block">Standard machinery / product line</span>
                                            </td>
                                            <td className="p-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                                {p.inquiriesCount}
                                            </td>
                                            <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                                                ₹{Number(p.quotedValue || 0).toLocaleString()}
                                            </td>
                                            <td className="p-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                {p.wonCount}
                                            </td>
                                            <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                ₹{Number(p.wonRevenue || 0).toLocaleString()}
                                            </td>
                                            <td className="p-3.5 font-mono font-extrabold text-slate-800 dark:text-slate-200">
                                                {winRate}%
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Middle Section: Funnel Stages & Source ROI */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Conversion Funnel */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <BarChart2 size={16} className="text-blue-600" />
                        Lead Pipeline Funnel
                    </h3>

                    <div className="space-y-3">
                        {stageFunnel.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">No lead stage data yet.</p>
                        ) : (
                            stageFunnel.map((item: any, idx: number) => {
                                const maxCount = Math.max(...stageFunnel.map((f: any) => f.count), 1);
                                const pct = Math.round((item.count / maxCount) * 100);
                                return (
                                    <div key={item.stage || `stage-${idx}`} className="space-y-1">
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
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={16} className="text-emerald-600" />
                        Lead Source Performance
                    </h3>

                    <div className="space-y-3">
                        {sourceStats.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">No source metrics yet.</p>
                        ) : (
                            sourceStats.map((src: any, idx: number) => (
                                <div key={src.source || `src-${idx}`} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
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
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Flame size={16} className="text-rose-500" />
                            Lead Warmth Breakdown
                        </h3>

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
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Clock size={16} className="text-blue-600" />
                    Recent Interactions
                </h3>

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
                                recentActivities.map((act: any, idx: number) => (
                                    <tr key={act._id || `act-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
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
