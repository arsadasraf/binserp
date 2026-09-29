"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, Search, RefreshCw, Wrench, ShieldCheck, AlertCircle, 
    CheckCircle2, Clock, Calendar, Box, Tag, Edit2, Trash2, X, Check,
    UserCheck, FileText, ChevronRight
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface InstalledItem {
    _id: string;
    customerName: string;
    productName: string;
    productDescription?: string;
    serialNumber: string;
    batchNumber?: string;
    deliveryDate?: string;
    invoiceNumber?: string;
    warrantyPeriodMonths: number;
    warrantyExpiryDate?: string;
    warrantyStatus: "Under Warranty" | "Out of Warranty" | "AMC Active";
    amcStartDate?: string;
    amcEndDate?: string;
    amcValue?: number;
    location?: string;
    notes?: string;
    createdByName?: string;
    createdAt?: string;
}

interface ServiceTicket {
    _id: string;
    ticketNo: string;
    customerName: string;
    productName?: string;
    serialNumber?: string;
    category: string;
    priority: "Low" | "Medium" | "High" | "Urgent";
    status: "Open" | "Assigned" | "In Progress" | "Resolved" | "Closed";
    issueDescription: string;
    technicianName?: string;
    resolutionNotes?: string;
    chargeable?: boolean;
    serviceCost?: number;
    createdByName?: string;
    createdAt?: string;
}

export default function AfterSalesServicesHub() {
    const [activeSection, setActiveSection] = useState<"installed" | "tickets">("installed");
    const [installedItems, setInstalledItems] = useState<InstalledItem[]>([]);
    const [tickets, setTickets] = useState<ServiceTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [warrantyFilter, setWarrantyFilter] = useState("All");
    const [ticketStatusFilter, setTicketStatusFilter] = useState("All");

    // Installed Base Modal State
    const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
    const [editingEquip, setEditingEquip] = useState<InstalledItem | null>(null);
    const [equipForm, setEquipForm] = useState({
        customerName: "",
        productName: "",
        productDescription: "",
        serialNumber: "",
        batchNumber: "",
        deliveryDate: new Date().toISOString().slice(0, 10),
        invoiceNumber: "",
        warrantyPeriodMonths: 12,
        warrantyExpiryDate: "",
        warrantyStatus: "Under Warranty" as InstalledItem["warrantyStatus"],
        amcStartDate: "",
        amcEndDate: "",
        amcValue: 0,
        location: "",
        notes: ""
    });

    // Ticket Modal State
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [editingTicket, setEditingTicket] = useState<ServiceTicket | null>(null);
    const [ticketForm, setTicketForm] = useState({
        customerName: "",
        productName: "",
        serialNumber: "",
        category: "Breakdown",
        priority: "Medium" as ServiceTicket["priority"],
        status: "Open" as ServiceTicket["status"],
        issueDescription: "",
        technicianName: "",
        resolutionNotes: "",
        chargeable: false,
        serviceCost: 0
    });

    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const [equipRes, ticketRes] = await Promise.all([
                apiGet(`/api/crm/installed-base?search=${encodeURIComponent(search)}&warrantyStatus=${warrantyFilter}`, token),
                apiGet(`/api/crm/service-tickets?search=${encodeURIComponent(search)}&status=${ticketStatusFilter}`, token)
            ]);
            setInstalledItems(equipRes.data || []);
            setTickets(ticketRes.data || []);
        } catch (err) {
            console.error("Failed to fetch after-sales data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [warrantyFilter, ticketStatusFilter]);

    // Installed Base Handlers
    const handleOpenCreateEquip = () => {
        setEditingEquip(null);
        setEquipForm({
            customerName: "",
            productName: "",
            productDescription: "",
            serialNumber: "",
            batchNumber: "",
            deliveryDate: new Date().toISOString().slice(0, 10),
            invoiceNumber: "",
            warrantyPeriodMonths: 12,
            warrantyExpiryDate: "",
            warrantyStatus: "Under Warranty",
            amcStartDate: "",
            amcEndDate: "",
            amcValue: 0,
            location: "",
            notes: ""
        });
        setIsEquipModalOpen(true);
    };

    const handleOpenEditEquip = (eq: InstalledItem) => {
        setEditingEquip(eq);
        setEquipForm({
            customerName: eq.customerName,
            productName: eq.productName,
            productDescription: eq.productDescription || "",
            serialNumber: eq.serialNumber,
            batchNumber: eq.batchNumber || "",
            deliveryDate: eq.deliveryDate ? new Date(eq.deliveryDate).toISOString().slice(0, 10) : "",
            invoiceNumber: eq.invoiceNumber || "",
            warrantyPeriodMonths: eq.warrantyPeriodMonths || 12,
            warrantyExpiryDate: eq.warrantyExpiryDate ? new Date(eq.warrantyExpiryDate).toISOString().slice(0, 10) : "",
            warrantyStatus: eq.warrantyStatus,
            amcStartDate: eq.amcStartDate ? new Date(eq.amcStartDate).toISOString().slice(0, 10) : "",
            amcEndDate: eq.amcEndDate ? new Date(eq.amcEndDate).toISOString().slice(0, 10) : "",
            amcValue: eq.amcValue || 0,
            location: eq.location || "",
            notes: eq.notes || ""
        });
        setIsEquipModalOpen(true);
    };

    const handleEquipSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            if (editingEquip) {
                await apiPut(`/api/crm/installed-base/${editingEquip._id}`, equipForm, token);
            } else {
                await apiPost("/api/crm/installed-base", equipForm, token);
            }
            setIsEquipModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert(err.message || "Failed to save equipment");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteEquip = async (id: string, sn: string) => {
        if (!confirm(`Delete equipment with serial ${sn}?`)) return;
        try {
            const token = localStorage.getItem("token");
            await apiDelete(`/api/crm/installed-base/${id}`, token);
            fetchData();
        } catch (err) {
            console.error("Failed to delete equipment", err);
        }
    };

    // Ticket Handlers
    const handleOpenCreateTicket = () => {
        setEditingTicket(null);
        setTicketForm({
            customerName: "",
            productName: "",
            serialNumber: "",
            category: "Breakdown",
            priority: "Medium",
            status: "Open",
            issueDescription: "",
            technicianName: "",
            resolutionNotes: "",
            chargeable: false,
            serviceCost: 0
        });
        setIsTicketModalOpen(true);
    };

    const handleOpenEditTicket = (t: ServiceTicket) => {
        setEditingTicket(t);
        setTicketForm({
            customerName: t.customerName,
            productName: t.productName || "",
            serialNumber: t.serialNumber || "",
            category: t.category,
            priority: t.priority,
            status: t.status,
            issueDescription: t.issueDescription,
            technicianName: t.technicianName || "",
            resolutionNotes: t.resolutionNotes || "",
            chargeable: Boolean(t.chargeable),
            serviceCost: t.serviceCost || 0
        });
        setIsTicketModalOpen(true);
    };

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            if (editingTicket) {
                await apiPut(`/api/crm/service-tickets/${editingTicket._id}`, ticketForm, token);
            } else {
                await apiPost("/api/crm/service-tickets", ticketForm, token);
            }
            setIsTicketModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert(err.message || "Failed to save service ticket");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteTicket = async (id: string, ticketNo: string) => {
        if (!confirm(`Delete service ticket ${ticketNo}?`)) return;
        try {
            const token = localStorage.getItem("token");
            await apiDelete(`/api/crm/service-tickets/${id}`, token);
            fetchData();
        } catch (err) {
            console.error("Failed to delete ticket", err);
        }
    };

    const underWarrantyCount = installedItems.filter(i => i.warrantyStatus === "Under Warranty").length;
    const activeAmcCount = installedItems.filter(i => i.warrantyStatus === "AMC Active").length;
    const openTicketsCount = tickets.filter(t => t.status === "Open" || t.status === "In Progress" || t.status === "Assigned").length;

    return (
        <div className="space-y-4">
            {/* Quick KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Installed Goods</span>
                    <strong className="text-xl font-extrabold block text-slate-900 dark:text-white mt-1 font-mono">{installedItems.length}</strong>
                    <span className="text-[10px] text-slate-500">Tracked in field</span>
                </div>
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">Under Warranty</span>
                    <strong className="text-xl font-extrabold block text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{underWarrantyCount}</strong>
                    <span className="text-[10px] text-slate-500">Free service eligibility</span>
                </div>
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Active AMC</span>
                    <strong className="text-xl font-extrabold block text-indigo-600 dark:text-indigo-400 mt-1 font-mono">{activeAmcCount}</strong>
                    <span className="text-[10px] text-slate-500">Maintenance contracts</span>
                </div>
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400">Open Tickets</span>
                    <strong className="text-xl font-extrabold block text-amber-600 dark:text-amber-400 mt-1 font-mono">{openTicketsCount}</strong>
                    <span className="text-[10px] text-slate-500">Service requests active</span>
                </div>
            </div>

            {/* Sub-Switch: Installed Base vs Tickets */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
                    <button
                        onClick={() => setActiveSection("installed")}
                        className={`px-4 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                            activeSection === "installed"
                                ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                        }`}
                    >
                        <Box size={14} />
                        <span>Installed Base ({installedItems.length})</span>
                    </button>
                    <button
                        onClick={() => setActiveSection("tickets")}
                        className={`px-4 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                            activeSection === "tickets"
                                ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                        }`}
                    >
                        <Wrench size={14} />
                        <span>Service Tickets ({tickets.length})</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>

                    {activeSection === "installed" ? (
                        <button
                            onClick={handleOpenCreateEquip}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                        >
                            <Plus size={14} />
                            <span>Register Sold Equipment</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleOpenCreateTicket}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                        >
                            <Plus size={14} />
                            <span>Log Support Ticket</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 1. INSTALLED BASE VIEW */}
            {activeSection === "installed" && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-3.5">Product & Technical Description</th>
                                    <th className="px-5 py-3.5">Serial # & Invoice</th>
                                    <th className="px-5 py-3.5">Customer / Client</th>
                                    <th className="px-5 py-3.5">Delivery Date</th>
                                    <th className="px-5 py-3.5">Warranty Status</th>
                                    <th className="px-5 py-3.5">Registered By</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                                            Loading installed equipment...
                                        </td>
                                    </tr>
                                ) : installedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                            No equipment registered yet. Click &quot;Register Sold Equipment&quot; when goods are delivered to a customer.
                                        </td>
                                    </tr>
                                ) : (
                                    installedItems.map((item) => (
                                        <tr key={item._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                            {/* Strict Rule 1: Item Name & Technical Description */}
                                            <td className="px-5 py-4">
                                                <strong className="text-slate-900 dark:text-white font-bold block">{item.productName}</strong>
                                                {item.productDescription && (
                                                    <span className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2 block">
                                                        {item.productDescription}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <strong className="text-slate-900 dark:text-white font-mono block">{item.serialNumber}</strong>
                                                {item.invoiceNumber && <span className="text-[10px] text-slate-500 font-mono">Inv: {item.invoiceNumber}</span>}
                                            </td>
                                            <td className="px-5 py-4">
                                                <strong className="text-slate-900 dark:text-white block">{item.customerName}</strong>
                                                {item.location && <span className="text-[10px] text-slate-400">{item.location}</span>}
                                            </td>
                                            <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                                                {item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : "—"}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                                    item.warrantyStatus === "Under Warranty"
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : item.warrantyStatus === "AMC Active"
                                                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                                }`}>
                                                    {item.warrantyStatus}
                                                </span>
                                                {item.warrantyExpiryDate && (
                                                    <span className="block text-[10px] text-slate-400 mt-1 font-mono">
                                                        Exp: {new Date(item.warrantyExpiryDate).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-slate-500 text-[11px]">
                                                <div>{item.createdByName || "CRM Team"}</div>
                                                <div className="text-[10px] text-slate-400">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEditEquip(item)}
                                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteEquip(item._id, item.serialNumber)}
                                                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
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
            )}

            {/* 2. SERVICE TICKETS VIEW */}
            {activeSection === "tickets" && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-3.5">Ticket # & Priority</th>
                                    <th className="px-5 py-3.5">Customer & Equipment</th>
                                    <th className="px-5 py-3.5">Category</th>
                                    <th className="px-5 py-3.5">Issue Description</th>
                                    <th className="px-5 py-3.5">Technician</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Reported Date</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                                            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-500" />
                                            Loading service tickets...
                                        </td>
                                    </tr>
                                ) : tickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                                            No active service tickets. Click &quot;Log Support Ticket&quot; to report an issue.
                                        </td>
                                    </tr>
                                ) : (
                                    tickets.map((t) => (
                                        <tr key={t._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-5 py-4">
                                                <strong className="text-slate-900 dark:text-white font-mono block">{t.ticketNo}</strong>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold mt-1 inline-block ${
                                                    t.priority === "Urgent" ? "bg-rose-100 text-rose-800" :
                                                    t.priority === "High" ? "bg-orange-100 text-orange-800" :
                                                    "bg-slate-100 text-slate-700"
                                                }`}>
                                                    {t.priority}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <strong className="text-slate-900 dark:text-white block">{t.customerName}</strong>
                                                {t.productName && <span className="text-[11px] text-slate-500">{t.productName} ({t.serialNumber || "—"})</span>}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{t.category}</span>
                                            </td>
                                            <td className="px-5 py-4 max-w-xs">
                                                <span className="line-clamp-2 text-slate-600 dark:text-slate-400">{t.issueDescription}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-slate-700 dark:text-slate-300">{t.technicianName || "Unassigned"}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                                    t.status === "Resolved" || t.status === "Closed"
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : t.status === "In Progress"
                                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                                }`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-slate-500 text-[11px]">
                                                {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ""}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEditTicket(t)}
                                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTicket(t._id, t.ticketNo)}
                                                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
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
            )}

            {/* REGISTER INSTALLED EQUIPMENT MODAL */}
            {isEquipModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center border-b border-slate-700 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <Box size={18} className="text-blue-400" />
                                    {editingEquip ? `Edit Equipment: ${editingEquip.serialNumber}` : "Register Sold Equipment (Installed Base)"}
                                </h3>
                                <p className="text-xs text-slate-300 mt-0.5">Track warranty and maintenance for delivered goods</p>
                            </div>
                            <button onClick={() => setIsEquipModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleEquipSubmit} className="p-6 space-y-3.5 overflow-y-auto text-xs flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer / Client Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Bharat Heavy Electricals"
                                        value={equipForm.customerName}
                                        onChange={(e) => setEquipForm({ ...equipForm, customerName: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Product / Machine Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. 50-Ton Hydraulic Press"
                                        value={equipForm.productName}
                                        onChange={(e) => setEquipForm({ ...equipForm, productName: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Technical Description (Rule 1 Compliant)</label>
                                <input
                                    type="text"
                                    placeholder="Technical specifications, model, material grades..."
                                    value={equipForm.productDescription}
                                    onChange={(e) => setEquipForm({ ...equipForm, productDescription: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl italic outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Serial Number *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. HYD-2026-0042"
                                        value={equipForm.serialNumber}
                                        onChange={(e) => setEquipForm({ ...equipForm, serialNumber: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice / DC Ref</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. INV-8812"
                                        value={equipForm.invoiceNumber}
                                        onChange={(e) => setEquipForm({ ...equipForm, invoiceNumber: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Delivery Date</label>
                                    <input
                                        type="date"
                                        value={equipForm.deliveryDate}
                                        onChange={(e) => setEquipForm({ ...equipForm, deliveryDate: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Warranty (Months)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={equipForm.warrantyPeriodMonths}
                                        onChange={(e) => setEquipForm({ ...equipForm, warrantyPeriodMonths: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Warranty Status</label>
                                    <select
                                        value={equipForm.warrantyStatus}
                                        onChange={(e) => setEquipForm({ ...equipForm, warrantyStatus: e.target.value as any })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Under Warranty">Under Warranty</option>
                                        <option value="Out of Warranty">Out of Warranty</option>
                                        <option value="AMC Active">AMC Active</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Plant / Site Location</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Pune Plant Bay 2"
                                        value={equipForm.location}
                                        onChange={(e) => setEquipForm({ ...equipForm, location: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEquipModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                                >
                                    {submitting ? "Saving..." : editingEquip ? "Update Equipment" : "Register Equipment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* LOG SERVICE TICKET MODAL */}
            {isTicketModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center border-b border-slate-700 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <Wrench size={18} className="text-amber-400" />
                                    {editingTicket ? `Edit Ticket: ${editingTicket.ticketNo}` : "Log After-Sales Service Ticket"}
                                </h3>
                                <p className="text-xs text-slate-300 mt-0.5">Support, repairs, and warranty claims</p>
                            </div>
                            <button onClick={() => setIsTicketModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleTicketSubmit} className="p-6 space-y-3.5 overflow-y-auto text-xs flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Maruti Suzuki"
                                        value={ticketForm.customerName}
                                        onChange={(e) => setTicketForm({ ...ticketForm, customerName: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Machine / Serial #</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. HYD-2026-0042"
                                        value={ticketForm.serialNumber}
                                        onChange={(e) => setTicketForm({ ...ticketForm, serialNumber: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                                    <select
                                        value={ticketForm.category}
                                        onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Breakdown">Breakdown</option>
                                        <option value="Preventive Maintenance">Preventive Maintenance</option>
                                        <option value="Installation">Installation</option>
                                        <option value="Calibration">Calibration</option>
                                        <option value="Spare Parts">Spare Parts</option>
                                        <option value="General Service">General Service</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                                    <select
                                        value={ticketForm.priority}
                                        onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as any })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                    <select
                                        value={ticketForm.status}
                                        onChange={(e) => setTicketForm({ ...ticketForm, status: e.target.value as any })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Open">Open</option>
                                        <option value="Assigned">Assigned</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Resolved">Resolved</option>
                                        <option value="Closed">Closed</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Issue Description *</label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Describe the breakdown, error codes, abnormal noise..."
                                    value={ticketForm.issueDescription}
                                    onChange={(e) => setTicketForm({ ...ticketForm, issueDescription: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Field Engineer / Technician</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Ramesh Kumar"
                                        value={ticketForm.technicianName}
                                        onChange={(e) => setTicketForm({ ...ticketForm, technicianName: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Service Charges (INR)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={ticketForm.serviceCost}
                                        onChange={(e) => setTicketForm({ ...ticketForm, serviceCost: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Resolution Remarks</label>
                                <textarea
                                    rows={2}
                                    placeholder="Parts replaced, calibration results, root cause..."
                                    value={ticketForm.resolutionNotes}
                                    onChange={(e) => setTicketForm({ ...ticketForm, resolutionNotes: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsTicketModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                                >
                                    {submitting ? "Saving..." : editingTicket ? "Update Ticket" : "Log Ticket"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
