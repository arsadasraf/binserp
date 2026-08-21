import React, { useState } from 'react';
import { 
  X, Layers, Calendar, User, FileText, CheckCircle2, Download, 
  Package, ArrowUpRight, ShoppingCart, ChevronDown, ChevronRight, 
  Boxes, GitFork, CornerDownRight, ShieldCheck 
} from 'lucide-react';
import Link from 'next/link';

interface MRPDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    mrpPlan: any;
    onStatusChange?: (id: string, newStatus: string) => void;
}

export default function MRPDetailsModal({ isOpen, onClose, mrpPlan, onStatusChange }: MRPDetailsModalProps) {
    const [activeTab, setActiveTab] = useState<'consolidated' | 'nested'>('consolidated');
    const [expandedFgIndex, setExpandedFgIndex] = useState<number | null>(0);

    if (!isOpen || !mrpPlan) return null;

    const fgItems = mrpPlan.fgItems || [];
    // Consolidated materials
    const materials = [...(mrpPlan.rmRequirements || []), ...(mrpPlan.boRequirements || [])];
    const totalShortages = materials.reduce((sum: number, r: any) => sum + (r.shortage || 0), 0);

    const handlePrint = () => {
        window.print();
    };

    const toggleFgAccordion = (index: number) => {
        setExpandedFgIndex(prev => prev === index ? null : index);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5 lg:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl xl:max-w-7xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                
                {/* Header */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white flex justify-between items-start shrink-0 border-b border-indigo-900">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-mono font-bold">
                                {mrpPlan.mrpNumber}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                mrpPlan.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                mrpPlan.status === 'In Production' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                mrpPlan.status === 'Partially Completed' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                                mrpPlan.status === 'In Procurement' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                                {mrpPlan.status || 'Planned'}
                            </span>
                        </div>
                        <h2 className="text-xl font-black mt-1.5 text-white">
                            MRP Material Plan Preview & Breakdown
                        </h2>
                        <p className="text-xs text-indigo-200 mt-0.5">
                            Customer: <strong>{mrpPlan.customerName || 'Internal / Direct Demand'}</strong> | Target: <strong>{mrpPlan.targetDate ? new Date(mrpPlan.targetDate).toLocaleDateString('en-GB') : 'N/A'}</strong>
                            {mrpPlan.remarks && <span className="ml-2">| Purpose: <strong>{mrpPlan.remarks}</strong></span>}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Entered Finished Goods</span>
                        <strong className="text-slate-900 dark:text-white font-black text-base">{fgItems.length} Products</strong>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/20 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-indigo-500 block">Consolidated Materials Needed</span>
                        <strong className="text-indigo-700 dark:text-indigo-300 font-black text-base">{materials.length} Unique Items</strong>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50/20 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-rose-500 block">Net Purchase Shortages</span>
                        <strong className="text-rose-600 dark:text-rose-400 font-black text-base">
                            {totalShortages > 0 ? `${totalShortages} Short` : 'All In Stock'}
                        </strong>
                    </div>
                </div>

                {/* Sub-tab Navigation */}
                <div className="p-4 pb-0 flex gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto no-scrollbar shrink-0">
                    <button
                        onClick={() => setActiveTab('consolidated')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                            activeTab === 'consolidated'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40'
                                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Package size={15} /> Consolidated RM / BO Requirements ({materials.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('nested')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                            activeTab === 'nested'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40'
                                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <GitFork size={15} /> Nested FG Items & Sub-Assemblies ({fgItems.length})
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-900 space-y-6">
                    
                    {/* TAB 1: CONSOLIDATED RM / BO MATERIAL REQUIREMENTS */}
                    {activeTab === 'consolidated' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <Package className="text-indigo-600" size={18} />
                                        Consolidated Material Purchase Requirements
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Aggregated gross requirements across all entered FG products with real-time in-house stock & shortages
                                    </p>
                                </div>
                                <span className="text-xs font-mono font-bold text-slate-400">
                                    {materials.length} Items Total
                                </span>
                            </div>

                            {materials.length === 0 ? (
                                <div className="p-12 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200">
                                    No materials required for these Finished Goods BOMs.
                                </div>
                            ) : (
                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-indigo-50/60 dark:bg-slate-800 text-indigo-950 dark:text-indigo-300 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                                            <tr>
                                                <th className="px-4 py-3.5">Material / Item</th>
                                                <th className="px-4 py-3.5">Category / Type</th>
                                                <th className="px-4 py-3.5">Required For (FG Items)</th>
                                                <th className="px-4 py-3.5 text-center">Gross Required</th>
                                                <th className="px-4 py-3.5 text-center">Current Stock</th>
                                                <th className="px-4 py-3.5 text-center">Net Shortage</th>
                                                <th className="px-4 py-3.5 text-right">Procure Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                            {materials.map((rm: any, idx: number) => {
                                                const sourceBreakdown = Array.isArray(rm.sourceFGNames) && rm.sourceFGNames.length > 0 
                                                    ? rm.sourceFGNames.join(', ')
                                                    : (rm.sourceFGName || '-');

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                                        <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                                                            {rm.materialName}
                                                            {rm.materialCode && <span className="block text-[10px] text-slate-400 font-mono font-normal">{rm.materialCode}</span>}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 font-medium">
                                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold">
                                                                {rm.category || 'RM / BO'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 max-w-[240px] truncate text-slate-600 dark:text-slate-300 font-medium" title={sourceBreakdown}>
                                                            {sourceBreakdown}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                                                            {rm.requiredQuantity} {rm.unit || 'PCS'}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center font-semibold text-slate-600 dark:text-slate-400">
                                                            {rm.currentStock} {rm.unit || 'PCS'}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center font-extrabold font-mono">
                                                            {rm.shortage > 0 ? (
                                                                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                                    -{rm.shortage} {rm.unit || 'PCS'} Short
                                                                </span>
                                                            ) : (
                                                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                    In Stock
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <Link
                                                                    href={`/dashboard/store/purchase/rfq?materialId=${rm.material || ''}&qty=${rm.shortage || rm.requiredQuantity}&name=${encodeURIComponent(rm.materialName)}`}
                                                                    className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold text-[11px] transition-colors"
                                                                >
                                                                    Outward RFQ
                                                                </Link>
                                                                <Link
                                                                    href={`/dashboard/store/purchase/po?materialId=${rm.material || ''}&qty=${rm.shortage || rm.requiredQuantity}&name=${encodeURIComponent(rm.materialName)}`}
                                                                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] transition-colors"
                                                                >
                                                                    Outward PO
                                                                </Link>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: NESTED FG ITEMS, SUB-ASSEMBLIES & INDIVIDUAL COMPONENTS */}
                    {activeTab === 'nested' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <GitFork className="text-indigo-600" size={18} />
                                    Finished Goods & Multi-Level BOM Explosion
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Drill down into each entered Finished Good to view its sub-assemblies, individual components, and raw materials
                                </p>
                            </div>

                            <div className="space-y-4">
                                {fgItems.map((fg: any, fgIdx: number) => {
                                    const isExpanded = expandedFgIndex === fgIdx;
                                    const nestedList = fg.nestedMaterials || [];

                                    return (
                                        <div 
                                            key={fgIdx}
                                            className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs bg-white dark:bg-slate-900 transition-all"
                                        >
                                            {/* FG Accordion Header */}
                                            <div 
                                                onClick={() => toggleFgAccordion(fgIdx)}
                                                className="p-4 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                                                                {fg.fgItemName}
                                                            </span>
                                                            {fg.fgItemCode && (
                                                                <span className="font-mono text-xs text-slate-400 bg-slate-200/60 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                                    {fg.fgItemCode}
                                                                </span>
                                                            )}
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                                Target: {fg.quantity} {fg.unit || 'PCS'}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                                (fg.receivedQuantity || 0) >= fg.quantity
                                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                                    : (fg.receivedQuantity || 0) > 0
                                                                        ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
                                                                        : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                                            }`}>
                                                                Produced / Received: {fg.receivedQuantity || 0} / {fg.quantity}
                                                            </span>
                                                        </div>
                                                        {fg.description && (
                                                            <p className="text-xs text-slate-500 mt-0.5">{fg.description}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 text-xs">
                                                    <div className="text-slate-500">
                                                        Target: <strong className="text-slate-800 dark:text-slate-200">{fg.targetDate ? new Date(fg.targetDate).toLocaleDateString('en-GB') : 'N/A'}</strong>
                                                    </div>
                                                    <div className="text-slate-500">
                                                        BOM: <strong className="text-indigo-600 dark:text-indigo-400">{fg.bomNumber || 'BOM-Auto'}</strong>
                                                    </div>
                                                    <div className="text-slate-500">
                                                        Exploded: <strong className="text-slate-800 dark:text-slate-200 font-mono">{nestedList.length} items</strong>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Nested BOM Table */}
                                            {isExpanded && (
                                                <div className="p-4 bg-white dark:bg-slate-900 overflow-x-auto">
                                                    {nestedList.length === 0 ? (
                                                        <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl">
                                                            No nested components or BOM formula found for this item.
                                                        </div>
                                                    ) : (
                                                        <table className="w-full text-xs text-left">
                                                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                                                                <tr>
                                                                    <th className="px-3.5 py-2.5">Hierarchy / Item Name</th>
                                                                    <th className="px-3.5 py-2.5">Type / Category</th>
                                                                    <th className="px-3.5 py-2.5 text-center">Qty / FG</th>
                                                                    <th className="px-3.5 py-2.5 text-center">Total Required</th>
                                                                    <th className="px-3.5 py-2.5 text-center">Current Stock</th>
                                                                    <th className="px-3.5 py-2.5 text-center">Shortage</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                {nestedList.map((item: any, nIdx: number) => {
                                                                    const isSubAssembly = item.itemType === 'SubAssembly';
                                                                    const indentPadding = (item.level || 1) > 1 ? 'pl-6' : 'pl-3.5';

                                                                    return (
                                                                        <tr key={nIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                                            <td className={`py-2.5 ${indentPadding} font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5`}>
                                                                                {(item.level || 1) > 1 && (
                                                                                    <CornerDownRight size={13} className="text-indigo-400 shrink-0" />
                                                                                )}
                                                                                <div>
                                                                                    <span className={isSubAssembly ? "font-bold text-indigo-600 dark:text-indigo-400" : ""}>
                                                                                        {item.materialName}
                                                                                    </span>
                                                                                    {item.materialCode && (
                                                                                        <span className="block text-[10px] text-slate-400 font-mono">{item.materialCode}</span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5">
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                                    isSubAssembly 
                                                                                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' 
                                                                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                                                }`}>
                                                                                    {isSubAssembly ? 'Sub-Assembly' : (item.category || 'Component')}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400">
                                                                                {item.quantityPerFG || 1} {item.unit || 'PCS'}
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200">
                                                                                {item.totalRequired} {item.unit || 'PCS'}
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-400">
                                                                                {item.currentStock} {item.unit || 'PCS'}
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 text-center font-extrabold font-mono">
                                                                                {item.shortage > 0 ? (
                                                                                    <span className="text-rose-600">
                                                                                        -{item.shortage} {item.unit || 'PCS'} Short
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-emerald-600">
                                                                                        In Stock
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="text-xs text-slate-500">
                        Created By: <strong>{mrpPlan.createdByName || mrpPlan.createdBy?.name || 'Planner'}</strong> on {new Date(mrpPlan.createdAt).toLocaleString('en-GB')}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                            <Download size={14} /> Print Plan
                        </button>

                        <button
                            onClick={onClose}
                            className="px-5 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-all shadow-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
