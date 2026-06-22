"use client";

import React from 'react';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts';
import { Package, TrendingUp, AlertOctagon, DollarSign } from 'lucide-react';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

// Dummy Data
const categoryData = [
    { name: 'Computers', value: 400 },
    { name: 'Raw Material', value: 300 },
    { name: 'Tools', value: 300 },
    { name: 'Consumables', value: 200 },
];

const stockValueTrend = [
    { name: 'Jan', stock: 4000, value: 2400 },
    { name: 'Feb', stock: 3000, value: 1398 },
    { name: 'Mar', stock: 2000, value: 9800 },
    { name: 'Apr', stock: 2780, value: 3908 },
    { name: 'May', stock: 1890, value: 4800 },
    { name: 'Jun', stock: 2390, value: 3800 },
];

const consumptionData = [
    { name: 'Steel', usage: 120, limit: 150 },
    { name: 'Aluminum', usage: 98, limit: 120 },
    { name: 'Coolant', usage: 86, limit: 100 },
    { name: 'Oil', usage: 45, limit: 80 },
    { name: 'Insert', usage: 150, limit: 200 },
];

export default function InventoryReports() {
    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Total Inventory Value" value="$125,400" trend="+12%" icon={DollarSign} color="violet" />
                <KPICard title="Stock Items" value="1,240" trend="-5%" icon={Package} color="blue" />
                <KPICard title="Low Stock Alerts" value="8" trend="Caution" icon={AlertOctagon} color="amber" />
                <KPICard title="Inventory Turnover" value="4.2" trend="Good" icon={TrendingUp} color="emerald" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Category Value Pie */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 lg:col-span-1"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Value by Category</h3>
                    <div className="h-[250px] w-full flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Value vs Quantity Trend */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 lg:col-span-2"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Stock Value Analysis</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={stockValueTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend />
                                <Bar dataKey="stock" barSize={20} fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Stock Qty" />
                                <Line type="monotone" dataKey="value" stroke="#ff7300" name="Value ($)" strokeWidth={2} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Consumption vs Limit */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Material Consumption</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={consumptionData} margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                <XAxis type="number" stroke="#9ca3af" fontSize={10} />
                                <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} width={60} />
                                <Tooltip />
                                <Bar dataKey="usage" fill="#10b981" radius={[0, 4, 4, 0]} barSize={15} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Low Stock Alerts */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 lg:col-span-2"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <AlertOctagon className="text-amber-500" size={20} />
                        Critical Low Stock Items
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 font-medium">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">Item Name</th>
                                    <th className="px-4 py-3">Code</th>
                                    <th className="px-4 py-3">Current Stock</th>
                                    <th className="px-4 py-3">Min Level</th>
                                    <th className="px-4 py-3 rounded-r-lg">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {[
                                    { name: "Cutting Oil 30W", code: "OIL-30", stock: 12, min: 20 },
                                    { name: "M6 Hex Bolt", code: "BLT-M6", stock: 85, min: 200 },
                                    { name: "Carbide Insert TNMG", code: "INS-TNMG", stock: 5, min: 25 },
                                ].map((item, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                        <td className="px-4 py-3 text-gray-500">{item.code}</td>
                                        <td className="px-4 py-3 font-bold text-red-500">{item.stock}</td>
                                        <td className="px-4 py-3 text-gray-500">{item.min}</td>
                                        <td className="px-4 py-3">
                                            <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                                                Reorder
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

function KPICard({ title, value, trend, icon: Icon, color }: any) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800"
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-500 text-sm font-medium">{title}</p>
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</h4>
                </div>
                <div className={`p-3 rounded-xl bg-${color}-50 dark:bg-${color}-900/20 text-${color}-600 dark:text-${color}-400`}>
                    <Icon size={24} />
                </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend.includes('+') ? 'bg-green-100 text-green-700' :
                        trend.includes('-') ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                    }`}>
                    {trend}
                </span>
                <span className="text-gray-400 text-xs">vs last week</span>
            </div>
        </motion.div>
    );
}
