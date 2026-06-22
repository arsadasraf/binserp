"use client";

import React from 'react';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, RadialBarChart, RadialBar
} from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#14b8a6'];

// Dummy Data
const statusData = [
    { name: 'Running', value: 8 },
    { name: 'Idle', value: 3 },
    { name: 'Maintenance', value: 1 },
    { name: 'Breakdown', value: 0 },
];

const oeeData = [
    {
        name: 'Availability',
        uv: 90,
        fill: '#8884d8',
    },
    {
        name: 'Performance',
        uv: 85,
        fill: '#83a6ed',
    },
    {
        name: 'Quality',
        uv: 95,
        fill: '#8dd1e1',
    },
];

const performanceTrend = [
    { name: 'Mon', oee: 82, availability: 85 },
    { name: 'Tue', oee: 85, availability: 88 },
    { name: 'Wed', oee: 88, availability: 90 },
    { name: 'Thu', oee: 84, availability: 86 },
    { name: 'Fri', oee: 89, availability: 92 },
    { name: 'Sat', oee: 91, availability: 94 },
    { name: 'Sun', oee: 92, availability: 95 },
];

export default function MachineReports() {
    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Overall OEE" value="87.5%" trend="+2.4%" icon={Activity} color="indigo" />
                <KPICard title="Total Downtime" value="4h 12m" trend="-15m" icon={Clock} color="amber" />
                <KPICard title="Active Machines" value="12/15" trend="Stable" icon={CheckCircle} color="emerald" />
                <KPICard title="Maintenance Alert" value="1" trend="Urgent" icon={AlertTriangle} color="red" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* OEE Radial Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 lg:col-span-1"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">OEE Composition</h3>
                    <div className="h-[250px] w-full flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="80%" barSize={20} data={oeeData}>
                                <RadialBar
                                    background
                                    dataKey="uv"
                                    cornerRadius={10}
                                    label={{ position: 'insideStart', fill: '#fff' }}
                                />
                                <Legend iconSize={10} layout="vertical" verticalAlign="middle" wrapperStyle={{ right: 0 }} />
                                <Tooltip />
                            </RadialBarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-3 text-center gap-2">
                        <div><p className="text-xs text-gray-500">Availability</p><p className="font-bold text-indigo-500">90%</p></div>
                        <div><p className="text-xs text-gray-500">Performance</p><p className="font-bold text-violet-500">85%</p></div>
                        <div><p className="text-xs text-gray-500">Quality</p><p className="font-bold text-teal-500">95%</p></div>
                    </div>
                </motion.div>

                {/* Performance Trend */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 lg:col-span-2"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Availability Trend</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={performanceTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorOee" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <Area type="monotone" dataKey="oee" stroke="#6366f1" fillOpacity={1} fill="url(#colorOee)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Machine Status Breakdown */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Machine Status</h3>
                    <div className="h-[250px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-3xl font-bold text-gray-800 dark:text-white">12</span>
                            <p className="text-xs text-gray-500">Total Machines</p>
                        </div>
                    </div>
                </motion.div>

                {/* Top Performing Machines List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 lg:col-span-2"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Top Performing Machines</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-medium">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">Machine Name</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">OEE</th>
                                    <th className="px-4 py-3">Availability</th>
                                    <th className="px-4 py-3 rounded-r-lg">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {[
                                    { name: "CNC-001", type: "CNC Lathe", oee: 92, avail: 96, status: "Running" },
                                    { name: "VMC-003", type: "Vertical Milling", oee: 89, avail: 91, status: "Running" },
                                    { name: "GR-002", type: "Grinder", oee: 85, avail: 88, status: "Idle" },
                                    { name: "CNC-004", type: "CNC Lathe", oee: 94, avail: 98, status: "Running" },
                                ].map((m, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{m.name}</td>
                                        <td className="px-4 py-3 text-gray-500">{m.type}</td>
                                        <td className="px-4 py-3 font-bold text-indigo-600">{m.oee}%</td>
                                        <td className="px-4 py-3 text-indigo-500">{m.avail}%</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${m.status === 'Running' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {m.status}
                                            </span>
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
