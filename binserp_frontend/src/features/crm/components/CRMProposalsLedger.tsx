"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, Search, Filter, RefreshCw, FileText, CheckCircle2, Clock, 
    XCircle, Send, Edit2, Trash2, X, Check, IndianRupee, ExternalLink, Calendar
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface ProposalItem {
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
}

interface Proposal {
    _id: string;
    proposalNo: string;
    title: string;
    customerName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    items?: ProposalItem[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
    status: "Draft" | "Sent" | "Under Review" | "Accepted" | "Declined";
    sentDate?: string;
    validUntil?: string;
    notes?: string;
    createdByName?: string;
    createdAt?: string;
}

export default function CRMProposalsLedger() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        proposalNo: "",
        title: "",
        customerName: "",
        contactPerson: "",
        email: "",
        phone: "",
        status: "Sent" as Proposal["status"],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        notes: "",
        items: [
            { name: "", description: "", quantity: 1, unitPrice: 0, taxRate: 18, total: 0 }
        ]
    });

    const fetchProposals = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            let url = `/api/crm/proposals?search=${encodeURIComponent(search)}`;
            if (statusFilter !== "All") url += `&status=${encodeURIComponent(statusFilter)}`;

            const res = await apiGet(url, token);
            setProposals(res.data || []);
        } catch (err) {
            console.error("Failed to load proposals", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProposals();
    }, [statusFilter]);

    const handleOpenCreate = () => {
        setEditingProposal(null);
        setFormData({
            proposalNo: "",
            title: "",
            customerName: "",
            contactPerson: "",
            email: "",
            phone: "",
            status: "Sent",
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            notes: "",
            items: [
                { name: "", description: "", quantity: 1, unitPrice: 0, taxRate: 18, total: 0 }
            ]
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (prop: Proposal) => {
        setEditingProposal(prop);
        setFormData({
            proposalNo: prop.proposalNo,
            title: prop.title,
            customerName: prop.customerName || "",
            contactPerson: prop.contactPerson || "",
            email: prop.email || "",
            phone: prop.phone || "",
            status: prop.status,
            validUntil: prop.validUntil ? new Date(prop.validUntil).toISOString().slice(0, 10) : "",
            notes: prop.notes || "",
            items: prop.items && prop.items.length > 0 ? prop.items.map(it => ({
                name: it.name,
                description: it.description || "",
                quantity: it.quantity || 1,
                unitPrice: it.unitPrice || 0,
                taxRate: it.taxRate || 18,
                total: it.total || 0
            })) : [
                { name: "", description: "", quantity: 1, unitPrice: prop.totalAmount || 0, taxRate: 18, total: prop.totalAmount || 0 }
            ]
        });
        setIsModalOpen(true);
    };

    const handleAddItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { name: "", description: "", quantity: 1, unitPrice: 0, taxRate: 18, total: 0 }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        if (formData.items.length <= 1) return;
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index: number, field: string, val: any) => {
        setFormData(prev => {
            const nextItems = [...prev.items];
            const item = { ...nextItems[index], [field]: val };
            const qty = Number(item.quantity || 0);
            const price = Number(item.unitPrice || 0);
            item.total = qty * price;
            nextItems[index] = item;
            return { ...prev, items: nextItems };
        });
    };

    const subtotal = formData.items.reduce((acc, it) => acc + (it.total || 0), 0);
    const taxTotal = formData.items.reduce((acc, it) => acc + ((it.total || 0) * (it.taxRate || 18) / 100), 0);
    const grandTotal = subtotal + taxTotal;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const payload = {
                ...formData,
                subtotal,
                taxAmount: taxTotal,
                totalAmount: grandTotal
            };

            if (editingProposal) {
                await apiPut(`/api/crm/proposals/${editingProposal._id}`, payload, token);
            } else {
                await apiPost("/api/crm/proposals", payload, token);
            }
            setIsModalOpen(false);
            fetchProposals();
        } catch (err) {
            console.error("Failed to save proposal", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, propNo: string) => {
        if (!confirm(`Delete proposal ${propNo}?`)) return;
        try {
            const token = localStorage.getItem("token");
            await apiDelete(`/api/crm/proposals/${id}`, token);
            fetchProposals();
        } catch (err) {
            console.error("Failed to delete proposal", err);
        }
    };

    const getStatusBadge = (st: string) => {
        switch (st) {
            case "Accepted":
                return <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold rounded-lg text-[10px] border border-emerald-200">Accepted</span>;
            case "Declined":
                return <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold rounded-lg text-[10px] border border-rose-200">Declined</span>;
            case "Under Review":
                return <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold rounded-lg text-[10px] border border-amber-200">Under Review</span>;
            case "Sent":
                return <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold rounded-lg text-[10px] border border-blue-200">Sent</span>;
            default:
                return <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-lg text-[10px]">Draft</span>;
        }
    };

    return (
        <div className="space-y-4">
            {/* Header / Filter Toolbar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search proposal, client..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchProposals()}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Under Review">Under Review</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Declined">Declined</option>
                    </select>

                    <button
                        onClick={fetchProposals}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <button
                    onClick={handleOpenCreate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                >
                    <Plus size={15} />
                    <span>Create Proposal</span>
                </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-5 py-3.5">Proposal # & Title</th>
                                <th className="px-5 py-3.5">Client / Customer</th>
                                <th className="px-5 py-3.5">Sent / Valid Date</th>
                                <th className="px-5 py-3.5">Total Value (INR)</th>
                                <th className="px-5 py-3.5">Status</th>
                                <th className="px-5 py-3.5">Created By</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                                        Loading proposals...
                                    </td>
                                </tr>
                            ) : proposals.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                        No proposals found. Click &quot;Create Proposal&quot; to record a new quotation.
                                    </td>
                                </tr>
                            ) : (
                                proposals.map((p) => (
                                    <tr key={p._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-5 py-4">
                                            <strong className="text-slate-900 dark:text-white font-mono block">{p.proposalNo}</strong>
                                            <span className="text-[11px] text-slate-500 truncate block max-w-xs">{p.title}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <strong className="text-slate-900 dark:text-white block">{p.customerName || "N/A"}</strong>
                                            {p.contactPerson && <span className="text-[11px] text-slate-500">{p.contactPerson}</span>}
                                        </td>
                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                                            <div>Sent: {p.sentDate ? new Date(p.sentDate).toLocaleDateString() : "Draft"}</div>
                                            {p.validUntil && (
                                                <div className="text-[10px] text-slate-400">
                                                    Valid till: {new Date(p.validUntil).toLocaleDateString()}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <strong className="text-slate-900 dark:text-white font-mono text-sm">
                                                ₹{Number(p.totalAmount || 0).toLocaleString()}
                                            </strong>
                                        </td>
                                        <td className="px-5 py-4">
                                            {getStatusBadge(p.status)}
                                        </td>
                                        <td className="px-5 py-4 text-slate-500 text-[11px]">
                                            <div>{p.createdByName || "CRM Team"}</div>
                                            <div className="text-[10px] text-slate-400">
                                                {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ""}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleOpenEdit(p)}
                                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(p._id, p.proposalNo)}
                                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
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

            {/* CREATE / EDIT PROPOSAL MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center border-b border-slate-700 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <FileText size={18} className="text-blue-400" />
                                    {editingProposal ? `Edit Proposal: ${editingProposal.proposalNo}` : "Create Commercial Proposal"}
                                </h3>
                                <p className="text-xs text-slate-300 mt-0.5">Formal quotation record sent to customer</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Proposal / Quote Title *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Turnkey Robotic Automation Line"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Client / Company Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Tata Motors Ltd"
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
                                    <input
                                        type="text"
                                        value={formData.contactPerson}
                                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Sent">Sent</option>
                                        <option value="Under Review">Under Review</option>
                                        <option value="Accepted">Accepted</option>
                                        <option value="Declined">Declined</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Valid Until</label>
                                    <input
                                        type="date"
                                        value={formData.validUntil}
                                        onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                            </div>

                            {/* Line Items (Compliant with Item Name & Technical Description standard) */}
                            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className="font-extrabold text-slate-800 dark:text-slate-200">Quotation Line Items (Rule 1 Compliant)</span>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold rounded-lg text-[11px] flex items-center gap-1"
                                    >
                                        <Plus size={12} /> Add Item
                                    </button>
                                </div>

                                {formData.items.map((it, idx) => (
                                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Item Name *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Product / Equipment Name"
                                                    value={it.name}
                                                    onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Technical Description</label>
                                                <input
                                                    type="text"
                                                    placeholder="Specs, capacity, material grades..."
                                                    value={it.description || ""}
                                                    onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl italic"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 items-center">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Qty</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={it.quantity}
                                                    onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Unit Price (₹)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={it.unitPrice}
                                                    onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value))}
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">GST %</label>
                                                <select
                                                    value={it.taxRate}
                                                    onChange={(e) => handleItemChange(idx, "taxRate", Number(e.target.value))}
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                                                >
                                                    <option value="0">0%</option>
                                                    <option value="5">5%</option>
                                                    <option value="12">12%</option>
                                                    <option value="18">18%</option>
                                                    <option value="28">28%</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between pt-4">
                                                <strong className="font-mono text-xs">₹{it.total.toLocaleString()}</strong>
                                                {formData.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="text-rose-500 hover:text-rose-700"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Summary Box */}
                            <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-1 font-mono text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Subtotal:</span>
                                    <span>₹{subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Estimated GST:</span>
                                    <span>₹{taxTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-base font-extrabold text-emerald-400 pt-1 border-t border-slate-800">
                                    <span>Total Amount:</span>
                                    <span>₹{grandTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notes & Commercial Terms</label>
                                <textarea
                                    rows={2}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Payment terms, delivery schedules, validity..."
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                                >
                                    {submitting ? "Saving..." : editingProposal ? "Update Proposal" : "Create Proposal"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
