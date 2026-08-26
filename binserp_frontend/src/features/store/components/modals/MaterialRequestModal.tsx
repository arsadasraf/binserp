import { useState, useEffect, useMemo } from "react";
import { RmBoItem } from "@/src/features/store/types/store.types";
import { X, Plus, Trash2, Package, ShoppingCart, Boxes, Layers, Sparkles } from "lucide-react";
import SearchableSelect from "../SearchableSelect";
import { apiGet } from "@/src/lib/api";

export type RequestInventoryType = "rm" | "bo" | "consumable" | "fg";

interface MaterialRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    rawMaterials?: any[];
    boughtOuts?: any[];
    materials?: RmBoItem[];
    consumables?: any[];
    inventoryList?: any[];
    inHouseComponents?: any[];
    fgItems?: any[];
    salesOrders?: any[];
    customerPos?: any[];
    loading?: boolean;
    defaultType?: RequestInventoryType | "inhouse";
}

export default function MaterialRequestModal({
    isOpen,
    onClose,
    onSubmit,
    rawMaterials = [],
    boughtOuts = [],
    materials = [],
    consumables = [],
    inventoryList = [],
    inHouseComponents = [],
    fgItems = [],
    salesOrders = [],
    customerPos = [],
    loading,
    defaultType = "consumable"
}: MaterialRequestModalProps) {
    const [mrpPlans, setMrpPlans] = useState<any[]>([]);

    const initialType: RequestInventoryType = (
        defaultType === 'inhouse' ? 'fg' : (defaultType as RequestInventoryType) || 'consumable'
    );

    const [formData, setFormData] = useState({
        requestNumber: "",
        type: initialType,
        salesOrder: "",
        soNumber: "",
        mrpPlan: "",
        mrpNumber: "",
        items: [{
            material: "",
            materialName: "",
            materialCode: "",
            materialDescription: "" as string | undefined,
            quantity: 1,
            unit: initialType === 'fg' ? "Nos" : "PCS",
            purpose: "",
            component: undefined as string | undefined,
            consumable: undefined as string | undefined,
            fgItem: undefined as string | undefined,
            currentStock: 0
        }]
    });

    const generateRequestNumber = () => {
        const now = new Date();
        const timeStr = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 12);
        return `REQ-${timeStr}`;
    };

    useEffect(() => {
        if (isOpen) {
            const currentInitial: RequestInventoryType = (
                defaultType === 'inhouse' ? 'fg' : (defaultType as RequestInventoryType) || 'consumable'
            );

            setFormData({
                requestNumber: generateRequestNumber(),
                type: currentInitial,
                salesOrder: "",
                soNumber: "",
                mrpPlan: "",
                mrpNumber: "",
                items: [{
                    material: "",
                    materialName: "",
                    materialCode: "",
                    materialDescription: "" as string | undefined,
                    quantity: 1,
                    unit: currentInitial === 'fg' ? "Nos" : "PCS",
                    purpose: "",
                    component: undefined,
                    consumable: undefined,
                    fgItem: undefined,
                    currentStock: 0
                }]
            });

            // Fetch active MRP plans
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
            if (token) {
                apiGet('/api/purchase/mrp/plans', token)
                    .then(res => setMrpPlans(res.mrpPlans || []))
                    .catch(err => console.error('Failed to load MRP plans in request modal:', err));
            }
        }
    }, [isOpen, defaultType]);

    // Filter only ACTIVE (NOT COMPLETED) MRP Plans
    const activeMrpPlans = useMemo(() => {
        return (mrpPlans || []).filter((plan: any) => plan.status !== 'Completed');
    }, [mrpPlans]);

    // Keyword searchable MRP options
    const mrpOptions = useMemo(() => {
        return activeMrpPlans.map((plan: any) => {
            const fgNames = (plan.fgItems || []).map((f: any) => f.fgItemName).filter(Boolean).join(', ');
            return {
                value: plan._id,
                label: plan.mrpNumber,
                description: `${plan.customerName || 'Internal Demand'}${plan.customerPoNumber ? ` • PO: ${plan.customerPoNumber}` : ''}${fgNames ? ` • FG: ${fgNames}` : ''} (${plan.status || 'Planned'})`,
                code: plan.mrpNumber
            };
        });
    }, [activeMrpPlans]);

    const isMrpRequired = formData.type !== 'consumable';
    const isMrpMissing = isMrpRequired && !formData.mrpPlan;

    // Effective item lists strictly separated for each category
    const effectiveRMList = useMemo(() => {
        if (rawMaterials && rawMaterials.length > 0) return rawMaterials;
        return (materials || []).filter((m: any) => {
            const t = (m.itemType || '').toString().trim().toLowerCase();
            const c = (m.code || '').toUpperCase();
            return t !== 'bought out' && t !== 'bo' && !c.startsWith('BO-');
        });
    }, [rawMaterials, materials]);

    const effectiveBOList = useMemo(() => {
        if (boughtOuts && boughtOuts.length > 0) return boughtOuts;
        return (materials || []).filter((m: any) => {
            const t = (m.itemType || '').toString().trim().toLowerCase();
            const c = (m.code || '').toUpperCase();
            return t === 'bought out' || t === 'bo' || c.startsWith('BO-');
        });
    }, [boughtOuts, materials]);

    const effectiveFGList = useMemo(() => {
        if (fgItems && fgItems.length > 0) return fgItems;
        return inHouseComponents || [];
    }, [fgItems, inHouseComponents]);

    const handleSelectMRPPlan = (planId: string) => {
        const selectedPlan = mrpPlans.find(p => p._id === planId);
        if (!selectedPlan) {
            setFormData(prev => ({ ...prev, mrpPlan: '', mrpNumber: '' }));
            return;
        }

        // Auto-fill required items from this MRP plan if available
        let populatedItems: any[] = [];
        if (formData.type === 'fg' && Array.isArray(selectedPlan.fgItems) && selectedPlan.fgItems.length > 0) {
            populatedItems = selectedPlan.fgItems.map((f: any) => {
                const comp = effectiveFGList.find((c: any) => (c._id === f.fgItem || c.name === f.fgItemName));
                return {
                    material: comp?._id || f.fgItem || '',
                    materialName: f.fgItemName,
                    materialCode: f.fgItemCode || '',
                    quantity: f.quantity || 1,
                    unit: f.unit || 'Nos',
                    purpose: `Production for MRP: ${selectedPlan.mrpNumber}`,
                    component: comp?._id || f.fgItem,
                    fgItem: comp?._id || f.fgItem,
                    consumable: undefined,
                    currentStock: comp?.quantity || 0
                };
            });
        } else if (Array.isArray(selectedPlan.rmRequirements) && selectedPlan.rmRequirements.length > 0) {
            populatedItems = selectedPlan.rmRequirements.map((r: any) => {
                const searchList = formData.type === 'bo' ? effectiveBOList : effectiveRMList;
                const mat = searchList.find((m: any) => (m._id === r.material || m.name === r.materialName));
                return {
                    material: mat?._id || r.material || '',
                    materialName: r.materialName,
                    materialCode: r.materialCode || '',
                    quantity: r.shortage > 0 ? r.shortage : (r.requiredQuantity || 1),
                    unit: r.unit || 'PCS',
                    purpose: `Demand for MRP: ${selectedPlan.mrpNumber}`,
                    consumable: undefined,
                    component: undefined,
                    fgItem: undefined,
                    currentStock: mat?.quantity || 0
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

        if (formData.type === 'fg') {
            if (effectiveFGList && effectiveFGList.length > 0) {
                const comp = effectiveFGList.find((c: any) => c._id === materialId || c.code === materialCode || c.name === materialName);
                return comp ? (Number(comp.quantity) || 0) : 0;
            }
        }

        if (formData.type === 'rm') {
            const rm = effectiveRMList.find((m: any) => m._id === materialId || m.code === materialCode || m.name === materialName);
            if (rm && rm.quantity !== undefined) return Number(rm.quantity) || 0;
        }

        if (formData.type === 'bo') {
            const bo = effectiveBOList.find((m: any) => m._id === materialId || m.code === materialCode || m.name === materialName);
            if (bo && bo.quantity !== undefined) return Number(bo.quantity) || 0;
        }

        if (inventoryList && inventoryList.length > 0) {
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
        }

        const mat = (materials || []).find((m: any) => m._id === materialId) as any;
        if (mat && mat.quantity !== undefined) return Number(mat.quantity) || 0;

        return 0;
    };

    const handleMaterialChange = (index: number, materialId: string) => {
        let selectedItem: any = null;
        if (formData.type === 'consumable') {
            selectedItem = (consumables || []).find((c: any) => c._id === materialId);
        } else if (formData.type === 'fg') {
            selectedItem = effectiveFGList.find((c: any) => c._id === materialId);
        } else if (formData.type === 'rm') {
            selectedItem = effectiveRMList.find((m: any) => m._id === materialId);
        } else {
            selectedItem = effectiveBOList.find((m: any) => m._id === materialId);
        }

        const unitVal = (formData.type === 'consumable'
            ? (selectedItem?.unit || "PCS")
            : formData.type === 'fg'
                ? (selectedItem?.unit || "Nos")
                : (typeof selectedItem?.categoryId === 'object' ? (selectedItem.categoryId as any)?.unit : selectedItem?.unit || "PCS")
        ) || "PCS";

        const currentStock = getStock(materialId, selectedItem?.code || selectedItem?.componentCode, selectedItem?.name || selectedItem?.componentName);
        const materialDesc = selectedItem?.description || selectedItem?.specification || selectedItem?.grade || "";

        const newItems = [...formData.items];
        newItems[index] = {
            ...newItems[index],
            material: materialId,
            materialName: selectedItem?.name || selectedItem?.componentName || "",
            materialCode: selectedItem?.code || selectedItem?.componentCode || "",
            materialDescription: materialDesc,
            unit: unitVal,
            currentStock,
            consumable: formData.type === 'consumable' ? materialId : undefined,
            component: formData.type === 'fg' ? materialId : undefined,
            fgItem: formData.type === 'fg' ? materialId : undefined
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
            items: [...formData.items, {
                material: "",
                materialName: "",
                materialCode: "",
                materialDescription: "",
                quantity: 1,
                unit: formData.type === 'fg' ? "Nos" : "PCS",
                purpose: "",
                component: undefined,
                consumable: undefined,
                fgItem: undefined,
                currentStock: 0
            }]
        });
    };

    const removeItem = (index: number) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const switchType = (newType: RequestInventoryType) => {
        setFormData(prev => ({
            ...prev,
            type: newType,
            items: [{
                material: "",
                materialName: "",
                materialCode: "",
                materialDescription: "",
                quantity: 1,
                unit: newType === 'fg' ? "Nos" : "PCS",
                purpose: "",
                component: undefined,
                consumable: undefined,
                fgItem: undefined,
                currentStock: 0
            }]
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start sm:items-center bg-gray-50/80 dark:bg-gray-800/80 shrink-0 backdrop-blur-md">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">New Material Request</h2>
                            <span className="text-xs font-mono font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-0.5 rounded-md">
                                {formData.requestNumber}
                            </span>
                        </div>
                        
                        {/* 4 Inventory Types Switcher (Consumables First, then RM, BO, FG) */}
                        <div className="flex flex-wrap bg-gray-200/80 dark:bg-gray-750 p-1 rounded-xl gap-1 w-fit shadow-inner">
                            {/* Consumable Button (1st Tab) */}
                            <button
                                type="button"
                                onClick={() => switchType('consumable')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    formData.type === 'consumable' 
                                        ? 'bg-amber-500 text-white shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <Package size={13} /> Consumables
                            </button>

                            {/* RM Button */}
                            <button
                                type="button"
                                onClick={() => switchType('rm')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    formData.type === 'rm' 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <Layers size={13} /> Raw Material (RM)
                            </button>

                            {/* BO Button */}
                            <button
                                type="button"
                                onClick={() => switchType('bo')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    formData.type === 'bo' 
                                        ? 'bg-emerald-600 text-white shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <ShoppingCart size={13} /> Bought Out (BO)
                            </button>

                            {/* FG Button */}
                            <button
                                type="button"
                                onClick={() => switchType('fg')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    formData.type === 'fg' 
                                        ? 'bg-purple-600 text-white shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <Boxes size={13} /> Finished Goods (FG)
                            </button>
                        </div>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body with proper scrolling and padding */}
                <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 pb-36">
                    
                    {/* Linked MRP Plan */}
                    <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-sm">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Layers size={14} className="text-indigo-600 dark:text-indigo-400" />
                                    <span>MRP Plan #</span>
                                    {isMrpRequired ? (
                                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-extrabold bg-rose-100 dark:bg-rose-950 px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-900">
                                            * Compulsory
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-slate-400 font-normal">(Optional for Consumables)</span>
                                    )}
                                </span>
                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">
                                    {activeMrpPlans.length} Active MRPs
                                </span>
                            </label>
                            
                            <SearchableSelect
                                options={mrpOptions}
                                value={formData.mrpPlan || ''}
                                onChange={(val) => handleSelectMRPPlan(val)}
                                placeholder={isMrpRequired ? "🔍 Search active MRP #, Customer, FG (* Required)..." : "🔍 Search MRP # (Optional)..."}
                                hasError={isMrpMissing}
                                className="w-full"
                            />
                            {isMrpMissing && (
                                <p className="text-[11px] font-semibold text-rose-500">
                                    ⚠️ Please select an active MRP Plan to proceed with this {formData.type.toUpperCase()} request.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Items Section */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-1.5">
                                {formData.type === 'rm' && <Layers size={14} className="text-blue-600" />}
                                {formData.type === 'bo' && <ShoppingCart size={14} className="text-emerald-600" />}
                                {formData.type === 'consumable' && <Package size={14} className="text-amber-500" />}
                                {formData.type === 'fg' && <Boxes size={14} className="text-purple-600" />}
                                Requested {formData.type === 'consumable' ? 'Consumable Items' : formData.type === 'fg' ? 'Finished Goods (FG)' : formData.type === 'bo' ? 'Bought Out Items' : 'Raw Materials'}
                            </h3>
                            <button
                                type="button"
                                onClick={addItem}
                                className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                            >
                                <Plus size={14} /> Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {formData.items.map((item: any, index) => {
                                const currentStock = getStock(item.material, item.materialCode, item.materialName);
                                const isExceedingStock = item.material && item.quantity > currentStock;

                                // Options generation strictly filtered per category with Name and Description ONLY
                                const currentOptions = (
                                    formData.type === 'consumable'
                                        ? (consumables || []).map((c: any) => {
                                            const desc = c.description || c.specification || c.category || '';
                                            return {
                                                value: c._id,
                                                label: `${c.name || ''}${desc ? ` • ${desc}` : ''}`,
                                                description: desc || '',
                                                code: c.code
                                            };
                                        })
                                        : formData.type === 'fg'
                                            ? effectiveFGList.map((c: any) => {
                                                const desc = c.description || c.specification || '';
                                                return {
                                                    value: c._id,
                                                    label: `${c.name || c.componentName || ''}${desc ? ` • ${desc}` : ''}`,
                                                    description: desc || '',
                                                    code: c.code
                                                };
                                            })
                                            : formData.type === 'bo'
                                                ? effectiveBOList.map((b: any) => {
                                                    const desc = b.description || b.specification || b.category || '';
                                                    return {
                                                        value: b._id,
                                                        label: `${b.name || ''}${desc ? ` • ${desc}` : ''}`,
                                                        description: desc || '',
                                                        code: b.code
                                                    };
                                                })
                                                : effectiveRMList.map((r: any) => {
                                                    const desc = r.description || r.specification || r.grade || r.thickness || r.materialType || '';
                                                    return {
                                                        value: r._id,
                                                        label: `${r.name || ''}${desc ? ` • ${desc}` : ''}`,
                                                        description: desc || '',
                                                        code: r.code
                                                    };
                                                })
                                );

                                return (
                                    <div 
                                        key={index} 
                                        className="relative flex flex-col xl:flex-row gap-3 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800 group hover:border-blue-200 transition-colors"
                                        style={{ zIndex: 50 - index }}
                                    >
                                        <div className="flex-[2] min-w-[220px]">
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                                                {formData.type === 'consumable' ? 'Consumable Item' : formData.type === 'fg' ? 'Finished Good / FG Item' : formData.type === 'bo' ? 'Bought Out Item' : 'Raw Material Item'}
                                            </label>
                                            <SearchableSelect
                                                options={currentOptions}
                                                value={typeof item.material === 'object' ? (item.material as any)._id : item.material || ''}
                                                onChange={(val: any) => handleMaterialChange(index, val)}
                                                placeholder={`Select ${formData.type === 'consumable' ? 'Consumable' : formData.type === 'fg' ? 'FG Item' : formData.type === 'bo' ? 'Bought Out Item' : 'Raw Material'}...`}
                                                dropdownPosition="bottom"
                                            />
                                            {item.materialDescription && (
                                                <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">Description:</span> {item.materialDescription}
                                                </div>
                                            )}
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
                                                    className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-colors cursor-pointer"
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

                <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 shrink-0 backdrop-blur-md flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (isMrpMissing) {
                                alert(`MRP Plan is compulsory for ${formData.type.toUpperCase()} Material Requests. Please select an active MRP Plan.`);
                                return;
                            }
                            onSubmit(formData);
                        }}
                        disabled={loading || isMrpMissing || formData.items.some(item => {
                            const currentStock = getStock(item.material, item.materialCode, item.materialName);
                            return (item.material && item.quantity > currentStock) || !item.quantity || item.quantity <= 0;
                        })}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:shadow-lg hover:shadow-blue-200 dark:hover:shadow-none transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none cursor-pointer"
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
