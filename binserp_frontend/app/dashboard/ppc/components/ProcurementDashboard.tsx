"use client";

import React from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useGetProcurementDashboardQuery } from "@/src/store/services/ppcService";

export default function ProcurementDashboard() {
    const { data, isLoading: loading } = useGetProcurementDashboardQuery();

    const dashboardData = data?.dashboard || [];
    const totalValue = data?.totalValue || 0;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
    };

    if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>;

    return (
        <div className="space-y-6">
            {/* Financial Overview Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-2xl"></div>

                <div className="relative z-10">
                    <h2 className="text-emerald-100 font-medium text-lg mb-2 flex items-center gap-2">
                        <TrendingUp size={20} /> Total Procurement Value
                    </h2>
                    <div className="text-5xl font-bold tracking-tight mb-4">
                        {formatCurrency(totalValue)}
                    </div>
                    <p className="text-emerald-100/80 text-sm max-w-xl">
                        Estimated cost to fulfill all pending material shortages for active confirmed orders.
                        Based on current average inventory prices.
                    </p>
                </div>
            </motion.div>

            {/* Detailed Table Card */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden"
            >
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Shortage Analysis</h3>
                        <p className="text-sm text-gray-500">Aggregated material demand by item</p>
                    </div>
                    <button
                        disabled
                        className="px-4 py-2 bg-gray-200 text-gray-500 rounded-xl text-sm font-medium cursor-not-allowed flex items-center gap-2"
                    >
                        Raise Bulk PO (Coming Soon)
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 font-medium">
                                <th className="px-6 py-4">Material</th>
                                <th className="px-6 py-4">Total Shortage</th>
                                <th className="px-6 py-4">Avg. Price</th>
                                <th className="px-6 py-4">Est. Cost</th>
                                <th className="px-6 py-4">Linked Orders</th>
                                <th className="px-6 py-4 text-right">Stock</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {dashboardData.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No shortages found! You are well stocked.</td></tr>
                            ) : (
                                dashboardData.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800 dark:text-gray-200">{item.materialName}</div>
                                            <div className="text-xs text-gray-400 font-mono">ID: {item.materialId.slice(-6)}</div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-red-500">
                                            {item.totalShortage} <span className="text-xs font-normal text-gray-500">{item.unit}</span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {formatCurrency(item.unitPrice)}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(item.estimatedCost)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {item.orders.map((o: string, i: number) => (
                                                    <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs border border-indigo-100">
                                                        #{o}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full font-medium text-xs">
                                                {item.currentStock} In Stock
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
