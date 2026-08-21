import { useState, useEffect, useMemo } from "react";
import { RmBoItem } from "@/src/features/store/types/store.types";
import { X, Plus, Trash2, Package, ShoppingCart, Boxes, Layers } from "lucide-react";
import SearchableSelect from "../SearchableSelect";

interface MaterialRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    materials?: RmBoItem[];
    consumables?: any[];
    inventoryList?: any[];
    inHouseComponents?: any[];
    salesOrders?: any[];
    loading?: boolean;
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
    loading
}: MaterialRequestModalProps) {
    const [formData, setFormData] = useState({
        requestNumber: "",
        type: "bo" as "consumable" | "bo" | "inhouse",
        salesOrder: "",
        soNumber: "",
        items: [{ material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined as string | undefined, consumable: undefined as string | undefined }]
    });

    // Filter open sales orders (status !== 'Completed' && status !== 'Cancelled')
    const openSalesOrders = useMemo(() => {
        return (salesOrders || []).filter((so: any) => so.status !== 'Completed' && so.status !== 'Cancelled');
    }, [salesOrders]);

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
                salesOrder: "",
                soNumber: "",
                items: [{ material: "", materialName: "", materialCode: "", quantity: 1, unit: "PCS", purpose: "", component: undefined, consumable: undefined }]
            });
        }
    }, [isOpen]);

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
                    
                    {/* Target Sales Order Selector (Shown for RM/BO & Inhouse, Not Required for Consumable) */}
                    {formData.type !== 'consumable' ? (
                        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-sm space-y-2">
                            <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                <ShoppingCart size={15} className="text-indigo-600 dark:text-indigo-400" /> Target Sales Order (Which Sales Order are you requesting material for?)
                            </label>
                            <SearchableSelect
                                options={openSalesOrders.map((so: any) => ({
                                    value: so._id,
                                    label: `${so.orderNumber || 'SO'} - ${so.customer?.name || 'Customer'} (Status: ${so.status || 'Open'})`
                                }))}
                                value={formData.salesOrder || ''}
                                onChange={(val: any) => {
                                    const selectedSO = openSalesOrders.find((so: any) => so._id === val);
                                    setFormData(prev => ({
                                        ...prev,
                                        salesOrder: val,
                                        soNumber: selectedSO?.orderNumber || ''
                                    }));
                                }}
                                placeholder="Select Open Sales Order (e.g. SO-0001)..."
                            />
                            {formData.soNumber && (
                                <div className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                                    Bound to Sales Order: <strong className="font-mono bg-indigo-100 dark:bg-indigo-900 px-2 py-0.5 rounded">{formData.soNumber}</strong>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-amber-50/70 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-200/70 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
                            <Package size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Consumable item requests are direct store issuances — <strong>Sales Order linkage is not required</strong>.</span>
                        </div>
                    )}

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
