"use client";

import { useState, useEffect } from "react";
import { RmBoItem } from "../../types/store.types";
import { X, Plus, Trash2, Package } from "lucide-react";
import SearchableSelect from "../SearchableSelect";

interface MaterialRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    materials: RmBoItem[];
    inventoryList?: any[]; // Optional to avoid strict type breaking if not passed immediately
    inHouseComponents?: any[];
    loading?: boolean;
}

export default function MaterialRequestModal({
    isOpen,
    onClose,
    onSubmit,
    materials = [],
    inventoryList = [],
    inHouseComponents = [],
    loading
}: MaterialRequestModalProps) {
    const [formData, setFormData] = useState({
        requestNumber: "",
        type: "bo" as "bo" | "inhouse",
        items: [{ material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined as string | undefined }]
    });

    const generateRequestNumber = () => {
        const now = new Date();
        const timeStr = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 12);
        return `REQ-${timeStr}`;
    };

    useEffect(() => {
        if (isOpen) {
            setFormData({
                requestNumber: generateRequestNumber(),
                type: "bo",
                items: [{ material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined }]
            });
        }
    }, [isOpen]);

    const getStock = (materialId: string, materialCode?: string, materialName?: string) => {
        if (!materialId) return 0;

        if (formData.type === 'inhouse') {
            if (!inHouseComponents) return 0;
            const comp = inHouseComponents.find((c: any) => c._id === materialId);
            return comp ? (comp.quantity || 0) : 0;
        }

        if (!inventoryList) return 0;

        const stockItem = inventoryList.find((inv: any) => {
            if (!inv) return false;

            // Check ID match (handle populated or string ID)
            const invMatId = (typeof inv.materialId === 'object' && inv.materialId !== null)
                ? inv.materialId._id
                : inv.materialId;

            if (invMatId && invMatId.toString() === materialId.toString()) return true;

            // Check Code match (fallback)
            if (materialCode && inv.materialCode &&
                inv.materialCode.toString().trim().toLowerCase() === materialCode.toString().trim().toLowerCase()) return true;

            // Check Name match (strong fallback)
            if (materialName && inv.materialName &&
                inv.materialName.toString().trim().toLowerCase() === materialName.toString().trim().toLowerCase()) return true;

            return false;
        });

        // Debug log if stock is 0 but we expected something
        // if (!stockItem) console.log(`No stock found for ${materialName} (${materialCode})`);

        return stockItem ? (stockItem.currentStock || 0) : 0;
    };

    const handleMaterialChange = (index: number, materialId: string) => {
        let selectedItem;
        if (formData.type === 'inhouse') {
            selectedItem = inHouseComponents?.find((c: any) => c._id === materialId);
        } else {
            selectedItem = materials.find(m => m._id === materialId);
        }

        const newItems = [...formData.items];
        newItems[index] = {
            ...newItems[index],
            material: materialId,
            materialName: selectedItem?.componentName || selectedItem?.name || "",
            materialCode: selectedItem?.componentCode || selectedItem?.code || "", // Ensure code is sent
            // Inhouse items might store unit directly, BO items stores refs usually but check existing logic
            unit: (formData.type === 'inhouse' ? selectedItem?.unit : (typeof selectedItem?.categoryId === 'object' ? (selectedItem.categoryId as any).unit : "PCS")) || "PCS",
            // For Inhouse request, we also want to send 'component' key if possible, but backend handles mapping from 'material' or 'component'
            component: formData.type === 'inhouse' ? materialId : undefined
        };
        setFormData({ ...formData, items: newItems });
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData({ ...formData, items: newItems });
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined }]
        });
    };

    const removeItem = (index: number) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10 backdrop-blur-md">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">New Material Request</h2>
                        <div className="flex items-center gap-4 mt-1">
                            <p className="text-sm text-gray-500">
                                Request Number: {formData.requestNumber}
                            </p>
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            type: 'bo',
                                            items: [{ material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined }]
                                        }));
                                    }}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${formData.type === 'bo' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    BO Items
                                </button>
                                <button
                                    onClick={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            type: 'inhouse',
                                            items: [{ material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined }]
                                        }));
                                    }}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${formData.type === 'inhouse' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Inhouse Items
                                </button>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6 pb-32">
                    {/* Items Section */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Requested Items</h3>
                            <button
                                type="button"
                                onClick={addItem}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                                <Plus size={16} /> Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {formData.items.map((item, index) => {
                                const currentStock = getStock(item.material, item.materialCode, item.materialName);
                                const isExceedingStock = item.material && item.quantity > currentStock;

                                return (
                                    <div key={index} className="flex flex-col xl:flex-row gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 group hover:border-blue-200 transition-colors">
                                        <div className="flex-[2] min-w-[200px]">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Material</label>
                                            <SearchableSelect
                                                options={formData.type === 'inhouse' ? (
                                                    (inHouseComponents || []).map((c: any) => ({
                                                        value: c._id,
                                                        label: `${c.name || c.componentName || ''} ${c.code ? `(${c.code})` : ''} ${c.description ? `- ${c.description}` : ''}`
                                                    }))
                                                ) : (
                                                    (materials || []).map((m) => ({
                                                        value: m._id,
                                                        label: `${m.name || ''} ${((m as any).code) ? `(${((m as any).code)})` : ''}`
                                                    }))
                                                )}
                                                value={typeof item.material === 'object' ? (item.material as any)._id : item.material || ''}
                                                onChange={(val: any) => handleMaterialChange(index, val)}
                                                placeholder={`Select ${formData.type === 'inhouse' ? 'Component' : 'Material'}`}
                                            />
                                        </div>

                                        {/* Current Stock Field */}
                                        <div className="w-32">
                                            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                                <Package size={12} /> Stock
                                            </label>
                                            <div className={`w-full px-3 py-2 rounded-lg text-sm border font-medium ${item.material
                                                ? currentStock > 0
                                                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                    : 'bg-red-50 border-red-200 text-red-600'
                                                : 'bg-gray-100 border-gray-200 text-gray-400'
                                                }`}>
                                                {item.material ? `${currentStock} ${item.unit}` : '-'}
                                            </div>
                                        </div>

                                        <div className="w-32">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={isNaN(item.quantity) ? '' : item.quantity}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? NaN : parseFloat(e.target.value);
                                                        updateItem(index, "quantity", val);
                                                    }}
                                                    className={`w-full px-3 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm ${isExceedingStock ? 'border-red-500 text-red-600 focus:border-red-500 focus:ring-red-200' : 'border-gray-200'}`}
                                                    min="0.01"
                                                    step="0.01"
                                                    required
                                                />
                                                {isExceedingStock && (
                                                    <span className="absolute -bottom-5 left-0 text-[10px] text-red-500 font-medium whitespace-nowrap">
                                                        Max available: {currentStock}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Purpose/Remarks</label>
                                            <input
                                                type="text"
                                                value={item.purpose}
                                                onChange={(e) => updateItem(index, "purpose", e.target.value)}
                                                placeholder="Why is this needed?"
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>

                                        <div className="flex items-end pb-1">
                                            {formData.items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50 sticky bottom-0 backdrop-blur-md rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit(formData)}
                        disabled={loading || formData.items.some(item => {
                            const currentStock = getStock(item.material, item.materialCode, item.materialName);
                            return (item.material && item.quantity > currentStock) || !item.quantity || item.quantity <= 0;
                        })}
                        className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                submitting...
                            </div>
                        ) : (
                            "Submit Request"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
