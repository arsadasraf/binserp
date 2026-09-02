"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, Trash2, Edit2, CheckCircle2, RefreshCw, Layers, Tag, Target, 
    Building2, HelpCircle, ShoppingBag, Palette, X, Check, Search, Filter 
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface MasterItem {
    _id: string;
    type: string;
    name: string;
    code?: string;
    color?: string;
    order?: number;
    probability?: number;
    description?: string;
    unitPrice?: number;
    unit?: string;
    isDefault?: boolean;
    isActive?: boolean;
}

export default function CRMMastersManager() {
    const [activeMasterType, setActiveMasterType] = useState<string>("source");
    const [items, setItems] = useState<MasterItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        code: "",
        color: "#3b82f6",
        order: 0,
        probability: 50,
        description: "",
        unitPrice: 0,
        unit: "PCS"
    });

    const masterCategories = [
        { id: "source", label: "Lead Sources", icon: Tag, desc: "IndiaMART, Web, Referrals, Cold Calls" },
        { id: "stage", label: "Pipeline Stages", icon: Target, desc: "Kanban pipeline columns & win probability" },
        { id: "industry", label: "Customer Industries", icon: Building2, desc: "Market segments & vertical categories" },
        { id: "lossReason", label: "Deal Loss Reasons", icon: HelpCircle, desc: "Loss analysis tags & competitor tracking" },
        { id: "product", label: "Products / Services", icon: ShoppingBag, desc: "Standard CRM product offerings & rates" }
    ];

    const fetchMasters = async (type = activeMasterType) => {
        setLoading(true);
        setMsg(null);
        try {
            const token = localStorage.getItem("token");
            const res = await apiGet(`/api/crm/masters/${type}`, token);
            setItems(res.data || []);
        } catch (err: any) {
            setMsg({ type: "error", text: err.message || "Failed to load CRM master items" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMasters(activeMasterType);
    }, [activeMasterType]);

    const handleOpenCreate = () => {
        setEditingItem(null);
        setFormData({
            name: "",
            code: "",
            color: activeMasterType === "stage" ? "#6366f1" : "#3b82f6",
            order: items.length + 1,
            probability: 50,
            description: "",
            unitPrice: 0,
            unit: "PCS"
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: MasterItem) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            code: item.code || "",
            color: item.color || "#3b82f6",
            order: item.order || 0,
            probability: item.probability || 0,
            description: item.description || "",
            unitPrice: item.unitPrice || 0,
            unit: item.unit || "PCS"
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setSubmitting(true);
        setMsg(null);
        try {
            const token = localStorage.getItem("token");
            if (editingItem) {
                await apiPut(`/api/crm/masters/${activeMasterType}/${editingItem._id}`, formData, token);
                setMsg({ type: "success", text: `Updated '${formData.name}' successfully` });
            } else {
                await apiPost(`/api/crm/masters/${activeMasterType}`, { ...formData, type: activeMasterType }, token);
                setMsg({ type: "success", text: `Added '${formData.name}' to master` });
            }
            setIsModalOpen(false);
            fetchMasters(activeMasterType);
        } catch (err: any) {
            setMsg({ type: "error", text: err.message || "Failed to save master item" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete '${name}' from CRM masters?`)) return;

        try {
            const token = localStorage.getItem("token");
            await apiDelete(`/api/crm/masters/${activeMasterType}/${id}`, token);
            setMsg({ type: "success", text: `Deleted '${name}' from master` });
            fetchMasters(activeMasterType);
        } catch (err: any) {
            setMsg({ type: "error", text: err.message || "Failed to delete item" });
        }
    };

    const filteredItems = items.filter(item => 
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase()) ||
        item.code?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Alert Message */}
            {msg && (
                <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold ${
                    msg.type === "success" 
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"
                }`}>
                    <span>{msg.text}</span>
                    <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Master Category Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {masterCategories.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = activeMasterType === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => { setActiveMasterType(cat.id); setSearch(""); }}
                            className={`p-4 rounded-2xl text-left border transition-all flex flex-col justify-between ${
                                isActive
                                    ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20 scale-[1.02]"
                                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className={`p-2 rounded-xl ${isActive ? "bg-white/20 text-white" : "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"}`}>
                                    <Icon size={18} />
                                </div>
                                {isActive && <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>}
                            </div>
                            <div>
                                <h3 className="font-extrabold text-sm tracking-tight">{cat.label}</h3>
                                <p className={`text-[11px] mt-0.5 line-clamp-1 ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                                    {cat.desc}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Main Action & Data Card */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                
                {/* Header Action Bar */}
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                            <Layers size={18} className="text-blue-600 dark:text-blue-400" />
                            {masterCategories.find(c => c.id === activeMasterType)?.label} Ledger
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Manage custom parameters used across Lead forms, Kanban pipelines, and Deal stages.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>

                        <button
                            onClick={() => fetchMasters(activeMasterType)}
                            className="p-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors shrink-0"
                            title="Refresh Master Items"
                        >
                            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                        </button>

                        <button
                            onClick={handleOpenCreate}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-600/20 flex items-center gap-1.5 shrink-0"
                        >
                            <Plus size={15} /> Add New
                        </button>
                    </div>
                </div>

                {/* Table View */}
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="p-4 w-12 text-center">#</th>
                                <th className="p-4">Name / Title</th>
                                {activeMasterType === "stage" && <th className="p-4 text-center">Win Probability</th>}
                                {activeMasterType === "product" && <th className="p-4 text-right">Standard Rate</th>}
                                <th className="p-4">Color Badge</th>
                                <th className="p-4">Description</th>
                                <th className="p-4 text-center">Order Sequence</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-slate-400">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                                        Loading master items...
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-slate-400">
                                        No items found in this category. Click <strong>Add New</strong> to create one.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, idx) => (
                                    <tr key={item._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span 
                                                    className="w-3 h-3 rounded-full shrink-0 shadow-xs" 
                                                    style={{ backgroundColor: item.color || "#3b82f6" }}
                                                />
                                                <strong className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</strong>
                                                {item.code && <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{item.code}</span>}
                                                {item.isDefault && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">Default</span>}
                                            </div>
                                        </td>
                                        {activeMasterType === "stage" && (
                                            <td className="p-4 text-center">
                                                <span className="px-2.5 py-1 rounded-full font-mono font-extrabold text-[11px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                                    {item.probability || 0}%
                                                </span>
                                            </td>
                                        )}
                                        {activeMasterType === "product" && (
                                            <td className="p-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                                ₹{Number(item.unitPrice || 0).toLocaleString()} / {item.unit || "PCS"}
                                            </td>
                                        )}
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                                <span className="w-3.5 h-3.5 rounded border border-slate-300 shadow-2xs" style={{ backgroundColor: item.color || "#3b82f6" }}></span>
                                                {item.color || "#3b82f6"}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-500 max-w-xs truncate">
                                            {item.description || "-"}
                                        </td>
                                        <td className="p-4 text-center font-mono font-bold text-slate-500">
                                            {item.order != null ? item.order : idx + 1}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleOpenEdit(item)}
                                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-lg transition-colors"
                                                    title="Edit Item"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item._id, item.name)}
                                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 rounded-lg transition-colors"
                                                    title="Delete Item"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create / Edit Master Item Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                        
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                            <div>
                                <h3 className="font-extrabold text-base">
                                    {editingItem ? "Edit Master Item" : `Add New ${masterCategories.find(c => c.id === activeMasterType)?.label.slice(0, -1)}`}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Configure CRM master parameter</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
                            
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Name / Label <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. IndiaMART, Proposal Sent, Automotive..."
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Code / Key (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        placeholder="e.g. IM_SRC, STG_01"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                                        <Palette size={13} /> Color Code
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            className="w-10 h-9 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
                                        />
                                        <input
                                            type="text"
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {activeMasterType === "stage" && (
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex justify-between">
                                        <span>Default Win Probability (%)</span>
                                        <span className="font-mono text-blue-600 font-bold">{formData.probability}%</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={formData.probability}
                                        onChange={(e) => setFormData({ ...formData, probability: Number(e.target.value) })}
                                        className="w-full accent-blue-600"
                                    />
                                </div>
                            )}

                            {activeMasterType === "product" && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Standard Unit Price (INR)
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.unitPrice}
                                            onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Unit of Measure
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.unit}
                                            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                            placeholder="PCS, SET, KG, LOT"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Display Order
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.order}
                                        onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Description (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Internal notes..."
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50"
                                >
                                    {submitting ? "Saving..." : editingItem ? "Update Master" : "Save Item"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
