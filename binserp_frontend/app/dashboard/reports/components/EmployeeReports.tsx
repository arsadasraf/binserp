"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  Users, UserCheck, UserX, Clock, Trophy, RefreshCw, Search,
  Briefcase, IndianRupee, Eye, X, CheckCircle, Award, TrendingUp
} from "lucide-react";
import { API_BASE_URL } from "@/src/utils/config";

export default function EmployeeReports() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    kpis: any;
    employees: any[];
  }>({
    kpis: {},
    employees: []
  });

  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  const fetchManpowerReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/reports/manpower`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch manpower reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManpowerReports();
  }, []);

  const kpis = data.kpis || {};
  const allEmployees = data.employees || [];

  // Extract unique departments & designations for filtering
  const departments = Array.from(new Set(allEmployees.map((e) => e.department).filter(Boolean)));
  const designations = Array.from(new Set(allEmployees.map((e) => e.designation).filter(Boolean)));

  // Filter employees
  const filteredEmployees = allEmployees.filter((e) => {
    const matchesDept = selectedDept === "all" || e.department === selectedDept;
    const matchesRole = selectedRole === "all" || e.designation === selectedRole;
    const matchesSearch =
      searchTerm === "" ||
      e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.designation?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDept && matchesRole && matchesSearch;
  });

  // Helper for Initials
  const getInitials = (name: string) => {
    return name?.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "NA";
  };

  // Aggregated Attendance Pie Chart Data
  const totalPresent = allEmployees.reduce((acc, e) => acc + (e.presentDays || 0), 0);
  const totalAbsent = allEmployees.reduce((acc, e) => acc + (e.absentDays || 0), 0);
  const totalLeave = allEmployees.reduce((acc, e) => acc + (e.leaveDays || 0), 0);
  const totalLate = allEmployees.reduce((acc, e) => acc + (e.lateDays || 0), 0);

  const attendancePieData = [
    { name: "Present", value: totalPresent, color: "#10b981" },
    { name: "Absent", value: totalAbsent, color: "#ef4444" },
    { name: "Leave", value: totalLeave, color: "#8b5cf6" },
    { name: "Late Arrivals", value: totalLate, color: "#f59e0b" }
  ].filter((d) => d.value > 0);

  // Department-wise parts output
  const deptOutputMap: Record<string, { dept: string; parts: number; count: number }> = {};
  allEmployees.forEach((e) => {
    const d = e.department || "Other";
    if (!deptOutputMap[d]) deptOutputMap[d] = { dept: d, parts: 0, count: 0 };
    deptOutputMap[d].parts += e.partsProduced || 0;
    deptOutputMap[d].count += 1;
  });
  const deptOutputData = Object.values(deptOutputMap);

  // Top Performers (Ranked by Parts Produced & Efficiency)
  const topPerformers = [...allEmployees]
    .sort((a, b) => (b.partsProduced || 0) - (a.partsProduced || 0) || (b.efficiency || 0) - (a.efficiency || 0))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* ── Filter & Search Toolbar ── */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Department Filter */}
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Departments ({departments.length})</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Designation Filter */}
          <div className="relative">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Designations ({designations.length})</option>
              {designations.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchManpowerReports}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-xl text-xs font-semibold transition-colors shrink-0"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh Workforce
        </button>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Manpower</p>
              <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{kpis.totalEmployees || 0}</h4>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Users size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-emerald-600 font-semibold">{kpis.activeEmployees || 0} Active Staff</span>
            <span>{departments.length} Departments</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Attendance Rate</p>
              <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{kpis.avgAttendanceRate || 0}%</h4>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <UserCheck size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span>Logged Attendance</span>
            <span className="text-emerald-600 font-bold">Stable</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Avg Productivity</p>
              <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{kpis.avgEfficiency || 0}%</h4>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <Trophy size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span>Quality Pass Rate:</span>
            <span className="text-cyan-600 font-bold">{kpis.avgQualityScore || 0}%</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Overtime</p>
              <h4 className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{kpis.totalOvertimeHours || 0} hrs</h4>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
              <Clock size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span>Total Parts Produced:</span>
            <span className="text-purple-600 font-bold">{(kpis.totalPartsProduced || 0).toLocaleString()}</span>
          </div>
        </motion.div>
      </div>

      {/* ── Top Performers & Attendance Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Pie Chart */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UserCheck size={16} className="text-emerald-600" /> Attendance Distribution
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Total working days & absence breakdown</p>
          </div>
          <div className="h-[230px] w-full relative my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendancePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {attendancePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} Days`, name]}
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="text-2xl font-black text-gray-900 dark:text-white">{kpis.avgAttendanceRate || 0}%</span>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Attendance</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs pt-3 border-t border-gray-100 dark:border-gray-800">
            {attendancePieData.map((item) => (
              <span key={item.name} className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}: <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Department Output Comparison */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Briefcase size={16} className="text-indigo-600" /> Department Parts Output
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Finished output generated by department</p>
          </div>
          <div className="h-[230px] w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptOutputData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dept" stroke="#94a3b8" fontSize={10} angle={-20} textAnchor="end" />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  formatter={(val: any) => [`${val} pcs`, "Parts Output"]}
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                />
                <Bar dataKey="parts" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-gray-400 text-center pt-3 border-t border-gray-100 dark:border-gray-800">
            Total across all production and machining departments
          </p>
        </div>

        {/* Top Performers Leaderboard */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Award size={16} className="text-amber-500" /> Top Operators & Performers
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Ranked by volume produced & efficiency</p>
          </div>

          <div className="space-y-3 my-3">
            {topPerformers.map((emp, index) => (
              <div
                key={emp._id}
                onClick={() => setSelectedEmployee(emp)}
                className="flex items-center gap-3 p-3 bg-gray-50/80 dark:bg-gray-800/50 rounded-xl hover:bg-indigo-50/50 dark:hover:bg-gray-800 cursor-pointer transition-colors border border-gray-100 dark:border-gray-800"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                    index === 0
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                      : index === 1
                      ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      : "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400"
                  }`}
                >
                  #{index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white text-xs truncate">{emp.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{emp.designation} • {emp.department}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                    {(emp.partsProduced || 0).toLocaleString()} pcs
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-600">{emp.efficiency}% eff.</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-400 text-center pt-3 border-t border-gray-100 dark:border-gray-800">
            Based on completed operations and logged hours
          </p>
        </div>
      </div>

      {/* ── Comprehensive Each-Manpower Table ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
              <Users size={18} className="text-indigo-600" /> Individual Manpower Performance Breakdown
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Showing {filteredEmployees.length} of {allEmployees.length} workforce personnel
            </p>
          </div>
          {(selectedDept !== "all" || selectedRole !== "all") && (
            <button
              onClick={() => {
                setSelectedDept("all");
                setSelectedRole("all");
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/75 dark:bg-gray-800/50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3.5">Employee</th>
                <th className="px-4 py-3.5">Department & Role</th>
                <th className="px-4 py-3.5">Attendance</th>
                <th className="px-4 py-3.5">Attendance %</th>
                <th className="px-4 py-3.5">Jobs / Ops</th>
                <th className="px-4 py-3.5">Parts Output</th>
                <th className="px-4 py-3.5">Quality Pass %</th>
                <th className="px-4 py-3.5">Efficiency %</th>
                <th className="px-4 py-3.5">Per-Day Salary</th>
                <th className="px-4 py-3.5">Est. Cost</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-gray-400 text-sm">
                    No workforce records match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp._id}
                    onClick={() => setSelectedEmployee(emp)}
                    className="hover:bg-indigo-50/30 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-extrabold flex items-center justify-center text-xs shrink-0">
                          {getInitials(emp.name)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white text-sm">{emp.name}</div>
                          <div className="text-[11px] text-gray-400 font-mono">ID: {emp.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-gray-800 dark:text-gray-200">{emp.department}</div>
                      <div className="text-[11px] text-gray-400">{emp.designation}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-gray-700 dark:text-gray-300">
                        <strong className="text-emerald-600">{emp.presentDays}</strong> Present •{" "}
                        <strong className="text-red-500">{emp.absentDays}</strong> Abs
                      </div>
                      {emp.overtimeHours > 0 && (
                        <div className="text-[10px] text-purple-600 font-semibold mt-0.5">
                          +{emp.overtimeHours} hrs Overtime
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-lg font-bold text-xs ${
                          emp.attendanceRate >= 95
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : emp.attendanceRate >= 85
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                        }`}
                      >
                        {emp.attendanceRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-gray-800 dark:text-gray-200">
                      {emp.operationsCompleted} ops
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {(emp.partsProduced || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-cyan-600 dark:text-cyan-400">
                      {emp.qualityScore}%
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-lg font-bold text-xs ${
                          emp.efficiency >= 95
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : emp.efficiency >= 85
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {emp.efficiency}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                        ₹{(emp.perDaySalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-gray-400">{emp.perDayBasis}</div>
                    </td>
                    <td className="px-4 py-3.5 font-bold font-mono text-gray-800 dark:text-gray-200">
                      ₹{(emp.totalSalaryCost || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEmployee(emp);
                        }}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Employee Detail Modal ── */}
      <AnimatePresence>
        {selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-black flex items-center justify-center text-base">
                    {getInitials(selectedEmployee.name)}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">{selectedEmployee.name}</h3>
                    <p className="text-xs text-gray-400">
                      {selectedEmployee.designation} • {selectedEmployee.department}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Performance Metric Badges */}
              <div className="grid grid-cols-3 gap-2 my-5 text-center">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                  <span className="text-[10px] uppercase font-bold text-indigo-500">Output Parts</span>
                  <p className="text-base font-black text-indigo-700 dark:text-indigo-300">
                    {(selectedEmployee.partsProduced || 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                  <span className="text-[10px] uppercase font-bold text-emerald-500">Quality Score</span>
                  <p className="text-base font-black text-emerald-700 dark:text-emerald-300">{selectedEmployee.qualityScore}%</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-100 dark:border-amber-900/50">
                  <span className="text-[10px] uppercase font-bold text-amber-500">Efficiency</span>
                  <p className="text-base font-black text-amber-700 dark:text-amber-300">{selectedEmployee.efficiency}%</p>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-3 text-xs bg-gray-50/70 dark:bg-gray-800/40 p-4 rounded-xl">
                <div className="flex justify-between">
                  <span className="text-gray-500">Attendance Days:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {selectedEmployee.presentDays} Present / {selectedEmployee.absentDays} Absent
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Overtime Logged:</span>
                  <span className="font-bold text-purple-600">{selectedEmployee.overtimeHours} hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Operations Completed:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">{selectedEmployee.operationsCompleted} operations</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Per Day Salary:</span>
                  <span className="font-bold text-blue-600">
                    ₹{(selectedEmployee.perDaySalary || 0).toLocaleString()} ({selectedEmployee.perDayBasis})
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-bold text-gray-700 dark:text-gray-300">Total Month Wage Cost:</span>
                  <span className="font-black text-sm text-gray-900 dark:text-white font-mono">
                    ₹{(selectedEmployee.totalSalaryCost || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="px-5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
