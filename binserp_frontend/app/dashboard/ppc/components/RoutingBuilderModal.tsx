import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Edit2, Check, Package, Factory, LayoutList, GripVertical } from "lucide-react";
import { useSavePPCProductMutation, useGetProcessesQuery } from "@/src/store/services/ppcService";
import LoadingSpinner from "@/src/components/LoadingSpinner";

interface RoutingBuilderModalProps {
    fgItem: any;
    onClose: () => void;
}

export default function RoutingBuilderModal({ fgItem, onClose }: RoutingBuilderModalProps) {
    const [savePPCProduct, { isLoading: isSaving }] = useSavePPCProductMutation();
    const { data: processes = [], isLoading: isLoadingProcesses } = useGetProcessesQuery();

    // The working copy of the FGItem's BOM (so we can edit it here)
    const [bom, setBom] = useState<any[]>([]);
    
    // The routing array
    const [routing, setRouting] = useState<any[]>([]);

    useEffect(() => {
        if (fgItem) {
            // Initialize working BOM
            setBom(fgItem.bom || []);
            // Initialize routing if it exists
            setRouting(fgItem.ppcProduct?.routing || []);
        }
    }, [fgItem]);

    const handleSave = async () => {
        try {
            await savePPCProduct({
                fgItemId: fgItem._id,
                routing,
                updatedBom: bom
            }).unwrap();
            onClose();
        } catch (error) {
            console.error("Failed to save routing", error);
            alert("Failed to save routing.");
        }
    };

    const addProcess = () => {
        setRouting([...routing, {
            process: "",
            setupTime: 0,
            cycleTime: 0,
            bomRequirements: []
        }]);
    };

    const removeProcess = (index: number) => {
        setRouting(routing.filter((_, i) => i !== index));
    };

    const updateProcess = (index: number, field: string, value: any) => {
        const updated = [...routing];
        updated[index] = { ...updated[index], [field]: value };
        setRouting(updated);
    };

    const toggleBOMRequirement = (processIndex: number, bomItem: any) => {
        const process = routing[processIndex];
        const reqs = [...process.bomRequirements];
        
        // Ensure bomItem has item id properly stringified for comparison
        const itemId = bomItem.item?._id || bomItem.item;
        
        const existingIndex = reqs.findIndex((r: any) => (r.item?._id || r.item) === itemId);

        if (existingIndex >= 0) {
            reqs.splice(existingIndex, 1);
        } else {
            reqs.push({
                item: itemId,
                itemType: bomItem.itemType,
                itemName: bomItem.item?.name || bomItem.itemName,
                quantity: bomItem.quantity,
                unit: bomItem.unit || "Nos"
            });
        }
        updateProcess(processIndex, "bomRequirements", reqs);
    };

    const updateBOMRequirementQuantity = (processIndex: number, reqIndex: number, quantity: number) => {
        const reqs = [...routing[processIndex].bomRequirements];
        reqs[reqIndex].quantity = quantity;
        updateProcess(processIndex, "bomRequirements", reqs);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800">
                
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-gray-100 dark:border-gray-800">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Factory className="text-indigo-600" />
                            Route Builder: {fgItem.name}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Define the manufacturing sequence and assign BOM materials to specific processes.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-gray-50 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6">
                    
                    {/* Left Column: BOM Editor */}
                    <div className="w-full lg:w-1/3 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                <Package size={18} className="text-amber-500" />
                                Base BOM
                            </h3>
                        </div>
                        
                        <div className="bg-amber-50/50 dark:bg-gray-800/50 border border-amber-100 dark:border-gray-700 rounded-xl p-4">
                            <p className="text-xs text-gray-500 mb-3">
                                You can edit the required quantity for these items here. Changes will overwrite the primary Store BOM upon saving.
                            </p>
                            
                            {bom.length === 0 ? (
                                <div className="text-sm text-gray-400 text-center py-4">No BOM components attached.</div>
                            ) : (
                                <div className="space-y-2">
                                    {bom.map((b, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.item?.name || b.itemName || 'Unknown'}</span>
                                                <span className="text-[10px] text-amber-600 uppercase font-bold tracking-wider">{b.itemType}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number"
                                                    value={b.quantity}
                                                    onChange={(e) => {
                                                        const newBom = [...bom];
                                                        newBom[idx].quantity = Number(e.target.value);
                                                        setBom(newBom);
                                                    }}
                                                    className="w-16 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded focus:ring-1 focus:ring-amber-500 dark:bg-gray-900"
                                                />
                                                <span className="text-xs text-gray-500">{b.unit || 'Nos'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Routing Sequence */}
                    <div className="w-full lg:w-2/3 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                <LayoutList size={18} className="text-indigo-500" />
                                Process Sequence
                            </h3>
                            <button
                                onClick={addProcess}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                            >
                                <Plus size={16} /> Add Step
                            </button>
                        </div>

                        {isLoadingProcesses ? <LoadingSpinner /> : routing.length === 0 ? (
                            <div className="flex-1 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-400 p-8">
                                <Factory size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
                                <p>No process steps defined.</p>
                                <p className="text-sm">Click "Add Step" to begin building the route.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {routing.map((route, rIdx) => (
                                    <div key={rIdx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                                        
                                        {/* Process Step Header */}
                                        <div className="bg-gray-50 dark:bg-gray-800/80 p-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold">{rIdx + 1}</span>
                                            </div>
                                            
                                            <div className="flex-1 min-w-[200px]">
                                                <select
                                                    value={typeof route.process === 'object' ? route.process._id : route.process}
                                                    onChange={(e) => updateProcess(rIdx, "process", e.target.value)}
                                                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900"
                                                >
                                                    <option value="">Select Process...</option>
                                                    {processes.map((p: any) => (
                                                        <option key={p._id} value={p._id}>{p.processName}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] text-gray-500 font-medium">Setup (m)</label>
                                                    <input 
                                                        type="number" 
                                                        value={route.setupTime} 
                                                        onChange={(e) => updateProcess(rIdx, "setupTime", Number(e.target.value))}
                                                        className="w-16 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] text-gray-500 font-medium">Cycle (m)</label>
                                                    <input 
                                                        type="number" 
                                                        value={route.cycleTime} 
                                                        onChange={(e) => updateProcess(rIdx, "cycleTime", Number(e.target.value))}
                                                        className="w-16 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <button
                                                onClick={() => removeProcess(rIdx)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {/* BOM Allocation for this Process */}
                                        <div className="p-4">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Allocated Materials</h4>
                                            
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {bom.map((b, bIdx) => {
                                                    const itemId = b.item?._id || b.item;
                                                    const isAllocated = route.bomRequirements?.some((r: any) => (r.item?._id || r.item) === itemId);
                                                    
                                                    return (
                                                        <button
                                                            key={bIdx}
                                                            onClick={() => toggleBOMRequirement(rIdx, b)}
                                                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors flex items-center gap-1.5 ${
                                                                isAllocated 
                                                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                                                                    : "bg-white border-gray-200 text-gray-500 hover:border-indigo-300"
                                                            }`}
                                                        >
                                                            {isAllocated ? <Check size={12} /> : <Plus size={12} />}
                                                            {b.item?.name || b.itemName || 'Unknown'}
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            {/* Quantities for allocated items */}
                                            {route.bomRequirements?.length > 0 && (
                                                <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800 p-3 space-y-2">
                                                    {route.bomRequirements.map((req: any, reqIdx: number) => (
                                                        <div key={reqIdx} className="flex items-center justify-between text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                                <span className="font-medium text-gray-700 dark:text-gray-300">{req.itemName}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <input 
                                                                    type="number"
                                                                    value={req.quantity}
                                                                    onChange={(e) => updateBOMRequirementQuantity(rIdx, reqIdx, Number(e.target.value))}
                                                                    className="w-16 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                                                                />
                                                                <span className="text-xs text-gray-500">{req.unit}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? <LoadingSpinner /> : <Check size={18} />}
                        Save Routing & BOM
                    </button>
                </div>

            </div>
        </div>
    );
}
