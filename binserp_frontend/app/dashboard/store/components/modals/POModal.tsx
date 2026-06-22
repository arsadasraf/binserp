/**
 * POModal Component - Multi-Material Support
 * 
 * Modal dialog for creating/editing Purchase Orders (PO).
 * Features:
 * - Auto-generated PO number based on date and time
 * - Vendor selection with searchable dropdown
 * - Multiple material entries support
 * - Auto-filled unit and category from selected material
 * - Auto-calculated amount per material and total
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { POModalProps, Material } from '../../types/store.types';

interface MaterialEntry {
    material: string;
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
        material: '',
        materialName: '',
        quantity: 0,
        unit: '',
        rate: 0,
        amount: 0,
        category: '',
    }]);

    /**
     * Generates PO number based on current date and time
     * Format: PO/YYYYMMDD-HHMMSS
     */
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

    // Initialize form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (isEditing && initialData) {
                setPoNumber(initialData.poNumber || '');
                setDate(initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '');
                setVendor(initialData.vendor || '');
                setMaterialEntries([{
                    material: initialData.material || '',
                    materialName: initialData.materialName || '',
                    quantity: initialData.quantity || 0,
                    unit: initialData.unit || '',
                    rate: initialData.rate || 0,
                    amount: initialData.amount || 0,
                    category: initialData.category || '',
                }]);
            } else {
                setPoNumber(generatePONumber());
                setDate(new Date().toISOString().split('T')[0]);
                setVendor('');
                setMaterialEntries([{
                    material: '',
                    materialName: '',
                    quantity: 0,
                    unit: '',
                    rate: 0,
                    amount: 0,
                    category: '',
                }]);
            }
        }
    }, [isOpen, isEditing, initialData]);

    /**
     * Handles material selection for a specific entry
     */
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
                materialName: selectedComponent?.partName || '',
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

    /**
     * Helper function to get category unit from material
     */
    const getCategoryUnit = (material: Material | undefined): string => {
        if (!material) return '';
        if (typeof material.categoryId === 'object' && material.categoryId.unit) {
            return material.categoryId.unit;
        }
        return material.category?.unit || '';
    };

    /**
     * Helper function to get category name from material
     */
    const getCategoryName = (material: Material | undefined): string => {
        if (!material) return '';
        if (typeof material.categoryId === 'object' && material.categoryId.name) {
            return material.categoryId.name;
        }
        return material.category?.name || '';
    };

    /**
     * Updates a field in a specific material entry
     */
    const updateEntry = (index: number, field: keyof MaterialEntry, value: any) => {
        const newEntries = [...materialEntries];
        newEntries[index] = { ...newEntries[index], [field]: value };

        // Auto-calculate amount when quantity or rate changes
        if (field === 'quantity' || field === 'rate') {
            const entry = newEntries[index];
            newEntries[index].amount = entry.quantity * entry.rate;
        }

        setMaterialEntries(newEntries);
    };

    /**
     * Adds a new material entry
     */
    const addMaterialEntry = () => {
        setMaterialEntries([...materialEntries, {
            material: '',
            materialName: '',
            quantity: 0,
            unit: '',
            rate: 0,
            amount: 0,
            category: '',
        }]);
    };

    /**
     * Removes a material entry
     */
    const removeMaterialEntry = (index: number) => {
        if (materialEntries.length > 1) {
            setMaterialEntries(materialEntries.filter((_, i) => i !== index));
        }
    };

    /**
     * Calculate total amount
     */
    const getTotalAmount = () => {
        return materialEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    };

    /**
     * Handles form submission
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Use items array format
        onSubmit({
            poNumber,
            date,
            vendor,
            material: materialEntries[0].material, // For backward compatibility
            materialName: materialEntries[0].materialName,
            quantity: materialEntries[0].quantity,
            unit: materialEntries[0].unit,
            rate: materialEntries[0].rate,
            amount: materialEntries[0].amount,
            category: materialEntries[0].category,
            items: materialEntries.map(entry => ({
                material: entry.material,
                materialName: entry.materialName,
                quantity: entry.quantity,
                unit: entry.unit,
                rate: entry.rate,
                amount: entry.amount,
            })),
            totalAmount: getTotalAmount(),
        } as any);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Modal backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />

            {/* Modal content */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Modal header */}
                    <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-600 to-pink-600">
                        <div>
                            <h2 className="text-2xl font-bold text-white">
                                {isEditing ? 'Edit Purchase Order' : 'Create Purchase Order'}
                            </h2>
                            <p className="text-purple-100 text-sm mt-1">
                                Issue a purchase order to vendor
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors text-white"
                            title="Close"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Modal body - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <form id="po-form" onSubmit={handleSubmit} className="space-y-6">
                            {/* PO Details Section */}
                            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-purple-600 rounded"></div>
                                    PO Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* PO Number */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            PO Number
                                        </label>
                                        <input
                                            type="text"
                                            value={poNumber}
                                            readOnly
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 font-mono text-sm cursor-not-allowed"
                                        />
                                    </div>

                                    {/* Date */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>

                                    {/* Vendor */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Vendor <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            required
                                            value={vendor}
                                            onChange={(e) => setVendor(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                            <div className="bg-white rounded-xl border-2 border-purple-100 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <div className="w-1 h-5 bg-purple-600 rounded"></div>
                                        Materials
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={addMaterialEntry}
                                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                                    >
                                        <Plus size={16} />
                                        Add Material
                                    </button>
                                </div>

                                {/* Material Entries */}
                                <div className="space-y-4">
                                    {materialEntries.map((entry, index) => (
                                        <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-semibold text-gray-700">
                                                    Material {index + 1}
                                                </span>
                                                {materialEntries.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMaterialEntry(index)}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Remove Material"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                                {/* Material */}
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Material <span className="text-red-500">*</span>
                                                    </label>
                                                    <select
                                                        required
                                                        value={entry.material}
                                                        onChange={(e) => handleMaterialChange(index, e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                                    >
                                                        <option value="">Select Item</option>
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
                                                                        {item.partName} ({item.partNumber || 'N/A'})
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </select>
                                                </div>

                                                {/* Quantity */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Quantity <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        required
                                                        min="0"
                                                        step="0.01"
                                                        value={entry.quantity || ''}
                                                        onChange={(e) => updateEntry(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                                        placeholder="0"
                                                    />
                                                </div>

                                                {/* Unit */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Unit
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={entry.unit}
                                                        readOnly
                                                        className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 cursor-not-allowed text-sm"
                                                    />
                                                </div>

                                                {/* Rate */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Rate (₹) <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        required
                                                        min="0"
                                                        step="0.01"
                                                        value={entry.rate || ''}
                                                        onChange={(e) => updateEntry(index, 'rate', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>

                                            {/* Amount Display */}
                                            <div className="mt-3 flex justify-end">
                                                <div className="text-right">
                                                    <span className="text-xs text-gray-600 block">Amount</span>
                                                    <span className="text-lg font-bold text-purple-600">
                                                        ₹ {entry.amount.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Total Amount */}
                                <div className="mt-6 pt-4 border-t-2 border-purple-200">
                                    <div className="flex justify-between items-center">
                                        <span className="text-lg font-semibold text-gray-900">Total Amount</span>
                                        <span className="text-2xl font-bold text-green-600">
                                            ₹ {getTotalAmount().toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Modal footer - Fixed at bottom */}
                    <div className="p-6 border-t bg-gray-50">
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                form="po-form"
                                disabled={loading}
                                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                            >
                                {loading ? 'Saving...' : isEditing ? 'Update PO' : 'Create PO'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 bg-white text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors border-2 border-gray-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
