"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  Package, TrendingUp, AlertOctagon, RefreshCw, Search,
  IndianRupee, Layers, Eye, X, ArrowDownRight, ArrowUpRight, CheckCircle, ShieldAlert
} from "lucide-react";
import { API_BASE_URL } from "@/src/utils/config";

const CATEGORY_COLORS: Record<string, string> = {
  "Raw Material": "#6366f1",   // Indigo
  "Bought Out": "#8b5cf6",     // Violet
  "Consumable": "#ec4899",     // Pink
  "Finished Goods": "#10b981"  // Emerald
};

const HEALTH_COLORS: Record<string, string> = {
  Adequate: "#10b981",
  "Low Stock": "#f59e0b",
  "Out of Stock": "#ef4444",
  Excess: "#8b5cf6"
};

export default function InventoryReports() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    kpis: any;
    categoryStats: any;
    materials: any[];
  }>({
    kpis: {},
    categoryStats: {},
    materials: []
  });

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedHealth, setSelectedHealth] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);

  const fetchMaterialReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/reports/materials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch material reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterialReports();
  }, []);

  const kpis = data.kpis || {};
  const allMaterials = data.materials || [];
  const categoryStats = data.categoryStats || {};

  // Filter materials
  const filteredMaterials = allMaterials.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesHealth = selectedHealth === "all" || item.stockStatus === selectedHealth;
    const matchesSearch =
      searchTerm === "" ||
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesHealth && matchesSearch;
  });

  // Chart: Category Valuation Pie
  const categoryPieData = Object.entries(categoryStats).map(([catName, stats]: [string, any]) => ({
    name: catName,
    value: Math.round(stats.valuation || 0),
    count: stats.count || 0,
    color: CATEGORY_COLORS[catName] || "#64748b"
  })).filter((item) => item.value > 0);

  // Chart: Stock Health Pie
  const healthPieData = [
    { name: "Adequate", value: kpis.adequateCount || 0, color: "#10b981" },
    { name: "Low Stock", value: kpis.lowStockCount || 0, color: "#f59e0b" },
    { name: "Out of Stock", value: kpis.outOfStockCount || 0, color: "#ef4444" },
    { name: "Excess", value: kpis.excessCount || 0, color: "#8b5cf6" }
  ].filter((item) => item.value > 0);

  // Chart: Top 8 Most Valued Materials
  const topValuedItems = [...allMaterials]
    .sort((a, b) => (b.valuation || 0) - (a.valuation || 0))
    .slice(0, 8)
    .map((item) => ({
      name: item.name.length > 15 ? item.name.slice(0, 15) + "..." : item.name,
      fullName: item.name,
      valuation: item.valuation,
      category: item.category
    }));

  return (
    <div className="space-y-6">
      {/* ── Toolbar & Filters ── */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            {["all", "Raw Material", "Bought Out", "Consumable", "Finished Goods"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {cat === "all" ? "All Categories" : cat}
              </button>
            ))}
          </div>

          {/* Health Status Filter */}
          <div className="relative">
            <select
              value={selectedHealth}
              onChange={(e) => setSelectedHealth(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Health Statuses</option>
              <option value="Adequate">Adequate (Healthy)</option>
              <option value="Low Stock">Low Stock (Alert)</option>
              <option value="Out of Stock">Out of Stock</option>
              <option value="Excess">Excess Stock</option>
            </select>
          </div>

          {/* Search Input (Strict Item Name & Description) */}
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by item name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchMaterialReports}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-xl text-xs font-semibold transition-colors shrink-0"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh Inventory
        </button>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Store Valuation</p>
              <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                ₹{(kpis.totalValuation || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </h4>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <IndianRupee size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span>Catalog Items: <strong>{kpis.totalItemsCount || 0}</strong></span>
            <span className="text-emerald-600 font-bold">4 Categories</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Healthy Stock</p>
              <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{kpis.adequateCount || 0}</h4>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span>Adequate Levels</span>
            <span className="text-purple-600 font-bold">{kpis.excessCount || 0} Excess Items</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Low Stock Alerts</p>
              <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{kpis.lowStockCount || 0}</h4>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <AlertOctagon size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-amber-600 font-semibold">Below Reorder Level</span>
            <span className="text-gray-400">Needs PO</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Out of Stock Items</p>
              <h4 className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{kpis.outOfStockCount || 0}</h4>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl">
              <ShieldAlert size={22} />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-red-600 font-semibold">Zero On Hand</span>
            <span className="text-red-500 font-bold">Critical</span>
          </div>
        </motion.div>
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Valuation Pie Chart */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Layers size={16} className="text-indigo-600" /> Valuation by Category
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Share of capital invested in inventory</p>
          </div>
          <div className="h-[230px] w-full relative my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [`₹${Number(value).toLocaleString()}`, name]}
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="text-xl font-black text-gray-900 dark:text-white">
                ₹{((kpis.totalValuation || 0) / 100000).toFixed(1)}L
              </span>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Total Stock</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs pt-3 border-t border-gray-100 dark:border-gray-800">
            {categoryPieData.map((item) => (
              <span key={item.name} className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}: <strong>₹{(item.value / 1000).toFixed(0)}k</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Top 8 Valued Items Bar Chart */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between lg:col-span-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-purple-600" /> High-Value Inventory Holdings
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Top materials by total monetary stock holding</p>
          </div>
          <div className="h-[230px] w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topValuedItems} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-20} textAnchor="end" />
                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `₹${val > 1000 ? (val / 1000).toFixed(0) + "k" : val}`} />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, "Valuation"]}
                  labelFormatter={(label: any) => {
                    const it = topValuedItems.find((i) => i.name === label);
                    return it?.fullName || label;
                  }}
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                />
                <Bar dataKey="valuation" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-gray-400 text-center pt-3 border-t border-gray-100 dark:border-gray-800">
            Valuation = Current Stock × Unit Rate / Cost Price
          </p>
        </div>
      </div>

      {/* ── Comprehensive Material Inventory Table (Strict AGENTS.md Rule) ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
              <Package size={18} className="text-indigo-600" /> Complete Store Inventory & Movement
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Showing {filteredMaterials.length} of {allMaterials.length} store items across all categories
            </p>
          </div>
          {(selectedCategory !== "all" || selectedHealth !== "all") && (
            <button
              onClick={() => {
                setSelectedCategory("all");
                setSelectedHealth("all");
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
                <th className="px-4 py-3.5">Item Name & Technical Description</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Current Stock</th>
                <th className="px-4 py-3.5">Min / Reorder Level</th>
                <th className="px-4 py-3.5">Health Status</th>
                <th className="px-4 py-3.5">Unit Rate</th>
                <th className="px-4 py-3.5">Total Valuation</th>
                <th className="px-4 py-3.5">Inward (GRN)</th>
                <th className="px-4 py-3.5">Outward (Issue)</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-gray-400 text-sm">
                    No store materials found matching the filters.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((item) => (
                  <tr
                    key={item._id}
                    onClick={() => setSelectedMaterial(item)}
                    className="hover:bg-indigo-50/30 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    {/* Item Name & Technical Description (Strict Rule: Descriptions, Never Item Codes) */}
                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                        {item.name || "N/A"}
                      </div>
                      {item.description ? (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                          {item.description}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic mt-0.5">No technical description</div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[item.category] || "#64748b"}20`,
                          color: CATEGORY_COLORS[item.category] || "#64748b"
                        }}
                      >
                        {item.category}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-bold text-gray-900 dark:text-white font-mono text-sm">
                        {item.currentStock.toLocaleString()}
                      </span>{" "}
                      <span className="text-[11px] text-gray-400 font-semibold">{item.unit}</span>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-gray-600 dark:text-gray-400">
                      {item.minStockLevel > 0 ? `${item.minStockLevel.toLocaleString()} ${item.unit}` : "-"}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          item.stockStatus === "Adequate"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : item.stockStatus === "Low Stock"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                            : item.stockStatus === "Excess"
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: HEALTH_COLORS[item.stockStatus] || "#94a3b8" }}
                        />
                        {item.stockStatus}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-gray-600 dark:text-gray-400">
                      ₹{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="px-4 py-3.5 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      ₹{item.valuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-emerald-600 font-semibold">
                      {item.inwardQty > 0 ? `+${item.inwardQty} ${item.unit}` : "-"}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-amber-600 font-semibold">
                      {item.outwardQty > 0 ? `-${item.outwardQty} ${item.unit}` : "-"}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMaterial(item);
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

      {/* ── Material Detail Modal ── */}
      <AnimatePresence>
        {selectedMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[selectedMaterial.category] || "#64748b"}20`,
                      color: CATEGORY_COLORS[selectedMaterial.category] || "#64748b"
                    }}
                  >
                    {selectedMaterial.category}
                  </span>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">{selectedMaterial.name}</h3>
                  {selectedMaterial.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5">
                      {selectedMaterial.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedMaterial(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Stock Overview Cards */}
              <div className="grid grid-cols-3 gap-2 my-5 text-center">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                  <span className="text-[10px] uppercase font-bold text-indigo-500">Current Stock</span>
                  <p className="text-base font-black text-indigo-700 dark:text-indigo-300">
                    {selectedMaterial.currentStock.toLocaleString()} {selectedMaterial.unit}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Unit Rate</span>
                  <p className="text-base font-bold text-gray-800 dark:text-gray-200">
                    ₹{selectedMaterial.unitPrice.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/50">
                  <span className="text-[10px] uppercase font-bold text-purple-500">Total Valuation</span>
                  <p className="text-base font-black text-purple-700 dark:text-purple-300">
                    ₹{selectedMaterial.valuation.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Stock Movement Details */}
              <div className="space-y-3 text-xs bg-gray-50/70 dark:bg-gray-800/40 p-4 rounded-xl">
                <div className="flex justify-between">
                  <span className="text-gray-500">Stock Health Status:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">{selectedMaterial.stockStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Min Reorder Level:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {selectedMaterial.minStockLevel > 0 ? `${selectedMaterial.minStockLevel} ${selectedMaterial.unit}` : "Not specified"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Inward Received (GRN):</span>
                  <span className="font-bold text-emerald-600">+{selectedMaterial.inwardQty} {selectedMaterial.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Outward Issued (Production):</span>
                  <span className="font-bold text-amber-600">-{selectedMaterial.outwardQty} {selectedMaterial.unit}</span>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setSelectedMaterial(null)}
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
