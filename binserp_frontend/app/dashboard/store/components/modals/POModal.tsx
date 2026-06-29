/**
 * POModal Component - Multi-Material Support
 * 
 * Modal dialog for creating/editing Purchase Orders (PO).
 * Features:
 * - Auto-generated PO number based on date and time
 * - Vendor selection with searchable dropdown
 * - Multiple material entries support (Master vs Custom)
 * - Auto-calculated amount per material and total
 * - Modern Glassmorphism UI
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, User, Calendar, Hash, FileText } from 'lucide-react';
import { POModalProps, RmBoItem } from '../../types/store.types';

interface MaterialEntry {
    itemType: 'bo' | 'custom';
    material?: string;
    component?: string;
    materialName: string;
    quantity: number;
    unit: string;
    rate: number;
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
    loading,
    initialData,
    isEditing = false,
}: POModalProps) {
    // Form state
    const [poNumber, setPoNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [vendor, setVendor] = useState('');
    const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([{
        itemType: 'bo',
        material: '',
        materialName: '',
        quantity: 0,
        unit: 'PCS',
        rate: 0,
        amount: 0,
        category: '',
    }]);

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
                
                // Load existing entries or fallback to legacy single item format
                if (initialData.items && initialData.items.length > 0) {
                    setMaterialEntries(initialData.items.map((item: any) => ({
                        itemType: item.itemType || (item.material || item.component ? 'bo' : 'custom'),
                        material: item.material || '',
                        component: item.component || '',
                        materialName: item.materialName || '',
                        quantity: item.quantity || 0,
                        unit: item.unit || 'PCS',
                        rate: item.rate || 0,
                        amount: item.amount || 0,
                        category: item.category || '',
                    })));
                } else {
                    setMaterialEntries([{
                        itemType: initialData.material || initialData.component ? 'bo' : 'custom',
                        material: initialData.material || '',
                        component: initialData.component || '',
                        materialName: initialData.materialName || '',
                        quantity: initialData.quantity || 0,
                        unit: initialData.unit || 'PCS',
                        rate: initialData.rate || 0,
                        amount: initialData.amount || 0,
                        category: initialData.category || '',
                    }]);
                }
            } else {
                setPoNumber(generatePONumber());
                setDate(new Date().toISOString().split('T')[0]);
                setVendor('');
                setMaterialEntries([{
                    itemType: 'bo',
                    material: '',
                    materialName: '',
                    quantity: 0,
                    unit: 'PCS',
                    rate: 0,
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
            newEntries[index] = {
                ...newEntries[index],
                material: id,
                component: undefined,
                materialName: selectedMaterial?.name || '',
                unit: getCategoryUnit(selectedMaterial) || 'PCS',
                category: getCategoryName(selectedMaterial) || '',
            };
        } else if (type === 'FG') {
            const selectedComponent = inHouseItems?.find((item: any) => item._id === id);
            newEntries[index] = {
                ...newEntries[index],
                component: id,
                material: undefined,
                materialName: selectedComponent?.partName || selectedComponent?.name || selectedComponent?.componentName || '',
                unit: selectedComponent?.unit || 'PCS',
                category: 'InHouse',
            };
        } else {
             newEntries[index] = {
                ...newEntries[index],
                material: '',
                component: '',
                materialName: '',
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

        // Auto-calculate amount when quantity or rate changes
        if (field === 'quantity' || field === 'rate') {
            const entry = newEntries[index];
            newEntries[index].amount = (entry.quantity || 0) * (entry.rate || 0);
        }

        setMaterialEntries(newEntries);
    };

    const addMaterialEntry = () => {
        setMaterialEntries([...materialEntries, {
            itemType: 'bo',
            material: '',
            materialName: '',
            quantity: 0,
            unit: 'PCS',
            rate: 0,
            amount: 0,
            category: '',
        }]);
    };

    const removeMaterialEntry = (index: number) => {
        if (materialEntries.length > 1) {
            setMaterialEntries(materialEntries.filter((_, i) => i !== index));
        }
    };

    const getTotalAmount = () => {
        return materialEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        onSubmit({
            poNumber,
            date,
            vendor,
            items: materialEntries.map(entry => {
                const payload: any = {
                    itemType: entry.itemType,
                    materialName: entry.materialName,
                    quantity: entry.quantity,
                    unit: entry.unit,
                    rate: entry.rate,
                    amount: entry.amount,
                };
                if (entry.material) payload.material = entry.material;
                if (entry.component) payload.component = entry.component;
                return payload;
            }),
            totalAmount: getTotalAmount(),
        } as any);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Modal backdrop with blur */}
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[105] transition-opacity" onClick={onClose} />

            {/* Modal content */}
            <div className="fixed inset-0 flex items-center justify-center z-[110] p-4 sm:p-6">
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col border border-white/50">
                    
                    {/* Modal header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white/50">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200">
                                <FileText className="text-white" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                                    {isEditing ? 'Edit Purchase Order' : 'Create Purchase Order'}
                                </h2>
                                <p className="text-gray-500 text-sm mt-1 font-medium">
                                    Fill in the details below to generate a new PO
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-full transition-all duration-200 text-gray-400 group"
                            title="Close"
                        >
                            <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>

                    {/* Modal body - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        <form id="po-form" onSubmit={handleSubmit} className="space-y-6">
                            
                            {/* General Details Section */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-500"></div>
                                <h3 className="text-sm uppercase tracking-wider font-bold text-gray-400 mb-5 pl-2">General Details</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* PO Number */}
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <Hash size={14} className="text-purple-500" />
                                            PO Number
                                        </label>
                                        <input
                                            type="text"
                                            value={poNumber}
                                            readOnly
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 font-mono text-sm cursor-not-allowed focus:outline-none"
                                        />
                                    </div>

                                    {/* Date */}
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <Calendar size={14} className="text-indigo-500" />
                                            Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-gray-700"
                                        />
                                    </div>

                                    {/* Vendor */}
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <User size={14} className="text-pink-500" />
                                            Vendor <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            required
                                            value={vendor}
                                            onChange={(e) => setVendor(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-gray-700"
                                        >
                                            <option value="">Select Vendor</option>
                                            {vendors.map((v) => (
                                                <option key={v._id} value={v._id}>
                                                    {v.name} {v.code ? `(${v.code})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Materials Section */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-cyan-500"></div>
                                
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-gray-50 gap-4">
                                    <div className="flex items-center gap-2 pl-2">
                                        <Package size={18} className="text-indigo-500" />
                                        <h3 className="text-lg font-bold text-gray-800">Order Items</h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addMaterialEntry}
                                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-all duration-200 text-sm font-semibold group"
                                    >
                                        <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                                        Add Item
                                    </button>
                                </div>

                                <div className="p-6 space-y-6">
                                    {materialEntries.map((entry, index) => (
                                        <div key={index} className="relative bg-slate-50/50 rounded-xl p-5 border border-slate-200 group hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-200">
                                            
                                            <div className="absolute -top-3 -left-3 w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border border-white">
                                                {index + 1}
                                            </div>

                                            {materialEntries.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeMaterialEntry(index)}
                                                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Remove Item"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}

                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2">
                                                
                                                {/* Type Selection */}
                                                <div className="lg:col-span-2 space-y-1.5">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Type</label>
                                                    <select
                                                        value={entry.itemType}
                                                        onChange={e => updateEntry(index, 'itemType', e.target.value)}
                                                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium text-gray-700"
                                                    >
                                                        <option value="bo">RM / BO (Master)</option>
                                                        <option value="custom">Custom Item</option>
                                                    </select>
                                                </div>

                                                {/* Item Name / Selection */}
                                                <div className="lg:col-span-3 space-y-1.5">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Item Details <span className="text-red-500">*</span>
                                                    </label>
                                                    {entry.itemType === 'custom' ? (
                                                        <input
                                                            type="text"
                                                            required
                                                            value={entry.materialName}
                                                            onChange={e => updateEntry(index, 'materialName', e.target.value)}
                                                            placeholder="Type custom item name..."
                                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium text-gray-800"
                                                        />
                                                    ) : (
                                                        <select
                                                            required
                                                            value={entry.component ? `FG_${entry.component}` : entry.material ? `MAT_${entry.material}` : ''}
                                                            onChange={(e) => handleMaterialChange(index, e.target.value)}
                                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium text-gray-800"
                                                        >
                                                            <option value="" className="text-gray-400">Select Item</option>
                                                            <optgroup label="Materials (RM/BO)">
                                                                {materials.map((item) => (
                                                                    <option key={item._id} value={`MAT_${item._id}`}>
                                                                        {item.name} ({item.code || 'N/A'})
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                            {inHouseItems && inHouseItems.length > 0 && (
                                                                <optgroup label="Finished Goods (FG)">
                                                                    {inHouseItems.map((item: any) => (
                                                                        <option key={item._id} value={`FG_${item._id}`}>
                                                                            {item.partName || item.name || item.componentName} ({item.partNumber || item.code || 'N/A'})
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                        </select>
                                                    )}
                                                </div>

                                                {/* Quantity */}
                                                <div className="lg:col-span-2 space-y-1.5">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Quantity <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        required
                                                        min="0"
                                                        step="0.01"
                                                        value={entry.quantity || ''}
                                                        onChange={(e) => updateEntry(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-bold text-gray-800"
                                                        placeholder="0"
                                                    />
                                                </div>

                                                {/* Unit & Rate */}
                                                <div className="lg:col-span-3 space-y-1.5">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Rate / Unit <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
                                                        <span className="flex items-center justify-center bg-gray-50 px-3 text-gray-500 text-sm font-medium border-r border-gray-200">
                                                            ₹
                                                        </span>
                                                        <input
                                                            type="number"
                                                            required
                                                            min="0"
                                                            step="0.01"
                                                            value={entry.rate || ''}
                                                            onChange={(e) => updateEntry(index, 'rate', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-2 py-2.5 border-none focus:ring-0 text-sm font-bold text-gray-800"
                                                            placeholder="0.00"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={entry.unit}
                                                            onChange={e => entry.itemType === 'custom' && updateEntry(index, 'unit', e.target.value.toUpperCase())}
                                                            readOnly={entry.itemType !== 'custom'}
                                                            className={`w-16 px-2 py-2.5 border-none focus:ring-0 text-sm font-medium uppercase text-center border-l border-gray-200 ${entry.itemType === 'custom' ? 'bg-white text-indigo-600' : 'bg-gray-50 text-gray-500'}`}
                                                            placeholder="Unit"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Amount */}
                                                <div className="lg:col-span-2 space-y-1.5 flex flex-col justify-center bg-indigo-50/50 rounded-lg p-3 border border-indigo-100/50">
                                                    <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider text-right">Amount</label>
                                                    <div className="text-right">
                                                        <span className="text-lg font-black text-indigo-700">
                                                            ₹ {entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Total Amount Footer */}
                                <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-t border-gray-100">
                                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                        <div className="text-gray-500 text-sm font-medium">
                                            {materialEntries.length} Item{materialEntries.length !== 1 && 's'} in order
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Value</span>
                                            <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                                                ₹ {getTotalAmount().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
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
                                className="px-8 py-3 bg-white text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="po-form"
                                disabled={loading}
                                className="px-10 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                            >
                                {loading ? 'Saving...' : isEditing ? 'Update Order' : 'Create Order'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
