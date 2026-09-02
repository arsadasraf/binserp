"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, Search, Filter, RefreshCw, Users, Building2, Phone, Mail, 
    MapPin, FileText, ChevronRight, X, Edit2, Trash2, DollarSign, Calendar, Clock, CheckCircle2
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface Customer {
    _id: string;
    name: string;
    customerCode?: string;
    contactPerson?: string;
    designation?: string;
    email?: string;
    phone?: string;
    altPhone?: string;
    website?: string;
    gstin?: string;
    pan?: string;
    industry?: string;
    tier?: "Platinum" | "Gold" | "Silver" | "Standard";
    address?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string };
    annualRevenue?: number;
    notes?: string;
    createdAt?: string;
}

export default function CustomerDirectory() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [tierFilter, setTierFilter] = useState("All");
    
    // 360 Drawer State
    const [selectedCustomer360, setSelectedCustomer360] = useState<any | null>(null);
    const [loading360, setLoading360] = useState(false);

    // Create / Edit Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        customerCode: "",
        contactPerson: "",
        designation: "",
        email: "",
        phone: "",
        altPhone: "",
        website: "",
        gstin: "",
        pan: "",
        industry: "Automotive & OEM",
        tier: "Standard",
        street: "",
        city: "",
        state: "",
        zipCode: "",
        annualRevenue: 0,
        notes: ""
    });

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            let url = `/api/crm/customers?search=${encodeURIComponent(search)}`;
            if (tierFilter !== "All") url += `&tier=${encodeURIComponent(tierFilter)}`;

            const res = await apiGet(url, token);
            setCustomers(res.data || []);
        } catch (err) {
            console.error("Failed to load customers", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, [tierFilter]);

    const handleOpenCustomer360 = async (customerId: string) => {
        setLoading360(true);
        setSelectedCustomer360(null);
        try {
            const token = localStorage.getItem("token");
            const res = await apiGet(`/api/crm/customers/${customerId}/360`, token);
            setSelectedCustomer360(res.data || null);
        } catch (err) {
            console.error("Failed to load customer 360", err);
        } finally {
            setLoading360(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingCustomer(null);
        setFormData({
            name: "",
            customerCode: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
            contactPerson: "",
            designation: "",
            email: "",
            phone: "",
            altPhone: "",
            website: "",
            gstin: "",
            pan: "",
            industry: "Automotive & OEM",
            tier: "Standard",
            street: "",
            city: "",
            state: "",
            zipCode: "",
            annualRevenue: 0,
            notes: ""
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (c: Customer) => {
        setEditingCustomer(c);
        setFormData({
            name: c.name,
            customerCode: c.customerCode || "",
            contactPerson: c.contactPerson || "",
            designation: c.designation || "",
            email: c.email || "",
            phone: c.phone || "",
            altPhone: c.altPhone || "",
            website: c.website || "",
            gstin: c.gstin || "",
            pan: c.pan || "",
            industry: c.industry || "Automotive & OEM",
            tier: c.tier || "Standard",
            street: c.address?.street || "",
            city: c.address?.city || "",
            state: c.address?.state || "",
            zipCode: c.address?.zipCode || "",
            annualRevenue: c.annualRevenue || 0,
            notes: c.notes || ""
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const payload = {
                ...formData,
                address: {
                    street: formData.street,
                    city: formData.city,
                    state: formData.state,
                    zipCode: formData.zipCode,
                    country: "India"
                }
            };

            if (editingCustomer) {
                await apiPut(`/api/crm/customers/${editingCustomer._id}`, payload, token);
            } else {
                await apiPost("/api/crm/customers", payload, token);
            }
            setIsModalOpen(false);
            fetchCustomers();
        } catch (err) {
            console.error("Failed to save customer", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete customer '${name}'?`)) return;
        try {
            const token = localStorage.getItem("token");
            await apiDelete(`/api/crm/customers/${id}`, token);
            fetchCustomers();
            if (selectedCustomer360?.customer?._id === id) {
                setSelectedCustomer360(null);
            }
        } catch (err) {
            console.error("Failed to delete customer", err);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Top Control Bar */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search customer, GST, contact..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchCustomers()}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                        />
                    </div>

                    <select
                        value={tierFilter}
                        onChange={(e) => setTierFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                    >
                        <option value="All">All Tiers</option>
                        <option value="Platinum">Platinum</option>
                        <option value="Gold">Gold</option>
                        <option value="Silver">Silver</option>
                        <option value="Standard">Standard</option>
                    </select>

                    <button
                        onClick={fetchCustomers}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <button
                    onClick={handleOpenCreate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5"
                >
                    <Plus size={15} /> Add Customer
                </button>
            </div>

            {/* Customers Ledger Table */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="p-4">Customer / Enterprise</th>
                                <th className="p-4">Primary Contact</th>
                                <th className="p-4">Phone & Email</th>
                                <th className="p-4">Industry & Tier</th>
                                <th className="p-4">GST / Tax ID</th>
                                <th className="p-4">Location</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-slate-400">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                                        Loading customer directory...
                                    </td>
                                </tr>
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-slate-400">
                                        No customers registered. Click <strong>Add Customer</strong> to create one.
                                    </td>
                                </tr>
                            ) : (
                                customers.map((c) => (
                                    <tr 
                                        key={c._id} 
                                        className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
                                        onClick={() => handleOpenCustomer360(c._id)}
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center text-xs shrink-0 border border-blue-200 dark:border-blue-800">
                                                    {c.name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <strong className="font-extrabold text-slate-900 dark:text-white text-sm block group-hover:text-blue-600 transition-colors">
                                                        {c.name}
                                                    </strong>
                                                    {c.customerCode && <span className="text-[10px] font-mono text-slate-400">{c.customerCode}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <strong className="text-slate-800 dark:text-slate-200 block">{c.contactPerson || "-"}</strong>
                                            <span className="text-[10px] text-slate-400">{c.designation || "Executive"}</span>
                                        </td>
                                        <td className="p-4 font-mono text-[11px] space-y-0.5">
                                            {c.phone && <div className="text-slate-700 dark:text-slate-300">{c.phone}</div>}
                                            {c.email && <div className="text-slate-400">{c.email}</div>}
                                        </td>
                                        <td className="p-4 space-y-1">
                                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">{c.industry || "General Manufacturing"}</span>
                                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] inline-block ${
                                                c.tier === "Platinum" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                                                c.tier === "Gold" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                "bg-slate-100 text-slate-600"
                                            }`}>
                                                {c.tier || "Standard"} Tier
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                            {c.gstin || "-"}
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            {c.address?.city ? `${c.address.city}, ${c.address.state || ""}` : "-"}
                                        </td>
                                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleOpenCustomer360(c._id)}
                                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1"
                                                >
                                                    360° View <ChevronRight size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEdit(c)}
                                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-500"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(c._id, c.name)}
                                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 rounded-lg"
                                                    title="Delete"
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

            {/* CUSTOMER 360° DRAWER MODAL */}
            {selectedCustomer360 && (
                <div className="fixed inset-0 z-[200] flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
                        
                        {/* Drawer Header */}
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-start border-b border-slate-800 shrink-0">
                            <div>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                                    Customer 360° Profile
                                </span>
                                <h3 className="font-extrabold text-xl mt-2">{selectedCustomer360.customer.name}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{selectedCustomer360.customer.customerCode} · {selectedCustomer360.customer.industry}</p>
                            </div>
                            <button onClick={() => setSelectedCustomer360(null)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Drawer Content */}
                        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
                            
                            {/* Analytics Summary */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900">
                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block uppercase">Won Revenue</span>
                                    <strong className="text-base font-extrabold font-mono text-slate-900 dark:text-white mt-0.5 block">
                                        ₹{Number(selectedCustomer360.analytics?.totalRevenue || 0).toLocaleString()}
                                    </strong>
                                </div>

                                <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-900">
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase">Active Pipeline</span>
                                    <strong className="text-base font-extrabold font-mono text-slate-900 dark:text-white mt-0.5 block">
                                        ₹{Number(selectedCustomer360.analytics?.activePipeline || 0).toLocaleString()}
                                    </strong>
                                </div>

                                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-900">
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">Total Deals</span>
                                    <strong className="text-base font-extrabold font-mono text-slate-900 dark:text-white mt-0.5 block">
                                        {selectedCustomer360.analytics?.wonDealsCount || 0} / {selectedCustomer360.analytics?.totalDealsCount || 0}
                                    </strong>
                                </div>
                            </div>

                            {/* Contact & Business Info */}
                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                                    Contact & Tax Identification
                                </h4>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-slate-700 dark:text-slate-300">
                                    <div><strong className="text-slate-400 block text-[10px]">Contact Person:</strong> {selectedCustomer360.customer.contactPerson || "-"}</div>
                                    <div><strong className="text-slate-400 block text-[10px]">Phone Number:</strong> {selectedCustomer360.customer.phone || "-"}</div>
                                    <div><strong className="text-slate-400 block text-[10px]">Email Address:</strong> {selectedCustomer360.customer.email || "-"}</div>
                                    <div><strong className="text-slate-400 block text-[10px]">GSTIN Number:</strong> {selectedCustomer360.customer.gstin || "-"}</div>
                                    <div className="col-span-2"><strong className="text-slate-400 block text-[10px]">Billing Address:</strong> {selectedCustomer360.customer.address?.street || "-"}, {selectedCustomer360.customer.address?.city}</div>
                                </div>
                            </div>

                            {/* Linked Deals */}
                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                                    Linked Opportunities & Deals ({selectedCustomer360.deals?.length || 0})
                                </h4>
                                <div className="space-y-2">
                                    {selectedCustomer360.deals?.length === 0 ? (
                                        <p className="text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl">No active deals linked.</p>
                                    ) : (
                                        selectedCustomer360.deals?.map((deal: any) => (
                                            <div key={deal._id} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-2xs">
                                                <div>
                                                    <strong className="text-slate-900 dark:text-white block">{deal.title}</strong>
                                                    <span className="text-[10px] text-slate-400">Stage: {deal.stage} · {deal.probability}% Win Probability</span>
                                                </div>
                                                <strong className="font-mono text-blue-600 dark:text-blue-400 font-extrabold">
                                                    ₹{Number(deal.value || 0).toLocaleString()}
                                                </strong>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Activities Timeline */}
                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                                    Communication & Follow-up Timeline
                                </h4>
                                <div className="space-y-2">
                                    {selectedCustomer360.activities?.length === 0 ? (
                                        <p className="text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl">No interaction logs found.</p>
                                    ) : (
                                        selectedCustomer360.activities?.map((act: any) => (
                                            <div key={act._id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{act.type}: {act.summary}</span>
                                                    <span className="font-mono text-[10px] text-slate-400">{new Date(act.date).toLocaleDateString("en-GB")}</span>
                                                </div>
                                                {act.description && <p className="text-slate-500 text-[11px]">{act.description}</p>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Drawer Footer */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
                            <button
                                onClick={() => setSelectedCustomer360(null)}
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
                            >
                                Close 360° Drawer
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* CREATE / EDIT CUSTOMER MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                            <div>
                                <h3 className="font-extrabold text-base">
                                    {editingCustomer ? "Edit Customer Account" : "Add New Customer Account"}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Enterprise & Commercial Profile</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Company / Customer Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Full Enterprise Name"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Customer Code
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.customerCode}
                                        onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Primary Contact Person
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.contactPerson}
                                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                        placeholder="Contact Name"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Designation
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.designation}
                                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                        placeholder="e.g. Procurement Head"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
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
                                        placeholder="buyer@domain.com"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        GSTIN Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.gstin}
                                        onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                                        placeholder="27AAAAA0000A1Z5"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Customer Tier
                                    </label>
                                    <select
                                        value={formData.tier}
                                        onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Platinum">Platinum</option>
                                        <option value="Gold">Gold</option>
                                        <option value="Silver">Silver</option>
                                        <option value="Standard">Standard</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
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
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Pincode
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.zipCode}
                                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
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
                                    {submitting ? "Saving..." : editingCustomer ? "Update Account" : "Save Account"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
