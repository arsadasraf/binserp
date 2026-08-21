import { useState, useEffect, useMemo } from "react";
import { RmBoItem } from "@/src/features/store/types/store.types";
import { X, Plus, Trash2, Package, ShoppingCart, Boxes, Layers, Sparkles } from "lucide-react";
import SearchableSelect from "../SearchableSelect";
import { apiGet } from "@/src/lib/api";

interface MaterialRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    materials?: RmBoItem[];
    consumables?: any[];
    inventoryList?: any[];
    inHouseComponents?: any[];
    salesOrders?: any[];
    customerPos?: any[];
    loading?: boolean;
    defaultType?: "consumable" | "bo" | "inhouse";
}

export default function MaterialRequestModal({
    isOpen,
    onClose,
    onSubmit,
    materials = [],
    consumables = [],
    inventoryList = [],
    inHouseComponents = [],
    salesOrders = [],
    customerPos = [],
    loading,
    defaultType = "bo"
}: MaterialRequestModalProps) {
    const [mrpPlans, setMrpPlans] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        requestNumber: "",
        type: defaultType as "consumable" | "bo" | "inhouse",
        salesOrder: "",
        soNumber: "",
        mrpPlan: "",
        mrpNumber: "",
        items: [{ material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined as string | undefined, consumable: undefined as string | undefined }]
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
                type: defaultType,
                salesOrder: "",
                soNumber: "",
                mrpPlan: "",
                mrpNumber: "",
                items: [{ material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined, consumable: undefined }]
            });

            // Fetch active MRP plans
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
            if (token) {
                apiGet('/api/purchase/mrp/plans', token)
                    .then(res => setMrpPlans(res.mrpPlans || []))
                    .catch(err => console.error('Failed to load MRP plans in request modal:', err));
            }
        }
    }, [isOpen]);

    const handleSelectMRPPlan = (planId: string) => {
        const selectedPlan = mrpPlans.find(p => p._id === planId);
        if (!selectedPlan) {
            setFormData(prev => ({ ...prev, mrpPlan: '', mrpNumber: '' }));
            return;
        }

        // Auto-fill required items from this MRP plan if available
        let populatedItems: any[] = [];
        if (formData.type === 'inhouse' && Array.isArray(selectedPlan.fgItems) && selectedPlan.fgItems.length > 0) {
            populatedItems = selectedPlan.fgItems.map((f: any) => {
                const comp = (inHouseComponents || []).find((c: any) => (c._id === f.fgItem || c.name === f.fgItemName));
                return {
                    material: comp?._id || f.fgItem || '',
                    materialName: f.fgItemName,
                    materialCode: f.fgItemCode || '',
                    quantity: f.quantity || 1,
                    unit: f.unit || 'Nos',
                    purpose: `Production for MRP: ${selectedPlan.mrpNumber}`,
                    component: comp?._id || f.fgItem
                };
            });
        } else if (Array.isArray(selectedPlan.rmRequirements) && selectedPlan.rmRequirements.length > 0) {
            populatedItems = selectedPlan.rmRequirements.map((r: any) => {
                const mat = (materials || []).find((m: any) => (m._id === r.material || m.name === r.materialName));
                return {
                    material: mat?._id || r.material || '',
                    materialName: r.materialName,
                    materialCode: r.materialCode || '',
                    quantity: r.shortage > 0 ? r.shortage : (r.requiredQuantity || 1),
                    unit: r.unit || 'PCS',
                    purpose: `Demand for MRP: ${selectedPlan.mrpNumber}`,
                    consumable: undefined,
                    component: undefined
                };
            });
        }

        setFormData(prev => ({
            ...prev,
            mrpPlan: selectedPlan._id,
            mrpNumber: selectedPlan.mrpNumber,
            soNumber: prev.soNumber || selectedPlan.customerName || selectedPlan.remarks || '',
            items: populatedItems.length > 0 ? populatedItems : prev.items
        }));
    };

    const getStock = (materialId: string, materialCode?: string, materialName?: string) => {
        if (!materialId) return 0;

        if (formData.type === 'consumable') {
            if (consumables && consumables.length > 0) {
                const consumable = consumables.find((c: any) => c._id === materialId || c.code === materialCode || c.name === materialName);
                if (consumable && consumable.quantity !== undefined) return Number(consumable.quantity) || 0;
            }
        }

        if (formData.type === 'inhouse') {
            if (!inHouseComponents) return 0;
            const comp = inHouseComponents.find((c: any) => c._id === materialId || c.code === materialCode || c.name === materialName);
            return comp ? (Number(comp.quantity) || 0) : 0;
        }

        if (!inventoryList) return 0;

        const stockItem = inventoryList.find((inv: any) => {
            if (!inv) return false;

            const invMatId = (typeof inv.materialId === 'object' && inv.materialId !== null)
                ? inv.materialId._id
                : inv.materialId;

            if (invMatId && invMatId.toString() === materialId.toString()) return true;

            if (materialCode && inv.materialCode &&
                inv.materialCode.toString().trim().toLowerCase() === materialCode.toString().trim().toLowerCase()) return true;

            if (materialName && inv.materialName &&
                inv.materialName.toString().trim().toLowerCase() === materialName.toString().trim().toLowerCase()) return true;

            return false;
        });

        if (stockItem && stockItem.currentStock !== undefined) return Number(stockItem.currentStock) || 0;

        const mat = (materials || []).find((m: any) => m._id === materialId) as any;
        if (mat && mat.quantity !== undefined) return Number(mat.quantity) || 0;

        return 0;
    };

    const handleMaterialChange = (index: number, materialId: string) => {
        let selectedItem;
        if (formData.type === 'consumable') {
            selectedItem = (consumables || []).find((c: any) => c._id === materialId);
        } else if (formData.type === 'inhouse') {
            selectedItem = (inHouseComponents || []).find((c: any) => c._id === materialId);
        } else {
            selectedItem = (materials || []).find((m: any) => m._id === materialId);
        }

        const newItems = [...formData.items];
        const unitVal = (formData.type === 'consumable'
            ? (selectedItem?.unit || "PCS")
            : formData.type === 'inhouse'
                ? (selectedItem?.unit || "Nos")
                : (typeof selectedItem?.categoryId === 'object' ? (selectedItem.categoryId as any)?.unit : selectedItem?.unit || "PCS")
        ) || "PCS";

        newItems[index] = {
            ...newItems[index],
            material: materialId,
            materialName: selectedItem?.name || selectedItem?.componentName || "",
            materialCode: selectedItem?.code || selectedItem?.componentCode || "",
            unit: unitVal,
            consumable: formData.type === 'consumable' ? materialId : undefined,
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
            items: [...formData.items, { material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined, consumable: undefined }]
        });
    };

    const removeItem = (index: number) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-800">
                
                {/* Modal Header */}
                <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start sm:items-center bg-gray-50/80 dark:bg-gray-800/80 sticky top-0 z-10 backdrop-blur-md">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">New Material Request</h2>
                            <span className="text-xs font-mono font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-0.5 rounded-md">
                                {formData.requestNumber}
                            </span>
                        </div>
                        
                        {/* 3 Request Types Switcher */}
                        <div className="flex bg-gray-200/80 dark:bg-gray-750 p-1 rounded-xl gap-1 w-fit">
                            <button
                                type="button"
                                onClick={() => {
                                    setFormData(prev => ({
                                        ...prev,
                                        type: 'consumable',
                                        salesOrder: '',
                                        soNumber: '',
                                        items: [{ material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined, consumable: undefined }]
                                    }));
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    formData.type === 'consumable' 
                                        ? 'bg-amber-500 text-white shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                            >
                                <Package size={13} /> Consumables
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setFormData(prev => ({
                                        ...prev,
                                        type: 'bo',
                                        items: [{ material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined, consumable: undefined }]
                                    }));
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    formData.type === 'bo' 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                            >
                                <Layers size={13} /> RM / BO Items
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setFormData(prev => ({
                                        ...prev,
                                        type: 'inhouse',
                                        items: [{ material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined, consumable: undefined }]
                                    }));
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    formData.type === 'inhouse' 
                                        ? 'bg-purple-600 text-white shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                            >
                                <Boxes size={13} /> FG / In-House Items
                            </button>
                        </div>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 sm:p-6 space-y-6 pb-32">
                    
                    {/* Linked MRP Plan & Customer PO / Demand Reference */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/70 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-sm">
                        {/* MRP Plan # Dropdown */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers size={14} className="text-indigo-600 dark:text-indigo-400" /> Link MRP Plan # <span className="text-[10px] text-slate-400 font-normal">(Auto-fills Materials)</span>
                            </label>
                            <select
                                value={formData.mrpPlan || ''}
                                onChange={(e) => handleSelectMRPPlan(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">-- Direct Store Request (No MRP) --</option>
                                {mrpPlans.map((plan) => (
                                    <option key={plan._id} value={plan._id}>
                                        {plan.mrpNumber} {plan.customerName ? `(${plan.customerName})` : ''} - {plan.status || 'Planned'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Customer PO / Order Ref */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                <ShoppingCart size={14} className="text-indigo-600 dark:text-indigo-400" /> Customer PO / Order Ref <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. PO-8921 / Shopfloor Assembly"
                                value={formData.soNumber || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({
                                        ...prev,
                                        salesOrder: val,
                                        soNumber: val
                                    }));
                                }}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    {/* Items Section */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                                Requested {formData.type === 'consumable' ? 'Consumable Items' : formData.type === 'inhouse' ? 'Inhouse Components' : 'RM / BO Items'}
                            </h3>
                            <button
                                type="button"
                                onClick={addItem}
                                className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded-xl transition-colors"
                            >
                                <Plus size={14} /> Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {formData.items.map((item, index) => {
                                const currentStock = getStock(item.material, item.materialCode, item.materialName);
                                const isExceedingStock = item.material && item.quantity > currentStock;

                                return (
                                    <div key={index} className="flex flex-col xl:flex-row gap-3 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800 group hover:border-blue-200 transition-colors">
                                        <div className="flex-[2] min-w-[200px]">
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                                                {formData.type === 'consumable' ? 'Consumable Item' : formData.type === 'inhouse' ? 'FG / Inhouse Item' : 'RM / BO Material'}
                                            </label>
                                            <SearchableSelect
                                                options={
                                                    formData.type === 'consumable' ? (
                                                        (consumables || []).map((c: any) => ({
                                                            value: c._id,
                                                            label: `${c.name || ''} ${c.code ? `(${c.code})` : ''} ${c.unit ? `[${c.unit}]` : ''}`
                                                        }))
                                                    ) : formData.type === 'inhouse' ? (
                                                        (inHouseComponents || []).map((c: any) => ({
                                                            value: c._id,
                                                            label: `${c.name || c.componentName || ''} ${c.code ? `(${c.code})` : ''} ${c.description ? `- ${c.description}` : ''}`
                                                        }))
                                                    ) : (
                                                        (materials || []).map((m: any) => ({
                                                            value: m._id,
                                                            label: `${m.name || ''} ${m.code ? `(${m.code})` : ''}`
                                                        }))
                                                    )
                                                }
                                                value={typeof item.material === 'object' ? (item.material as any)._id : item.material || ''}
                                                onChange={(val: any) => handleMaterialChange(index, val)}
                                                placeholder={`Select ${formData.type === 'consumable' ? 'Consumable Item' : formData.type === 'inhouse' ? 'FG / Component' : 'Material'}`}
                                            />
                                        </div>

                                        {/* Current Stock Field */}
                                        <div className="w-full sm:w-32">
                                            <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                                                <Package size={12} /> Stock
                                            </label>
                                            <div className={`w-full px-3 py-2 rounded-xl text-xs font-black border ${item.material
                                                ? currentStock > 0
                                                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                                    : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-600 dark:text-red-300'
                                                : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'
                                                }`}>
                                                {item.material ? `${currentStock} ${item.unit}` : '-'}
                                            </div>
                                        </div>

                                        <div className="w-full sm:w-32">
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Quantity</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={isNaN(item.quantity) ? '' : item.quantity}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? NaN : parseFloat(e.target.value);
                                                        updateItem(index, "quantity", val);
                                                    }}
                                                    className={`w-full px-3 py-2 bg-white dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-blue-500 text-xs font-bold ${isExceedingStock ? 'border-red-500 text-red-600 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 dark:border-gray-700'}`}
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
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Purpose/Remarks</label>
                                            <input
                                                type="text"
                                                value={item.purpose}
                                                onChange={(e) => updateItem(index, "purpose", e.target.value)}
                                                placeholder="Why is this needed?"
                                                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-xs"
                                            />
                                        </div>

                                        <div className="flex items-end pb-1">
                                            {formData.items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-5 sm:p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 sticky bottom-0 backdrop-blur-md rounded-b-3xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
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
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:shadow-lg hover:shadow-blue-200 dark:hover:shadow-none transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Submitting...
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
