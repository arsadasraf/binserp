"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { DollarSign, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function AccountsOverview() {
    const [stats, setStats] = useState({
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        pendingReceivables: 0,
        pendingPayables: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/api/accounts/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch accounts stats", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    };

    const cards = [
        {
            title: "Total Income",
            value: formatCurrency(stats.totalIncome),
            icon: ArrowUpRight,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            border: "border-emerald-100"
        },
        {
            title: "Total Expenses",
            value: formatCurrency(stats.totalExpenses),
            icon: ArrowDownRight,
            color: "text-rose-600",
            bg: "bg-rose-50",
            border: "border-rose-100"
        },
        {
            title: "Net Profit",
            value: formatCurrency(stats.netProfit),
            icon: DollarSign,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
            border: "border-indigo-100"
        },
        {
            title: "Pending Receivables",
            value: formatCurrency(stats.pendingReceivables),
            icon: Activity,
            color: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-100"
        }
    ];

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Financial Metrics...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Financial Overview</h2>

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
                                    <h3 className="text-2xl font-bold text-gray-900">{card.value}</h3>
                                </div>
                                <div className={`p-3 rounded-xl ${card.bg}`}>
                                    <Icon className={`w-6 h-6 ${card.color}`} />
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Pending Payables Alert */}
            {stats.pendingPayables > 0 && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                        <h4 className="font-bold">Pending Payables Alert</h4>
                        <p className="text-sm">You have {formatCurrency(stats.pendingPayables)} in pending bills to be paid.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
