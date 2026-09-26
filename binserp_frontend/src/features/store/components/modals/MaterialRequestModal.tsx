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
    allowedTypes?: RequestInventoryType[];
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
    defaultType = "consumable",
    allowedTypes
}: MaterialRequestModalProps) {
    const [mrpPlans, setMrpPlans] = useState<any[]>([]);

    const effectiveAllowedTypes: RequestInventoryType[] = useMemo(() => {
        if (Array.isArray(allowedTypes) && allowedTypes.length > 0) {
            return allowedTypes;
        }
        return ['consumable', 'rm', 'bo', 'fg'];
    }, [allowedTypes]);

    const initialType: RequestInventoryType = useMemo(() => {
        const raw = defaultType === 'inhouse' ? 'fg' : (defaultType as RequestInventoryType) || 'consumable';
        return effectiveAllowedTypes.includes(raw) ? raw : effectiveAllowedTypes[0] || 'consumable';
    }, [defaultType, effectiveAllowedTypes]);

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
            hasSecondaryUnit: false,
            secondaryUnit: "",
            conversionFactor: 0,
            secondaryQuantity: 0,
            selectedUnit: initialType === 'fg' ? "Nos" : "PCS",
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
                    hasSecondaryUnit: false,
                    secondaryUnit: "",
                    conversionFactor: 0,
                    secondaryQuantity: 0,
                    selectedUnit: currentInitial === 'fg' ? "Nos" : "PCS",
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

    // Enforce compulsory MRP selection for RM, BO, and FG requests
    const isMrpRequired = ['rm', 'bo', 'fg'].includes((formData.type || '').toLowerCase());
    const isMrpMissing = isMrpRequired && !formData.mrpPlan;

    // Safe multi-attribute description extractor
    const getDescStr = (item: any): string => {
        if (!item) return '';
        const val = item.descriptions || item.description || item.specification || item.specifications || item.grade || item.size || item.thickness || item.materialType || (typeof item.categoryId === 'object' ? item.categoryId?.name : '') || item.category || '';
        return String(val || '').trim();
    };

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
                const hasSec = Boolean(comp?.hasSecondaryUnit);
                const secUnit = comp?.secondaryUnit || "";
                const convFactor = Number(comp?.conversionFactor) || 0;
                const qty = f.quantity || 1;
                const secQty = hasSec && convFactor ? parseFloat((qty * convFactor).toFixed(4)) : 0;
                return {
                    material: comp?._id || f.fgItem || '',
                    materialName: f.fgItemName,
                    materialCode: f.fgItemCode || '',
                    quantity: qty,
                    unit: f.unit || 'Nos',
                    hasSecondaryUnit: hasSec,
                    secondaryUnit: secUnit,
                    conversionFactor: convFactor,
                    secondaryQuantity: secQty,
                    selectedUnit: f.unit || 'Nos',
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
                const hasSec = Boolean(mat?.hasSecondaryUnit);
                const secUnit = mat?.secondaryUnit || "";
                const convFactor = Number(mat?.conversionFactor) || 0;
                const qty = r.shortage > 0 ? r.shortage : (r.requiredQuantity || 1);
                const secQty = hasSec && convFactor ? parseFloat((qty * convFactor).toFixed(4)) : 0;
                return {
                    material: mat?._id || r.material || '',
                    materialName: r.materialName,
                    materialCode: r.materialCode || '',
                    quantity: qty,
                    unit: r.unit || 'PCS',
                    hasSecondaryUnit: hasSec,
                    secondaryUnit: secUnit,
                    conversionFactor: convFactor,
                    secondaryQuantity: secQty,
                    selectedUnit: r.unit || 'PCS',
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
        const hasSecondaryUnit = Boolean(selectedItem?.hasSecondaryUnit);
        const secondaryUnit = selectedItem?.secondaryUnit || "";
        const conversionFactor = Number(selectedItem?.conversionFactor) || 0;
        const currentQty = formData.items[index]?.quantity || 1;
        const secondaryQuantity = hasSecondaryUnit && conversionFactor ? parseFloat((currentQty * conversionFactor).toFixed(4)) : 0;

        const newItems = [...formData.items];
        newItems[index] = {
            ...newItems[index],
            material: materialId,
            materialName: selectedItem?.name || selectedItem?.componentName || "",
            materialCode: selectedItem?.code || selectedItem?.componentCode || "",
            materialDescription: materialDesc,
            unit: unitVal,
            hasSecondaryUnit,
            secondaryUnit,
            conversionFactor,
            secondaryQuantity,
            selectedUnit: unitVal,
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

    const addItem = (insertAfterIndex?: number) => {
        const newItem = {
            material: "",
            materialName: "",
            materialCode: "",
            materialDescription: "",
            quantity: 1,
            unit: formData.type === 'fg' ? "Nos" : "PCS",
            hasSecondaryUnit: false,
            secondaryUnit: "",
            conversionFactor: 0,
            secondaryQuantity: 0,
            selectedUnit: formData.type === 'fg' ? "Nos" : "PCS",
            purpose: "",
            component: undefined,
            consumable: undefined,
            fgItem: undefined,
            currentStock: 0
        };

        if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0 && insertAfterIndex < formData.items.length) {
            const newItems = [...formData.items];
            newItems.splice(insertAfterIndex + 1, 0, newItem);
            setFormData({ ...formData, items: newItems });
        } else {
            setFormData({
                ...formData,
                items: [...formData.items, newItem]
            });
        }
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
                hasSecondaryUnit: false,
                secondaryUnit: "",
                conversionFactor: 0,
                secondaryQuantity: 0,
                selectedUnit: newType === 'fg' ? "Nos" : "PCS",
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
        <div className="fixed inset-0 z-[200] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 md:p-6 lg:p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-t-[28px] sm:rounded-3xl w-full sm:w-[94vw] lg:w-[90vw] xl:w-[86vw] max-w-7xl h-[94vh] sm:h-auto sm:max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden my-auto">
                
                {/* Mobile Drag Pill */}
                <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
                    <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
                </div>

                {/* Modal Header */}
                <div className="p-3.5 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/80 dark:bg-gray-800/80 shrink-0 backdrop-blur-md">
                    <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">New Material Request</h2>
                            <span className="text-xs font-mono font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-0.5 rounded-md">
                                {formData.requestNumber}
                            </span>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="sm:hidden p-2 -mr-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-gray-600 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Allowed Inventory Types Switcher (Mobile Swipeable Pills / Desktop Segmented) */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                        <div className="flex bg-gray-200/80 dark:bg-gray-750 p-1 rounded-xl gap-1 w-full sm:w-fit shadow-inner overflow-x-auto no-scrollbar">
                            {/* Consumable Button */}
                            {effectiveAllowedTypes.includes('consumable') && (
                                <button
                                    type="button"
                                    onClick={() => switchType('consumable')}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                        formData.type === 'consumable' 
                                            ? 'bg-amber-500 text-white shadow-sm' 
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Package size={13} /> Consumables
                                </button>
                            )}

                            {/* RM Button */}
                            {effectiveAllowedTypes.includes('rm') && (
                                <button
                                    type="button"
                                    onClick={() => switchType('rm')}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                        formData.type === 'rm' 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Layers size={13} /> RM
                                </button>
                            )}

                            {/* BO Button */}
                            {effectiveAllowedTypes.includes('bo') && (
                                <button
                                    type="button"
                                    onClick={() => switchType('bo')}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                        formData.type === 'bo' 
                                            ? 'bg-emerald-600 text-white shadow-sm' 
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    <ShoppingCart size={13} /> BO
                                </button>
                            )}

                            {/* FG Button */}
                            {effectiveAllowedTypes.includes('fg') && (
                                <button
                                    type="button"
                                    onClick={() => switchType('fg')}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                        formData.type === 'fg' 
                                            ? 'bg-purple-600 text-white shadow-sm' 
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Boxes size={13} /> FG
                                </button>
                            )}
                        </div>

                        <button 
                            onClick={onClose} 
                            className="hidden sm:flex p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-3.5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                    
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
                                placeholder={isMrpRequired ? `🔍 Search active MRP #, Customer, FG (* Required)...` : "🔍 Search MRP # (Optional)..."}
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
                        <div className="flex justify-between items-center mb-2.5">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-1.5">
                                {formData.type === 'rm' && <Layers size={14} className="text-blue-600" />}
                                {formData.type === 'bo' && <ShoppingCart size={14} className="text-emerald-600" />}
                                {formData.type === 'consumable' && <Package size={14} className="text-amber-500" />}
                                {formData.type === 'fg' && <Boxes size={14} className="text-purple-600" />}
                                Requested Items ({formData.items.length})
                            </h3>
                            <button
                                type="button"
                                onClick={() => addItem()}
                                className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded-xl transition-all cursor-pointer active:scale-95"
                            >
                                <Plus size={14} /> Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {formData.items.map((item: any, index) => {
                                const currentStock = getStock(item.material, item.materialCode, item.materialName);
                                const secStock = item.hasSecondaryUnit && item.conversionFactor ? currentStock * item.conversionFactor : 0;
                                const isOperatingInSecondary = Boolean(item.hasSecondaryUnit && item.selectedUnit === item.secondaryUnit);
                                const isExceedingStock = Boolean(
                                    item.material && (
                                        isOperatingInSecondary
                                            ? (item.secondaryQuantity > secStock || item.quantity > currentStock)
                                            : (item.quantity > currentStock)
                                    )
                                );

                                // Options generation strictly filtered per category with Name and Description ONLY
                                const currentOptions = (
                                    formData.type === 'consumable'
                                        ? (consumables || []).map((c: any) => ({
                                            value: c._id,
                                            label: c.name || '',
                                            description: getDescStr(c)
                                        }))
                                        : formData.type === 'fg'
                                            ? effectiveFGList.map((c: any) => ({
                                                value: c._id,
                                                label: c.name || c.componentName || '',
                                                description: getDescStr(c)
                                            }))
                                            : formData.type === 'bo'
                                                ? effectiveBOList.map((b: any) => ({
                                                    value: b._id,
                                                    label: b.name || '',
                                                    description: getDescStr(b)
                                                }))
                                                : effectiveRMList.map((r: any) => ({
                                                    value: r._id,
                                                    label: r.name || '',
                                                    description: getDescStr(r)
                                                }))
                                );

                                return (
                                    <div 
                                        key={index} 
                                        className="relative flex flex-col gap-3 p-3.5 sm:p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800 group hover:border-blue-200 transition-colors shadow-2xs"
                                        style={{ zIndex: 50 - index }}
                                    >
                                        {/* Item Card Top Bar: Item Index & Quick Remove Button */}
                                        <div className="flex items-center justify-between pb-1 border-b border-gray-200/50 dark:border-gray-700/50">
                                            <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                                                Item #{index + 1}
                                            </span>
                                            {formData.items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                                                    title="Remove item"
                                                >
                                                    <Trash2 size={14} />
                                                    <span className="text-[11px]">Remove</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Responsive Grid for Material Selection + Stock + Unit + Qty */}
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                                            {/* Material Selection Field */}
                                            <div className="lg:col-span-6 xl:col-span-5">
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
                                                    <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5">
                                                        <span className="font-bold text-slate-500 text-[10px] uppercase">Description:</span>
                                                        <span className="italic">{item.materialDescription}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Responsive Grid for Stock, Unit & Quantity Controls */}
                                            <div className="lg:col-span-6 xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                {/* Current Stock Field */}
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                                                        <Package size={12} /> Live Stock
                                                    </label>
                                                    <div className={`w-full px-3 py-2.5 rounded-xl text-xs font-black border flex items-center justify-between ${item.material
                                                        ? currentStock > 0
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                                            : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-600 dark:text-red-300'
                                                        : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'
                                                        }`}>
                                                        {item.material ? (
                                                            <div>
                                                                <div>{currentStock} {item.unit}</div>
                                                                {item.hasSecondaryUnit && item.secondaryUnit && (
                                                                    <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                                                        ({secStock.toFixed(2)} {item.secondaryUnit})
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span>-</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Unit Selector Dropdown */}
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                                                        Request Unit
                                                    </label>
                                                    {item.hasSecondaryUnit ? (
                                                        <select
                                                            value={item.selectedUnit || item.unit}
                                                            onChange={(e) => {
                                                                const newUnit = e.target.value;
                                                                const newItems = [...formData.items];
                                                                newItems[index] = {
                                                                    ...newItems[index],
                                                                    selectedUnit: newUnit
                                                                };
                                                                setFormData({ ...formData, items: newItems });
                                                            }}
                                                            className="w-full h-10 px-3 bg-white dark:bg-gray-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
                                                        >
                                                            <option value={item.unit}>{item.unit} (Primary)</option>
                                                            <option value={item.secondaryUnit}>{item.secondaryUnit} (Secondary)</option>
                                                        </select>
                                                    ) : (
                                                        <div className="w-full h-10 px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                                                            <span>{item.unit || 'PCS'}</span>
                                                            <span className="text-[9px] text-gray-400 font-semibold uppercase">Pri</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Dynamic Quantity Input based on Selected Unit */}
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center justify-between">
                                                        <span>Req Qty ({isOperatingInSecondary ? item.secondaryUnit : item.unit || 'Unit'})</span>
                                                        {isOperatingInSecondary && (
                                                            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">2nd</span>
                                                        )}
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={
                                                                isOperatingInSecondary
                                                                    ? (isNaN(item.secondaryQuantity) ? '' : item.secondaryQuantity)
                                                                    : (isNaN(item.quantity) ? '' : item.quantity)
                                                            }
                                                            onChange={(e) => {
                                                                const val = e.target.value === '' ? NaN : parseFloat(e.target.value);
                                                                const newItems = [...formData.items];
                                                                if (isOperatingInSecondary) {
                                                                    const priVal = (!isNaN(val) && item.conversionFactor > 0)
                                                                        ? parseFloat((val / item.conversionFactor).toFixed(4))
                                                                        : 0;
                                                                    newItems[index] = {
                                                                        ...newItems[index],
                                                                        secondaryQuantity: val,
                                                                        quantity: priVal
                                                                    };
                                                                } else {
                                                                    const secVal = (!isNaN(val) && item.hasSecondaryUnit && item.conversionFactor > 0)
                                                                        ? parseFloat((val * item.conversionFactor).toFixed(4))
                                                                        : 0;
                                                                    newItems[index] = {
                                                                        ...newItems[index],
                                                                        quantity: val,
                                                                        secondaryQuantity: secVal
                                                                    };
                                                                }
                                                                setFormData({ ...formData, items: newItems });
                                                            }}
                                                            className={`w-full h-10 px-3 bg-white dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-blue-500 text-xs font-bold ${isExceedingStock ? 'border-red-500 text-red-600 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 dark:border-gray-700'}`}
                                                            min="0.0001"
                                                            step="any"
                                                            placeholder="0"
                                                            required
                                                        />
                                                        {isExceedingStock && (
                                                            <span className="text-[10px] text-red-500 font-medium block mt-1">
                                                                Max Available: {isOperatingInSecondary ? `${secStock.toFixed(2)} ${item.secondaryUnit}` : `${currentStock} ${item.unit}`}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Live Auto-Conversion Display */}
                                                    {item.hasSecondaryUnit && item.conversionFactor > 0 && (
                                                        <div className="mt-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 truncate" title={`1 ${item.unit} = ${item.conversionFactor} ${item.secondaryUnit}`}>
                                                            {isOperatingInSecondary ? (
                                                                <span>↳ = <strong className="font-bold">{item.quantity || 0}</strong> {item.unit}</span>
                                                            ) : (
                                                                <span>↳ = <strong className="font-bold">{item.secondaryQuantity || 0}</strong> {item.secondaryUnit}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Purpose / Remarks Field */}
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Purpose / Remarks</label>
                                            <input
                                                type="text"
                                                value={item.purpose}
                                                onChange={(e) => updateItem(index, "purpose", e.target.value)}
                                                placeholder="Why is this material required on the floor?"
                                                className="w-full h-10 px-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-xs"
                                            />
                                        </div>

                                        {/* Line Item End Action Bar: + Add Item Directly Below & Remove Line */}
                                        <div className="flex items-center justify-between pt-2.5 border-t border-gray-200/60 dark:border-gray-700/60 mt-1">
                                            <button
                                                type="button"
                                                onClick={() => addItem(index)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                                title="Add next line item directly below"
                                            >
                                                <Plus size={14} />
                                                <span>+ Add Item</span>
                                            </button>

                                            {formData.items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer text-xs font-semibold"
                                                    title="Remove this line item"
                                                >
                                                    <Trash2 size={13} />
                                                    <span>Remove</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Full-width Add Button at bottom of items list */}
                            <button
                                type="button"
                                onClick={() => addItem()}
                                className="w-full py-3.5 border-2 border-dashed border-blue-200 hover:border-blue-400 dark:border-blue-800/80 dark:hover:border-blue-600 bg-blue-50/40 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-[0.99] shadow-xs"
                            >
                                <Plus size={16} />
                                <span>+ Add Another Line Item</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sticky Mobile App-Style Footer Action Bar */}
                <div className="p-3 sm:p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/90 dark:bg-gray-850/90 shrink-0 backdrop-blur-md flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-semibold hidden sm:inline">Total:</span>
                        <span className="font-extrabold text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            {formData.items.length} Item{formData.items.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 text-gray-600 dark:text-gray-300 text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
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
                                const secStock = item.hasSecondaryUnit && item.conversionFactor ? currentStock * item.conversionFactor : 0;
                                const isSecondary = item.hasSecondaryUnit && item.selectedUnit === item.secondaryUnit;
                                const exceeds = isSecondary 
                                    ? (item.secondaryQuantity > secStock || item.quantity > currentStock)
                                    : (item.quantity > currentStock);
                                const isZeroOrNegative = isSecondary 
                                    ? (!item.secondaryQuantity || item.secondaryQuantity <= 0)
                                    : (!item.quantity || item.quantity <= 0);
                                return exceeds || isZeroOrNegative;
                            })}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer min-h-[42px] flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Submitting...</span>
                                </div>
                            ) : (
                                "Submit Request"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
