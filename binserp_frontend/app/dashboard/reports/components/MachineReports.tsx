"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar
} from "recharts";
import {
  Activity, AlertTriangle, CheckCircle, Clock, Cpu, RefreshCw, Search,
  Filter, Layers, Wrench, X, Eye, ArrowUpRight, Gauge, ChevronRight
} from "lucide-react";
import { API_BASE_URL } from "@/src/utils/config";

const STATUS_COLORS: Record<string, string> = {
  Busy: "#10b981",       // Running (Green)
  Available: "#3b82f6",  // Idle / Ready (Blue)
  Maintenance: "#f59e0b",// Maintenance (Amber)
  Breakdown: "#ef4444"   // Breakdown (Red)
};

export default function MachineReports() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    kpis: any;
    workstations: any[];
    unassignedMachines: any[];
    allMachines: any[];
  }>({
    kpis: {},
    workstations: [],
    unassignedMachines: [],
    allMachines: []
  });

  const [selectedWorkstation, setSelectedWorkstation] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);

  const fetchMachineReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/reports/machines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch machine reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachineReports();
  }, []);

  const kpis = data.kpis || {};
  const allMachines = data.allMachines || [];
  const workstations = data.workstations || [];

  // Filter machines based on selected workstation, status, and search term
  const filteredMachines = allMachines.filter((m) => {
    const matchesWs =
      selectedWorkstation === "all" ||
      (selectedWorkstation === "unassigned" ? !m.workstationId : m.workstationId === selectedWorkstation);
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    const matchesSearch =
      searchTerm === "" ||
      m.machineName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.machineCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.workstationName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesWs && matchesStatus && matchesSearch;
  });

  // Data for Charts
  const oeeRadialData = [
    { name: "Availability", value: kpis.fleetAvailability || 90, fill: "#6366f1" },
    { name: "Performance", value: kpis.fleetPerformance || 85, fill: "#8b5cf6" },
    { name: "Quality", value: kpis.fleetQuality || 98, fill: "#06b6d4" }
  ];

  const statusPieData = [
    { name: "Running (Busy)", value: kpis.runningMachines || 0, color: "#10b981" },
    { name: "Available (Idle)", value: kpis.idleMachines || 0, color: "#3b82f6" },
    { name: "Maintenance", value: kpis.maintenanceMachines || 0, color: "#f59e0b" },
    { name: "Breakdown", value: kpis.breakdownMachines || 0, color: "#ef4444" }
  ].filter((item) => item.value > 0);

  const workstationBarData = workstations.map((ws) => ({
    name: ws.workstationCode || ws.workstationName,
    fullName: ws.workstationName,
    oee: ws.avgOee,
    machines: ws.totalMachines,
    parts: ws.totalPartsProduced
  }));

  return (
    <div className="space-y-6">
      {/* ── Top Filter & Control Bar ── */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Workstation Filter */}
          <div className="relative">
            <select
              value={selectedWorkstation}
              onChange={(e) => setSelectedWorkstation(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs rounded-xl px-3 py-2 pr-8 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Workstations ({workstations.length})</option>
              {workstations.map((ws) => (
                <option key={ws._id} value={ws._id}>
                  {ws.workstationName} ({ws.totalMachines} machines)
                </option>
              ))}
              {data.unassignedMachines?.length > 0 && (
                <option value="unassigned">Unassigned Machines ({data.unassignedMachines.length})</option>
              )}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="Busy">Running (Busy)</option>
              <option value="Available">Available (Idle)</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Breakdown">Breakdown</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search machine or workstation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchMachineReports}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-xl text-xs font-semibold transition-colors shrink-0"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh Insights
        </button>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Fleet OEE</p>
              <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{kpis.fleetOee || 0}%</h4>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Gauge size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span>Avail: <strong className="text-indigo-600">{kpis.fleetAvailability || 0}%</strong></span>
            <span>Perf: <strong className="text-violet-600">{kpis.fleetPerformance || 0}%</strong></span>
            <span>Qual: <strong className="text-teal-600">{kpis.fleetQuality || 0}%</strong></span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Active Machines</p>
              <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {kpis.runningMachines || 0} <span className="text-xs font-medium text-gray-400">/ {kpis.totalMachines || 0} Total</span>
              </h4>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {kpis.runningMachines || 0} Running</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> {kpis.idleMachines || 0} Idle</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Downtime</p>
              <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{kpis.totalDowntimeHours || 0} hrs</h4>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-red-500 font-semibold">{kpis.breakdownMachines || 0} Breakdowns</span>
            <span className="text-amber-500 font-semibold">{kpis.maintenanceMachines || 0} In Maint.</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Parts Output</p>
              <h4 className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                {(kpis.totalPartsProduced || 0).toLocaleString()} <span className="text-xs font-medium text-gray-400">pcs</span>
              </h4>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
              <Activity size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span>Workstations: <strong>{workstations.length}</strong></span>
            <span>Total Fleet: <strong>{kpis.totalMachines || 0}</strong></span>
          </div>
        </motion.div>
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* OEE Breakdown Radial Bar */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Gauge size={16} className="text-indigo-600" /> OEE Composition Breakdown
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Availability × Performance × Quality</p>
          </div>
          <div className="h-[230px] w-full relative my-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="25%" outerRadius="90%" barSize={16} data={oeeRadialData}>
                <RadialBar background dataKey="value" cornerRadius={8} />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, "Score"]}
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="text-2xl font-black text-gray-900 dark:text-white">{kpis.fleetOee || 0}%</span>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Overall OEE</p>
            </div>
          </div>
          <div className="grid grid-cols-3 text-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold">Availability</p>
              <p className="font-extrabold text-indigo-600 text-sm">{kpis.fleetAvailability || 0}%</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold">Performance</p>
              <p className="font-extrabold text-violet-600 text-sm">{kpis.fleetPerformance || 0}%</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold">Quality</p>
              <p className="font-extrabold text-cyan-600 text-sm">{kpis.fleetQuality || 0}%</p>
            </div>
          </div>
        </div>

        {/* Machine Status Breakdown Pie */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Cpu size={16} className="text-emerald-600" /> Machine Status Distribution
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Real-time status of all {kpis.totalMachines || 0} machines</p>
          </div>
          <div className="h-[230px] w-full relative my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} Machines`, name]}
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="text-2xl font-black text-gray-900 dark:text-white">{kpis.totalMachines || 0}</span>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Total Machines</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs pt-3 border-t border-gray-100 dark:border-gray-800">
            {statusPieData.map((item) => (
              <span key={item.name} className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}: <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Workstation Average OEE Bar Chart */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Layers size={16} className="text-purple-600" /> Workstation OEE Comparison
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Average OEE % across workstations</p>
          </div>
          <div className="h-[230px] w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workstationBarData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-25} textAnchor="end" />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `${val}%`} />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, "Avg OEE"]}
                  labelFormatter={(label: any) => {
                    const ws = workstationBarData.find((w) => w.name === label);
                    return ws?.fullName || label;
                  }}
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                />
                <Bar dataKey="oee" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-gray-400 text-center pt-3 border-t border-gray-100 dark:border-gray-800">
            Benchmarked against standard 85% World Class OEE threshold
          </p>
        </div>
      </div>

      {/* ── Workstation Overview Cards ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <Layers size={16} className="text-indigo-600" /> Workstation Breakdown ({workstations.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workstations.map((ws) => (
            <div
              key={ws._id}
              onClick={() => setSelectedWorkstation(selectedWorkstation === ws._id ? "all" : ws._id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedWorkstation === ws._id
                  ? "bg-indigo-50/60 border-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-700 shadow-md"
                  : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-gray-700 shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded">
                    {ws.workstationCode}
                  </span>
                  <h4 className="font-bold text-gray-900 dark:text-white text-base mt-1">{ws.workstationName}</h4>
                  <p className="text-xs text-gray-400">{ws.workstationType?.replace("_", " ") || "INDIVIDUAL MACHINE"}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-xl text-xs font-black ${
                      ws.avgOee >= 85
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                        : ws.avgOee >= 70
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                    }`}
                  >
                    OEE: {ws.avgOee}%
                  </span>
                  <p className="text-[10px] text-gray-400 mt-1">{ws.totalMachines} Machines</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 dark:border-gray-800/80 text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px]">Running / Idle</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    <strong className="text-emerald-600">{ws.runningCount}</strong> / {ws.idleCount}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Capacity Rate</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">₹{ws.hourlyRate}/hr</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Output Parts</span>
                  <span className="font-bold text-purple-600">{(ws.totalPartsProduced || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── All Machines Comprehensive Intelligence Table ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
              <Cpu size={18} className="text-indigo-600" /> Machine Operational Intelligence
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Showing {filteredMachines.length} of {allMachines.length} machines
            </p>
          </div>
          {selectedWorkstation !== "all" && (
            <button
              onClick={() => setSelectedWorkstation("all")}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              Clear Workstation Filter
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/75 dark:bg-gray-800/50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3.5">Machine Details</th>
                <th className="px-4 py-3.5">Workstation</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Availability</th>
                <th className="px-4 py-3.5">Performance</th>
                <th className="px-4 py-3.5">Quality</th>
                <th className="px-4 py-3.5">Overall OEE</th>
                <th className="px-4 py-3.5">Downtime (Hrs)</th>
                <th className="px-4 py-3.5">Parts Produced</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredMachines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-gray-400 text-sm">
                    No machines match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredMachines.map((m) => (
                  <tr
                    key={m._id}
                    onClick={() => setSelectedMachine(m)}
                    className="hover:bg-indigo-50/30 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-gray-900 dark:text-white text-sm">{m.machineName}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{m.machineCode} • {m.machineType}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{m.workstationName}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          m.status === "Busy"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                            : m.status === "Available"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                            : m.status === "Maintenance"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[m.status] || "#94a3b8" }} />
                        {m.status === "Busy" ? "Running" : m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">
                      {m.availability}%
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-violet-600 dark:text-violet-400">
                      {m.performance}%
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-cyan-600 dark:text-cyan-400">
                      {m.quality}%
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-lg font-black text-xs ${
                          m.oee >= 85
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                            : m.oee >= 70
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800"
                            : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                        }`}
                      >
                        {m.oee}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={m.downtimeHours > 0 ? "font-bold text-amber-600" : "text-gray-400"}>
                        {m.downtimeHours} hrs
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-gray-800 dark:text-gray-200">
                      {(m.totalPartsProduced || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMachine(m);
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

      {/* ── Machine Detailed Drawer / Modal ── */}
      <AnimatePresence>
        {selectedMachine && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded">
                    {selectedMachine.machineCode}
                  </span>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">{selectedMachine.machineName}</h3>
                  <p className="text-xs text-gray-400">{selectedMachine.machineType} • Workstation: {selectedMachine.workstationName}</p>
                </div>
                <button
                  onClick={() => setSelectedMachine(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {/* OEE Metrics Card Grid */}
              <div className="grid grid-cols-4 gap-2 my-5 text-center">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                  <span className="text-[10px] uppercase font-bold text-indigo-500">Overall OEE</span>
                  <p className="text-lg font-black text-indigo-700 dark:text-indigo-300">{selectedMachine.oee}%</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Availability</span>
                  <p className="text-base font-bold text-gray-800 dark:text-gray-200">{selectedMachine.availability}%</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Performance</span>
                  <p className="text-base font-bold text-gray-800 dark:text-gray-200">{selectedMachine.performance}%</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Quality</span>
                  <p className="text-base font-bold text-gray-800 dark:text-gray-200">{selectedMachine.quality}%</p>
                </div>
              </div>

              {/* Breakdown & Production Stats */}
              <div className="space-y-3 text-xs bg-gray-50/70 dark:bg-gray-800/40 p-4 rounded-xl">
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Status:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">{selectedMachine.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Operating Hours:</span>
                  <span className="font-bold font-mono text-gray-800 dark:text-gray-200">{selectedMachine.operatingHours} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Downtime:</span>
                  <span className="font-bold font-mono text-amber-600">{selectedMachine.downtimeHours} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Breakdown Incidents:</span>
                  <span className="font-bold font-mono text-red-600">{selectedMachine.breakdownIncidents} incidents</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Maintenance Costs Logged:</span>
                  <span className="font-bold font-mono text-gray-800 dark:text-gray-200">₹{selectedMachine.maintenanceCost?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Finished Parts:</span>
                  <span className="font-bold font-mono text-purple-600 text-sm">{(selectedMachine.totalPartsProduced || 0).toLocaleString()} pcs</span>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setSelectedMachine(null)}
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
