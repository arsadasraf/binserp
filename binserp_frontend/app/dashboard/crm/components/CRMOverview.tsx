"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Users, Target, ShoppingBag, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function CRMOverview() {
    const [stats, setStats] = useState({
        totalLeads: 0,
        newLeads: 0,
        totalCustomers: 0,
        conversionRate: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/api/crm/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch crm stats");
        } finally {
            setLoading(false);
        }
    };

    const cards = [
        {
            title: "Total Leads",
            value: stats.totalLeads,
            icon: Target,
            color: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-100"
        },
        {
            title: "New Leads",
            value: stats.newLeads,
            icon: ShoppingBag,
            color: "text-purple-600",
            bg: "bg-purple-50",
            border: "border-purple-100"
        },
        {
            title: "Total Customers",
            value: stats.totalCustomers,
            icon: Users,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            border: "border-emerald-100"
        },
        {
            title: "Conversion Rate",
            value: `${stats.conversionRate}%`,
            icon: TrendingUp,
            color: "text-orange-600",
            bg: "bg-orange-50",
            border: "border-orange-100"
        }
    ];

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading CRM Metrics...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Sales Pipeline Overview</h2>

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

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-96 flex flex-col">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Sales Funnel Analysis</h3>
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={[
                                { name: 'Total Leads', count: stats.totalLeads, color: '#3b82f6' },
                                { name: 'Contacted', count: Math.floor(stats.totalLeads * 0.7), color: '#a855f7' },
                                { name: 'Qualified', count: Math.floor(stats.totalLeads * 0.4), color: '#f59e0b' },
                                { name: 'Converted', count: stats.totalCustomers, color: '#10b981' }
                            ]}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 500 }} width={80} />
                            <Tooltip 
                                cursor={{fill: '#f9fafb'}}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={32}>
                                {
                                    [
                                        { name: 'Total Leads', count: stats.totalLeads, color: '#3b82f6' },
                                        { name: 'Contacted', count: Math.floor(stats.totalLeads * 0.7), color: '#a855f7' },
                                        { name: 'Qualified', count: Math.floor(stats.totalLeads * 0.4), color: '#f59e0b' },
                                        { name: 'Converted', count: stats.totalCustomers, color: '#10b981' }
                                    ].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))
                                }
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
