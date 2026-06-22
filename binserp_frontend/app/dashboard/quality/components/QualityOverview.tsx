"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Activity, AlertTriangle, CheckCircle, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function QualityOverview() {
    const [stats, setStats] = useState({
        totalIncomingInspections: 0,
        incomingRejected: 0,
        processChecksToday: 0,
        processRejectionRate: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/api/quality/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch quality stats");
        } finally {
            setLoading(false);
        }
    };

    const cards = [
        {
            title: "Total Incoming QC",
            value: stats.totalIncomingInspections,
            icon: ClipboardList,
            color: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-100"
        },
        {
            title: "Incoming Rejections",
            value: stats.incomingRejected,
            icon: AlertTriangle,
            color: "text-red-600",
            bg: "bg-red-50",
            border: "border-red-100"
        },
        {
            title: "Process Checks Today",
            value: stats.processChecksToday,
            icon: Activity,
            color: "text-purple-600",
            bg: "bg-purple-50",
            border: "border-purple-100"
        },
        {
            title: "Process Rejection Rate",
            value: `${stats.processRejectionRate}%`,
            icon: CheckCircle, // Using CheckCircle ironically or as 'Quality Status'
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            border: "border-emerald-100"
        }
    ];

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Quality Metrics...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Quality Control Overview</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`p-6 rounded-2xl border ${card.border} bg-white shadow-sm hover:shadow-md transition-shadow`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">{card.title}</p>
                                    <h3 className="text-3xl font-bold text-gray-900">{card.value}</h3>
                                </div>
                                <div className={`p-3 rounded-xl ${card.bg}`}>
                                    <Icon className={`w-6 h-6 ${card.color}`} />
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                {/* Trend Chart */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-96">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Historical Rejection Trend</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={[
                                    { day: 'Mon', rate: 4.2 },
                                    { day: 'Tue', rate: 3.8 },
                                    { day: 'Wed', rate: 5.1 },
                                    { day: 'Thu', rate: 2.9 },
                                    { day: 'Fri', rate: stats.processRejectionRate || 3.1 }
                                ]}
                                margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Area type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pareto Chart */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-96">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Defect Pareto Analysis</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { defect: 'Dimensions', count: 45 },
                                    { defect: 'Scratches', count: 28 },
                                    { defect: 'Material', count: 15 },
                                    { defect: 'Other', count: 5 }
                                ]}
                                margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="defect" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <RechartsTooltip cursor={{fill: '#f9fafb'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                                    {
                                        [
                                            { defect: 'Dimensions', count: 45 },
                                            { defect: 'Scratches', count: 28 },
                                            { defect: 'Material', count: 15 },
                                            { defect: 'Other', count: 5 }
                                        ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={'#6366f1'} />
                                        ))
                                    }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
