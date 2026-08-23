import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Package, User, Calendar, Hash, FileText, Truck, Box, Calculator, Layers, Sparkles } from 'lucide-react';
import { POModalProps } from "@/src/features/store/types/store.types";
import SearchableSelect from '@/src/features/store/components/SearchableSelect';
import { apiGet } from '@/src/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface POLineItemEntry {
    itemType: 'rm' | 'bo' | 'consumable' | 'custom';
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
    materials = [],
    vendors = [],
    inHouseItems = [],
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

    // 3 distinct inventory lists
    const [rawMaterialsList, setRawMaterialsList] = useState<any[]>([]);
    const [boughtOutsList, setBoughtOutsList] = useState<any[]>([]);
    const [consumablesList, setConsumablesList] = useState<any[]>([]);

    // Logistics & Packing state
    const [transportType, setTransportType] = useState('Road Freight');
    const [transportCharge, setTransportCharge] = useState<number>(0);
    const [packingType, setPackingType] = useState('Standard Packaging');
    const [packingCharge, setPackingCharge] = useState<number>(0);

    const [materialEntries, setMaterialEntries] = useState<POLineItemEntry[]>([{
        itemType: 'rm',
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

    // Fetch 3 separate inventory feeds & price lists
    useEffect(() => {
        if (isOpen) {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (!token) return;

            Promise.all([
                apiGet('/api/store/raw-material', token).catch(() => []),
                apiGet('/api/store/bought-out', token).catch(() => []),
                apiGet('/api/store/consumable-item', token).catch(() => []),
                apiGet('/api/purchase/price-list', token).catch(() => ({ data: [] }))
            ]).then(([rmRes, boRes, conRes, plRes]) => {
                setRawMaterialsList(Array.isArray(rmRes) ? rmRes : (rmRes?.rawMaterials || []));
                setBoughtOutsList(Array.isArray(boRes) ? boRes : (boRes?.boughtOuts || []));
                setConsumablesList(Array.isArray(conRes) ? conRes : (conRes?.consumables || conRes?.consumableItems || []));
                const pl = Array.isArray(plRes?.data) ? plRes.data : (Array.isArray(plRes) ? plRes : []);
                setFetchedPriceLists(pl);
            }).catch(e => {
                console.error("Failed to load inventory feeds for PO Modal:", e);
            });
        }
    }, [isOpen]);

    // Vendor options
    const vendorOptions = useMemo(() => {
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

    // 3 distinct dropdown options
    const rmOptions = useMemo(() => {
        return rawMaterialsList.map(item => ({
            value: item._id,
            label: `${item.name || 'RM'} ${item.code ? `(${item.code})` : ''}`
        }));
    }, [rawMaterialsList]);

    const boOptions = useMemo(() => {
        return boughtOutsList.map(item => ({
            value: item._id,
            label: `${item.name || 'BO'} ${item.code ? `(${item.code})` : ''}`
        }));
    }, [boughtOutsList]);

    const consumableOptions = useMemo(() => {
        return consumablesList.map(item => ({
            value: item._id,
            label: `${item.name || 'Consumable'} ${item.code ? `(${item.code})` : ''}`
        }));
    }, [consumablesList]);

    const generatePONumber = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        return `PO/${year}${month}${day}-${hours}${minutes}${seconds}`;
    };

    useEffect(() => {
        if (isOpen) {
            if (isEditing && initialData) {
                setPoNumber(initialData.poNumber || '');
                setDate(initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '');
                setVendor(typeof initialData.vendor === 'object' ? (initialData.vendor as any)?._id : (initialData.vendor || ''));
                setTransportType(initialData.transportType || 'Road Freight');
                setTransportCharge(initialData.transportCharge || 0);
                setPackingType(initialData.packingType || 'Standard Packaging');
                setPackingCharge(initialData.packingCharge || 0);

                if (initialData.items && initialData.items.length > 0) {
                    setMaterialEntries(initialData.items.map((item: any) => {
                        const qty = Number(item.quantity) || 0;
                        const rate = Number(item.rate) || 0;
                        const taxRate = item.taxRate != null ? Number(item.taxRate) : 18;
                        const lineSub = qty * rate;
                        const lineTax = lineSub * (taxRate / 100);

                        return {
                            itemType: item.itemType || 'rm',
                            material: typeof item.material === 'object' ? item.material?._id : (item.material || ''),
                            component: item.component || '',
                            materialName: item.materialName || item.material?.name || '',
                            description: item.description || '',
                            quantity: qty,
                            unit: item.unit || 'PCS',
                            rate: rate,
                            taxRate: taxRate,
                            taxAmount: item.taxAmount != null ? Number(item.taxAmount) : lineTax,
                            amount: item.amount != null ? Number(item.amount) : (lineSub + lineTax),
                            category: item.category || '',
                        };
                    }));
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
                    itemType: 'rm',
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

    const handleItemTypeChange = (index: number, newType: 'rm' | 'bo' | 'consumable' | 'custom') => {
        setMaterialEntries(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                itemType: newType,
                material: '',
                materialName: '',
                description: '',
                rate: 0,
                amount: 0,
                taxAmount: 0,
            };
            return updated;
        });
    };

    const handleMaterialSelect = (index: number, selectedId: string) => {
        const currentEntry = materialEntries[index];
        const entryType = currentEntry.itemType;

        let foundItem: any = null;
        if (entryType === 'rm') {
            foundItem = rawMaterialsList.find(m => m._id === selectedId);
        } else if (entryType === 'bo') {
            foundItem = boughtOutsList.find(m => m._id === selectedId);
        } else if (entryType === 'consumable') {
            foundItem = consumablesList.find(m => m._id === selectedId);
        }

        const activePriceLists = (priceLists && priceLists.length > 0) ? priceLists : fetchedPriceLists;
        const priceConfig = activePriceLists.find((p: any) => 
            (p.material?._id || p.material)?.toString() === selectedId
        );

        const autoRate = priceConfig && priceConfig.price != null ? Number(priceConfig.price) : 0;
        const autoTax = (foundItem as any)?.gstRate || (foundItem as any)?.tax || 18;
        const autoUnit = (foundItem as any)?.unit || (typeof foundItem?.category === 'object' ? foundItem?.category?.unit : '') || 'PCS';
        const autoCat = typeof foundItem?.category === 'object' ? foundItem?.category?.name : (foundItem?.category || '');
        const autoDesc = foundItem?.description || foundItem?.descriptions || foundItem?.specifications || '';

        setMaterialEntries(prev => {
            const updated = [...prev];
            const qty = updated[index].quantity || 0;
            const rate = autoRate || updated[index].rate || 0;
            const sub = qty * rate;
            const tax = sub * (autoTax / 100);

            updated[index] = {
                ...updated[index],
                material: selectedId,
                materialName: foundItem?.name || '',
                description: autoDesc,
                unit: autoUnit,
                rate: rate,
                taxRate: autoTax,
                taxAmount: tax,
                amount: sub + tax,
                category: autoCat,
            };
            return updated;
        });
    };

    const updateEntry = (index: number, field: keyof POLineItemEntry, value: any) => {
        setMaterialEntries(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };

            if (field === 'quantity' || field === 'rate' || field === 'taxRate') {
                const qty = field === 'quantity' ? Number(value) : (updated[index].quantity || 0);
                const rate = field === 'rate' ? Number(value) : (updated[index].rate || 0);
                const taxRate = field === 'taxRate' ? Number(value) : (updated[index].taxRate || 0);
                const lineSub = qty * rate;
                const lineTax = lineSub * (taxRate / 100);

                updated[index].taxAmount = lineTax;
                updated[index].amount = lineSub + lineTax;
            }
            return updated;
        });
    };

    const handleAddEntry = () => {
        setMaterialEntries(prev => [...prev, {
            itemType: 'rm',
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

    const handleRemoveEntry = (index: number) => {
        if (materialEntries.length > 1) {
            setMaterialEntries(prev => prev.filter((_, i) => i !== index));
        }
    };

    // Calculate subtotal, taxes, logistics, and grand total
    const subtotal = materialEntries.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.rate) || 0)), 0);
    const totalTax = materialEntries.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0);
    const totalLogistics = (Number(transportCharge) || 0) + (Number(packingCharge) || 0);
    const grandTotal = subtotal + totalTax + totalLogistics;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const invalid = materialEntries.filter(m => (!m.material && !m.materialName) || m.quantity <= 0);
        if (invalid.length > 0) {
            alert("Please ensure every item has a valid material selected and quantity > 0.");
            return;
        }

        const selectedVendorObj = (vendors || []).find((v: any) => (v._id || v.id) === vendor);

        const payload = {
            poNumber,
            date,
            vendor,
            vendorName: selectedVendorObj?.name || '',
            items: materialEntries.map(item => ({
                itemType: item.itemType,
                material: item.material || undefined,
                materialName: item.materialName,
                description: item.description,
                quantity: Number(item.quantity),
                unit: item.unit,
                rate: Number(item.rate),
                taxRate: Number(item.taxRate),
                taxAmount: Number(item.taxAmount),
                amount: Number(item.amount),
                category: item.category,
            })),
            transportType,
            transportCharge: Number(transportCharge) || 0,
            packingType,
            packingCharge: Number(packingCharge) || 0,
            subtotal,
            totalTax,
            grandTotal,
        };

        onSubmit(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden border border-gray-100">
                
                {/* Modal Header */}
                <div className="px-5 py-3.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white flex items-center justify-between shrink-0 shadow-md">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-white/15 rounded-lg border border-white/20">
                            <FileText className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                            {isEditing ? `Edit Purchase Order (${poNumber})` : 'Create Outward Purchase Order (PO)'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-gray-50/60">
                    
                    {/* Top Details Card */}
                    <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200/80 shadow-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                    PO Number
                                </label>
                                <input
                                    type="text"
                                    value={poNumber}
                                    readOnly
                                    className="w-full px-2.5 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 font-mono text-xs font-semibold select-all cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                    PO Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                    Supplier / Vendor <span className="text-red-500">*</span>
                                </label>
                                <SearchableSelect
                                    options={vendorOptions}
                                    value={vendor}
                                    onChange={(val: any) => setVendor(val)}
                                    placeholder="Search and Select Vendor..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Items Section */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50/90 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-600" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                                    Order Line Items
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                                    {materialEntries.length} Item(s)
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddEntry}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Item
                            </button>
                        </div>

                        {/* Desktop View Table (hidden on mobile) */}
                        <div className="hidden lg:block overflow-x-auto min-h-[260px] pb-24">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100/75 text-gray-600 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                                        <th className="py-2.5 px-3 w-36">Inventory Type</th>
                                        <th className="py-2.5 px-3 min-w-[280px]">Item Description</th>
                                        <th className="py-2.5 px-3 w-24">Qty</th>
                                        <th className="py-2.5 px-3 w-20">Unit</th>
                                        <th className="py-2.5 px-3 w-28">Rate (₹)</th>
                                        <th className="py-2.5 px-3 w-24">GST %</th>
                                        <th className="py-2.5 px-3 w-32 text-right">Line Total (₹)</th>
                                        <th className="py-2.5 px-3 w-10 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs">
                                    {materialEntries.map((entry, index) => {
                                        let optionsToUse = rmOptions;
                                        if (entry.itemType === 'bo') optionsToUse = boOptions;
                                        else if (entry.itemType === 'consumable') optionsToUse = consumableOptions;

                                        return (
                                            <tr key={index} className="hover:bg-indigo-50/20 transition-colors">
                                                <td className="py-2 px-3 text-center text-gray-400 font-bold">
                                                    {index + 1}
                                                </td>

                                                {/* Inventory Type Selector */}
                                                <td className="py-2 px-3">
                                                    <select
                                                        value={entry.itemType}
                                                        onChange={(e) => handleItemTypeChange(index, e.target.value as any)}
                                                        className="w-full px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                                    >
                                                        <option value="rm">Raw Material (RM)</option>
                                                        <option value="bo">Bought Out (BO)</option>
                                                        <option value="consumable">Consumable</option>
                                                        <option value="custom">Custom Entry</option>
                                                    </select>
                                                </td>

                                                {/* Item Searchable Dropdown or Custom Input */}
                                                <td className="py-2 px-3">
                                                    {entry.itemType === 'custom' ? (
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="Custom item description..."
                                                            value={entry.materialName}
                                                            onChange={(e) => updateEntry(index, 'materialName', e.target.value)}
                                                            className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                                                        />
                                                    ) : (
                                                        <SearchableSelect
                                                            options={optionsToUse}
                                                            value={entry.material || ''}
                                                            onChange={(val: any) => handleMaterialSelect(index, val)}
                                                            placeholder={`Select ${entry.itemType === 'rm' ? 'Raw Material' : entry.itemType === 'bo' ? 'Bought Out' : 'Consumable'}...`}
                                                        />
                                                    )}
                                                </td>

                                                {/* Qty */}
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="number"
                                                        min="0.001"
                                                        step="any"
                                                        required
                                                        value={entry.quantity || ''}
                                                        onChange={(e) => updateEntry(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                        placeholder="0"
                                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </td>

                                                {/* Unit */}
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="text"
                                                        value={entry.unit}
                                                        onChange={(e) => updateEntry(index, 'unit', e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 text-center"
                                                    />
                                                </td>

                                                {/* Rate */}
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={entry.rate || ''}
                                                        onChange={(e) => updateEntry(index, 'rate', parseFloat(e.target.value) || 0)}
                                                        placeholder="0.00"
                                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </td>

                                                {/* Tax Rate % */}
                                                <td className="py-2 px-3">
                                                    <select
                                                        value={entry.taxRate}
                                                        onChange={(e) => updateEntry(index, 'taxRate', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                                    >
                                                        <option value="0">0%</option>
                                                        <option value="5">5%</option>
                                                        <option value="12">12%</option>
                                                        <option value="18">18%</option>
                                                        <option value="28">28%</option>
                                                    </select>
                                                </td>

                                                {/* Line Total */}
                                                <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                                                    ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>

                                                {/* Trash */}
                                                <td className="py-2 px-3 text-center">
                                                    {materialEntries.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveEntry(index)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View: Touch-Friendly Cards (hidden on desktop) */}
                        <div className="block lg:hidden p-3 space-y-3 bg-gray-50/70">
                            {materialEntries.map((entry, index) => {
                                let optionsToUse = rmOptions;
                                if (entry.itemType === 'bo') optionsToUse = boOptions;
                                else if (entry.itemType === 'consumable') optionsToUse = consumableOptions;

                                return (
                                    <div key={index} className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2.5">
                                        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                                Line Item #{index + 1}
                                            </span>
                                            {materialEntries.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveEntry(index)}
                                                    className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Type Selector */}
                                        <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
                                            <button
                                                type="button"
                                                onClick={() => handleItemTypeChange(index, 'rm')}
                                                className={`py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                    entry.itemType === 'rm' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600'
                                                }`}
                                            >
                                                RM
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleItemTypeChange(index, 'bo')}
                                                className={`py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                    entry.itemType === 'bo' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600'
                                                }`}
                                            >
                                                BO
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleItemTypeChange(index, 'consumable')}
                                                className={`py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                    entry.itemType === 'consumable' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600'
                                                }`}
                                            >
                                                Consumable
                                            </button>
                                        </div>

                                        {/* Item Select */}
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                                                {entry.itemType === 'rm' ? 'Raw Material' : entry.itemType === 'bo' ? 'Bought Out' : 'Consumable'}
                                            </label>
                                            <SearchableSelect
                                                options={optionsToUse}
                                                value={entry.material || ''}
                                                onChange={(val: any) => handleMaterialSelect(index, val)}
                                                placeholder={`Select ${entry.itemType.toUpperCase()}...`}
                                            />
                                        </div>

                                        {/* Qty, Unit, Rate Grid */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Qty</label>
                                                <input
                                                    type="number"
                                                    min="0.001"
                                                    step="any"
                                                    required
                                                    value={entry.quantity || ''}
                                                    onChange={(e) => updateEntry(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                    className="w-full px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Unit</label>
                                                <input
                                                    type="text"
                                                    value={entry.unit}
                                                    onChange={(e) => updateEntry(index, 'unit', e.target.value)}
                                                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Rate (₹)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={entry.rate || ''}
                                                    onChange={(e) => updateEntry(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    placeholder="0.00"
                                                    className="w-full px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-semibold"
                                                />
                                            </div>
                                        </div>

                                        {/* Row Total */}
                                        <div className="flex items-center justify-between pt-1 text-xs">
                                            <span className="text-gray-500 font-semibold">Row Total (incl. {entry.taxRate}% GST):</span>
                                            <span className="font-mono font-bold text-gray-900">
                                                ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Logistics & Grand Total Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Optional Logistics */}
                        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs space-y-3">
                            <h4 className="text-xs font-bold uppercase text-gray-700 flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                                Logistics & Packaging (Optional)
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Transport Mode</label>
                                    <select
                                        value={transportType}
                                        onChange={(e) => setTransportType(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                                    >
                                        <option value="Road Freight">Road Freight</option>
                                        <option value="Air Cargo">Air Cargo</option>
                                        <option value="Courier Express">Courier Express</option>
                                        <option value="Self Pickup">Self Pickup</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Transport Charges (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={transportCharge || ''}
                                        onChange={(e) => setTransportCharge(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Packaging Mode</label>
                                    <select
                                        value={packingType}
                                        onChange={(e) => setPackingType(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                                    >
                                        <option value="Standard Packaging">Standard Packaging</option>
                                        <option value="Wooden Crate">Wooden Crate</option>
                                        <option value="Bubble Wrap & Box">Bubble Wrap & Box</option>
                                        <option value="Pallet Packing">Pallet Packing</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Packaging Charges (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={packingCharge || ''}
                                        onChange={(e) => setPackingCharge(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Grand Total Calculation Box */}
                        <div className="bg-gradient-to-br from-indigo-50/90 to-blue-50/70 p-4 rounded-xl border border-indigo-200/80 shadow-xs flex flex-col justify-between space-y-2 text-xs">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-gray-600">
                                    <span>Items Subtotal:</span>
                                    <span className="font-mono font-bold text-gray-900">
                                        ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-gray-600">
                                    <span>GST Tax:</span>
                                    <span className="font-mono font-bold text-gray-900">
                                        ₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                {totalLogistics > 0 && (
                                    <div className="flex items-center justify-between text-gray-600">
                                        <span>Logistics & Packaging:</span>
                                        <span className="font-mono font-bold text-gray-900">
                                            ₹{totalLogistics.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 border-t border-indigo-200 flex items-center justify-between">
                                <span className="font-bold text-indigo-950 text-sm">Grand Total:</span>
                                <span className="text-base font-extrabold text-indigo-800 bg-white px-3 py-1 rounded-lg border border-indigo-200 shadow-2xs font-mono">
                                    ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 rounded-xl text-white text-xs font-bold shadow-md bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <span>{isEditing ? 'Update Purchase Order' : 'Release Purchase Order'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
