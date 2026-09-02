"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, Search, Filter, RefreshCw, LayoutGrid, List, Flame, Sun, Snowflake, 
    Phone, Mail, MapPin, Tag, ArrowRight, UserCheck, Trash2, Edit2, X, Check, Building2, Calendar, FileText
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface Lead {
    _id: string;
    name: string;
    companyName?: string;
    designation?: string;
    email?: string;
    phone?: string;
    altPhone?: string;
    city?: string;
    state?: string;
    address?: string;
    status: string;
    source: string;
    warmth: "Hot" | "Warm" | "Cold";
    priority: "Low" | "Medium" | "High" | "Urgent";
    estimatedValue?: number;
    currency?: string;
    productInterest?: string[];
    requirements?: string;
    tags?: string[];
    isConverted?: boolean;
    convertedToCustomer?: any;
    assignedTo?: any;
    createdAt?: string;
}

const STAGES = [
    { id: "New", label: "New Leads", color: "#3b82f6" },
    { id: "Contacted", label: "Contacted", color: "#6366f1" },
    { id: "Qualified", label: "Qualified", color: "#8b5cf6" },
    { id: "Proposal Sent", label: "Proposal Sent", color: "#ec4899" },
    { id: "Negotiation", label: "Negotiation", color: "#f59e0b" },
    { id: "Won", label: "Won Deals", color: "#10b981" },
    { id: "Lost", label: "Lost", color: "#ef4444" }
];

export default function LeadKanban() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
    const [search, setSearch] = useState("");
    const [sourceFilter, setSourceFilter] = useState("All");
    const [warmthFilter, setWarmthFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");

    // Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        companyName: "",
        designation: "",
        email: "",
        phone: "",
        city: "",
        state: "",
        address: "",
        source: "Direct",
        warmth: "Warm",
        priority: "Medium",
        status: "New",
        estimatedValue: 0,
        requirements: "",
        tags: ""
    });

    // Conversion Form
    const [convertDealTitle, setConvertDealTitle] = useState("");
    const [convertDealValue, setConvertDealValue] = useState(0);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            let url = `/api/crm/leads?search=${encodeURIComponent(search)}`;
            if (sourceFilter !== "All") url += `&source=${encodeURIComponent(sourceFilter)}`;
            if (warmthFilter !== "All") url += `&warmth=${encodeURIComponent(warmthFilter)}`;
            if (statusFilter !== "All") url += `&status=${encodeURIComponent(statusFilter)}`;

            const res = await apiGet(url, token);
            setLeads(res.data || []);
        } catch (err) {
            console.error("Failed to load leads", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, [sourceFilter, warmthFilter, statusFilter]);

    const handleOpenCreate = () => {
        setEditingLead(null);
        setFormData({
            name: "",
            companyName: "",
            designation: "",
            email: "",
            phone: "",
            city: "",
            state: "",
            address: "",
            source: "Direct",
            warmth: "Warm",
            priority: "Medium",
            status: "New",
            estimatedValue: 0,
            requirements: "",
            tags: ""
        });
        setIsCreateModalOpen(true);
    };

    const handleOpenEdit = (lead: Lead) => {
        setEditingLead(lead);
        setFormData({
            name: lead.name,
            companyName: lead.companyName || "",
            designation: lead.designation || "",
            email: lead.email || "",
            phone: lead.phone || "",
            city: lead.city || "",
            state: lead.state || "",
            address: lead.address || "",
            source: lead.source || "Direct",
            warmth: lead.warmth || "Warm",
            priority: lead.priority || "Medium",
            status: lead.status || "New",
            estimatedValue: lead.estimatedValue || 0,
            requirements: lead.requirements || "",
            tags: Array.isArray(lead.tags) ? lead.tags.join(", ") : ""
        });
        setIsCreateModalOpen(true);
    };

    const handleSaveLead = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const payload = {
                ...formData,
                tags: formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : []
            };

            if (editingLead) {
                await apiPut(`/api/crm/leads/${editingLead._id}`, payload, token);
            } else {
                await apiPost("/api/crm/leads", payload, token);
            }
            setIsCreateModalOpen(false);
            fetchLeads();
        } catch (err) {
            console.error("Failed to save lead", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleStageChange = async (leadId: string, newStatus: string) => {
        try {
            const token = localStorage.getItem("token");
            await apiPut(`/api/crm/leads/${leadId}`, { status: newStatus }, token);
            fetchLeads();
        } catch (err) {
            console.error("Failed to update status", err);
        }
    };

    const handleOpenConvert = (lead: Lead) => {
        setConvertingLead(lead);
        setConvertDealTitle(`Deal - ${lead.companyName || lead.name}`);
        setConvertDealValue(lead.estimatedValue || 0);
    };

    const handleConfirmConvert = async () => {
        if (!convertingLead) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            await apiPost(`/api/crm/leads/${convertingLead._id}/convert`, {
                createDeal: true,
                dealTitle: convertDealTitle,
                dealValue: convertDealValue
            }, token);
            setConvertingLead(null);
            fetchLeads();
        } catch (err) {
            console.error("Failed to convert lead", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteLead = async (leadId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete lead '${name}'?`)) return;
        try {
            const token = localStorage.getItem("token");
            await apiDelete(`/api/crm/leads/${leadId}`, token);
            fetchLeads();
        } catch (err) {
            console.error("Failed to delete lead", err);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Top Control Bar */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                
                {/* Search & Multi Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search name, phone, city..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchLeads()}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                        />
                    </div>

                    <select
                        value={warmthFilter}
                        onChange={(e) => setWarmthFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                    >
                        <option value="All">All Warmth</option>
                        <option value="Hot">🔥 Hot</option>
                        <option value="Warm">☀️ Warm</option>
                        <option value="Cold">❄️ Cold</option>
                    </select>

                    <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                    >
                        <option value="All">All Sources</option>
                        <option value="IndiaMART">IndiaMART</option>
                        <option value="TradeIndia">TradeIndia</option>
                        <option value="Website Inquiry">Website</option>
                        <option value="Direct Referral">Referral</option>
                        <option value="Direct">Direct</option>
                    </select>

                    <button
                        onClick={fetchLeads}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                {/* View Switch & Create Button */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode("kanban")}
                            className={`p-1.5 rounded-lg transition-all ${
                                viewMode === "kanban" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs" : "text-slate-400"
                            }`}
                            title="Kanban Board View"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode("table")}
                            className={`p-1.5 rounded-lg transition-all ${
                                viewMode === "table" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs" : "text-slate-400"
                            }`}
                            title="Table List View"
                        >
                            <List size={16} />
                        </button>
                    </div>

                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5"
                    >
                        <Plus size={15} /> Add Lead
                    </button>
                </div>

            </div>

            {/* KANBAN BOARD VIEW */}
            {viewMode === "kanban" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3.5 overflow-x-auto min-h-[600px] pb-4">
                    {STAGES.map((stg) => {
                        const stageLeads = leads.filter(l => (l.status || "New") === stg.id);
                        return (
                            <div 
                                key={stg.id} 
                                className="flex flex-col bg-slate-50/70 dark:bg-slate-900/40 rounded-3xl p-3 border border-slate-200/80 dark:border-slate-800 min-w-[220px]"
                            >
                                {/* Stage Header */}
                                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-3 px-1">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stg.color }} />
                                        <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate">
                                            {stg.label}
                                        </h4>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                        {stageLeads.length}
                                    </span>
                                </div>

                                {/* Lead Cards */}
                                <div className="space-y-3 flex-1 overflow-y-auto">
                                    {stageLeads.map((lead) => (
                                        <div
                                            key={lead._id}
                                            className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-md transition-all space-y-2.5 group"
                                        >
                                            {/* Warmth & Source Badges */}
                                            <div className="flex items-center justify-between">
                                                <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] flex items-center gap-1 ${
                                                    lead.warmth === "Hot" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" :
                                                    lead.warmth === "Warm" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" :
                                                    "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                                                }`}>
                                                    {lead.warmth === "Hot" ? "🔥 Hot" : lead.warmth === "Warm" ? "☀️ Warm" : "❄️ Cold"}
                                                </span>

                                                <span className="text-[10px] font-bold text-slate-400 truncate max-w-[90px]">
                                                    {lead.source}
                                                </span>
                                            </div>

                                            {/* Contact & Company Info */}
                                            <div>
                                                <h5 className="font-extrabold text-xs text-slate-900 dark:text-white line-clamp-1">
                                                    {lead.companyName || lead.name}
                                                </h5>
                                                {lead.companyName && (
                                                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                                                        Attn: {lead.name}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Contact Chips */}
                                            <div className="space-y-1 text-[11px] text-slate-500">
                                                {lead.phone && (
                                                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                                        <Phone size={11} className="text-blue-500 shrink-0" />
                                                        <span>{lead.phone}</span>
                                                    </div>
                                                )}
                                                {lead.city && (
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                        <MapPin size={11} className="shrink-0" />
                                                        <span>{lead.city}{lead.state ? `, ${lead.state}` : ""}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Requirements preview */}
                                            {lead.requirements && (
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400 line-clamp-2 bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    {lead.requirements}
                                                </p>
                                            )}

                                            {/* Estimated Value & Action Footer */}
                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                                <strong className="font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400">
                                                    {lead.estimatedValue ? `₹${Number(lead.estimatedValue).toLocaleString()}` : "₹ -"}
                                                </strong>

                                                <div className="flex items-center gap-1">
                                                    {!lead.isConverted && (
                                                        <button
                                                            onClick={() => handleOpenConvert(lead)}
                                                            className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-md transition-colors"
                                                            title="Convert to Customer & Deal"
                                                        >
                                                            <UserCheck size={12} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenEdit(lead)}
                                                        className="p-1 text-slate-400 hover:text-blue-600"
                                                        title="Edit Lead"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteLead(lead._id, lead.name)}
                                                        className="p-1 text-slate-400 hover:text-rose-600"
                                                        title="Delete Lead"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quick Move Dropdown */}
                                            <select
                                                value={lead.status || stg.id}
                                                onChange={(e) => handleStageChange(lead._id, e.target.value)}
                                                className="w-full text-[10px] font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none cursor-pointer"
                                            >
                                                {STAGES.map(s => (
                                                    <option key={s.id} value={s.id}>Move to: {s.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* TABLE LIST VIEW */
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th className="p-3.5">Lead / Company</th>
                                    <th className="p-3.5">Contact Coordinates</th>
                                    <th className="p-3.5">Source</th>
                                    <th className="p-3.5">Warmth</th>
                                    <th className="p-3.5">Pipeline Stage</th>
                                    <th className="p-3.5 text-right">Est. Value</th>
                                    <th className="p-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                {leads.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-slate-400">
                                            No leads match the filters. Click <strong>Add Lead</strong> to create one.
                                        </td>
                                    </tr>
                                ) : (
                                    leads.map((lead) => (
                                        <tr key={lead._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="p-3.5">
                                                <strong className="font-extrabold text-slate-900 dark:text-white text-sm block">
                                                    {lead.companyName || lead.name}
                                                </strong>
                                                <span className="text-[11px] text-slate-400">Attn: {lead.name}</span>
                                            </td>
                                            <td className="p-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                                                {lead.phone && <div>{lead.phone}</div>}
                                                {lead.email && <div className="text-slate-400">{lead.email}</div>}
                                            </td>
                                            <td className="p-3.5">
                                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                                    {lead.source}
                                                </span>
                                            </td>
                                            <td className="p-3.5">
                                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                                    lead.warmth === "Hot" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" :
                                                    lead.warmth === "Warm" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" :
                                                    "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                                                }`}>
                                                    {lead.warmth === "Hot" ? "🔥 Hot" : lead.warmth === "Warm" ? "☀️ Warm" : "❄️ Cold"}
                                                </span>
                                            </td>
                                            <td className="p-3.5">
                                                <select
                                                    value={lead.status || "New"}
                                                    onChange={(e) => handleStageChange(lead._id, e.target.value)}
                                                    className="text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none cursor-pointer"
                                                >
                                                    {STAGES.map(s => (
                                                        <option key={s.id} value={s.id}>{s.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-3.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                                {lead.estimatedValue ? `₹${Number(lead.estimatedValue).toLocaleString()}` : "₹ -"}
                                            </td>
                                            <td className="p-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {!lead.isConverted && (
                                                        <button
                                                            onClick={() => handleOpenConvert(lead)}
                                                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg"
                                                            title="Convert to Customer"
                                                        >
                                                            <UserCheck size={13} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenEdit(lead)}
                                                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-lg"
                                                        title="Edit Lead"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteLead(lead._id, lead.name)}
                                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 rounded-lg"
                                                        title="Delete Lead"
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
            )}

            {/* CREATE / EDIT LEAD MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                            <div>
                                <h3 className="font-extrabold text-base">
                                    {editingLead ? "Edit Lead Details" : "Add New Lead"}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Pipeline contact & commercial parameters</p>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveLead} className="p-6 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Contact Person Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Full Name"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Company / Enterprise Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.companyName}
                                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                        placeholder="Company Name"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+91..."
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="email@company.com"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Source
                                    </label>
                                    <select
                                        value={formData.source}
                                        onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Direct">Direct</option>
                                        <option value="IndiaMART">IndiaMART</option>
                                        <option value="TradeIndia">TradeIndia</option>
                                        <option value="Website Inquiry">Website Inquiry</option>
                                        <option value="Direct Referral">Referral</option>
                                        <option value="Cold Call / Outreach">Cold Call</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Warmth
                                    </label>
                                    <select
                                        value={formData.warmth}
                                        onChange={(e) => setFormData({ ...formData, warmth: e.target.value as any })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Hot">🔥 Hot</option>
                                        <option value="Warm">☀️ Warm</option>
                                        <option value="Cold">❄️ Cold</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Stage
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        {STAGES.map(s => (
                                            <option key={s.id} value={s.id}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        placeholder="City Name"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Estimated Deal Value (INR)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.estimatedValue}
                                        onChange={(e) => setFormData({ ...formData, estimatedValue: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Product Requirements / Inquired Items
                                </label>
                                <textarea
                                    rows={2}
                                    value={formData.requirements}
                                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                                    placeholder="Buyer inquiry specification or order requirement..."
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none resize-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50"
                                >
                                    {submitting ? "Saving..." : editingLead ? "Update Lead" : "Save Lead"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 1-CLICK CONVERT LEAD MODAL */}
            {convertingLead && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <UserCheck size={18} className="text-emerald-400" />
                                    Convert Lead to Account & Deal
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">{convertingLead.companyName || convertingLead.name}</p>
                            </div>
                            <button onClick={() => setConvertingLead(null)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs">
                            <p className="text-slate-600 dark:text-slate-400">
                                This will automatically create an Account in the Customer Directory and initialize an active Deal in your revenue pipeline.
                            </p>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Opportunity / Deal Title
                                </label>
                                <input
                                    type="text"
                                    value={convertDealTitle}
                                    onChange={(e) => setConvertDealTitle(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Contract / Deal Value (INR)
                                </label>
                                <input
                                    type="number"
                                    value={convertDealValue}
                                    onChange={(e) => setConvertDealValue(Number(e.target.value))}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold outline-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                <button
                                    onClick={() => setConvertingLead(null)}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmConvert}
                                    disabled={submitting}
                                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {submitting ? "Converting..." : <><Check size={14} /> Confirm Conversion</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
