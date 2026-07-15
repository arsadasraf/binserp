/**
 * Quotation Modal Component
 * Modal form for creating and editing Quotations
 * Supports custom customer names and addresses, and per-item taxes
 */

"use client";

import { useState, useEffect } from "react";
import { QuotationModalProps, QuotationFormData } from "../../types/store.types";
import { API_BASE_URL } from "@/src/utils/config";
import SearchableSelect from "../SearchableSelect";

export default function QuotationModal({
    isOpen,
    onClose,
    onSubmit,
    components = [],
    materials = [],
    customers = [],
    priceLists = [],
    loading,
    initialData,
    isEditing = false,
    isPreview = false,
}: QuotationModalProps) {
    const [prefix, setPrefix] = useState('QT-OUT');

    const generateQuotationNumber = (currentPrefix: string) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        return `${currentPrefix}/${year}${month}${day}-${hours}${mins}`;
    };

    const [formData, setFormData] = useState<QuotationFormData>({
        quotationNumber: "",
        date: new Date().toISOString().split("T")[0],
        customerType: 'master',
        customer: "",
        customerName: "",
        customerAddress: "",
        items: [{ itemType: 'fg', component: "", productName: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: 0, taxAmount: 0, description: "" }],
        subtotal: 0,
        discount: 0,
        taxAmount: 0,
        totalAmount: 0,
        otherDetails: "",
        status: "Draft",
    });

    const [globalTaxRate, setGlobalTaxRate] = useState(0);

    // Fetch prefix settings
    useEffect(() => {
        const fetchPrefix = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/store/prefix`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await res.json();
                if (data.settings?.quotationOutwardPrefix) {
                    setPrefix(data.settings.quotationOutwardPrefix);
                }
            } catch (error) {
                console.error("Failed to fetch prefix settings", error);
            }
        };
        if (isOpen && !isEditing) fetchPrefix();
    }, [isOpen, isEditing]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    ...initialData,
                    date: initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                    customerType: initialData.customer ? 'master' : 'custom',
                    customer: initialData.customer?._id || initialData.customer,
                    items: initialData.items.map(item => ({
                        ...item,
                        itemType: item.component ? 'fg' : 'custom',
                        component: item.component?._id || item.component
                    }))
                });
                if (initialData.items.length > 0) {
                    setGlobalTaxRate(initialData.items[0].taxRate || 0);
                }
            } else {
                setFormData({
                    quotationNumber: generateQuotationNumber(prefix),
                    date: new Date().toISOString().split("T")[0],
                    customerType: 'master',
                    customer: "",
                    customerName: "",
                    customerAddress: "",
                    items: [{ itemType: 'fg', component: "", productName: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: 0, taxAmount: 0, description: "" }],
                    subtotal: 0,
                    discount: 0,
                    taxAmount: 0,
                    totalAmount: 0,
                    otherDetails: "",
                    status: "Draft",
                });
                setGlobalTaxRate(0);
            }
        }
    }, [initialData, isOpen, prefix]);

    // Recalculate totals
    useEffect(() => {
        let subtotal = 0;
        let totalTax = 0;

        const updatedItems = formData.items.map(item => {
            const amount = (item.quantity || 0) * (item.rate || 0);
            const itemTax = (amount * (item.taxRate || 0)) / 100;
            return { ...item, amount, taxAmount: itemTax };
        });

        updatedItems.forEach(item => {
            subtotal += item.amount;
            totalTax += item.taxAmount || 0;
        });

        const discountAmount = formData.discount || 0;
        const totalAmount = subtotal + totalTax - discountAmount;

        if (
            Math.abs(subtotal - formData.subtotal) > 0.01 ||
            Math.abs(totalTax - (formData.taxAmount || 0)) > 0.01 ||
            Math.abs(totalAmount - formData.totalAmount) > 0.01
        ) {
            setFormData(prev => ({
                ...prev,
                subtotal,
                taxAmount: totalTax,
                totalAmount: totalAmount > 0 ? totalAmount : 0
            }));
        }

    }, [formData.items, formData.discount]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Clean up data before submitting to prevent MongoDB ObjectId casting errors for empty strings
        const cleanedData = {
            ...formData,
            items: formData.items.map(item => {
                const cleanedItem = { ...item };
                if (!cleanedItem.component || cleanedItem.component.trim() === "") {
                    delete cleanedItem.component;
                }
                return cleanedItem;
            })
        };

        if (cleanedData.customerType === 'custom') {
            delete cleanedData.customer; // Remove master reference if custom
        }
        
        onSubmit(cleanedData);
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { itemType: 'fg', component: "", productName: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: globalTaxRate, taxAmount: 0, description: "" }],
        });
    };

    const handleItemTypeChange = (index: number, itemType: 'custom' | 'fg') => {
        const newItems = [...formData.items];
        newItems[index] = {
            ...newItems[index],
            itemType,
            component: '',
            productName: '',
            rate: 0,
            taxRate: globalTaxRate,
            amount: 0,
            taxAmount: 0,
        };
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const handleComponentChange = (index: number, selectedValue: string) => {
        const newItems = [...formData.items];
        const selectedComponent = components.find(item => item._id === selectedValue);
        
        let rate = 0;
        let taxRate = globalTaxRate;

        // Auto-fetch from priceLists if available
        if (selectedComponent && priceLists) {
            const itemPriceList = priceLists.find(pl => 
                (pl.fgItem === selectedComponent._id || pl.fgItem?._id === selectedComponent._id)
            );
            
            if (itemPriceList) {
                rate = itemPriceList.price || 0;
                taxRate = itemPriceList.taxRate !== undefined && itemPriceList.taxRate !== null ? itemPriceList.taxRate : globalTaxRate;
            }
        }

        const qty = newItems[index].quantity || 1;
        const amount = qty * rate;
        const taxAmount = (amount * taxRate) / 100;

        newItems[index] = {
            ...newItems[index],
            component: selectedValue,
            material: undefined,
            productName: selectedComponent?.name || selectedComponent?.partName || selectedComponent?.componentName || '',
            unit: selectedComponent?.unit || 'PCS',
            rate,
            taxRate,
            amount,
            taxAmount
        };
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        let item = { ...newItems[index], [field]: value };

        if (field === "quantity" || field === "rate" || field === "taxRate") {
            const qty = field === "quantity" ? value : item.quantity;
            const rate = field === "rate" ? value : item.rate;
            const taxRate = field === "taxRate" ? value : item.taxRate;

            item.amount = qty * rate;
            item.taxAmount = (item.amount * taxRate) / 100;
        }

        newItems[index] = item;
        setFormData({ ...formData, items: newItems });
    };

    const removeItem = (index: number) => {
        if (formData.items.length > 1) {
            const newItems = formData.items.filter((_, i) => i !== index);
            setFormData({ ...formData, items: newItems });
        }
    };

    // Apply global tax rate to all items
    const handleGlobalTaxChange = (rate: number) => {
        setGlobalTaxRate(rate);
        const newItems = formData.items.map(item => ({
            ...item,
            taxRate: rate,
            taxAmount: (item.amount * rate) / 100
        }));
        setFormData({ ...formData, items: newItems });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col m-4 transform transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-700 via-indigo-600 to-indigo-800">
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-wide">
                            {isPreview ? "Quotation Details" : isEditing ? "Edit Quotation" : "Create Quotation"}
                        </h2>
                        <p className="text-indigo-200 text-sm mt-1 font-medium">Generate a professional sales quotation</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white/20 p-2 rounded-full transition-colors backdrop-blur-md"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    <form id="quotation-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Quotation Details */}
                        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-3">
                                    <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
                                    Quotation Details
                                </h3>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-semibold text-gray-700">Status:</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium text-sm shadow-sm"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Sent">Sent</option>
                                        <option value="Accepted">Accepted</option>
                                        <option value="Rejected">Rejected</option>
                                    </select>
                                </div>
                            </div>

                            <div className={`grid grid-cols-1 md:grid-cols-4 gap-6 ${isPreview ? "pointer-events-none opacity-70" : ""}`}>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Quotation No</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={formData.quotationNumber}
                                        className="w-full px-4 py-2.5 bg-gray-100/80 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date <span className="text-red-500">*</span></label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-semibold text-gray-700">Customer <span className="text-red-500">*</span></label>
                                        <div className="flex bg-gray-100 p-1 rounded-lg">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, customerType: 'master', customer: '', customerName: '', customerAddress: '' })}
                                                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${formData.customerType === 'master' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                Master
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, customerType: 'custom', customer: '', customerName: '', customerAddress: '' })}
                                                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${formData.customerType === 'custom' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                Custom
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {formData.customerType === 'master' ? (
                                        <SearchableSelect
                                            options={customers?.map((c: any) => ({ value: c._id, label: c.name })) || []}
                                            value={formData.customer || ""}
                                            onChange={(val: any) => {
                                                const customerId = val;
                                                const selectedCustomer = customers?.find(c => c._id === customerId);
                                                setFormData({
                                                    ...formData,
                                                    customer: customerId,
                                                    customerName: selectedCustomer?.name || '',
                                                    customerAddress: selectedCustomer ? `${selectedCustomer.billingAddress || ''} ${selectedCustomer.billingCity || ''} ${selectedCustomer.billingState || ''}`.trim() : ''
                                                });
                                            }}
                                            placeholder="Select Master Customer"
                                            innerClassName="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            required
                                            value={formData.customerName}
                                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                            placeholder="Enter Custom Customer Name"
                                        />
                                    )}
                                </div>
                            </div>

                            {formData.customerType === 'custom' && (
                                <div className={`grid grid-cols-1 md:grid-cols-1 gap-4 mt-6 ${isPreview ? "pointer-events-none opacity-70" : ""}`}>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Address</label>
                                        <input
                                            type="text"
                                            value={formData.customerAddress}
                                            onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                            placeholder="Enter full address"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Items Section */}
                        <div className={`bg-white rounded-2xl shadow-sm border border-indigo-100 p-6 ${isPreview ? "pointer-events-none opacity-70" : ""}`}>
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-6">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-3">
                                        <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
                                        Items
                                    </h3>
                                    {/* Global Tax Setting */}
                                    <div className="flex items-center gap-3 bg-indigo-50/50 border border-indigo-100 px-4 py-2 rounded-xl">
                                        <span className="text-sm font-semibold text-indigo-700">Global Tax %:</span>
                                        <input
                                            type="number"
                                            className="w-20 text-sm font-medium border-indigo-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={globalTaxRate}
                                            onChange={(e) => handleGlobalTaxChange(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="text-sm bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 flex items-center gap-2 transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Item
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-12 gap-3 text-xs font-bold text-gray-500 uppercase tracking-wider px-4">
                                    <div className="col-span-2">Type</div>
                                    <div className="col-span-3">Product / Component</div>
                                    <div className="col-span-1">Qty</div>
                                    <div className="col-span-1">Unit</div>
                                    <div className="col-span-1">Rate</div>
                                    <div className="col-span-1">Tax%</div>
                                    <div className="col-span-2 text-right">Amount</div>
                                    <div className="col-span-1"></div>
                                </div>

                                {formData.items.map((item, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-3 items-start p-4 bg-gray-50/50 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors">
                                        
                                        <div className="col-span-2">
                                            <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleItemTypeChange(index, 'fg')}
                                                    className={`flex-1 text-[11px] py-1.5 px-1 rounded-md font-medium transition-all ${item.itemType !== 'custom' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-gray-500 hover:bg-gray-50'}`}
                                                >
                                                    FG
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleItemTypeChange(index, 'custom')}
                                                    className={`flex-1 text-[11px] py-1.5 px-1 rounded-md font-medium transition-all ${item.itemType === 'custom' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-gray-500 hover:bg-gray-50'}`}
                                                >
                                                    Custom
                                                </button>
                                            </div>
                                        </div>

                                        <div className="col-span-3">
                                            {item.itemType !== 'custom' ? (
                                                <select
                                                    value={item.component || ""}
                                                    onChange={(e) => handleComponentChange(index, e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                                >
                                                    <option value="">Select FG Item</option>
                                                    {components.map((c) => (
                                                        <option key={c._id} value={c._id}>{c.componentName || c.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={item.productName}
                                                    onChange={(e) => updateItem(index, "productName", e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                                    placeholder="Enter custom product name"
                                                    required
                                                />
                                            )}
                                            
                                            <input
                                                type="text"
                                                value={item.description || ''}
                                                onChange={(e) => updateItem(index, "description", e.target.value)}
                                                className="w-full mt-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                                placeholder="Optional description/specs"
                                            />
                                        </div>
                                        
                                        <div className="col-span-1">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                                className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <input
                                                type="text"
                                                value={item.unit}
                                                onChange={(e) => updateItem(index, "unit", e.target.value)}
                                                className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <input
                                                type="number"
                                                value={item.rate}
                                                onChange={(e) => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                                                className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <input
                                                type="number"
                                                value={item.taxRate}
                                                onChange={(e) => updateItem(index, "taxRate", parseFloat(e.target.value) || 0)}
                                                className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            />
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <div className="font-bold text-gray-900 text-sm mt-1">
                                                ₹ {(item.amount + (item.taxAmount || 0)).toFixed(2)}
                                            </div>
                                            <div className="text-[10px] text-gray-500 mt-1 font-medium bg-gray-100/80 inline-block px-2 py-0.5 rounded">
                                                Base: ₹{item.amount.toFixed(0)} | Tax: ₹{item.taxAmount?.toFixed(0)}
                                            </div>
                                        </div>
                                        <div className="col-span-1 text-right mt-1">
                                            {formData.items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer Totals & Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className={isPreview ? "pointer-events-none opacity-70" : ""}>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Remarks / Terms</label>
                                    <textarea
                                        value={formData.otherDetails}
                                        onChange={(e) => setFormData({ ...formData, otherDetails: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                                        rows={4}
                                        placeholder="Payment terms, delivery notes, etc."
                                    />
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-100/50 flex flex-col justify-center space-y-4">
                                <div className="flex justify-between items-center text-sm font-medium text-gray-600 px-2">
                                    <span>Subtotal</span>
                                    <span>₹ {formData.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-medium text-gray-600 px-2">
                                    <span>Total Tax</span>
                                    <span>₹ {formData.taxAmount?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-medium text-gray-900 bg-white/60 p-3 rounded-xl border border-white">
                                    <span>Discount (Flat)</span>
                                    <div className={`flex items-center gap-2 ${isPreview ? "pointer-events-none opacity-70" : ""}`}>
                                        <span className="text-gray-400">₹</span>
                                        <input
                                            type="number"
                                            value={formData.discount}
                                            onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                                            className="w-24 px-3 py-1.5 text-right font-semibold bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="pt-4 mt-2 border-t border-indigo-100/80 flex justify-between items-center px-2">
                                    <span className="text-lg font-bold text-gray-900">Total Amount</span>
                                    <span className="text-3xl font-extrabold text-indigo-700 tracking-tight">₹ {formData.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="quotation-form"
                        disabled={loading}
                        className={`px-8 py-2.5 rounded-xl font-bold text-white shadow-sm transition-all focus:ring-4 focus:ring-indigo-500/20 ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-indigo-500/25 hover:shadow-indigo-500/40'}`}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Saving...
                            </span>
                        ) : (
                            isPreview ? "Update Status" : isEditing ? "Update Quotation" : "Create Quotation"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
