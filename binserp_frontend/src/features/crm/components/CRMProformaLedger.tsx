"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
    Plus, Search, Filter, RefreshCw, Receipt, CheckCircle2, Clock, 
    XCircle, Send, Edit2, Trash2, X, Check, IndianRupee, ExternalLink, Calendar,
    History, ArrowRight, AlertTriangle, MessageCircle, FileText, CheckSquare, Layers
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface PIItem {
    productId?: string;
    productSource?: "FGItem" | "CRMMaster" | "Custom";
    name: string;
    description?: string;
    uom?: string;
    hsnCode?: string;
    quantity: number;
    proposalPrice?: number;
    leastPrice?: number;
    unitPrice: number;
    discountPercent?: number;
    taxRate: number;
    total: number;
    isBelowFloorPrice?: boolean;
}

interface RevisionHistoryItem {
    revisionNumber: number;
    piNumber: string;
    title: string;
    items: PIItem[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    advanceRequired?: number;
    changeNotes?: string;
    status?: string;
    savedByName?: string;
    savedAt?: string;
}

interface ProformaInvoice {
    _id: string;
    piNumber: string;
    revisionNumber?: number;
    title: string;
    quotation?: any;
    quotationNo?: string;
    deal?: any;
    customerName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    items?: PIItem[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    advanceRequired?: number;
    advancePaid?: number;
    paymentTerms?: string;
    currency: string;
    status: "Draft" | "Sent" | "Advance Received" | "Confirmed" | "Converted to Invoice" | "Cancelled";
    convertedToInvoice?: any;
    convertedToInvoiceNo?: string;
    convertedAt?: string;
    revisionHistory?: RevisionHistoryItem[];
    issueDate?: string;
    validUntil?: string;
    notes?: string;
    terms?: string;
    createdByName?: string;
    createdAt?: string;
}

export default function CRMProformaLedger() {
    const [proformas, setProformas] = useState<ProformaInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPI, setEditingPI] = useState<ProformaInvoice | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Revision Modal State
    const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
    const [revisionTarget, setRevisionTarget] = useState<ProformaInvoice | null>(null);
    const [revisionChangeNotes, setRevisionChangeNotes] = useState("");

    // Revision History Viewer Drawer
    const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
    const [historyPI, setHistoryPI] = useState<ProformaInvoice | null>(null);

    // Convert to Tax Invoice Modal
    const [isConvertToInvOpen, setIsConvertToInvOpen] = useState(false);
    const [invTargetPI, setInvTargetPI] = useState<ProformaInvoice | null>(null);
    const [poReference, setPoReference] = useState("");
    const [convertingInvoice, setConvertingInvoice] = useState(false);

    // Form Data
    const [formData, setFormData] = useState<{
        piNumber: string;
        title: string;
        quotationNo: string;
        customerName: string;
        contactPerson: string;
        email: string;
        phone: string;
        status: ProformaInvoice["status"];
        advanceRequired: number;
        advancePaid: number;
        paymentTerms: string;
        validUntil: string;
        notes: string;
        terms: string;
        items: PIItem[];
    }>({
        piNumber: "",
        title: "",
        quotationNo: "",
        customerName: "",
        contactPerson: "",
        email: "",
        phone: "",
        status: "Sent" as ProformaInvoice["status"],
        advanceRequired: 0,
        advancePaid: 0,
        paymentTerms: "30% Advance, 70% before Dispatch",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        notes: "",
        terms: "1. Advance payment confirms manufacturing schedule.\n2. Balance against dispatch.\n3. Taxes: GST as applicable.",
        items: [
            { 
                productId: "",
                productSource: "Custom",
                name: "", 
                description: "", 
                uom: "NOS",
                hsnCode: "",
                quantity: 1, 
                proposalPrice: 0,
                leastPrice: 0,
                unitPrice: 0, 
                discountPercent: 0,
                taxRate: 18, 
                total: 0,
                isBelowFloorPrice: false
            }
        ]
    });

    const fetchProformas = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            let url = `/api/crm/proforma-invoices?search=${encodeURIComponent(search)}`;
            if (statusFilter !== "All") url += `&status=${encodeURIComponent(statusFilter)}`;

            const res = await apiGet(url, token);
            setProformas(res.data || []);
        } catch (err) {
            console.error("Failed to load proforma invoices", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProformas();
    }, [statusFilter]);

    // KPI Aggregations
    const kpis = useMemo(() => {
        const totalValue = proformas.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
        const totalAdvanceReq = proformas.reduce((sum, p) => sum + (p.advanceRequired || 0), 0);
        const totalAdvancePaid = proformas.reduce((sum, p) => sum + (p.advancePaid || 0), 0);
        const convertedCount = proformas.filter(p => p.status === "Converted to Invoice").length;
        return { totalValue, totalAdvanceReq, totalAdvancePaid, convertedCount };
    }, [proformas]);

    const handleOpenCreate = () => {
        setEditingPI(null);
        setFormData({
            piNumber: "",
            title: "",
            quotationNo: "",
            customerName: "",
            contactPerson: "",
            email: "",
            phone: "",
            status: "Sent",
            advanceRequired: 0,
            advancePaid: 0,
            paymentTerms: "30% Advance, 70% before Dispatch",
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            notes: "",
            terms: "1. Advance payment confirms manufacturing schedule.\n2. Balance against dispatch.\n3. Taxes: GST as applicable.",
            items: [
                { 
                    productId: "",
                    productSource: "Custom",
                    name: "", 
                    description: "", 
                    uom: "NOS",
                    hsnCode: "",
                    quantity: 1, 
                    proposalPrice: 0,
                    leastPrice: 0,
                    unitPrice: 0, 
                    discountPercent: 0,
                    taxRate: 18, 
                    total: 0,
                    isBelowFloorPrice: false
                }
            ]
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (pi: ProformaInvoice) => {
        setEditingPI(pi);
        setFormData({
            piNumber: pi.piNumber,
            title: pi.title,
            quotationNo: pi.quotationNo || "",
            customerName: pi.customerName || "",
            contactPerson: pi.contactPerson || "",
            email: pi.email || "",
            phone: pi.phone || "",
            status: pi.status,
            advanceRequired: pi.advanceRequired || 0,
            advancePaid: pi.advancePaid || 0,
            paymentTerms: pi.paymentTerms || "",
            validUntil: pi.validUntil ? new Date(pi.validUntil).toISOString().slice(0, 10) : "",
            notes: pi.notes || "",
            terms: pi.terms || "",
            items: pi.items && pi.items.length > 0 ? pi.items.map(it => ({ ...it })) : []
        });
        setIsModalOpen(true);
    };

    const handleAddItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [
                ...prev.items, 
                { 
                    productId: "",
                    productSource: "Custom",
                    name: "", 
                    description: "", 
                    uom: "NOS",
                    hsnCode: "",
                    quantity: 1, 
                    proposalPrice: 0,
                    leastPrice: 0,
                    unitPrice: 0, 
                    discountPercent: 0,
                    taxRate: 18, 
                    total: 0,
                    isBelowFloorPrice: false
                }
            ]
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
            const unitPrice = Number(item.unitPrice || 0);
            const discount = Number(item.discountPercent || 0);
            const effectivePrice = discount > 0 ? unitPrice * (1 - discount / 100) : unitPrice;
            item.total = Math.round(qty * effectivePrice * 100) / 100;
            nextItems[index] = item;
            return { ...prev, items: nextItems };
        });
    };

    const subtotal = useMemo(() => {
        return Math.round(formData.items.reduce((acc, it) => acc + (it.total || 0), 0) * 100) / 100;
    }, [formData.items]);

    const taxTotal = useMemo(() => {
        return Math.round(formData.items.reduce((acc, it) => acc + ((it.total || 0) * (it.taxRate || 18) / 100), 0) * 100) / 100;
    }, [formData.items]);

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

            if (editingPI) {
                await apiPut(`/api/crm/proforma-invoices/${editingPI._id}`, payload, token);
            } else {
                await apiPost("/api/crm/proforma-invoices", payload, token);
            }
            setIsModalOpen(false);
            fetchProformas();
        } catch (err: any) {
            alert(err?.message || "Failed to save proforma invoice");
        } finally {
            setSubmitting(false);
        }
    };

    // Revision Creator
    const handleOpenRevision = (pi: ProformaInvoice) => {
        setRevisionTarget(pi);
        setRevisionChangeNotes("");
        setFormData({
            piNumber: pi.piNumber,
            title: pi.title,
            quotationNo: pi.quotationNo || "",
            customerName: pi.customerName || "",
            contactPerson: pi.contactPerson || "",
            email: pi.email || "",
            phone: pi.phone || "",
            status: pi.status,
            advanceRequired: pi.advanceRequired || 0,
            advancePaid: pi.advancePaid || 0,
            paymentTerms: pi.paymentTerms || "",
            validUntil: pi.validUntil ? new Date(pi.validUntil).toISOString().slice(0, 10) : "",
            notes: pi.notes || "",
            terms: pi.terms || "",
            items: pi.items && pi.items.length > 0 ? pi.items.map(it => ({ ...it })) : []
        });
        setIsRevisionModalOpen(true);
    };

    const handleSaveRevision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!revisionTarget) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            await apiPost(`/api/crm/proforma-invoices/${revisionTarget._id}/revision`, {
                changeNotes: revisionChangeNotes,
                items: formData.items,
                subtotal,
                taxAmount: taxTotal,
                totalAmount: grandTotal,
                advanceRequired: formData.advanceRequired,
                terms: formData.terms,
                notes: formData.notes
            }, token);

            setIsRevisionModalOpen(false);
            fetchProformas();
        } catch (err: any) {
            alert(err?.message || "Failed to create PI revision");
        } finally {
            setSubmitting(false);
        }
    };

    // 1-Click Convert PI to Tax Invoice
    const handleOpenConvertToInvoice = (pi: ProformaInvoice) => {
        setInvTargetPI(pi);
        setPoReference(pi.quotationNo || "");
        setIsConvertToInvOpen(true);
    };

    const handleConfirmConvertToInvoice = async () => {
        if (!invTargetPI) return;
        setConvertingInvoice(true);
        try {
            const token = localStorage.getItem("token");
            const res = await apiPost(`/api/crm/proforma-invoices/${invTargetPI._id}/convert-to-invoice`, {
                poReference
            }, token);

            setIsConvertToInvOpen(false);
            fetchProformas();
            alert(`Tax Invoice generated successfully: ${res.data?.taxInvoice?.invoiceNumber || "INV-NEW"}`);
        } catch (err: any) {
            alert(err?.message || "Failed to convert PI to Tax Invoice");
        } finally {
            setConvertingInvoice(false);
        }
    };

    const handleDelete = async (id: string, piNo: string) => {
        if (!confirm(`Delete Proforma Invoice ${piNo}?`)) return;
        try {
            const token = localStorage.getItem("token");
            await apiDelete(`/api/crm/proforma-invoices/${id}`, token);
            fetchProformas();
        } catch (err) {
            console.error("Failed to delete PI", err);
        }
    };

    // WhatsApp Quick Share for PI
    const handleWhatsAppShare = (pi: ProformaInvoice) => {
        const phone = (pi.phone || "").replace(/[^0-9]/g, "");
        const msg = `Dear ${pi.customerName || "Customer"}, your Proforma Invoice *${pi.piNumber} (Rev ${pi.revisionNumber || 0})* for *₹${Number(pi.totalAmount || 0).toLocaleString()}* has been generated.\n\nAdvance Required: *₹${Number(pi.advanceRequired || 0).toLocaleString()}*\nPayment Terms: ${pi.paymentTerms || "Per agreement"}\n\nPlease transfer advance payment to commence production scheduling.\nThank you!`;
        window.open(`https://wa.me/${phone.startsWith("91") ? phone : `91${phone}`}?text=${encodeURIComponent(msg)}`, "_blank");
    };

    const getStatusBadge = (st: string) => {
        switch (st) {
            case "Converted to Invoice":
                return <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold rounded-lg text-[10px] border border-emerald-200">Converted to Tax Inv</span>;
            case "Advance Received":
                return <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg text-[10px] border border-indigo-200">Advance Received</span>;
            case "Confirmed":
                return <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold rounded-lg text-[10px] border border-blue-200">Confirmed</span>;
            case "Cancelled":
                return <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold rounded-lg text-[10px] border border-rose-200">Cancelled</span>;
            case "Sent":
                return <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold rounded-lg text-[10px] border border-purple-200">PI Sent</span>;
            default:
                return <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-lg text-[10px]">Draft</span>;
        }
    };

    return (
        <div className="space-y-4">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Total Proforma Value</span>
                    <strong className="text-xl font-extrabold font-mono text-purple-600 dark:text-purple-400 mt-1 block">
                        ₹{kpis.totalValue.toLocaleString()}
                    </strong>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">{proformas.length} Active Proforma Invoices</span>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Advance Required</span>
                    <strong className="text-xl font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
                        ₹{kpis.totalAdvanceReq.toLocaleString()}
                    </strong>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Target Booking Advances</span>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Advance Collected</span>
                    <strong className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                        ₹{kpis.totalAdvancePaid.toLocaleString()}
                    </strong>
                    <span className="text-[11px] text-emerald-600 font-bold mt-0.5 block">Verified Receipts</span>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Converted to Invoices</span>
                    <strong className="text-xl font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-1 block">
                        {kpis.convertedCount}
                    </strong>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Billed Tax Invoices</span>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search PI #, quotation, client..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchProformas()}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500/20"
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
                        <option value="Advance Received">Advance Received</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Converted to Invoice">Converted to Tax Inv</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>

                    <button
                        onClick={fetchProformas}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <button
                    onClick={handleOpenCreate}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                    <Plus size={15} />
                    <span>Create Proforma Invoice</span>
                </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-5 py-3.5">PI # & Rev</th>
                                <th className="px-5 py-3.5">Originating Quote</th>
                                <th className="px-5 py-3.5">Client / Customer</th>
                                <th className="px-5 py-3.5">Total & Advance</th>
                                <th className="px-5 py-3.5">Status</th>
                                <th className="px-5 py-3.5">Final Conversion</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-purple-500" />
                                        Loading proforma invoices...
                                    </td>
                                </tr>
                            ) : proformas.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                        No Proforma Invoices found. Convert from a Proposal or click &quot;Create Proforma Invoice&quot;.
                                    </td>
                                </tr>
                            ) : (
                                proformas.map((pi) => {
                                    const revCount = pi.revisionNumber || 0;
                                    const hasRevisions = (pi.revisionHistory || []).length > 0;
                                    return (
                                        <tr key={pi._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                            {/* PI Number & Revision */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <strong className="text-slate-900 dark:text-white font-mono text-sm">{pi.piNumber}</strong>
                                                    <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-extrabold ${revCount > 0 ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                                                        Rev {revCount}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-slate-500 truncate block max-w-xs mt-0.5">{pi.title}</span>
                                                {hasRevisions && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setHistoryPI(pi);
                                                            setIsHistoryDrawerOpen(true);
                                                        }}
                                                        className="text-[10px] text-purple-600 hover:underline flex items-center gap-1 mt-1 font-bold cursor-pointer"
                                                    >
                                                        <History size={11} /> View Revision Timeline ({pi.revisionHistory?.length} previous)
                                                    </button>
                                                )}
                                            </td>

                                            {/* Originating Quotation */}
                                            <td className="px-5 py-4">
                                                {pi.quotationNo ? (
                                                    <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg font-mono text-[11px] font-bold border border-blue-200">
                                                        {pi.quotationNo}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">Direct PI</span>
                                                )}
                                            </td>

                                            {/* Client / Customer */}
                                            <td className="px-5 py-4">
                                                <strong className="text-slate-900 dark:text-white block">{pi.customerName || "N/A"}</strong>
                                                <div className="text-[11px] text-slate-500">
                                                    {pi.contactPerson && <span>{pi.contactPerson} • </span>}
                                                    {pi.phone && <span>{pi.phone}</span>}
                                                </div>
                                            </td>

                                            {/* Total & Advance */}
                                            <td className="px-5 py-4">
                                                <strong className="text-slate-900 dark:text-white font-mono text-sm block">
                                                    ₹{Number(pi.totalAmount || 0).toLocaleString()}
                                                </strong>
                                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                                                    Advance Req: ₹{Number(pi.advanceRequired || 0).toLocaleString()}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-5 py-4">
                                                {getStatusBadge(pi.status)}
                                                {pi.convertedToInvoiceNo && (
                                                    <span className="text-[10px] text-emerald-600 block mt-1 font-mono font-bold">
                                                        Tax Inv: {pi.convertedToInvoiceNo}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Final Conversion to Tax Invoice */}
                                            <td className="px-5 py-4">
                                                {pi.status !== "Converted to Invoice" ? (
                                                    <button
                                                        onClick={() => handleOpenConvertToInvoice(pi)}
                                                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 rounded-xl text-[11px] font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 cursor-pointer transition-colors"
                                                        title="Convert to Tax Invoice"
                                                    >
                                                        <FileText size={12} />
                                                        <span>Generate Tax Inv</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                                        <CheckCircle2 size={12} /> Billed Tax Invoice
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* WhatsApp Quick Share */}
                                                    {pi.phone && (
                                                        <button
                                                            onClick={() => handleWhatsAppShare(pi)}
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                                                            title="Send PI via WhatsApp"
                                                        >
                                                            <MessageCircle size={14} />
                                                        </button>
                                                    )}

                                                    {/* New PI Revision */}
                                                    <button
                                                        onClick={() => handleOpenRevision(pi)}
                                                        className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                                                        title="Create New Revision (Rev+)"
                                                    >
                                                        <History size={14} />
                                                    </button>

                                                    {/* Edit */}
                                                    <button
                                                        onClick={() => handleOpenEdit(pi)}
                                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                                                        title="Edit PI"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => handleDelete(pi._id, pi.piNumber)}
                                                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE / EDIT PI MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col">
                        <div className="p-5 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex justify-between items-center border-b border-purple-800 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <Receipt size={18} className="text-purple-300" />
                                    {editingPI ? `Edit Proforma Invoice: ${editingPI.piNumber}` : "Create Proforma Invoice (PI)"}
                                </h3>
                                <p className="text-xs text-purple-200 mt-0.5">Formal commercial pre-billing document with advance payment terms</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-purple-950 hover:bg-purple-900 flex items-center justify-center text-purple-200 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                                <div className="sm:col-span-2">
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">PI Subject / Title *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Proforma Invoice for Assembly Workstation Batch #1"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">PI Number</label>
                                    <input
                                        type="text"
                                        placeholder="Auto-generated if blank"
                                        value={formData.piNumber}
                                        onChange={(e) => setFormData({ ...formData, piNumber: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Quotation Reference #</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. PROP-2026-0001"
                                        value={formData.quotationNo}
                                        onChange={(e) => setFormData({ ...formData, quotationNo: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer / Company *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Customer name"
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
                                    <input
                                        type="text"
                                        placeholder="Contact person"
                                        value={formData.contactPerson}
                                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone / WhatsApp</label>
                                    <input
                                        type="text"
                                        placeholder="+91 9876543210"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as ProformaInvoice["status"] })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Sent">Sent</option>
                                        <option value="Advance Received">Advance Received</option>
                                        <option value="Confirmed">Confirmed</option>
                                        <option value="Converted to Invoice">Converted to Tax Inv</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            {/* Milestone Terms */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-purple-50/60 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-800/50">
                                <div>
                                    <label className="block font-bold text-purple-950 dark:text-purple-300 mb-1">Advance Amount Required (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={formData.advanceRequired}
                                        onChange={(e) => setFormData({ ...formData, advanceRequired: Number(e.target.value) })}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl font-mono text-sm font-bold outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-purple-950 dark:text-purple-300 mb-1">Milestone Payment Terms</label>
                                    <input
                                        type="text"
                                        value={formData.paymentTerms}
                                        onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl font-semibold outline-none"
                                    />
                                </div>
                            </div>

                            {/* Line Items */}
                            <div className="pt-2">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <Layers size={15} className="text-purple-500" />
                                        Line Items
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus size={13} /> Add Item
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {formData.items.map((item, index) => (
                                        <div key={index} className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                                            <div className="grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-12 sm:col-span-6">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Item Name *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="Item Name"
                                                        value={item.name}
                                                        onChange={(e) => handleItemChange(index, "name", e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-bold outline-none"
                                                    />
                                                </div>

                                                <div className="col-span-6 sm:col-span-3">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">UOM</label>
                                                    <input
                                                        type="text"
                                                        placeholder="NOS / SET"
                                                        value={item.uom || "NOS"}
                                                        onChange={(e) => handleItemChange(index, "uom", e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg uppercase outline-none"
                                                    />
                                                </div>

                                                <div className="col-span-6 sm:col-span-3 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(index)}
                                                        disabled={formData.items.length <= 1}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>

                                                <div className="col-span-12">
                                                    <textarea
                                                        rows={1}
                                                        placeholder="Technical description & specs..."
                                                        value={item.description}
                                                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg italic outline-none resize-none"
                                                    />
                                                </div>

                                                <div className="col-span-4 sm:col-span-3">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Qty</label>
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="any"
                                                        required
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-mono outline-none"
                                                    />
                                                </div>

                                                <div className="col-span-4 sm:col-span-3">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Rate (₹)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        required
                                                        value={item.unitPrice}
                                                        onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-mono outline-none"
                                                    />
                                                </div>

                                                <div className="col-span-4 sm:col-span-3">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Tax Rate %</label>
                                                    <select
                                                        value={item.taxRate}
                                                        onChange={(e) => handleItemChange(index, "taxRate", Number(e.target.value))}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold outline-none"
                                                    >
                                                        <option value={0}>0%</option>
                                                        <option value={5}>5%</option>
                                                        <option value={12}>12%</option>
                                                        <option value={18}>18%</option>
                                                        <option value={28}>28%</option>
                                                    </select>
                                                </div>

                                                <div className="col-span-12 sm:col-span-3 text-right">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Total</label>
                                                    <div className="font-mono font-black text-sm text-slate-900 dark:text-white py-1.5">
                                                        ₹{Number(item.total || 0).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Summary Banner */}
                            <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-800 flex justify-between items-center">
                                <div className="space-y-0.5 text-xs text-purple-900 dark:text-purple-200">
                                    <div>Subtotal: ₹{subtotal.toLocaleString()}</div>
                                    <div>GST Tax: ₹{taxTotal.toLocaleString()}</div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-500 block">Total Proforma Value</span>
                                    <span className="text-xl font-extrabold font-mono text-purple-700 dark:text-purple-300">
                                        ₹{grandTotal.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {submitting && <RefreshCw size={13} className="animate-spin" />}
                                    <span>{editingPI ? "Update PI" : "Save & Issue PI"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* REVISION MODAL */}
            {isRevisionModalOpen && revisionTarget && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-5 bg-gradient-to-r from-purple-900 to-slate-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <History size={18} className="text-purple-400" />
                                    Create PI Revision: Rev {(revisionTarget.revisionNumber || 0) + 1}
                                </h3>
                                <p className="text-xs text-slate-300">Archives Rev {revisionTarget.revisionNumber || 0} and creates a new revision</p>
                            </div>
                            <button onClick={() => setIsRevisionModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRevision} className="p-5 space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Revision Reason / Change Notes *
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="e.g. Revised milestone payment terms to 50% advance per client agreement."
                                    value={revisionChangeNotes}
                                    onChange={(e) => setRevisionChangeNotes(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsRevisionModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {submitting && <RefreshCw size={13} className="animate-spin" />}
                                    <span>Archive & Issue Rev {(revisionTarget.revisionNumber || 0) + 1}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* REVISION AUDIT DRAWER */}
            {isHistoryDrawerOpen && historyPI && (
                <div className="fixed inset-0 z-[220] flex items-center justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-xl h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <History size={18} className="text-purple-400" />
                                    PI Revision Audit Trail
                                </h3>
                                <p className="text-xs text-slate-300">{historyPI.piNumber} — {historyPI.title}</p>
                            </div>
                            <button onClick={() => setIsHistoryDrawerOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
                            <div className="p-4 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="px-2 py-0.5 bg-purple-600 text-white font-mono text-[10px] font-extrabold rounded-md">
                                        Current: Rev {historyPI.revisionNumber || 0}
                                    </span>
                                    <strong className="text-sm font-mono text-purple-700 dark:text-purple-300">
                                        ₹{Number(historyPI.totalAmount || 0).toLocaleString()}
                                    </strong>
                                </div>
                                <div className="text-[11px] text-purple-800 dark:text-purple-200">
                                    Status: {historyPI.status} • Advance Req: ₹{Number(historyPI.advanceRequired || 0).toLocaleString()}
                                </div>
                            </div>

                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Previous Archived Versions</h4>

                            {(!historyPI.revisionHistory || historyPI.revisionHistory.length === 0) ? (
                                <div className="text-slate-400 text-center py-8">No previous revisions recorded.</div>
                            ) : (
                                historyPI.revisionHistory.map((rev, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[10px] font-extrabold rounded-md">
                                                Archived: Rev {rev.revisionNumber}
                                            </span>
                                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                ₹{Number(rev.totalAmount || 0).toLocaleString()}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                            &quot;{rev.changeNotes || "No change notes"}&quot;
                                        </p>

                                        <div className="flex justify-between text-[10px] text-slate-400">
                                            <span>Modified by: {rev.savedByName || "CRM User"}</span>
                                            <span>{rev.savedAt ? new Date(rev.savedAt).toLocaleString() : ""}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CONVERT TO TAX INVOICE MODAL */}
            {isConvertToInvOpen && invTargetPI && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-5 bg-gradient-to-r from-emerald-800 to-slate-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <FileText size={18} className="text-emerald-300" />
                                    Convert PI to Official Tax Invoice
                                </h3>
                                <p className="text-xs text-emerald-200">Generates official Tax Invoice in Sales & Store ledger</p>
                            </div>
                            <button onClick={() => setIsConvertToInvOpen(false)} className="w-8 h-8 rounded-full bg-emerald-950 hover:bg-emerald-900 flex items-center justify-center text-emerald-200 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 text-xs">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Proforma Invoice:</span>
                                    <strong className="text-slate-900 dark:text-white font-mono">{invTargetPI.piNumber} (Rev {invTargetPI.revisionNumber || 0})</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Customer:</span>
                                    <strong className="text-slate-900 dark:text-white">{invTargetPI.customerName}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Total Billed Amount:</span>
                                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">₹{Number(invTargetPI.totalAmount || 0).toLocaleString()}</strong>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Customer Purchase Order (PO) Reference #
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. PO/2026/OCT/042"
                                    value={poReference}
                                    onChange={(e) => setPoReference(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsConvertToInvOpen(false)}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmConvertToInvoice}
                                    disabled={convertingInvoice}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {convertingInvoice && <RefreshCw size={13} className="animate-spin" />}
                                    <span>Confirm & Generate Tax Invoice</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
