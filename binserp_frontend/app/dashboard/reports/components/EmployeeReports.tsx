"use client";

import React from 'react';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { Users, UserCheck, UserX, Clock, Trophy } from 'lucide-react';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

// Dummy Data
const attendanceData = [
    { name: 'Present', value: 45 },
    { name: 'On Leave', value: 3 },
    { name: 'Absent', value: 2 },
    { name: 'Late', value: 5 },
];

const productivityTrend = [
    { name: 'Mon', deptA: 88, deptB: 82 },
    { name: 'Tue', deptA: 90, deptB: 85 },
    { name: 'Wed', deptA: 87, deptB: 86 },
    { name: 'Thu', deptA: 92, deptB: 89 },
    { name: 'Fri', deptA: 94, deptB: 88 },
    { name: 'Sat', deptA: 91, deptB: 92 },
];

const skillDistribution = [
    { subject: 'Machining', A: 120, B: 110, fullMark: 150 },
    { subject: 'Assembly', A: 98, B: 130, fullMark: 150 },
    { subject: 'Quality', A: 86, B: 130, fullMark: 150 },
    { subject: 'Safety', A: 99, B: 100, fullMark: 150 },
    { subject: 'Maintenance', A: 85, B: 90, fullMark: 150 },
    { subject: 'Soft Skills', A: 65, B: 85, fullMark: 150 },
];

export default function EmployeeReports() {
    const [employees, setEmployees] = React.useState<any[]>([]);

    React.useEffect(() => {
        const fetchEmployees = async () => {
            try {
                // Dynamically import API_BASE_URL inside effect if needed or use imported one.
                // Assuming standard usage:
                const token = localStorage.getItem("token");
                const { API_BASE_URL } = await import('@/src/utils/config');

                const res = await fetch(`${API_BASE_URL}/api/ppc/manpower`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.manpower) {
                    setEmployees(data.manpower);
                }
            } catch (error) {
                console.error("Failed to fetch employees for report:", error);
            }
        };
        fetchEmployees();
    }, []);

    // Helper to get initials
    const getInitials = (name: string) => {
        return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || "NA";
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Total Employees" value={employees.length.toString()} trend="+2 New" icon={Users} color="indigo" />
                <KPICard title="Attendance Rate" value="96%" trend="-1%" icon={UserCheck} color="emerald" />
                <KPICard title="Avg Productivity" value="92%" trend="+4%" icon={Trophy} color="amber" />
                <KPICard title="Overtime Hours" value="120h" trend="Avg" icon={Clock} color="blue" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Attendance Pie Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 lg:col-span-1"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Today's Attendance</h3>
                    <div className="h-[250px] w-full flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={attendanceData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {attendanceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Productivity Trend */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 lg:col-span-2"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Productivity Trend (By Dept)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={productivityTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="deptA" name="Production" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey="deptB" name="Assembly" stroke="#ec4899" strokeWidth={3} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Skill Gap Radar Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Skill Capability Map</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={skillDistribution}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 10 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 150]} />
                                <Radar name="Required" dataKey="B" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                                <Radar name="Actual" dataKey="A" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                                <Legend />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Top Employees List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 lg:col-span-2"
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Employee of the Week</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {employees.length === 0 ? (
                            <div className="col-span-3 text-center py-8 text-gray-500">Loading top performers...</div>
                        ) : (
                            employees.slice(0, 3).map((emp, i) => {
                                const name = emp.employee?.name || "Unknown";
                                const role = emp.skills?.[0]?.name || "Operator";
                                const score = 90 + Math.floor(Math.random() * 10); // Simulated Score
                                return (
                                    <div key={emp._id || i} className="flex items-center gap-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                        <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-lg ring-2 ring-white dark:ring-gray-700">
                                            {getInitials(name)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white truncate max-w-[120px]">{name}</p>
                                            <p className="text-xs text-gray-500 truncate max-w-[120px]">{role}</p>
                                        </div>
                                        <div className="ml-auto text-right">
                                            <p className="text-lg font-bold text-indigo-600">{score}</p>
                                            <p className="text-[10px] text-gray-400">Score</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
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
