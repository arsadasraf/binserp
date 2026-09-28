"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
    Plus, Search, Filter, RefreshCw, LayoutGrid, List, Flame, Sun, Snowflake, 
    Phone, Mail, MapPin, Tag, ArrowRight, UserCheck, Trash2, Edit2, X, Check, 
    Building2, Calendar, FileText, FileSpreadsheet, Download, Upload, 
    ChevronDown, AlertCircle, CheckCircle2, DollarSign, Package, Sparkles
} from "lucide-react";
import { apiRequest, apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface MasterProduct {
    _id: string;
    name: string;
    description?: string;
    unit?: string;
    itemClassification?: "product" | "service";
    hsnSacCode?: string;
    taxRate?: number;
    unitPrice?: number;
    pricing?: {
        intraState?: {
            sellingPrice?: number;
            negotiationPrice?: number;
        };
    };
}

interface Lead {
    _id: string;
    name: string;
    companyName?: string;
    designation?: string;
    email?: string;
    phone?: string;
    altPhone?: string;
    address?: string;
    city?: string;
    pincode?: string;
    state?: string;
    status: string;
    source: string;
    warmth: "Hot" | "Warm" | "Cold";
    priority: "Low" | "Medium" | "High" | "Urgent";
    estimatedValue?: number;
    currency?: string;
    budgetDetails?: string;
    productInterest?: string[];
    requirements?: string;
    tags?: string[];
    isConverted?: boolean;
    convertedToCustomer?: any;
    assignedTo?: any;
    createdAt?: string;
}

const DEFAULT_STAGES = [
    { id: "New", label: "New Leads", color: "#3b82f6" },
    { id: "Contacted", label: "Contacted", color: "#6366f1" },
    { id: "Qualified", label: "Qualified", color: "#8b5cf6" },
    { id: "Proposal Sent", label: "Proposal Sent", color: "#ec4899" },
    { id: "Negotiation", label: "Negotiation", color: "#f59e0b" },
    { id: "Won", label: "Won Deals", color: "#10b981" },
    { id: "Lost", label: "Lost", color: "#ef4444" }
];

const DEFAULT_SOURCES = [
    "Direct",
    "IndiaMART",
    "TradeIndia",
    "Website Inquiry",
    "Direct Referral",
    "Cold Call / Outreach",
    "Exhibition / Trade Show"
];

const DEFAULT_FORM_DATA = {
    name: "",
    phone: "",
    email: "",
    companyName: "",
    designation: "",
    address: "",
    city: "",
    pincode: "",
    state: "",
    requirements: "", // "looking for"
    productInterest: [] as string[], // "our product and services from master"
    source: "Direct", // "Source Direct"
    warmth: "Warm" as "Hot" | "Warm" | "Cold", // "Warmth ☀️ Warm"
    status: "New", // "Stage"
    priority: "Medium" as "Low" | "Medium" | "High" | "Urgent",
    estimatedValue: 0, // "details with budget"
    currency: "INR",
    budgetDetails: "", // "details with budget"
    tags: ""
};

export default function LeadKanban() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
    const [masterSources, setMasterSources] = useState<string[]>(DEFAULT_SOURCES);
    const [masterStages, setMasterStages] = useState(DEFAULT_STAGES);

    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
    const [search, setSearch] = useState("");
    const [sourceFilter, setSourceFilter] = useState("All");
    const [warmthFilter, setWarmthFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");

    // Excel Actions Dropdown
    const [isExcelMenuOpen, setIsExcelMenuOpen] = useState(false);
    const excelMenuRef = useRef<HTMLDivElement>(null);

    // Bulk Import Modal State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ totalRows: number; inserted: number; skipped: number; errors: string[] } | null>(null);
    const [importError, setImportError] = useState<string | null>(null);

    // Exporting State
    const [exporting, setExporting] = useState(false);

    // Manual Single Entry Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

    // Conversion Modal State
    const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
    const [convertDealTitle, setConvertDealTitle] = useState("");
    const [convertDealValue, setConvertDealValue] = useState(0);

    // Close Excel Dropdown on Outside Click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (excelMenuRef.current && !excelMenuRef.current.contains(e.target as Node)) {
                setIsExcelMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch CRM Master Products & Services
    const fetchMasters = async () => {
        try {
            const token = localStorage.getItem("token");
            const [prodRes, srcRes, stgRes] = await Promise.all([
                apiGet("/api/crm/masters/product", token).catch(() => ({ data: [] })),
                apiGet("/api/crm/masters/source", token).catch(() => ({ data: [] })),
                apiGet("/api/crm/masters/stage", token).catch(() => ({ data: [] }))
            ]);

            if (prodRes.data?.length) {
                setMasterProducts(prodRes.data);
            }
            if (srcRes.data?.length) {
                const srcNames = srcRes.data.map((s: any) => s.name);
                setMasterSources(Array.from(new Set(["Direct", ...srcNames])));
            }
            if (stgRes.data?.length) {
                setMasterStages(stgRes.data.map((s: any) => ({
                    id: s.name,
                    label: s.name,
                    color: s.color || "#3b82f6"
                })));
            }
        } catch (err) {
            console.warn("Could not load master items:", err);
        }
    };

    // Fetch Leads
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
        fetchMasters();
    }, []);

    useEffect(() => {
        fetchLeads();
    }, [sourceFilter, warmthFilter, statusFilter]);

    // Download Excel Template
    const handleDownloadTemplate = async () => {
        setIsExcelMenuOpen(false);
        try {
            const res = await apiRequest("/api/crm/excel/template/leads", {
                method: "GET"
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to download template (Status ${res.status})`);
            }
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = "CRM_Leads_Import_Template.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
        } catch (err: any) {
            console.error("Template download error:", err);
            alert(err.message || "Failed to download template");
        }
    };

    // Export Leads to Excel
    const handleExportLeads = async () => {
        setIsExcelMenuOpen(false);
        setExporting(true);
        try {
            let url = "/api/crm/excel/export/leads?";
            if (statusFilter !== "All") url += `status=${encodeURIComponent(statusFilter)}&`;
            if (sourceFilter !== "All") url += `source=${encodeURIComponent(sourceFilter)}&`;
            if (warmthFilter !== "All") url += `warmth=${encodeURIComponent(warmthFilter)}&`;

            const res = await apiRequest(url, {
                method: "GET"
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to export leads (Status ${res.status})`);
            }
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `CRM_Leads_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
        } catch (err: any) {
            console.error("Export leads error:", err);
            alert(err.message || "Failed to export leads");
        } finally {
            setExporting(false);
        }
    };

    // Handle Bulk Import Upload
    const handleImportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return;

        setImporting(true);
        setImportError(null);
        setImportResult(null);

        try {
            const form = new FormData();
            form.append("file", selectedFile);

            const res = await apiRequest("/api/crm/excel/import/leads", {
                method: "POST",
                body: form
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || "Failed to import spreadsheet data");
            }

            setImportResult(data.data);
            setSelectedFile(null);
            fetchLeads();
        } catch (err: any) {
            setImportError(err.message || "Failed to import file");
        } finally {
            setImporting(false);
        }
    };

    // Open Manual Create Modal
    const handleOpenCreate = () => {
        setEditingLead(null);
        setFormData(DEFAULT_FORM_DATA);
        setIsCreateModalOpen(true);
    };

    // Open Edit Modal
    const handleOpenEdit = (lead: Lead) => {
        setEditingLead(lead);
        setFormData({
            name: lead.name,
            phone: lead.phone || "",
            email: lead.email || "",
            companyName: lead.companyName || "",
            designation: lead.designation || "",
            address: lead.address || "",
            city: lead.city || "",
            pincode: lead.pincode || "",
            state: lead.state || "",
            requirements: lead.requirements || "",
            productInterest: Array.isArray(lead.productInterest) ? lead.productInterest : lead.productInterest ? [lead.productInterest] : [],
            source: lead.source || "Direct",
            warmth: (lead.warmth as any) || "Warm",
            status: lead.status || "New",
            priority: (lead.priority as any) || "Medium",
            estimatedValue: lead.estimatedValue || 0,
            currency: lead.currency || "INR",
            budgetDetails: lead.budgetDetails || "",
            tags: Array.isArray(lead.tags) ? lead.tags.join(", ") : ""
        });
        setIsCreateModalOpen(true);
    };

    // Save Manual Lead Entry
    const handleSaveLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

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

    // Stage Quick Move
    const handleStageChange = async (leadId: string, newStatus: string) => {
        try {
            const token = localStorage.getItem("token");
            await apiPut(`/api/crm/leads/${leadId}`, { status: newStatus }, token);
            fetchLeads();
        } catch (err) {
            console.error("Failed to update status", err);
        }
    };

    // 1-Click Convert Lead
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

    // Delete Lead
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

    // Helper: Select / toggle Master Product in Form
    const handleToggleProduct = (productName: string, standardRate?: number) => {
        setFormData(prev => {
            const exists = prev.productInterest.includes(productName);
            const nextList = exists
                ? prev.productInterest.filter(p => p !== productName)
                : [...prev.productInterest, productName];

            // If budget is 0 and we are adding a product with standard rate, suggest it
            let nextBudget = prev.estimatedValue;
            if (!exists && standardRate && (!prev.estimatedValue || prev.estimatedValue === 0)) {
                nextBudget = standardRate;
            }

            return {
                ...prev,
                productInterest: nextList,
                estimatedValue: nextBudget
            };
        });
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
                            placeholder="Search customer, phone, city..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchLeads()}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
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
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer max-w-[150px] truncate"
                    >
                        <option value="All">All Sources</option>
                        {masterSources.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    <button
                        onClick={fetchLeads}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                        title="Refresh Leads"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                {/* Actions: View Switch, Excel Actions Menu & Single Entry Add Lead */}
                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                    
                    {/* View Switch */}
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

                    {/* Excel Actions Dropdown Menu */}
                    <div className="relative" ref={excelMenuRef}>
                        <button
                            onClick={() => setIsExcelMenuOpen(!isExcelMenuOpen)}
                            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs"
                        >
                            <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />
                            <span>Excel Actions</span>
                            <ChevronDown size={13} className={`transition-transform duration-200 ${isExcelMenuOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isExcelMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in duration-100 text-xs">
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="w-full px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl flex items-center gap-2 transition-colors"
                                >
                                    <Download size={14} className="text-blue-500" />
                                    <span>Download Template (.xlsx)</span>
                                </button>
                                
                                <button
                                    onClick={() => { setIsExcelMenuOpen(false); setIsImportModalOpen(true); }}
                                    className="w-full px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl flex items-center gap-2 transition-colors"
                                >
                                    <Upload size={14} className="text-emerald-500" />
                                    <span>Bulk Import with Excel</span>
                                </button>
                                
                                <div className="border-t border-slate-100 dark:border-slate-700 my-1" />

                                <button
                                    onClick={handleExportLeads}
                                    disabled={exporting}
                                    className="w-full px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    <FileSpreadsheet size={14} className="text-purple-500" />
                                    <span>{exporting ? "Exporting..." : "Export Current Leads"}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Single Entry Manual Add Lead */}
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
                    {masterStages.map((stg) => {
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

                                                <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                                                    {lead.source || "Direct"}
                                                </span>
                                            </div>

                                            {/* Customer Name & Company */}
                                            <div>
                                                <h5 className="font-extrabold text-xs text-slate-900 dark:text-white line-clamp-1">
                                                    {lead.name}
                                                </h5>
                                                {lead.companyName && (
                                                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                                                        {lead.companyName}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Contact & Location Chips */}
                                            <div className="space-y-1 text-[11px] text-slate-500">
                                                {lead.phone && (
                                                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                                        <Phone size={11} className="text-blue-500 shrink-0" />
                                                        <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a>
                                                    </div>
                                                )}
                                                {(lead.city || lead.state || lead.pincode) && (
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                        <MapPin size={11} className="shrink-0 text-slate-400" />
                                                        <span className="truncate">
                                                            {[lead.city, lead.state, lead.pincode].filter(Boolean).join(", ")}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Products Interested */}
                                            {lead.productInterest && lead.productInterest.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {lead.productInterest.slice(0, 2).map((prod, idx) => (
                                                        <span key={idx} className="text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200/50 truncate max-w-[180px]">
                                                            {prod}
                                                        </span>
                                                    ))}
                                                    {lead.productInterest.length > 2 && (
                                                        <span className="text-[9px] font-bold text-slate-400">
                                                            +{lead.productInterest.length - 2} more
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Looking For / Requirements preview */}
                                            {lead.requirements && (
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400 line-clamp-2 bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 italic">
                                                    "{lead.requirements}"
                                                </p>
                                            )}

                                            {/* Estimated Value / Budget & Actions */}
                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                                <div>
                                                    <strong className="font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400 block">
                                                        {lead.estimatedValue ? `₹${Number(lead.estimatedValue).toLocaleString()}` : "Budget: -"}
                                                    </strong>
                                                    {lead.budgetDetails && (
                                                        <span className="text-[9px] text-slate-400 line-clamp-1 italic max-w-[120px]">
                                                            {lead.budgetDetails}
                                                        </span>
                                                    )}
                                                </div>

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
                                                        className="p-1 text-slate-400 hover:text-blue-600 rounded-md"
                                                        title="Edit Lead"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteLead(lead._id, lead.name)}
                                                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
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
                                                {masterStages.map(s => (
                                                    <option key={s.id} value={s.id}>Move: {s.label}</option>
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
                                    <th className="p-3.5">Customer Name & Company</th>
                                    <th className="p-3.5">Contact & Location</th>
                                    <th className="p-3.5">Looking For & Product Interest</th>
                                    <th className="p-3.5">Source</th>
                                    <th className="p-3.5">Warmth</th>
                                    <th className="p-3.5">Pipeline Stage</th>
                                    <th className="p-3.5 text-right">Budget / Est. Value</th>
                                    <th className="p-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-slate-400">
                                            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                                            Loading leads pipeline...
                                        </td>
                                    </tr>
                                ) : leads.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-slate-400">
                                            No leads found matching your criteria. Click <strong>Add Lead</strong> or use <strong>Bulk Import</strong>.
                                        </td>
                                    </tr>
                                ) : (
                                    leads.map((lead) => (
                                        <tr key={lead._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="p-3.5">
                                                <strong className="font-extrabold text-slate-900 dark:text-white text-xs block">
                                                    {lead.name}
                                                </strong>
                                                {lead.companyName && (
                                                    <span className="text-[11px] text-slate-500 block">{lead.companyName}</span>
                                                )}
                                            </td>

                                            <td className="p-3.5">
                                                <div className="space-y-0.5">
                                                    {lead.phone && (
                                                        <div className="font-mono text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                                            <Phone size={11} className="text-blue-500" />
                                                            <span>{lead.phone}</span>
                                                        </div>
                                                    )}
                                                    {lead.email && (
                                                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                                            <Mail size={11} className="text-slate-400" />
                                                            <span>{lead.email}</span>
                                                        </div>
                                                    )}
                                                    {(lead.city || lead.state || lead.pincode) && (
                                                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                            <MapPin size={10} />
                                                            <span>{[lead.city, lead.state, lead.pincode].filter(Boolean).join(", ")}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-3.5 max-w-xs">
                                                {lead.productInterest && lead.productInterest.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mb-1">
                                                        {lead.productInterest.map((p, i) => (
                                                            <span key={i} className="text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200/50">
                                                                {p}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {lead.requirements ? (
                                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 italic">
                                                        "{lead.requirements}"
                                                    </p>
                                                ) : (
                                                    <span className="text-slate-400 text-[10px]">-</span>
                                                )}
                                            </td>

                                            <td className="p-3.5">
                                                <span className="font-extrabold text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                                                    {lead.source || "Direct"}
                                                </span>
                                            </td>

                                            <td className="p-3.5">
                                                <span className={`px-2 py-1 rounded-full font-bold text-[10px] inline-flex items-center gap-1 ${
                                                    lead.warmth === "Hot" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" :
                                                    lead.warmth === "Warm" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" :
                                                    "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                                                }`}>
                                                    {lead.warmth === "Hot" ? "🔥 Hot" : lead.warmth === "Warm" ? "☀️ Warm" : "❄️ Cold"}
                                                </span>
                                            </td>

                                            <td className="p-3.5">
                                                <span className="px-2.5 py-1 rounded-full font-bold text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                    {lead.status || "New"}
                                                </span>
                                            </td>

                                            <td className="p-3.5 text-right">
                                                <div className="font-mono font-bold text-slate-900 dark:text-white">
                                                    {lead.estimatedValue ? `₹${Number(lead.estimatedValue).toLocaleString()}` : "-"}
                                                </div>
                                                {lead.budgetDetails && (
                                                    <span className="text-[10px] text-slate-400 block line-clamp-1 italic">
                                                        {lead.budgetDetails}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="p-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {!lead.isConverted && (
                                                        <button
                                                            onClick={() => handleOpenConvert(lead)}
                                                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg transition-colors"
                                                            title="Convert Lead"
                                                        >
                                                            <UserCheck size={13} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenEdit(lead)}
                                                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-lg transition-colors"
                                                        title="Edit Lead"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteLead(lead._id, lead.name)}
                                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 rounded-lg transition-colors"
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

            {/* BULK IMPORT FROM EXCEL MODAL */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <FileSpreadsheet size={18} className="text-emerald-400" />
                                    Bulk Import Leads with Excel
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Upload .xlsx or .xls file with lead coordinates</p>
                            </div>
                            <button onClick={() => { setIsImportModalOpen(false); setImportResult(null); setImportError(null); }} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleImportSubmit} className="p-6 space-y-4 text-xs">
                            
                            {/* Download template notice */}
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/50 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="font-bold text-blue-900 dark:text-blue-300">Need the official template?</p>
                                    <p className="text-[11px] text-blue-600 dark:text-blue-400">Download formatted spreadsheet with sample columns</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 shrink-0 shadow-xs"
                                >
                                    <Download size={13} /> Template
                                </button>
                            </div>

                            {/* Drop / Choose File */}
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Choose Excel File (.xlsx, .xls)
                                </label>
                                <input
                                    type="file"
                                    required
                                    accept=".xlsx, .xls, .csv"
                                    onChange={(e) => {
                                        setSelectedFile(e.target.files?.[0] || null);
                                        setImportResult(null);
                                        setImportError(null);
                                    }}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950 dark:file:text-blue-300 cursor-pointer"
                                />
                            </div>

                            {/* Error Alert */}
                            {importError && (
                                <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl flex items-center gap-2">
                                    <AlertCircle size={15} className="shrink-0 text-rose-600" />
                                    <span>{importError}</span>
                                </div>
                            )}

                            {/* Success Result */}
                            {importResult && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-2">
                                    <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                                        <CheckCircle2 size={16} className="text-emerald-600" />
                                        <span>Import Completed Successfully!</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-emerald-100 dark:border-emerald-900">
                                            <span className="block font-bold text-slate-500">Processed</span>
                                            <strong className="font-mono text-sm">{importResult.totalRows}</strong>
                                        </div>
                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-emerald-100 dark:border-emerald-900">
                                            <span className="block font-bold text-emerald-600">Inserted</span>
                                            <strong className="font-mono text-sm text-emerald-600">{importResult.inserted}</strong>
                                        </div>
                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-emerald-100 dark:border-emerald-900">
                                            <span className="block font-bold text-amber-600">Skipped</span>
                                            <strong className="font-mono text-sm text-amber-600">{importResult.skipped}</strong>
                                        </div>
                                    </div>
                                    {importResult.errors && importResult.errors.length > 0 && (
                                        <div className="mt-2 text-[10px] text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg max-h-24 overflow-y-auto">
                                            {importResult.errors.map((err, i) => (
                                                <div key={i}>{err}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsImportModalOpen(false); setImportResult(null); setImportError(null); }}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl"
                                >
                                    Close
                                </button>
                                <button
                                    type="submit"
                                    disabled={importing || !selectedFile}
                                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {importing ? "Importing..." : <><Upload size={14} /> Upload & Import</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MANUAL SINGLE ENTRY / EDIT LEAD MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                        
                        {/* Modal Header */}
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <Sparkles size={18} className="text-blue-400" />
                                    {editingLead ? "Edit Lead Details" : "Add New Lead (Manual Entry)"}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Enter customer details, location, master products/services, source, warmth, stage & budget
                                </p>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSaveLead} className="p-6 overflow-y-auto space-y-5 text-xs">
                            
                            {/* Section 1: Customer & Contact Coordinates */}
                            <div className="space-y-3">
                                <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <Building2 size={13} className="text-blue-500" /> Customer & Contact Information
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Customer Name <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Rajesh Kumar"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Contact Number <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+91 98765 43210"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="rajesh@example.com"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
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
                                            placeholder="e.g. Precision Engineering Ltd"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Location Details */}
                            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <MapPin size={13} className="text-emerald-500" /> Location Details
                                </h4>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Address
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Plot / Street / Industrial Area..."
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            City
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                            placeholder="e.g. Pune"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Pincode
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.pincode}
                                            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                                            placeholder="e.g. 411018"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            State
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.state}
                                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                            placeholder="e.g. Maharashtra"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Requirements & Our Master Products */}
                            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <Package size={13} className="text-purple-500" /> Commercial Scope & Master Offerings
                                </h4>

                                {/* Our Product and Services from Master */}
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                                        <span>Our Products & Services (From Master)</span>
                                        <span className="text-[10px] text-slate-400 font-normal">Click to toggle items</span>
                                    </label>
                                    
                                    {masterProducts.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                                            {masterProducts.map((p) => {
                                                const isSelected = formData.productInterest.includes(p.name);
                                                const rate = p.pricing?.intraState?.sellingPrice || p.unitPrice || 0;
                                                return (
                                                    <button
                                                        key={p._id}
                                                        type="button"
                                                        onClick={() => handleToggleProduct(p.name, rate)}
                                                        className={`p-2.5 text-left rounded-xl border transition-all flex flex-col justify-between ${
                                                            isSelected
                                                                ? "bg-blue-50 dark:bg-blue-950/70 border-blue-400 dark:border-blue-600 shadow-xs"
                                                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-1">
                                                            <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                                                                {p.name}
                                                            </div>
                                                            <span className={`text-[9px] font-extrabold uppercase px-1 py-0.2 rounded shrink-0 ${
                                                                p.itemClassification === "service"
                                                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-950"
                                                                    : "bg-blue-100 text-blue-700 dark:bg-blue-950"
                                                            }`}>
                                                                {p.itemClassification === "service" ? "Service" : "Product"}
                                                            </span>
                                                        </div>

                                                        {/* Strict Binserp Standard: Always show Item Description */}
                                                        {p.description && (
                                                            <p className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-1">
                                                                {p.description}
                                                            </p>
                                                        )}

                                                        <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
                                                            <span>Rate: ₹{rate.toLocaleString()}</span>
                                                            {isSelected && <Check size={13} className="text-blue-600 dark:text-blue-400 font-bold" />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-slate-400 italic">No master products found. You can add offerings in CRM Masters.</p>
                                    )}
                                </div>

                                {/* Looking For (Requirements) */}
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Looking For (Inquiry Details & Scope) <span className="text-rose-500">*</span>
                                    </label>
                                    <textarea
                                        rows={2}
                                        required
                                        value={formData.requirements}
                                        onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                                        placeholder="Specific technical requirement, specifications, volume, or customer request..."
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>

                                {/* Budget Amount & Details */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Budget Amount (INR ₹)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.estimatedValue}
                                            onChange={(e) => setFormData({ ...formData, estimatedValue: Number(e.target.value) })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-blue-600 dark:text-blue-400 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Details with Budget
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.budgetDetails}
                                            onChange={(e) => setFormData({ ...formData, budgetDetails: e.target.value })}
                                            placeholder="e.g. 30 days credit, delivery included, phase-1 budget"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Pipeline Classification (Source: Direct, Warmth: Warm, Stage) */}
                            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <Tag size={13} className="text-amber-500" /> Pipeline & Lead Classification
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* Source (Default Direct) */}
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Lead Source
                                        </label>
                                        <select
                                            value={formData.source}
                                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none cursor-pointer"
                                        >
                                            {masterSources.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Warmth (Default ☀️ Warm) */}
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Warmth
                                        </label>
                                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, warmth: "Hot" })}
                                                className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-all ${
                                                    formData.warmth === "Hot"
                                                        ? "bg-rose-500 text-white shadow-xs"
                                                        : "text-slate-500 hover:text-slate-700"
                                                }`}
                                            >
                                                🔥 Hot
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, warmth: "Warm" })}
                                                className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-all ${
                                                    formData.warmth === "Warm"
                                                        ? "bg-amber-500 text-white shadow-xs"
                                                        : "text-slate-500 hover:text-slate-700"
                                                }`}
                                            >
                                                ☀️ Warm
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, warmth: "Cold" })}
                                                className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-all ${
                                                    formData.warmth === "Cold"
                                                        ? "bg-sky-500 text-white shadow-xs"
                                                        : "text-slate-500 hover:text-slate-700"
                                                }`}
                                            >
                                                ❄️ Cold
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stage */}
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Pipeline Stage
                                        </label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none cursor-pointer"
                                        >
                                            {masterStages.map(s => (
                                                <option key={s.id} value={s.id}>{s.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
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
                                    Convert Lead to Customer & Deal
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">{convertingLead.companyName || convertingLead.name}</p>
                            </div>
                            <button onClick={() => setConvertingLead(null)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs">
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
