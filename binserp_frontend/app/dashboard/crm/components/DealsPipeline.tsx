"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, Search, Filter, RefreshCw, DollarSign, Calendar, User, 
    Building2, CheckCircle2, XCircle, ArrowRight, Edit2, Trash2, X, Tag 
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface Deal {
    _id: string;
    title: string;
    customerName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    value: number;
    currency: string;
    stage: string;
    probability: number;
    expectedCloseDate?: string;
    assignedTo?: any;
    status: "Open" | "Won" | "Lost" | "Abandoned";
    lossReason?: string;
    notes?: string;
    createdAt?: string;
}

const DEFAULT_STAGES = [
    { name: "Discovery", color: "border-blue-400 bg-blue-50/50 text-blue-800", probability: 20 },
    { name: "Proposal Sent", color: "border-indigo-400 bg-indigo-50/50 text-indigo-800", probability: 50 },
    { name: "Negotiation", color: "border-amber-400 bg-amber-50/50 text-amber-800", probability: 80 },
    { name: "Won", color: "border-emerald-400 bg-emerald-50/50 text-emerald-800", probability: 100 },
    { name: "Lost", color: "border-rose-400 bg-rose-50/50 text-rose-800", probability: 0 }
];

export default function DealsPipeline() {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [stageFilter, setStageFilter] = useState("All");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: "",
        customerName: "",
        contactPerson: "",
        email: "",
        phone: "",
        value: 0,
        currency: "INR",
        stage: "Discovery",
        probability: 50,
        expectedCloseDate: "",
        notes: ""
    });

    const fetchDeals = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await apiGet(`/api/crm/deals?search=${encodeURIComponent(search)}&stage=${stageFilter}`, token);
            setDeals(res.data || []);
        } catch (err) {
            console.error("Failed to fetch deals", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeals();
    }, [stageFilter]);

    const handleOpenCreate = () => {
        setEditingDeal(null);
        setFormData({
            title: "",
            customerName: "",
            contactPerson: "",
            email: "",
            phone: "",
            value: 0,
            currency: "INR",
            stage: "Discovery",
            probability: 50,
            expectedCloseDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            notes: ""
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (deal: Deal) => {
        setEditingDeal(deal);
        setFormData({
            title: deal.title,
            customerName: deal.customerName || "",
            contactPerson: deal.contactPerson || "",
            email: deal.email || "",
            phone: deal.phone || "",
            value: deal.value || 0,
            currency: deal.currency || "INR",
            stage: deal.stage || "Discovery",
            probability: deal.probability != null ? deal.probability : 50,
            expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().slice(0, 10) : "",
            notes: deal.notes || ""
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            if (editingDeal) {
                await apiPut(`/api/crm/deals/${editingDeal._id}`, formData, token);
            } else {
                await apiPost("/api/crm/deals", formData, token);
            }
            setIsModalOpen(false);
            fetchDeals();
        } catch (err) {
            console.error("Failed to save deal", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleQuickStageChange = async (dealId: string, newStage: string) => {
        try {
            const token = localStorage.getItem("token");
            await apiPut(`/api/crm/deals/${dealId}`, { stage: newStage }, token);
            fetchDeals();
        } catch (err) {
            console.error("Failed to update stage", err);
        }
    };

    const handleDelete = async (dealId: string, title: string) => {
        if (!confirm(`Are you sure you want to delete Deal '${title}'?`)) return;
        try {
            const token = localStorage.getItem("token");
            await apiDelete(`/api/crm/deals/${dealId}`, token);
            fetchDeals();
        } catch (err) {
            console.error("Failed to delete deal", err);
        }
    };

    // Calculate totals
    const totalPipelineValue = deals.filter(d => d.status === "Open").reduce((acc, d) => acc + (d.value || 0), 0);
    const weightedForecast = deals.filter(d => d.status === "Open").reduce((acc, d) => acc + ((d.value || 0) * (d.probability / 100)), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Top Stats Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Deals Count</span>
                    <strong className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block font-mono">{deals.length}</strong>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Pipeline Value</span>
                    <strong className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 block font-mono">
                        ₹{totalPipelineValue.toLocaleString()}
                    </strong>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Weighted Revenue Forecast</span>
                    <strong className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block font-mono">
                        ₹{Math.round(weightedForecast).toLocaleString()}
                    </strong>
                </div>
            </div>

            {/* Main Action Bar */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search deals or customers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchDeals()}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                        />
                    </div>

                    <select
                        value={stageFilter}
                        onChange={(e) => setStageFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                    >
                        <option value="All">All Stages</option>
                        {DEFAULT_STAGES.map(s => (
                            <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchDeals}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-1.5"
                    >
                        <Plus size={15} /> Create Deal
                    </button>
                </div>
            </div>

            {/* Deals Stage Kanban Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {DEFAULT_STAGES.map((stg) => {
                    const stageDeals = deals.filter(d => (d.stage || "Discovery") === stg.name);
                    const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

                    return (
                        <div key={stg.name} className="flex flex-col bg-slate-50/70 dark:bg-slate-900/40 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 min-h-[500px]">
                            
                            {/* Column Header */}
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                        {stg.name}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                        {stageDeals.length}
                                    </span>
                                </div>
                                <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 block mt-1">
                                    ₹{stageValue.toLocaleString()}
                                </span>
                            </div>

                            {/* Cards list */}
                            <div className="space-y-3 flex-1 overflow-y-auto">
                                {stageDeals.map((deal) => (
                                    <div
                                        key={deal._id}
                                        className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow-md transition-all space-y-2.5 group"
                                    >
                                        <div className="flex justify-between items-start">
                                            <h5 className="font-extrabold text-xs text-slate-900 dark:text-white line-clamp-1">
                                                {deal.title}
                                            </h5>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                <button onClick={() => handleOpenEdit(deal)} className="p-1 text-slate-400 hover:text-blue-600">
                                                    <Edit2 size={12} />
                                                </button>
                                                <button onClick={() => handleDelete(deal._id, deal.title)} className="p-1 text-slate-400 hover:text-rose-600">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="text-[11px] text-slate-500 space-y-0.5">
                                            <p className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                                                {deal.customerName || "Customer Deal"}
                                            </p>
                                            {deal.phone && <p className="font-mono text-[10px]">{deal.phone}</p>}
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                                            <strong className="font-mono font-extrabold text-blue-600 dark:text-blue-400">
                                                ₹{Number(deal.value || 0).toLocaleString()}
                                            </strong>
                                            <span className="font-mono text-[10px] font-bold text-slate-400">
                                                {deal.probability}% Win
                                            </span>
                                        </div>

                                        {/* Quick Move Stage Select */}
                                        <select
                                            value={deal.stage || stg.name}
                                            onChange={(e) => handleQuickStageChange(deal._id, e.target.value)}
                                            className="w-full text-[10px] font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none cursor-pointer"
                                        >
                                            {DEFAULT_STAGES.map(s => (
                                                <option key={s.name} value={s.name}>Move to: {s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                        </div>
                    );
                })}
            </div>

            {/* Create / Edit Deal Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                        
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                            <div>
                                <h3 className="font-extrabold text-base">
                                    {editingDeal ? "Edit Deal & Opportunity" : "Create New Deal"}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Pipeline revenue tracking</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Deal Title <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. 5000 Units Shaft Assembly Contract"
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Customer / Buyer Company
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                        placeholder="Company Name"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Deal Value (INR) *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-800 dark:text-slate-200 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Pipeline Stage
                                    </label>
                                    <select
                                        value={formData.stage}
                                        onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none cursor-pointer"
                                    >
                                        {DEFAULT_STAGES.map(s => (
                                            <option key={s.name} value={s.name}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex justify-between">
                                        <span>Win Probability</span>
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
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Expected Closing Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.expectedCloseDate}
                                    onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Notes & Commercial Conditions
                                </label>
                                <textarea
                                    rows={3}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Add payment terms, discount agreed, or delivery commitments..."
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none resize-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50"
                                >
                                    {submitting ? "Saving..." : editingDeal ? "Update Deal" : "Create Deal"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
