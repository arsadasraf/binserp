"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, Search, RefreshCw, ShoppingBag, LayoutGrid, List, 
    Camera, Image as ImageIcon, Trash2, Edit2, X, Check, IndianRupee, 
    Layers, Tag, Box, ArrowRight
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface Product {
    _id: string;
    name: string;
    code?: string;
    description?: string;
    unit: string;
    photos?: string[];
    itemClassification?: "product" | "service";
    hsnSacCode?: string;
    taxRate?: number;
    unitPrice?: number;
    pricing?: {
        intraState?: {
            currency: string;
            sellingPrice: number;
            negotiationPrice?: number;
            cgstRate?: number;
            sgstRate?: number;
        };
        interState?: {
            currency: string;
            sellingPrice: number;
            negotiationPrice?: number;
            igstRate?: number;
        };
        foreign?: {
            currency: string;
            sellingPrice: number;
            negotiationPrice?: number;
            incoterms?: string;
        };
    };
    createdByName?: string;
    createdAt?: string;
}

export default function CRMProductShowcase() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        code: "",
        description: "",
        unit: "PCS",
        photos: [] as string[],
        itemClassification: "product" as "product" | "service",
        hsnSacCode: "",
        taxRate: 18,
        sellingPrice: 0,
        negotiationPrice: 0,
        currency: "INR"
    });

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await apiGet(`/api/crm/masters/product`, token);
            setProducts(res.data || []);
        } catch (err) {
            console.error("Failed to load products", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (reader.result) {
                    setFormData(prev => ({
                        ...prev,
                        photos: [...prev.photos, reader.result as string]
                    }));
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemovePhoto = (index: number) => {
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    };

    const handleOpenCreate = () => {
        setEditingProduct(null);
        setFormData({
            name: "",
            code: "",
            description: "",
            unit: "PCS",
            photos: [],
            itemClassification: "product",
            hsnSacCode: "",
            taxRate: 18,
            sellingPrice: 0,
            negotiationPrice: 0,
            currency: "INR"
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (p: Product) => {
        setEditingProduct(p);
        const price = p.pricing?.intraState?.sellingPrice ?? p.unitPrice ?? 0;
        const floorPrice = p.pricing?.intraState?.negotiationPrice ?? 0;
        setFormData({
            name: p.name,
            code: p.code || "",
            description: p.description || "",
            unit: p.unit || "PCS",
            photos: p.photos || [],
            itemClassification: p.itemClassification || "product",
            hsnSacCode: p.hsnSacCode || "",
            taxRate: p.taxRate ?? 18,
            sellingPrice: price,
            negotiationPrice: floorPrice,
            currency: p.pricing?.intraState?.currency || "INR"
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const halfTax = formData.taxRate / 2;
            const payload = {
                type: "product",
                name: formData.name,
                code: formData.code,
                description: formData.description,
                unit: formData.unit,
                photos: formData.photos,
                itemClassification: formData.itemClassification,
                hsnSacCode: formData.hsnSacCode,
                taxRate: formData.taxRate,
                unitPrice: formData.sellingPrice,
                pricing: {
                    intraState: {
                        currency: "INR",
                        sellingPrice: formData.sellingPrice,
                        negotiationPrice: formData.negotiationPrice,
                        cgstRate: halfTax,
                        sgstRate: halfTax
                    },
                    interState: {
                        currency: "INR",
                        sellingPrice: formData.sellingPrice,
                        negotiationPrice: formData.negotiationPrice,
                        igstRate: formData.taxRate
                    },
                    foreign: {
                        currency: "USD",
                        sellingPrice: 0,
                        negotiationPrice: 0
                    }
                }
            };

            if (editingProduct) {
                await apiPut(`/api/crm/masters/product/${editingProduct._id}`, payload, token);
            } else {
                await apiPost("/api/crm/masters/product", payload, token);
            }
            setIsModalOpen(false);
            fetchProducts();
        } catch (err: any) {
            alert(err.message || "Failed to save product");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete product '${name}'?`)) return;
        try {
            const token = localStorage.getItem("token");
            await apiDelete(`/api/crm/masters/product/${id}`, token);
            fetchProducts();
        } catch (err) {
            console.error("Failed to delete product", err);
        }
    };

    const filtered = products.filter(p => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
    });

    return (
        <div className="space-y-4">
            {/* Filter & Action Toolbar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search products, descriptions..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>

                    <button
                        onClick={fetchProducts}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* View Switch */}
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-1.5 rounded-lg transition-all ${
                                viewMode === "grid" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs" : "text-slate-400"
                            }`}
                            title="Grid Card View"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode("table")}
                            className={`p-1.5 rounded-lg transition-all ${
                                viewMode === "table" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs" : "text-slate-400"
                            }`}
                            title="Table View"
                        >
                            <List size={16} />
                        </button>
                    </div>

                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                    >
                        <Plus size={15} />
                        <span>Add Product / Service</span>
                    </button>
                </div>
            </div>

            {/* Content Display */}
            {loading ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-700 shadow-xs">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Loading product catalog...
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-700 shadow-xs">
                    No products found. Click &quot;Add Product / Service&quot; to showcase your commercial offerings with photos.
                </div>
            ) : viewMode === "grid" ? (
                /* GRID VIEW WITH PHOTOS */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filtered.map((p) => {
                        const price = p.pricing?.intraState?.sellingPrice ?? p.unitPrice ?? 0;
                        const hasPhotos = p.photos && p.photos.length > 0;
                        return (
                            <div key={p._id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                                <div>
                                    {/* Product Photo Showcase */}
                                    <div className="h-44 bg-slate-100 dark:bg-slate-900 relative overflow-hidden flex items-center justify-center">
                                        {hasPhotos ? (
                                            <img
                                                src={p.photos![0]}
                                                alt={p.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                                                <ImageIcon size={36} />
                                                <span className="text-[10px] font-bold mt-1">No Photo</span>
                                            </div>
                                        )}
                                        {p.photos && p.photos.length > 1 && (
                                            <span className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                +{p.photos.length - 1} photos
                                            </span>
                                        )}
                                        <span className="absolute top-2.5 left-2.5 bg-blue-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wide">
                                            {p.itemClassification || "Product"}
                                        </span>
                                    </div>

                                    {/* Strict Rule 1: Item Name & Technical Description */}
                                    <div className="p-4 space-y-1.5">
                                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1">{p.name}</h4>
                                        {p.description && (
                                            <p className="text-[11px] text-slate-500 italic line-clamp-2">{p.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 pt-2 text-[11px] text-slate-500">
                                            {p.hsnSacCode && <span>HSN: <strong className="font-mono text-slate-700 dark:text-slate-300">{p.hsnSacCode}</strong></span>}
                                            <span>•</span>
                                            <span>GST: <strong className="text-slate-700 dark:text-slate-300">{p.taxRate ?? 18}%</strong></span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-700/60 mt-2 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Standard Rate</span>
                                        <strong className="text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                                            ₹{price.toLocaleString()}
                                        </strong>
                                        <span className="text-[10px] text-slate-400">/{p.unit || "PCS"}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleOpenEdit(p)}
                                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p._id, p.name)}
                                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* TABLE VIEW */
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-3.5">Photo</th>
                                    <th className="px-5 py-3.5">Item Name & Description (Rule 1)</th>
                                    <th className="px-5 py-3.5">HSN / SAC</th>
                                    <th className="px-5 py-3.5">Standard Selling Price</th>
                                    <th className="px-5 py-3.5">GST Rate</th>
                                    <th className="px-5 py-3.5">Created By</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                                {filtered.map((p) => {
                                    const price = p.pricing?.intraState?.sellingPrice ?? p.unitPrice ?? 0;
                                    const hasPhotos = p.photos && p.photos.length > 0;
                                    return (
                                        <tr key={p._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                                                    {hasPhotos ? (
                                                        <img src={p.photos![0]} alt={p.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <ImageIcon size={18} className="text-slate-400" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <strong className="text-slate-900 dark:text-white font-bold block">{p.name}</strong>
                                                {p.description && (
                                                    <span className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1 block">
                                                        {p.description}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                                                {p.hsnSacCode || "—"}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                                                    ₹{price.toLocaleString()}
                                                </strong>
                                                <span className="text-[10px] text-slate-400 ml-1">/{p.unit || "PCS"}</span>
                                            </td>
                                            <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300">
                                                {p.taxRate ?? 18}%
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                                                {p.createdByName || "CRM Team"}
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEdit(p)}
                                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(p._id, p.name)}
                                                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ADD / EDIT PRODUCT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center border-b border-slate-700 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <ShoppingBag size={18} className="text-blue-400" />
                                    {editingProduct ? `Edit Product: ${editingProduct.name}` : "Add Commercial Offering with Photos"}
                                </h3>
                                <p className="text-xs text-slate-300 mt-0.5">Showcase products and services for CRM quotations and leads</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
                            {/* Photo Upload Showcase */}
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Product Photos</label>
                                <div className="flex flex-wrap gap-2.5 items-center">
                                    {formData.photos.map((ph, idx) => (
                                        <div key={idx} className="relative w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden group">
                                            <img src={ph} alt={`photo-${idx}`} className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePhoto(idx)}
                                                className="absolute inset-0 bg-rose-950/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-blue-600 transition-colors">
                                        <Camera size={18} />
                                        <span className="text-[9px] font-bold mt-0.5">+ Add</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handlePhotoUpload}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Item Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Servo Controlled Injection Molding Machine"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Classification</label>
                                    <select
                                        value={formData.itemClassification}
                                        onChange={(e) => setFormData({ ...formData, itemClassification: e.target.value as any })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="product">Physical Product / Machinery</option>
                                        <option value="service">Commercial Service / AMC</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Technical Description (Rule 1 Compliant)</label>
                                <textarea
                                    rows={2}
                                    placeholder="Technical specifications, capacity, dimensions, material grades..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl italic outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Standard Selling Price (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.sellingPrice}
                                        onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold outline-none text-emerald-600"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Floor / Negotiation Price (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.negotiationPrice}
                                        onChange={(e) => setFormData({ ...formData, negotiationPrice: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Unit of Measure</label>
                                    <input
                                        type="text"
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value.toUpperCase() })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold uppercase outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">HSN / SAC Code</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 84771000"
                                        value={formData.hsnSacCode}
                                        onChange={(e) => setFormData({ ...formData, hsnSacCode: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">GST Slab Rate (%)</label>
                                    <select
                                        value={formData.taxRate}
                                        onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="0">0% (Exempt)</option>
                                        <option value="5">5% GST</option>
                                        <option value="12">12% GST</option>
                                        <option value="18">18% GST (Standard)</option>
                                        <option value="28">28% GST</option>
                                    </select>
                                </div>
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
                                    {submitting ? "Saving..." : editingProduct ? "Update Product" : "Save Product"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
