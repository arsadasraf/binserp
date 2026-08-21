/**
 * POModal Component - Multi-Material Support with Tax, Description, & Logistics Charges
 * 
 * Modal dialog for creating/editing Purchase Orders (PO).
 * Features:
 * - Auto-generated PO number based on date and time
 * - Vendor selection with searchable dropdown
 * - Multiple material entries support (RM/BO Master vs Custom)
 * - Auto-filled Description & Tax Rate per item
 * - Optional Transport Types & Charges (Road, Air, Courier, etc.)
 * - Optional Packing Types & Charges (Standard Box, Wooden Crate, etc.)
 * - Subtotal, GST Tax, Logistics, and Grand Total Calculation
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, User, Calendar, Hash, FileText, Truck, Box, Calculator } from 'lucide-react';
import { POModalProps, RmBoItem } from "@/src/features/store/types/store.types";
import SearchableSelect from '../SearchableSelect';

import { API_BASE_URL } from '@/src/utils/config';

interface MaterialEntry {
    itemType: 'bo' | 'custom';
    material?: string;
    component?: string;
    materialName: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    taxRate: number;
    taxAmount: number;
    amount: number;
    category: string;
}

export default function POModal({
    isOpen,
    onClose,
    onSubmit,
    materials,
    vendors,
    inHouseItems,
    priceLists = [],
    loading,
    initialData,
    isEditing = false,
}: POModalProps) {
    // Form state
    const [poNumber, setPoNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [vendor, setVendor] = useState('');
    const [fetchedPriceLists, setFetchedPriceLists] = useState<any[]>([]);

    // Logistics & Packing optional state
    const [transportType, setTransportType] = useState('Road Freight');
    const [transportCharge, setTransportCharge] = useState<number>(0);
    const [packingType, setPackingType] = useState('Standard Packaging');
    const [packingCharge, setPackingCharge] = useState<number>(0);

    const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([{
        itemType: 'bo',
        material: '',
        materialName: '',
        description: '',
        quantity: 0,
        unit: 'PCS',
        rate: 0,
        taxRate: 18,
        taxAmount: 0,
        amount: 0,
        category: '',
    }]);

    // Deduplicated options for vendors and materials
    const vendorOptions = React.useMemo(() => {
        const list: any[] = [];
        const seen = new Set<string>();
        (vendors || []).forEach((v: any) => {
            const val = v._id || v.id;
            const label = `${v.name || v.companyName || 'Vendor'} ${v.code ? `(${v.code})` : ''}`.trim();
            if (val && !seen.has(val)) {
                seen.add(val);
                list.push({ value: val, label });
            }
        });
        return list;
    }, [vendors]);

    const itemOptions = React.useMemo(() => {
        const list: any[] = [];
        const seen = new Set<string>();

        (materials || []).forEach((item: any) => {
            const val = `MAT_${item._id || item.id}`;
            const label = `${item.name || 'Material'} ${((item as any).code) ? `(${((item as any).code)})` : ''}`.trim();
            if ((item._id || item.id) && !seen.has(val)) {
                seen.add(val);
                list.push({ value: val, label });
            }
        });

        return list;
    }, [materials]);

    // Fetch price lists if not passed via props
    useEffect(() => {
        if (isOpen) {
            const fetchPrices = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`${API_BASE_URL}/api/purchase/price-list`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const json = await res.json();
                        setFetchedPriceLists(json.data || []);
                    }
                } catch (e) {
                    console.error("Failed to fetch price list:", e);
                }
            };
            fetchPrices();
        }
    }, [isOpen]);

    const generatePONumber = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

        return `PO/${year}${month}${day}-${hours}${minutes}${seconds}-${milliseconds}`;
    };

    useEffect(() => {
        if (isOpen) {
            if (isEditing && initialData) {
                setPoNumber(initialData.poNumber || '');
                setDate(initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '');
                setVendor(initialData.vendor || '');
                setTransportType(initialData.transportType || 'Road Freight');
                setTransportCharge(initialData.transportCharge || 0);
                setPackingType(initialData.packingType || 'Standard Packaging');
                setPackingCharge(initialData.packingCharge || 0);
                
                // Load existing entries or fallback to legacy single item format
                if (initialData.items && initialData.items.length > 0) {
                    setMaterialEntries(initialData.items.map((item: any) => {
                        const qty = item.quantity || 0;
                        const rate = item.rate || 0;
                        const taxRate = item.taxRate != null ? item.taxRate : 18;
                        const lineSub = qty * rate;
                        const lineTax = lineSub * (taxRate / 100);

                        return {
                            itemType: item.itemType || (item.material || item.component ? 'bo' : 'custom'),
                            material: item.material || '',
                            component: item.component || '',
                            materialName: item.materialName || '',
                            description: item.description || '',
                            quantity: qty,
                            unit: item.unit || 'PCS',
                            rate: rate,
                            taxRate: taxRate,
                            taxAmount: item.taxAmount != null ? item.taxAmount : lineTax,
                            amount: item.amount != null ? item.amount : (lineSub + lineTax),
                            category: item.category || '',
                        };
                    }));
                } else {
                    const qty = initialData.quantity || 0;
                    const rate = initialData.rate || 0;
                    const lineSub = qty * rate;
                    const lineTax = lineSub * 0.18;

                    setMaterialEntries([{
                        itemType: initialData.material || initialData.component ? 'bo' : 'custom',
                        material: initialData.material || '',
                        component: initialData.component || '',
                        materialName: initialData.materialName || '',
                        description: (initialData as any).description || '',
                        quantity: qty,
                        unit: initialData.unit || 'PCS',
                        rate: rate,
                        taxRate: 18,
                        taxAmount: lineTax,
                        amount: initialData.amount || (lineSub + lineTax),
                        category: initialData.category || '',
                    }]);
                }
            } else {
                setPoNumber(generatePONumber());
                setDate(new Date().toISOString().split('T')[0]);
                setVendor('');
                setTransportType('Road Freight');
                setTransportCharge(0);
                setPackingType('Standard Packaging');
                setPackingCharge(0);
                setMaterialEntries([{
                    itemType: 'bo',
                    material: '',
                    materialName: '',
                    description: '',
                    quantity: 0,
                    unit: 'PCS',
                    rate: 0,
                    taxRate: 18,
                    taxAmount: 0,
                    amount: 0,
                    category: '',
                }]);
            }
        }
    }, [isOpen, isEditing, initialData]);

    const handleMaterialChange = (index: number, selectedValue: string) => {
        const [type, id] = selectedValue.split('_');
        const newEntries = [...materialEntries];

        if (type === 'MAT') {
            const selectedMaterial = materials.find(item => item._id === id);
            
            // Auto-fetch price from Price List
            const activePriceLists = (priceLists && priceLists.length > 0) ? priceLists : fetchedPriceLists;
            const priceConfig = activePriceLists.find((p: any) => 
                (p.material?._id || p.material)?.toString() === id
            );

            const autoRate = (priceConfig && priceConfig.price != null) ? Number(priceConfig.price) : 0;
            const currentQty = newEntries[index].quantity || 0;
            const autoTax = (selectedMaterial as any)?.gstRate || (selectedMaterial as any)?.tax || 18;
            const desc = (selectedMaterial as any)?.description || (selectedMaterial as any)?.descriptions || (selectedMaterial as any)?.specifications || '';

            const rate = autoRate || newEntries[index].rate || 0;
            const lineSubtotal = currentQty * rate;
            const lineTax = lineSubtotal * (autoTax / 100);

            newEntries[index] = {
                ...newEntries[index],
                material: id,
                component: undefined,
                materialName: selectedMaterial?.name || '',
                description: desc,
                unit: getCategoryUnit(selectedMaterial) || 'PCS',
                rate: rate,
                taxRate: autoTax,
                taxAmount: lineTax,
                amount: lineSubtotal + lineTax,
                category: getCategoryName(selectedMaterial) || '',
            };
        } else if (type === 'FG') {
            const selectedComponent = inHouseItems?.find((item: any) => item._id === id);
            newEntries[index] = {
                ...newEntries[index],
                component: id,
                material: undefined,
                materialName: selectedComponent?.partName || selectedComponent?.name || selectedComponent?.componentName || '',
                description: selectedComponent?.description || '',
                unit: selectedComponent?.unit || 'PCS',
                category: 'InHouse',
            };
        } else {
             newEntries[index] = {
                ...newEntries[index],
                material: '',
                component: '',
                materialName: '',
                description: '',
                unit: 'PCS',
                category: '',
            };
        }
        setMaterialEntries(newEntries);
    };

    const getCategoryUnit = (material: RmBoItem | undefined): string => {
        if (!material) return 'PCS';
        if (typeof material.categoryId === 'object' && material.categoryId.unit) {
            return material.categoryId.unit;
        }
        return material.category?.unit || 'PCS';
    };

    const getCategoryName = (material: RmBoItem | undefined): string => {
        if (!material) return '';
        if (typeof material.categoryId === 'object' && material.categoryId.name) {
            return material.categoryId.name;
        }
        return material.category?.name || '';
    };

    const updateEntry = (index: number, field: keyof MaterialEntry, value: any) => {
        const newEntries = [...materialEntries];
        newEntries[index] = { ...newEntries[index], [field]: value };

        // Handle item type switch
        if (field === 'itemType') {
            if (value === 'custom') {
                newEntries[index].material = '';
                newEntries[index].component = '';
            } else {
                newEntries[index].materialName = '';
            }
        }

        // Auto-calculate amount & taxAmount when quantity, rate, or taxRate changes
        if (field === 'quantity' || field === 'rate' || field === 'taxRate') {
            const entry = newEntries[index];
            const qty = Number(entry.quantity) || 0;
            const rate = Number(entry.rate) || 0;
            const taxRate = Number(entry.taxRate) || 0;

            const lineSub = qty * rate;
            const lineTax = lineSub * (taxRate / 100);

            newEntries[index].taxAmount = lineTax;
            newEntries[index].amount = lineSub + lineTax;
        }

        setMaterialEntries(newEntries);
    };

    const addMaterialEntry = () => {
        setMaterialEntries([...materialEntries, {
            itemType: 'bo',
            material: '',
            materialName: '',
            description: '',
            quantity: 0,
            unit: 'PCS',
            rate: 0,
            taxRate: 18,
            taxAmount: 0,
            amount: 0,
            category: '',
        }]);
    };

    const removeMaterialEntry = (index: number) => {
        if (materialEntries.length > 1) {
            setMaterialEntries(materialEntries.filter((_, i) => i !== index));
        }
    };

    const getSubtotal = () => {
        return materialEntries.reduce((sum, entry) => sum + ((entry.quantity || 0) * (entry.rate || 0)), 0);
    };

    const getTotalTax = () => {
        return materialEntries.reduce((sum, entry) => {
            const lineSub = (entry.quantity || 0) * (entry.rate || 0);
            return sum + (lineSub * ((entry.taxRate || 0) / 100));
        }, 0);
    };

    const getGrandTotal = () => {
        return getSubtotal() + getTotalTax() + (Number(transportCharge) || 0) + (Number(packingCharge) || 0);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const sub = getSubtotal();
        const tax = getTotalTax();
        const grand = getGrandTotal();

        onSubmit({
            poNumber,
            date,
            vendor,
            transportType,
            transportCharge: Number(transportCharge) || 0,
            packingType,
            packingCharge: Number(packingCharge) || 0,
            subtotal: sub,
            totalTax: tax,
            totalAmount: grand,
            grandTotal: grand,
            items: materialEntries.map(entry => {
                const payload: any = {
                    itemType: entry.itemType,
                    materialName: entry.materialName,
                    description: entry.description,
                    quantity: entry.quantity,
                    unit: entry.unit,
                    rate: entry.rate,
                    taxRate: entry.taxRate,
                    taxAmount: entry.taxAmount,
                    amount: entry.amount,
                };
                if (entry.material) payload.material = entry.material;
                if (entry.component) payload.component = entry.component;
                return payload;
            }),
        } as any);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Modal backdrop with blur */}
            <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[200] transition-opacity" onClick={onClose} />

            {/* Modal content - Extra Wide Layout */}
            <div className="fixed inset-0 flex items-center justify-center z-[200] p-2 sm:p-4">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-[96vw] w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
                    
                    {/* Modal header */}
                    <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-2xl bg-indigo-600/80 flex items-center justify-center border border-indigo-400/30 text-white shadow-lg shadow-indigo-500/30">
                                <FileText size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                                    {isEditing ? 'Edit Outward Purchase Order' : 'Create Outward Purchase Order'}
                                </h2>
                                <p className="text-xs text-indigo-200/80 mt-0.5 font-medium">
                                    Fill in vendor details, select RM/BO materials with tax rates & descriptions, and optional freight charges.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 bg-white/10 hover:bg-white/20 hover:rotate-90 rounded-full transition-all duration-300 text-white"
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Modal body - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6 pb-28">
                        <form id="po-form" onSubmit={handleSubmit} className="space-y-6">
                            
                            {/* General Details Section */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-visible">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-indigo-500 rounded-l-2xl"></div>
                                <h3 className="text-xs uppercase tracking-wider font-extrabold text-slate-400 mb-4 pl-2">General Order Info</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* PO Number */}
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                                            <Hash size={14} className="text-purple-500" />
                                            PO Number
                                        </label>
                                        <input
                                            type="text"
                                            value={poNumber}
                                            readOnly
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-mono text-xs font-bold cursor-not-allowed outline-none"
                                        />
                                    </div>

                                    {/* Date */}
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                                            <Calendar size={14} className="text-indigo-500" />
                                            Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-gray-800 font-bold text-xs outline-none"
                                        />
                                    </div>

                                    {/* Vendor */}
                                    <div className="space-y-1.5 overflow-visible">
                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                                            <User size={14} className="text-pink-500" />
                                            Vendor / Supplier <span className="text-red-500">*</span>
                                        </label>
                                        <SearchableSelect
                                            options={vendorOptions}
                                            value={vendor}
                                            onChange={(val: any) => setVendor(val)}
                                            placeholder="Select Vendor / Supplier"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Materials Section - Clean Table-Like Single Line Rows */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 relative overflow-visible">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-cyan-500 rounded-l-2xl"></div>
                                
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-gray-100 gap-4">
                                    <div className="flex items-center gap-2 pl-2">
                                        <Package size={20} className="text-indigo-600" />
                                        <h3 className="text-base font-extrabold text-gray-900">Order RM/BO Material Items</h3>
                                        <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200 ml-2">
                                            {materialEntries.length} Item{materialEntries.length !== 1 && 's'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addMaterialEntry}
                                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all duration-200 text-xs font-extrabold shadow-md shadow-indigo-600/20 group"
                                    >
                                        <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                                        Add Material Line Item
                                    </button>
                                </div>

                                <div className="p-5 space-y-3">
                                    
                                    {/* Table Column Headers for Single Line Layout */}
                                    <div className="hidden xl:grid grid-cols-12 gap-3 px-4 py-2 bg-slate-100/80 rounded-xl text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                                        <div className="col-span-1 text-center">Type</div>
                                        <div className="col-span-3">RM / BO Material Item</div>
                                        <div className="col-span-3">Item Specification / Description</div>
                                        <div className="col-span-1 text-center">Qty</div>
                                        <div className="col-span-2 text-center">Unit Rate (₹)</div>
                                        <div className="col-span-1 text-center">GST %</div>
                                        <div className="col-span-1 text-right pr-2">Total (₹)</div>
                                    </div>

                                    {/* Material Item Rows - Rendered on 1 Single Line */}
                                    {materialEntries.map((entry, index) => (
                                        <div 
                                            key={index} 
                                            className="relative bg-slate-50/70 hover:bg-indigo-50/30 rounded-2xl p-3.5 border border-slate-200/80 hover:border-indigo-300 transition-all duration-200 flex flex-col xl:grid xl:grid-cols-12 gap-3 items-center group shadow-2xs"
                                        >
                                            {/* Delete Button */}
                                            {materialEntries.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeMaterialEntry(index)}
                                                    className="absolute -right-3 -top-3 xl:static p-1.5 bg-white xl:bg-transparent text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full xl:rounded-xl transition-all border xl:border-none shadow-sm xl:shadow-none"
                                                    title="Remove Item"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}

                                            {/* Type Selection */}
                                            <div className="w-full xl:col-span-1">
                                                <label className="xl:hidden block text-[10px] font-bold text-gray-500 uppercase mb-1">Type</label>
                                                <select
                                                    value={entry.itemType}
                                                    onChange={e => updateEntry(index, 'itemType', e.target.value)}
                                                    className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                >
                                                    <option value="bo">RM/BO</option>
                                                    <option value="custom">Custom</option>
                                                </select>
                                            </div>

                                            {/* Item Name / Selection */}
                                            <div className="w-full xl:col-span-3 overflow-visible">
                                                <label className="xl:hidden block text-[10px] font-bold text-gray-500 uppercase mb-1">Material Item</label>
                                                {entry.itemType === 'custom' ? (
                                                    <input
                                                        type="text"
                                                        required
                                                        value={entry.materialName}
                                                        onChange={e => updateEntry(index, 'materialName', e.target.value)}
                                                        placeholder="Type custom item name..."
                                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-xs font-bold text-gray-800 outline-none"
                                                    />
                                                ) : (
                                                    <SearchableSelect
                                                        options={itemOptions}
                                                        value={entry.component ? `FG_${entry.component}` : entry.material ? `MAT_${entry.material}` : ''}
                                                        onChange={(val: any) => handleMaterialChange(index, val)}
                                                        placeholder="Select RM / BO Material..."
                                                    />
                                                )}
                                            </div>

                                            {/* Description Input */}
                                            <div className="w-full xl:col-span-3">
                                                <label className="xl:hidden block text-[10px] font-bold text-gray-500 uppercase mb-1">Specification / Description</label>
                                                <input
                                                    type="text"
                                                    value={entry.description || ''}
                                                    onChange={e => updateEntry(index, 'description', e.target.value)}
                                                    placeholder="Item specifications, grade, size..."
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-xs text-gray-800 outline-none"
                                                />
                                            </div>

                                            {/* Quantity */}
                                            <div className="w-full xl:col-span-1">
                                                <label className="xl:hidden block text-[10px] font-bold text-gray-500 uppercase mb-1">Qty</label>
                                                <input
                                                    type="number"
                                                    required
                                                    min="0"
                                                    step="0.01"
                                                    value={entry.quantity || ''}
                                                    onChange={(e) => updateEntry(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-xs font-bold text-gray-900 text-center outline-none"
                                                    placeholder="0"
                                                />
                                            </div>

                                            {/* Unit & Rate */}
                                            <div className="w-full xl:col-span-2">
                                                <label className="xl:hidden block text-[10px] font-bold text-gray-500 uppercase mb-1">Rate (₹)</label>
                                                <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500/20">
                                                    <span className="flex items-center justify-center bg-gray-50 px-2 text-gray-400 text-xs font-bold border-r border-gray-200">
                                                        ₹
                                                    </span>
                                                    <input
                                                        type="number"
                                                        required
                                                        min="0"
                                                        step="0.01"
                                                        value={entry.rate || ''}
                                                        onChange={(e) => updateEntry(index, 'rate', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-2 py-2 border-none focus:ring-0 text-xs font-bold text-gray-800 outline-none"
                                                        placeholder="0.00"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={entry.unit}
                                                        onChange={e => entry.itemType === 'custom' && updateEntry(index, 'unit', e.target.value.toUpperCase())}
                                                        readOnly={entry.itemType !== 'custom'}
                                                        className={`w-14 px-1 py-2 text-[11px] font-bold uppercase text-center border-l border-gray-200 ${entry.itemType === 'custom' ? 'bg-white text-indigo-600' : 'bg-slate-50 text-slate-500'}`}
                                                        placeholder="Unit"
                                                    />
                                                </div>
                                            </div>

                                            {/* GST Tax % */}
                                            <div className="w-full xl:col-span-1">
                                                <label className="xl:hidden block text-[10px] font-bold text-gray-500 uppercase mb-1">GST %</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={entry.taxRate != null ? entry.taxRate : 18}
                                                        onChange={(e) => updateEntry(index, 'taxRate', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-2 py-2 bg-white border border-gray-200 rounded-xl text-center font-bold text-slate-800 text-xs outline-none"
                                                        placeholder="18"
                                                    />
                                                </div>
                                            </div>

                                            {/* Line Amount */}
                                            <div className="w-full xl:col-span-1 text-right flex flex-col justify-center">
                                                <span className="text-[10px] text-slate-400 font-bold block xl:hidden">Line Total</span>
                                                <span className="text-xs font-black text-indigo-700 font-mono">
                                                    ₹{Number(entry.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Optional Logistics, Transport & Packing Section */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-visible p-6 space-y-4">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-blue-500"></div>
                                <h3 className="text-sm uppercase tracking-wider font-bold text-gray-500 flex items-center gap-2 pl-2">
                                    <Truck size={16} className="text-cyan-600" /> Optional Freight, Transport & Packing Charges
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Transport Details */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 space-y-3">
                                        <label className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                                            <Truck size={14} className="text-cyan-600" /> Transport Type & Freight Charges
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <select
                                                value={transportType}
                                                onChange={(e) => setTransportType(e.target.value)}
                                                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                                            >
                                                <option value="Road Freight">Road Freight</option>
                                                <option value="Air Cargo">Air Cargo</option>
                                                <option value="Express Courier">Express Courier</option>
                                                <option value="Rail Freight">Rail Freight</option>
                                                <option value="Self Pickup">Self Pickup</option>
                                                <option value="Custom Transport">Custom Transport</option>
                                            </select>

                                            <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
                                                <span className="flex items-center justify-center bg-gray-50 px-2.5 text-gray-500 text-xs font-bold border-r border-gray-200">
                                                    ₹
                                                </span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={transportCharge || ''}
                                                    onChange={(e) => setTransportCharge(parseFloat(e.target.value) || 0)}
                                                    placeholder="Transport Charge ₹"
                                                    className="w-full px-2 py-2 text-xs font-bold text-slate-900 border-none outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Packing & Forwarding Details */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 space-y-3">
                                        <label className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                                            <Box size={14} className="text-indigo-600" /> Packing & Forwarding Charges
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <select
                                                value={packingType}
                                                onChange={(e) => setPackingType(e.target.value)}
                                                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                                            >
                                                <option value="Standard Packaging">Standard Box</option>
                                                <option value="Wooden Crate">Wooden Crate</option>
                                                <option value="Palletized Box">Palletized Box</option>
                                                <option value="Bubble Wrap & Carton">Bubble Wrap & Carton</option>
                                                <option value="Custom Packaging">Custom Packaging</option>
                                            </select>

                                            <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
                                                <span className="flex items-center justify-center bg-gray-50 px-2.5 text-gray-500 text-xs font-bold border-r border-gray-200">
                                                    ₹
                                                </span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={packingCharge || ''}
                                                    onChange={(e) => setPackingCharge(parseFloat(e.target.value) || 0)}
                                                    placeholder="Packing Charge ₹"
                                                    className="w-full px-2 py-2 text-xs font-bold text-slate-900 border-none outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Total Order Summary Footer */}
                            <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-slate-600 border-b border-slate-200 pb-3">
                                    <div>Items Subtotal: <strong className="text-slate-900 font-mono block text-sm">₹{getSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                    <div>Total GST Tax: <strong className="text-slate-900 font-mono block text-sm">₹{getTotalTax().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                    <div>Transport Freight: <strong className="text-cyan-700 font-mono block text-sm">₹{Number(transportCharge || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                    <div>Packing Charge: <strong className="text-indigo-700 font-mono block text-sm">₹{Number(packingCharge || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-1">
                                    <div className="text-gray-500 text-xs font-medium">
                                        {materialEntries.length} Material Item{materialEntries.length !== 1 && 's'} in PO
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Grand Total Order Amount</span>
                                        <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 font-mono">
                                            ₹ {getGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                        </form>
                    </div>

                    {/* Modal footer */}
                    <div className="p-6 border-t border-gray-100 bg-white/80">
                        <div className="flex gap-4 justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-8 py-3 bg-white text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="po-form"
                                disabled={loading}
                                className="px-10 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-sm"
                            >
                                {loading ? 'Saving...' : isEditing ? 'Update Outward PO' : 'Create Outward PO'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
