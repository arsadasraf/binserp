"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { AlertTriangle, CheckCircle, Clock, Wrench } from "lucide-react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

interface MaintenanceStats {
    openTickets: number;
    overdueSchedules: number;
    lowStockParts: number;
}

export default function MaintenanceOverview() {
    const [stats, setStats] = useState<MaintenanceStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/api/maintenance/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch stats", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-4">Loading stats...</div>;

    const cards = [
        {
            title: "Open Breakdowns",
            value: stats?.openTickets || 0,
            icon: Wrench,
            color: "text-red-600",
            bg: "bg-red-50",
            desc: "Tickets requiring attention"
        },
        {
            title: "Overdue Schedules",
            value: stats?.overdueSchedules || 0,
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50",
            desc: "Preventive maintenance pending"
        },
        {
            title: "Low Stock Parts",
            value: stats?.lowStockParts || 0,
            icon: AlertTriangle,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
            desc: "Items below minimum level"
        },
        {
            title: "System Status",
            value: "Operational",
            icon: CheckCircle,
            color: "text-green-600",
            bg: "bg-green-50",
            desc: "All systems running"
        }
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-start justify-between"
                    >
                        <div>
                            <p className="text-sm font-medium text-gray-500">{card.title}</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">{card.value}</h3>
                            <p className="text-xs text-gray-400 mt-1">{card.desc}</p>
                        </div>
                        <div className={`p-3 rounded-lg ${card.bg}`}>
                            <card.icon className={`w-6 h-6 ${card.color}`} />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                {/* Status Pie Chart */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-96 lg:col-span-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Ticket Distribution</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Open', value: stats?.openTickets || 5, color: '#ef4444' },
                                        { name: 'In Progress', value: 3, color: '#f59e0b' },
                                        { name: 'Resolved', value: 12, color: '#10b981' }
                                    ]}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {
                                        [
                                            { color: '#ef4444' },
                                            { color: '#f59e0b' },
                                            { color: '#10b981' }
                                        ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                        ))
                                    }
                                </Pie>
                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#4b5563' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-96 lg:col-span-2">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Real-time Activity Log</h3>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                        {[
                            { title: 'Hydraulic Press #4', event: 'Breakdown Reported', time: '10 mins ago', type: 'error', icon: AlertTriangle },
                            { title: 'Conveyor Belt A', event: 'Preventive Maintenance Completed', time: '2 hours ago', type: 'success', icon: CheckCircle },
                            { title: 'CNC Machine 2', event: 'Spare Part Requested (Motor)', time: '4 hours ago', type: 'warning', icon: Wrench },
                            { title: 'HVAC System', event: 'Quarterly Check Scheduled', time: '1 day ago', type: 'info', icon: Clock }
                        ].map((log, idx) => (
                            <div key={idx} className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                <div className={`p-2 rounded-full ${
                                    log.type === 'error' ? 'bg-red-100 text-red-600' :
                                    log.type === 'success' ? 'bg-green-100 text-green-600' :
                                    log.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                    'bg-blue-100 text-blue-600'
                                }`}>
                                    <log.icon size={16} />
                                </div>
                                <div className="flex-1 pt-1">
                                    <h4 className="text-sm font-bold text-gray-800">{log.title}</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">{log.event}</p>
                                </div>
                                <span className="text-[10px] font-bold text-gray-400 pt-1">{log.time}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
