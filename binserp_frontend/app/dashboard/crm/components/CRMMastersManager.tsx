"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, Trash2, Edit2, CheckCircle2, RefreshCw, Layers, Tag, Target, 
    Building2, HelpCircle, ShoppingBag, Palette, X, Check, Search, Filter,
    Globe, DollarSign, Percent, ArrowRight, Copy, ShieldCheck, Briefcase, Box
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

const CURRENCY_SYMBOLS: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    AED: "AED ",
    SGD: "S$",
    CAD: "C$",
    AUD: "A$",
    JPY: "¥",
    SAR: "SAR "
};

interface PricingJurisdiction {
    currency: string;
    sellingPrice: number;
    negotiationPrice: number;
    cgstRate?: number;
    sgstRate?: number;
    igstRate?: number;
    taxTreatment?: string;
    exportTaxRate?: number;
    incoterms?: string;
}

interface MasterPricing {
    intraState?: PricingJurisdiction;
    interState?: PricingJurisdiction;
    foreign?: PricingJurisdiction;
}

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
    itemClassification?: "product" | "service";
    hsnSacCode?: string;
    taxRate?: number;
    pricing?: MasterPricing;
    isDefault?: boolean;
    isActive?: boolean;
}

const DEFAULT_FORM_DATA = {
    name: "",
    code: "",
    color: "#3b82f6",
    order: 0,
    probability: 50,
    description: "",
    unitPrice: 0,
    unit: "PCS",
    itemClassification: "product" as "product" | "service",
    hsnSacCode: "",
    taxRate: 18,
    pricing: {
        intraState: {
            currency: "INR",
            sellingPrice: 0,
            negotiationPrice: 0,
            cgstRate: 9,
            sgstRate: 9
        },
        interState: {
            currency: "INR",
            sellingPrice: 0,
            negotiationPrice: 0,
            igstRate: 18
        },
        foreign: {
            currency: "USD",
            sellingPrice: 0,
            negotiationPrice: 0,
            taxTreatment: "LUT_BOND_ZERO_RATED",
            exportTaxRate: 0,
            incoterms: "FOB"
        }
    }
};

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
    const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

    const masterCategories = [
        { id: "source", label: "Lead Sources", icon: Tag, desc: "IndiaMART, Web, Referrals, Cold Calls" },
        { id: "stage", label: "Pipeline Stages", icon: Target, desc: "Kanban pipeline columns & win probability" },
        { id: "industry", label: "Customer Industries", icon: Building2, desc: "Market segments & vertical categories" },
        { id: "lossReason", label: "Deal Loss Reasons", icon: HelpCircle, desc: "Loss analysis tags & competitor tracking" },
        { id: "product", label: "Products / Services", icon: ShoppingBag, desc: "Commercial offerings, multi-currency & tax matrix" }
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
            ...DEFAULT_FORM_DATA,
            color: activeMasterType === "stage" ? "#6366f1" : "#3b82f6",
            order: items.length + 1
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: MasterItem) => {
        setEditingItem(item);
        const itemTax = item.taxRate !== undefined ? item.taxRate : 18;
        const halfTax = itemTax / 2;

        setFormData({
            name: item.name || "",
            code: item.code || "",
            color: item.color || "#3b82f6",
            order: item.order || 0,
            probability: item.probability || 0,
            description: item.description || "",
            unitPrice: item.pricing?.intraState?.sellingPrice ?? item.unitPrice ?? 0,
            unit: item.unit || "PCS",
            itemClassification: item.itemClassification || "product",
            hsnSacCode: item.hsnSacCode || "",
            taxRate: itemTax,
            pricing: {
                intraState: {
                    currency: item.pricing?.intraState?.currency || "INR",
                    sellingPrice: item.pricing?.intraState?.sellingPrice ?? item.unitPrice ?? 0,
                    negotiationPrice: item.pricing?.intraState?.negotiationPrice ?? 0,
                    cgstRate: item.pricing?.intraState?.cgstRate ?? halfTax,
                    sgstRate: item.pricing?.intraState?.sgstRate ?? halfTax
                },
                interState: {
                    currency: item.pricing?.interState?.currency || "INR",
                    sellingPrice: item.pricing?.interState?.sellingPrice ?? item.unitPrice ?? 0,
                    negotiationPrice: item.pricing?.interState?.negotiationPrice ?? 0,
                    igstRate: item.pricing?.interState?.igstRate ?? itemTax
                },
                foreign: {
                    currency: item.pricing?.foreign?.currency || "USD",
                    sellingPrice: item.pricing?.foreign?.sellingPrice ?? 0,
                    negotiationPrice: item.pricing?.foreign?.negotiationPrice ?? 0,
                    taxTreatment: item.pricing?.foreign?.taxTreatment || "LUT_BOND_ZERO_RATED",
                    exportTaxRate: item.pricing?.foreign?.exportTaxRate ?? 0,
                    incoterms: item.pricing?.foreign?.incoterms || "FOB"
                }
            }
        });
        setIsModalOpen(true);
    };

    // Auto-sync tax slabs
    const handleTaxRateChange = (newRate: number) => {
        const half = newRate / 2;
        setFormData(prev => ({
            ...prev,
            taxRate: newRate,
            pricing: {
                ...prev.pricing,
                intraState: {
                    ...prev.pricing.intraState,
                    cgstRate: half,
                    sgstRate: half
                },
                interState: {
                    ...prev.pricing.interState,
                    igstRate: newRate
                },
                foreign: {
                    ...prev.pricing.foreign,
                    exportTaxRate: prev.pricing.foreign.taxTreatment === "EXPORT_WITH_IGST" ? newRate : 0
                }
            }
        }));
    };

    // Copy Intra-State pricing to Inter-State
    const handleCopyIntraToInter = () => {
        setFormData(prev => ({
            ...prev,
            pricing: {
                ...prev.pricing,
                interState: {
                    ...prev.pricing.interState,
                    currency: prev.pricing.intraState.currency,
                    sellingPrice: prev.pricing.intraState.sellingPrice,
                    negotiationPrice: prev.pricing.intraState.negotiationPrice,
                    igstRate: prev.taxRate
                }
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setSubmitting(true);
        setMsg(null);
        try {
            const token = localStorage.getItem("token");
            const payload = {
                ...formData,
                type: activeMasterType,
                unitPrice: activeMasterType === "product" ? formData.pricing.intraState.sellingPrice : formData.unitPrice
            };

            if (editingItem) {
                await apiPut(`/api/crm/masters/${activeMasterType}/${editingItem._id}`, payload, token);
                setMsg({ type: "success", text: `Updated '${formData.name}' successfully` });
            } else {
                await apiPost(`/api/crm/masters/${activeMasterType}`, payload, token);
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
        item.code?.toLowerCase().includes(search.toLowerCase()) ||
        item.hsnSacCode?.toLowerCase().includes(search.toLowerCase())
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
                            {activeMasterType === "product"
                                ? "Manage products & services with multi-territory pricing (Intra, Inter, Foreign) and GST tax rates."
                                : "Manage custom parameters used across Lead forms, Kanban pipelines, and Deal stages."}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder={activeMasterType === "product" ? "Search item, description, HSN..." : "Search items..."}
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
                            <Plus size={15} /> Add {activeMasterType === "product" ? "Product / Service" : "New"}
                        </button>
                    </div>
                </div>

                {/* Table View */}
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="p-4 w-12 text-center">#</th>
                                <th className="p-4">{activeMasterType === "product" ? "Item Name & Technical Description" : "Name / Title"}</th>
                                
                                {activeMasterType === "stage" && <th className="p-4 text-center">Win Probability</th>}
                                
                                {activeMasterType === "product" && (
                                    <>
                                        <th className="p-4 text-right">Intra-State (CGST+SGST)</th>
                                        <th className="p-4 text-right">Inter-State (IGST)</th>
                                        <th className="p-4 text-right">Foreign Export</th>
                                    </>
                                )}
                                
                                {activeMasterType !== "product" && <th className="p-4">Color Badge</th>}
                                {activeMasterType !== "product" && <th className="p-4">Description</th>}
                                {activeMasterType !== "product" && <th className="p-4 text-center">Order Sequence</th>}
                                
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={activeMasterType === "product" ? 6 : 7} className="p-12 text-center text-slate-400">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                                        Loading master items...
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={activeMasterType === "product" ? 6 : 7} className="p-12 text-center text-slate-400">
                                        No items found in this category. Click <strong>Add {activeMasterType === "product" ? "Product / Service" : "New"}</strong> to create one.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, idx) => {
                                    const intra = item.pricing?.intraState;
                                    const inter = item.pricing?.interState;
                                    const foreign = item.pricing?.foreign;
                                    const isService = item.itemClassification === "service";

                                    return (
                                        <tr key={item._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                                            
                                            {/* Name & Description - Strict Binserp Standards */}
                                            <td className="p-4">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span 
                                                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" 
                                                            style={{ backgroundColor: item.color || "#3b82f6" }}
                                                        />
                                                        <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                                            {item.name}
                                                        </span>
                                                        
                                                        {activeMasterType === "product" && (
                                                            <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                                                                isService
                                                                    ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                                                                    : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                                            }`}>
                                                                {isService ? "Service" : "Product"}
                                                            </span>
                                                        )}
                                                        
                                                        {item.hsnSacCode && (
                                                            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                                                {isService ? "SAC" : "HSN"}: {item.hsnSacCode}
                                                            </span>
                                                        )}

                                                        {item.unit && activeMasterType === "product" && (
                                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                                Per {item.unit}
                                                            </span>
                                                        )}

                                                        {item.isDefault && (
                                                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                                                                Default
                                                            </span>
                                                        )}
                                                    </div>

                                                    {item.description && (
                                                        <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                                                            {item.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Stage Column */}
                                            {activeMasterType === "stage" && (
                                                <td className="p-4 text-center">
                                                    <span className="px-2.5 py-1 rounded-full font-mono font-extrabold text-[11px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                                        {item.probability || 0}%
                                                    </span>
                                                </td>
                                            )}

                                            {/* Product Multi-Jurisdiction Pricing Columns */}
                                            {activeMasterType === "product" && (
                                                <>
                                                    {/* Intra-State */}
                                                    <td className="p-4 text-right">
                                                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                                                            ₹{Number(intra?.sellingPrice ?? item.unitPrice ?? 0).toLocaleString()}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-mono flex items-center justify-end gap-1">
                                                            <span>Floor: ₹{Number(intra?.negotiationPrice ?? 0).toLocaleString()}</span>
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                                                (GST {item.taxRate ?? 18}%)
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Inter-State */}
                                                    <td className="p-4 text-right">
                                                        <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                                            ₹{Number(inter?.sellingPrice ?? intra?.sellingPrice ?? item.unitPrice ?? 0).toLocaleString()}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-mono flex items-center justify-end gap-1">
                                                            <span>Floor: ₹{Number(inter?.negotiationPrice ?? 0).toLocaleString()}</span>
                                                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                                                (IGST {inter?.igstRate ?? item.taxRate ?? 18}%)
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Foreign Export */}
                                                    <td className="p-4 text-right">
                                                        {foreign?.sellingPrice ? (
                                                            <div>
                                                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">
                                                                    {CURRENCY_SYMBOLS[foreign.currency] || foreign.currency + " "}
                                                                    {Number(foreign.sellingPrice).toLocaleString()}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-mono flex items-center justify-end gap-1">
                                                                    <span>Floor: {CURRENCY_SYMBOLS[foreign.currency] || foreign.currency + " "}{Number(foreign.negotiationPrice || 0).toLocaleString()}</span>
                                                                    <span className="bg-purple-50 text-purple-700 dark:bg-purple-950 px-1 rounded font-bold">
                                                                        {foreign.incoterms || "FOB"} • {foreign.taxTreatment === "LUT_BOND_ZERO_RATED" ? "0% LUT" : "IGST"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-[11px] italic">Not Configured</span>
                                                        )}
                                                    </td>
                                                </>
                                            )}

                                            {/* General Columns for other masters */}
                                            {activeMasterType !== "product" && (
                                                <>
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
                                                </>
                                            )}

                                            {/* Actions */}
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
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create / Edit Master Item Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className={`bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full ${activeMasterType === "product" ? "max-w-3xl" : "max-w-lg"} max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800`}>
                        
                        {/* Modal Header */}
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    {activeMasterType === "product" ? <ShoppingBag size={18} className="text-blue-400" /> : <Layers size={18} className="text-blue-400" />}
                                    {editingItem 
                                        ? `Edit ${activeMasterType === "product" ? "Commercial Offering" : "Master Item"}` 
                                        : `Add New ${masterCategories.find(c => c.id === activeMasterType)?.label.slice(0, -1)}`}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {activeMasterType === "product" 
                                        ? "Configure multi-currency pricing, floor limits, tax treatment & HSN/SAC codes" 
                                        : "Configure CRM master parameter"}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 text-xs">
                            
                            {/* Classification Toggle for Products / Services */}
                            {activeMasterType === "product" && (
                                <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, itemClassification: "product" })}
                                        className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                            formData.itemClassification === "product"
                                                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                        }`}
                                    >
                                        <Box size={15} /> Physical Product (Goods)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, itemClassification: "service" })}
                                        className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                            formData.itemClassification === "service"
                                                ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs"
                                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                        }`}
                                    >
                                        <Briefcase size={15} /> Professional Service
                                    </button>
                                </div>
                            )}

                            {/* Section 1: Basic Identifiers */}
                            <div className="space-y-4">
                                <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <Tag size={13} className="text-blue-500" /> Basic Information
                                </h4>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        {activeMasterType === "product" ? "Item / Service Name" : "Name / Label"} <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder={activeMasterType === "product" ? "e.g. Industrial Automation Valve, ERP Implementation Service..." : "e.g. IndiaMART, Proposal Sent, Automotive..."}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>

                                {activeMasterType === "product" && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                {formData.itemClassification === "service" ? "SAC Code" : "HSN Code"}
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.hsnSacCode}
                                                onChange={(e) => setFormData({ ...formData, hsnSacCode: e.target.value })}
                                                placeholder={formData.itemClassification === "service" ? "e.g. 998313" : "e.g. 848180"}
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
                                                placeholder="PCS, SET, NOS, HRS, LOT"
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                                                <Percent size={13} className="text-emerald-500" /> Standard GST Slab
                                            </label>
                                            <select
                                                value={formData.taxRate}
                                                onChange={(e) => handleTaxRateChange(Number(e.target.value))}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                                            >
                                                <option value={0}>0% (Nil / Exempt)</option>
                                                <option value={5}>5% (Concessional)</option>
                                                <option value={12}>12% (Standard Lower)</option>
                                                <option value={18}>18% (Standard Higher)</option>
                                                <option value={28}>28% (Luxury / Demerit)</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Code / SKU (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                            placeholder="e.g. SKU-101, STG-01"
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

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Technical Description / Notes
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Detailed specifications, scope of supply, or usage..."
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Section 2: Domestic Pricing & Tax (Intra & Inter-State) */}
                            {activeMasterType === "product" && (
                                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                            <ShieldCheck size={14} className="text-emerald-500" /> Domestic Pricing & Jurisdiction Rates (INR ₹)
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={handleCopyIntraToInter}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 px-2 py-1 rounded-lg"
                                        >
                                            <Copy size={12} /> Sync Intra to Inter-State
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        
                                        {/* Intra-State Card */}
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                    Intra-State (Same State)
                                                </span>
                                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full">
                                                    CGST: {formData.pricing.intraState.cgstRate}% + SGST: {formData.pricing.intraState.sgstRate}%
                                                </span>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    Selling Price (INR ₹)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.pricing.intraState.sellingPrice}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        pricing: {
                                                            ...formData.pricing,
                                                            intraState: { ...formData.pricing.intraState, sellingPrice: Number(e.target.value) }
                                                        }
                                                    })}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-800 dark:text-slate-200 outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    Negotiation / Floor Price (INR ₹)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.pricing.intraState.negotiationPrice}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        pricing: {
                                                            ...formData.pricing,
                                                            intraState: { ...formData.pricing.intraState, negotiationPrice: Number(e.target.value) }
                                                        }
                                                    })}
                                                    placeholder="Minimum acceptable quote"
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Inter-State Card */}
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                    Inter-State (Outside State)
                                                </span>
                                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full">
                                                    IGST: {formData.pricing.interState.igstRate}%
                                                </span>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    Selling Price (INR ₹)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.pricing.interState.sellingPrice}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        pricing: {
                                                            ...formData.pricing,
                                                            interState: { ...formData.pricing.interState, sellingPrice: Number(e.target.value) }
                                                        }
                                                    })}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-800 dark:text-slate-200 outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    Negotiation / Floor Price (INR ₹)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.pricing.interState.negotiationPrice}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        pricing: {
                                                            ...formData.pricing,
                                                            interState: { ...formData.pricing.interState, negotiationPrice: Number(e.target.value) }
                                                        }
                                                    })}
                                                    placeholder="Minimum acceptable quote"
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 outline-none"
                                                />
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            )}

                            {/* Section 3: Foreign Export & Multi-Currency */}
                            {activeMasterType === "product" && (
                                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                        <Globe size={14} className="text-purple-500" /> Foreign / Export Multi-Currency Commercials
                                    </h4>

                                    <div className="p-4 bg-purple-50/40 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-900/50 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                                                    <DollarSign size={13} /> Export Currency
                                                </label>
                                                <select
                                                    value={formData.pricing.foreign.currency}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        pricing: {
                                                            ...formData.pricing,
                                                            foreign: { ...formData.pricing.foreign, currency: e.target.value }
                                                        }
                                                    })}
                                                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                                                >
                                                    <option value="USD">USD - US Dollar ($)</option>
                                                    <option value="EUR">EUR - Euro (€)</option>
                                                    <option value="GBP">GBP - British Pound (£)</option>
                                                    <option value="AED">AED - UAE Dirham (د.إ)</option>
                                                    <option value="SGD">SGD - Singapore Dollar (S$)</option>
                                                    <option value="CAD">CAD - Canadian Dollar (C$)</option>
                                                    <option value="AUD">AUD - Australian Dollar (A$)</option>
                                                    <option value="JPY">JPY - Japanese Yen (¥)</option>
                                                    <option value="SAR">SAR - Saudi Riyal (﷼)</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                    Export Tax Treatment
                                                </label>
                                                <select
                                                    value={formData.pricing.foreign.taxTreatment}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setFormData({
                                                            ...formData,
                                                            pricing: {
                                                                ...formData.pricing,
                                                                foreign: {
                                                                    ...formData.pricing.foreign,
                                                                    taxTreatment: val,
                                                                    exportTaxRate: val === "EXPORT_WITH_IGST" ? formData.taxRate : 0
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                                                >
                                                    <option value="LUT_BOND_ZERO_RATED">0% Under LUT / Export Bond</option>
                                                    <option value="EXPORT_WITH_IGST">Export with IGST Payment</option>
                                                    <option value="EXEMPT">Exempt</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                    Incoterms (Delivery Term)
                                                </label>
                                                <select
                                                    value={formData.pricing.foreign.incoterms}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        pricing: {
                                                            ...formData.pricing,
                                                            foreign: { ...formData.pricing.foreign, incoterms: e.target.value }
                                                        }
                                                    })}
                                                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                                                >
                                                    <option value="FOB">FOB (Free on Board)</option>
                                                    <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                                                    <option value="EXW">EXW (Ex Works)</option>
                                                    <option value="DDP">DDP (Delivered Duty Paid)</option>
                                                    <option value="CFR">CFR (Cost & Freight)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    Export Selling Price ({formData.pricing.foreign.currency})
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.pricing.foreign.sellingPrice}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        pricing: {
                                                            ...formData.pricing,
                                                            foreign: { ...formData.pricing.foreign, sellingPrice: Number(e.target.value) }
                                                        }
                                                    })}
                                                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-800 dark:text-slate-200 outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    Export Floor / Negotiation Price ({formData.pricing.foreign.currency})
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.pricing.foreign.negotiationPrice}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        pricing: {
                                                            ...formData.pricing,
                                                            foreign: { ...formData.pricing.foreign, negotiationPrice: Number(e.target.value) }
                                                        }
                                                    })}
                                                    placeholder="Minimum export quote limit"
                                                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Stage Win Probability */}
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

                            {/* Order Sequence for non-product */}
                            {activeMasterType !== "product" && (
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
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
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
