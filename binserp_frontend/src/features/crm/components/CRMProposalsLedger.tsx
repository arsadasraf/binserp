"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
    Plus, Search, Filter, RefreshCw, FileText, CheckCircle2, Clock, 
    XCircle, Send, Edit2, Trash2, X, Check, IndianRupee, ExternalLink, Calendar,
    History, ArrowRight, AlertTriangle, ShieldAlert, Receipt, MessageCircle, Copy,
    ChevronDown, ChevronUp, Layers, CheckSquare
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface ProposalItem {
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
    proposalNo: string;
    title: string;
    items: ProposalItem[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    changeNotes?: string;
    status?: string;
    savedByName?: string;
    savedAt?: string;
}

interface Proposal {
    _id: string;
    proposalNo: string;
    revisionNumber?: number;
    title: string;
    customerName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    deal?: any;
    items?: ProposalItem[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
    status: "Draft" | "Sent" | "Under Review" | "Accepted" | "Declined" | "Converted to PI";
    convertedToPI?: string;
    convertedToPINo?: string;
    convertedAt?: string;
    revisionHistory?: RevisionHistoryItem[];
    sentDate?: string;
    validUntil?: string;
    notes?: string;
    terms?: string;
    createdByName?: string;
    createdAt?: string;
}

interface MasterProductOption {
    id: string;
    source: "FGItem" | "CRMMaster";
    name: string;
    code?: string;
    description: string;
    uom: string;
    hsnCode: string;
    proposalPrice: number;
    leastPrice: number;
    taxRate: number;
}

export default function CRMProposalsLedger() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    // Master Products for auto-population
    const [masterProducts, setMasterProducts] = useState<MasterProductOption[]>([]);
    const [loadingMasters, setLoadingMasters] = useState(false);

    // Create / Edit Proposal Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Revision Modal State
    const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
    const [revisionTarget, setRevisionTarget] = useState<Proposal | null>(null);
    const [revisionChangeNotes, setRevisionChangeNotes] = useState("");

    // Revision History Viewer Drawer
    const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
    const [historyProposal, setHistoryProposal] = useState<Proposal | null>(null);

    // Convert to PI Modal State
    const [isConvertToPIOpen, setIsConvertToPIOpen] = useState(false);
    const [piTargetProposal, setPiTargetProposal] = useState<Proposal | null>(null);
    const [piAdvanceRequired, setPiAdvanceRequired] = useState(0);
    const [piPaymentTerms, setPiPaymentTerms] = useState("30% Advance, 70% before Dispatch");
    const [convertingPI, setConvertingPI] = useState(false);

    // Form Data
    const [formData, setFormData] = useState<{
        proposalNo: string;
        title: string;
        customerName: string;
        contactPerson: string;
        email: string;
        phone: string;
        status: Proposal["status"];
        validUntil: string;
        notes: string;
        terms: string;
        items: ProposalItem[];
    }>({
        proposalNo: "",
        title: "",
        customerName: "",
        contactPerson: "",
        email: "",
        phone: "",
        status: "Sent" as Proposal["status"],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        notes: "",
        terms: "1. Validity: 30 days from date of issue.\n2. Taxes: GST as applicable.\n3. Delivery: 2-3 weeks from receipt of confirmed purchase order / advance.",
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

    // Fetch Master Products (both Store FGItem and CRMMaster products)
    const fetchMasterProducts = async () => {
        setLoadingMasters(true);
        try {
            const token = localStorage.getItem("token");
            const [fgRes, crmMasterRes] = await Promise.all([
                apiGet("/api/store/fg-item", token).catch(() => []),
                apiGet("/api/crm/masters/product", token).catch(() => ({ data: [] }))
            ]);

            const options: MasterProductOption[] = [];

            // 1. Finished Goods from Store
            const fgList = Array.isArray(fgRes) ? fgRes : (fgRes?.data || []);
            fgList.forEach((fg: any) => {
                options.push({
                    id: fg._id,
                    source: "FGItem",
                    name: fg.name || fg.code || "FG Item",
                    code: fg.code || "",
                    description: fg.descriptions || fg.description || fg.specification || "",
                    uom: fg.unit || "NOS",
                    hsnCode: fg.hsnCode || "",
                    proposalPrice: Number(fg.sellingPrice || fg.proposalPrice || 0),
                    leastPrice: Number(fg.leastPrice || fg.minSellingPrice || (fg.sellingPrice ? fg.sellingPrice * 0.85 : 0)),
                    taxRate: Number(fg.taxRate || 18)
                });
            });

            // 2. CRM Master Products
            const crmList = Array.isArray(crmMasterRes?.data) ? crmMasterRes.data : (Array.isArray(crmMasterRes) ? crmMasterRes : []);
            crmList.forEach((cp: any) => {
                const pricing = cp.pricing?.intraState || {};
                options.push({
                    id: cp._id,
                    source: "CRMMaster",
                    name: cp.name,
                    code: cp.code || "",
                    description: cp.description || "",
                    uom: cp.unit || "NOS",
                    hsnCode: cp.hsnSacCode || "",
                    proposalPrice: Number(pricing.sellingPrice || cp.unitPrice || 0),
                    leastPrice: Number(pricing.negotiationPrice || (pricing.sellingPrice ? pricing.sellingPrice * 0.85 : 0)),
                    taxRate: Number(cp.taxRate || 18)
                });
            });

            setMasterProducts(options);
        } catch (err) {
            console.warn("Could not load master products for proposals", err);
        } finally {
            setLoadingMasters(false);
        }
    };

    useEffect(() => {
        fetchProposals();
        fetchMasterProducts();
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
            terms: "1. Validity: 30 days from date of issue.\n2. Taxes: GST as applicable.\n3. Delivery: 2-3 weeks from receipt of confirmed purchase order / advance.",
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
            terms: prop.terms || "",
            items: prop.items && prop.items.length > 0 ? prop.items.map(it => ({
                productId: it.productId || "",
                productSource: it.productSource || "Custom",
                name: it.name,
                description: it.description || "",
                uom: it.uom || "NOS",
                hsnCode: it.hsnCode || "",
                quantity: it.quantity || 1,
                proposalPrice: it.proposalPrice || it.unitPrice || 0,
                leastPrice: it.leastPrice || 0,
                unitPrice: it.unitPrice || 0,
                discountPercent: it.discountPercent || 0,
                taxRate: it.taxRate || 18,
                total: it.total || (it.quantity * it.unitPrice),
                isBelowFloorPrice: it.leastPrice ? it.unitPrice < it.leastPrice : false
            })) : [
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
                    unitPrice: prop.totalAmount || 0, 
                    discountPercent: 0,
                    taxRate: 18, 
                    total: prop.totalAmount || 0,
                    isBelowFloorPrice: false
                }
            ]
        });
        setIsModalOpen(true);
    };

    // Select Product from Master
    const handleSelectProductMaster = (index: number, masterId: string) => {
        const found = masterProducts.find(m => m.id === masterId);
        if (!found) return;

        setFormData(prev => {
            const nextItems = [...prev.items];
            const currentQty = Number(nextItems[index].quantity || 1);
            const unitPrice = found.proposalPrice || 0;
            const total = currentQty * unitPrice;

            nextItems[index] = {
                ...nextItems[index],
                productId: found.id,
                productSource: found.source,
                name: found.name,
                description: found.description,
                uom: found.uom,
                hsnCode: found.hsnCode,
                proposalPrice: found.proposalPrice,
                leastPrice: found.leastPrice,
                unitPrice,
                discountPercent: 0,
                taxRate: found.taxRate || 18,
                total,
                isBelowFloorPrice: found.leastPrice > 0 ? unitPrice < found.leastPrice : false
            };
            return { ...prev, items: nextItems };
        });
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
            const leastPrice = Number(item.leastPrice || 0);

            const effectivePrice = discount > 0 ? unitPrice * (1 - discount / 100) : unitPrice;
            item.total = Math.round(qty * effectivePrice * 100) / 100;
            item.isBelowFloorPrice = leastPrice > 0 ? unitPrice < leastPrice : false;

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

    const hasFloorPriceWarning = useMemo(() => {
        return formData.items.some(it => it.isBelowFloorPrice);
    }, [formData.items]);

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
        } catch (err: any) {
            console.error("Failed to save proposal", err);
            alert(err?.message || "Failed to save proposal");
        } finally {
            setSubmitting(false);
        }
    };

    // Open Revision Creator Modal
    const handleOpenRevision = (prop: Proposal) => {
        setRevisionTarget(prop);
        setRevisionChangeNotes("");
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
            terms: prop.terms || "",
            items: prop.items && prop.items.length > 0 ? prop.items.map(it => ({ ...it })) : []
        });
        setIsRevisionModalOpen(true);
    };

    const handleSaveRevision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!revisionTarget) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            await apiPost(`/api/crm/proposals/${revisionTarget._id}/revision`, {
                changeNotes: revisionChangeNotes,
                items: formData.items,
                subtotal,
                taxAmount: taxTotal,
                totalAmount: grandTotal,
                terms: formData.terms,
                notes: formData.notes
            }, token);

            setIsRevisionModalOpen(false);
            fetchProposals();
        } catch (err: any) {
            alert(err?.message || "Failed to create revision");
        } finally {
            setSubmitting(false);
        }
    };

    // Convert Proposal to Proforma Invoice
    const handleOpenConvertToPI = (prop: Proposal) => {
        setPiTargetProposal(prop);
        setPiAdvanceRequired(Math.round(Number(prop.totalAmount || 0) * 0.3)); // default 30% advance
        setPiPaymentTerms("30% Advance, 70% before Dispatch");
        setIsConvertToPIOpen(true);
    };

    const handleConfirmConvertToPI = async () => {
        if (!piTargetProposal) return;
        setConvertingPI(true);
        try {
            const token = localStorage.getItem("token");
            await apiPost(`/api/crm/proposals/${piTargetProposal._id}/convert-to-pi`, {
                advanceRequired: piAdvanceRequired,
                paymentTerms: piPaymentTerms
            }, token);

            setIsConvertToPIOpen(false);
            fetchProposals();
        } catch (err: any) {
            alert(err?.message || "Failed to convert proposal to PI");
        } finally {
            setConvertingPI(false);
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

    // 1-Click WhatsApp Quick Share
    const handleWhatsAppShare = (prop: Proposal) => {
        const phone = (prop.phone || "").replace(/[^0-9]/g, "");
        const msg = `Dear ${prop.customerName || "Customer"}, your commercial quotation *${prop.proposalNo} (Rev ${prop.revisionNumber || 0})* for *₹${Number(prop.totalAmount || 0).toLocaleString()}* is ready.\n\nItems Quoted:\n${(prop.items || []).map(i => `• ${i.name} (${i.quantity} ${i.uom || "NOS"}) @ ₹${Number(i.unitPrice).toLocaleString()}`).join("\n")}\n\nValid till: ${prop.validUntil ? new Date(prop.validUntil).toLocaleDateString() : "30 days"}.\nPlease let us know if you have any questions!`;
        window.open(`https://wa.me/${phone.startsWith("91") ? phone : `91${phone}`}?text=${encodeURIComponent(msg)}`, "_blank");
    };

    const getStatusBadge = (st: string) => {
        switch (st) {
            case "Converted to PI":
                return <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold rounded-lg text-[10px] border border-purple-200">Converted to PI</span>;
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
                            placeholder="Search proposal, client, item..."
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
                        <option value="Converted to PI">Converted to PI</option>
                        <option value="Declined">Declined</option>
                    </select>

                    <button
                        onClick={fetchProposals}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <button
                    onClick={handleOpenCreate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
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
                                <th className="px-5 py-3.5">Proposal # & Rev</th>
                                <th className="px-5 py-3.5">Client / Customer</th>
                                <th className="px-5 py-3.5">Items Quoted</th>
                                <th className="px-5 py-3.5">Total Value (INR)</th>
                                <th className="px-5 py-3.5">Status</th>
                                <th className="px-5 py-3.5">Next Step</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                                        Loading proposals & commercial quotes...
                                    </td>
                                </tr>
                            ) : proposals.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                        No proposals found. Click &quot;Create Proposal&quot; to quote items from Product Master.
                                    </td>
                                </tr>
                            ) : (
                                proposals.map((p) => {
                                    const revCount = p.revisionNumber || 0;
                                    const hasRevisions = (p.revisionHistory || []).length > 0;
                                    return (
                                        <tr key={p._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                            {/* Proposal # + Revision Badge */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <strong className="text-slate-900 dark:text-white font-mono text-sm">{p.proposalNo}</strong>
                                                    <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-extrabold ${revCount > 0 ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                                                        Rev {revCount}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-slate-500 truncate block max-w-xs mt-0.5">{p.title}</span>
                                                {hasRevisions && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setHistoryProposal(p);
                                                            setIsHistoryDrawerOpen(true);
                                                        }}
                                                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1 font-bold cursor-pointer"
                                                    >
                                                        <History size={11} /> View Revision Timeline ({p.revisionHistory?.length} previous)
                                                    </button>
                                                )}
                                            </td>

                                            {/* Client / Customer */}
                                            <td className="px-5 py-4">
                                                <strong className="text-slate-900 dark:text-white block">{p.customerName || "N/A"}</strong>
                                                <div className="text-[11px] text-slate-500">
                                                    {p.contactPerson && <span>{p.contactPerson} • </span>}
                                                    {p.phone && <span>{p.phone}</span>}
                                                </div>
                                            </td>

                                            {/* Items Quoted */}
                                            <td className="px-5 py-4">
                                                <div className="space-y-1">
                                                    {(p.items || []).slice(0, 2).map((it, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200">{it.name}</span>
                                                            <span className="text-slate-400">({it.quantity} {it.uom || "NOS"})</span>
                                                            {it.isBelowFloorPrice && (
                                                                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-700 text-[9px] rounded font-bold" title="Below floor price">Floor</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {(p.items || []).length > 2 && (
                                                        <div className="text-[10px] text-slate-400">+{(p.items || []).length - 2} more items</div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Total Value */}
                                            <td className="px-5 py-4">
                                                <strong className="text-slate-900 dark:text-white font-mono text-sm block">
                                                    ₹{Number(p.totalAmount || 0).toLocaleString()}
                                                </strong>
                                                <span className="text-[10px] text-slate-400 block">
                                                    GST: ₹{Number(p.taxAmount || 0).toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-5 py-4">
                                                {getStatusBadge(p.status)}
                                                {p.convertedToPINo && (
                                                    <span className="text-[10px] text-purple-600 block mt-1 font-mono font-bold">
                                                        → {p.convertedToPINo}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Next Step / 1-Click Workflow Conversion */}
                                            <td className="px-5 py-4">
                                                {p.status !== "Converted to PI" ? (
                                                    <button
                                                        onClick={() => handleOpenConvertToPI(p)}
                                                        className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/50 rounded-xl text-[11px] font-bold border border-purple-200 dark:border-purple-800 flex items-center gap-1 cursor-pointer transition-colors"
                                                        title="Convert to Proforma Invoice"
                                                    >
                                                        <Receipt size={12} />
                                                        <span>Convert to PI</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                                        <CheckCircle2 size={12} /> PI Created
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action Buttons */}
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* WhatsApp Quick Share */}
                                                    {p.phone && (
                                                        <button
                                                            onClick={() => handleWhatsAppShare(p)}
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                                                            title="Share via WhatsApp"
                                                        >
                                                            <MessageCircle size={14} />
                                                        </button>
                                                    )}

                                                    {/* New Revision */}
                                                    <button
                                                        onClick={() => handleOpenRevision(p)}
                                                        className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                                                        title="Create New Revision (Rev+)"
                                                    >
                                                        <History size={14} />
                                                    </button>

                                                    {/* Edit */}
                                                    <button
                                                        onClick={() => handleOpenEdit(p)}
                                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                                                        title="Edit Quote"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => handleDelete(p._id, p.proposalNo)}
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

            {/* CREATE / EDIT PROPOSAL MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col">
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center border-b border-slate-700 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <FileText size={18} className="text-blue-400" />
                                    {editingProposal ? `Edit Proposal: ${editingProposal.proposalNo} (Rev ${editingProposal.revisionNumber || 0})` : "Create Commercial Quotation"}
                                </h3>
                                <p className="text-xs text-slate-300 mt-0.5">Line items auto-fetch from Product Master with floor pricing validation</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
                            {/* Header Form Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                                <div className="sm:col-span-2">
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Proposal Title / Subject *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Quotation for CNC Machined Components & Tooling"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Proposal Number</label>
                                    <input
                                        type="text"
                                        placeholder="Auto-generated if blank"
                                        value={formData.proposalNo}
                                        onChange={(e) => setFormData({ ...formData, proposalNo: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as Proposal["status"] })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Sent">Sent</option>
                                        <option value="Under Review">Under Review</option>
                                        <option value="Accepted">Accepted</option>
                                        <option value="Declined">Declined</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer / Company *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Customer or Company name"
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
                                    <input
                                        type="text"
                                        placeholder="Key decision maker"
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
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Valid Until Date</label>
                                    <input
                                        type="date"
                                        value={formData.validUntil}
                                        onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                            </div>

                            {/* LINE ITEMS SECTION */}
                            <div className="pt-2">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <Layers size={15} className="text-blue-500" />
                                        Quotation Line Items
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus size={13} /> Add Item Row
                                    </button>
                                </div>

                                {hasFloorPriceWarning && (
                                    <div className="p-3 mb-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                        <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                                        <span>One or more items are priced below the minimum floor price recorded in Product Master. Review before finalizing.</span>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {formData.items.map((item, index) => (
                                        <div key={index} className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                                            <div className="grid grid-cols-12 gap-2 items-center">
                                                {/* Auto-fill from Product Master */}
                                                <div className="col-span-12 sm:col-span-4">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Product Master Auto-Fill</label>
                                                    <select
                                                        onChange={(e) => handleSelectProductMaster(index, e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold outline-none"
                                                    >
                                                        <option value="">-- Choose from Master Catalog --</option>
                                                        {masterProducts.map(mp => (
                                                            <option key={mp.id} value={mp.id}>
                                                                {mp.name} {mp.code ? `(${mp.code})` : ""} — List ₹{mp.proposalPrice}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Item Name (Editable) */}
                                                <div className="col-span-12 sm:col-span-5">
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

                                                {/* UOM */}
                                                <div className="col-span-6 sm:col-span-2">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">UOM</label>
                                                    <input
                                                        type="text"
                                                        placeholder="NOS / SET"
                                                        value={item.uom || "NOS"}
                                                        onChange={(e) => handleItemChange(index, "uom", e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg uppercase outline-none"
                                                    />
                                                </div>

                                                {/* Delete Row */}
                                                <div className="col-span-6 sm:col-span-1 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(index)}
                                                        disabled={formData.items.length <= 1}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                                                        title="Remove Row"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>

                                                {/* Technical Description (Editable) */}
                                                <div className="col-span-12">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Technical Description & Specification</label>
                                                    <textarea
                                                        rows={1}
                                                        placeholder="Material grade, dimensions, tolerances, surface coating specifications..."
                                                        value={item.description}
                                                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none italic text-slate-600 dark:text-slate-300 resize-none"
                                                    />
                                                </div>

                                                {/* Numeric Pricing Breakdown Row */}
                                                <div className="col-span-4 sm:col-span-2">
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

                                                <div className="col-span-4 sm:col-span-2">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                                                        Unit Price (₹)
                                                        {item.leastPrice ? <span className="text-slate-400 font-normal"> [Min: ₹{item.leastPrice}]</span> : ""}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        required
                                                        value={item.unitPrice}
                                                        onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                                                        className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-lg font-mono outline-none ${item.isBelowFloorPrice ? "border-amber-500 text-amber-700 dark:text-amber-300" : "border-slate-300 dark:border-slate-600"}`}
                                                    />
                                                </div>

                                                <div className="col-span-4 sm:col-span-2">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Disc %</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="any"
                                                        value={item.discountPercent || 0}
                                                        onChange={(e) => handleItemChange(index, "discountPercent", e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-mono outline-none"
                                                    />
                                                </div>

                                                <div className="col-span-6 sm:col-span-3">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">GST Tax Rate</label>
                                                    <select
                                                        value={item.taxRate}
                                                        onChange={(e) => handleItemChange(index, "taxRate", Number(e.target.value))}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold outline-none"
                                                    >
                                                        <option value={0}>0% (Exempt)</option>
                                                        <option value={5}>5%</option>
                                                        <option value={12}>12%</option>
                                                        <option value={18}>18% (Standard)</option>
                                                        <option value={28}>28%</option>
                                                    </select>
                                                </div>

                                                <div className="col-span-6 sm:col-span-3 text-right">
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Row Total (Excl. Tax)</label>
                                                    <div className="font-mono font-black text-sm text-slate-900 dark:text-white py-1.5">
                                                        ₹{Number(item.total || 0).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>

                                            {item.isBelowFloorPrice && (
                                                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 pt-1 border-t border-amber-200/50">
                                                    <AlertTriangle size={12} />
                                                    <span>Floor Price Warning: Quoting ₹{item.unitPrice} is below the recommended minimum floor rate of ₹{item.leastPrice}.</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Terms & Conditions */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Standard Commercial Terms</label>
                                    <textarea
                                        rows={3}
                                        value={formData.terms}
                                        onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Internal Notes & Remarks</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Internal notes, customer expectations, payment follow-up schedule..."
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                            </div>

                            {/* Commercial Summary Banner */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3">
                                <div className="space-y-0.5 text-xs text-slate-500">
                                    <div>Subtotal: <strong className="text-slate-700 dark:text-slate-300 font-mono">₹{subtotal.toLocaleString()}</strong></div>
                                    <div>GST Tax Amount: <strong className="text-slate-700 dark:text-slate-300 font-mono">₹{taxTotal.toLocaleString()}</strong></div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Grand Total Amount</span>
                                    <span className="text-xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
                                        ₹{grandTotal.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-2 flex justify-end gap-2">
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
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {submitting && <RefreshCw size={13} className="animate-spin" />}
                                    <span>{editingProposal ? "Update Proposal" : "Save & Issue Proposal"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CREATE REVISION MODAL */}
            {isRevisionModalOpen && revisionTarget && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-5 bg-gradient-to-r from-purple-900 to-slate-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <History size={18} className="text-purple-400" />
                                    Create Revision: Rev {(revisionTarget.revisionNumber || 0) + 1}
                                </h3>
                                <p className="text-xs text-slate-300">Archives Rev {revisionTarget.revisionNumber || 0} and creates a new version</p>
                            </div>
                            <button onClick={() => setIsRevisionModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRevision} className="p-5 space-y-4 text-xs">
                            <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-2xl border border-purple-200 dark:border-purple-800/50 space-y-1">
                                <div className="font-bold text-purple-900 dark:text-purple-200">
                                    Quotation: {revisionTarget.proposalNo} (Active: Rev {revisionTarget.revisionNumber || 0})
                                </div>
                                <div className="text-[11px] text-purple-800 dark:text-purple-300">
                                    Current Value: ₹{Number(revisionTarget.totalAmount || 0).toLocaleString()} • Client: {revisionTarget.customerName}
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Revision Reason / Change Notes *
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="e.g. Revised prices per discussion in client meeting on 19th Oct; added 5% volume discount."
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

            {/* REVISION HISTORY VIEWER DRAWER */}
            {isHistoryDrawerOpen && historyProposal && (
                <div className="fixed inset-0 z-[220] flex items-center justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-xl h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <History size={18} className="text-purple-400" />
                                    Revision Audit Trail
                                </h3>
                                <p className="text-xs text-slate-300">{historyProposal.proposalNo} — {historyProposal.title}</p>
                            </div>
                            <button onClick={() => setIsHistoryDrawerOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
                            {/* Current Live Revision Pill */}
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="px-2 py-0.5 bg-emerald-600 text-white font-mono text-[10px] font-extrabold rounded-md">
                                        Current: Rev {historyProposal.revisionNumber || 0}
                                    </span>
                                    <strong className="text-sm font-mono text-emerald-700 dark:text-emerald-300">
                                        ₹{Number(historyProposal.totalAmount || 0).toLocaleString()}
                                    </strong>
                                </div>
                                <div className="text-[11px] text-emerald-800 dark:text-emerald-200">
                                    Status: {historyProposal.status} • Items Quoted: {(historyProposal.items || []).length}
                                </div>
                            </div>

                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Previous Archived Versions</h4>

                            {(!historyProposal.revisionHistory || historyProposal.revisionHistory.length === 0) ? (
                                <div className="text-slate-400 text-center py-8">No previous revisions recorded.</div>
                            ) : (
                                historyProposal.revisionHistory.map((rev, idx) => (
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

                                        <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                                            {(rev.items || []).map((it: any, iIdx: number) => (
                                                <div key={iIdx} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                                                    <span>{it.name} ({it.quantity} {it.uom || "NOS"})</span>
                                                    <span className="font-mono">₹{Number(it.total || 0).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CONVERT TO PROFORMA INVOICE MODAL */}
            {isConvertToPIOpen && piTargetProposal && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-5 bg-gradient-to-r from-purple-800 to-indigo-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <Receipt size={18} className="text-purple-300" />
                                    Convert Quote to Proforma Invoice
                                </h3>
                                <p className="text-xs text-purple-200">Automatically creates formal PI from {piTargetProposal.proposalNo}</p>
                            </div>
                            <button onClick={() => setIsConvertToPIOpen(false)} className="w-8 h-8 rounded-full bg-purple-950 hover:bg-purple-900 flex items-center justify-center text-purple-200 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 text-xs">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Customer:</span>
                                    <strong className="text-slate-900 dark:text-white">{piTargetProposal.customerName}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Quotation Total:</span>
                                    <strong className="text-purple-600 dark:text-purple-400 font-mono text-sm">₹{Number(piTargetProposal.totalAmount || 0).toLocaleString()}</strong>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Advance Amount Required (₹)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={piAdvanceRequired}
                                    onChange={(e) => setPiAdvanceRequired(Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm font-bold outline-none"
                                />
                                <span className="text-[10px] text-slate-400 mt-1 block">Usually 30% to 50% advance before manufacturing dispatch.</span>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Payment Terms
                                </label>
                                <input
                                    type="text"
                                    value={piPaymentTerms}
                                    onChange={(e) => setPiPaymentTerms(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsConvertToPIOpen(false)}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmConvertToPI}
                                    disabled={convertingPI}
                                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {convertingPI && <RefreshCw size={13} className="animate-spin" />}
                                    <span>Confirm & Generate PI</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
