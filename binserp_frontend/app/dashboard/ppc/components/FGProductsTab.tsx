"use client";

import { useState } from "react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Package, Search, Factory, Edit, Download, Eye } from "lucide-react";
import { useGetPPCProductsStatusQuery } from "@/src/store/services/ppcService";
import RoutingBuilderModal from "./RoutingBuilderModal";
import FGItemRouteDetailsModal from "./routing/FGItemRouteDetailsModal";
import { generateProcessRoutePDF } from "@/src/utils/generateProcessRoutePDF";

export default function FGProductsTab() {
    const [searchTerm, setSearchTerm] = useState("");
    const [viewingItem, setViewingItem] = useState<any | null>(null);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [filterType, setFilterType] = useState("All");
    const [filterRoute, setFilterRoute] = useState("All");

    const { data: fgItemsWrapper, isLoading } = useGetPPCProductsStatusQuery();
    const fgItems = fgItemsWrapper?.data || [];

    const filteredItems = fgItems.filter((item: any) => {
        const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) || item.code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === "All" || (item.type || "Assembly") === filterType;
        const matchesRoute = filterRoute === "All" || 
            (filterRoute === "Yes" && item.isRoutingAttached) || 
            (filterRoute === "No" && !item.isRoutingAttached);
        
        return matchesSearch && matchesType && matchesRoute;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search FG Items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full sm:w-auto px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all cursor-pointer"
                    >
                        <option value="All">All Types</option>
                        <option value="Assembly">Assembly</option>
                        <option value="Sub Assembly">Sub Assembly</option>
                        <option value="Component">Component</option>
                    </select>
                    
                    <select
                        value={filterRoute}
                        onChange={(e) => setFilterRoute(e.target.value)}
                        className="w-full sm:w-auto px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all cursor-pointer"
                    >
                        <option value="All">All Routing Status</option>
                        <option value="Yes">Routing Attached</option>
                        <option value="No">No Routing</option>
                    </select>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 font-medium">
                                <th className="px-6 py-4">Item Details</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">BOM Count</th>
                                <th className="px-6 py-4 text-center">Route Process Attached</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {isLoading ? (
                                <tr><td colSpan={5} className="text-center py-12"><LoadingSpinner /></td></tr>
                            ) : filteredItems.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No FG Items found.</td></tr>
                            ) : (
                                filteredItems.map((item: any) => (
                                    <tr 
                                        key={item._id} 
                                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                                        onClick={() => setViewingItem(item)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                                                    <Package size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">{item.code || "No Code"}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium">
                                                {item.type || "Assembly"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                            {item.bom?.length || 0} items
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.isRoutingAttached && item.ppcProduct?.routing?.length > 0 ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-bold flex items-center gap-1">
                                                            <span>{item.ppcProduct.routing.length} Steps</span>
                                                        </span>
                                                        
                                                        {item.ppcProduct.routing.some((r: any) => r.qcRequired) && (
                                                            <span className="p-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-md text-[10px] font-bold" title="Quality Control Inspection Gate Active">
                                                                QC
                                                            </span>
                                                        )}

                                                        {item.ppcProduct.routing.some((r: any) => (r.photos?.length > 0 || r.documents?.length > 0)) && (
                                                            <span className="p-1 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-md text-[10px] font-bold" title="PDF Drawings / Setup Photos Attached">
                                                                Docs
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                                        <span>
                                                            {item.ppcProduct.routing.filter((r: any) => r.processType !== 'Outside' && !r.isOutsourced).length} In-House
                                                        </span>
                                                        {item.ppcProduct.routing.filter((r: any) => r.processType === 'Outside' || r.isOutsourced).length > 0 && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                                    {item.ppcProduct.routing.filter((r: any) => r.processType === 'Outside' || r.isOutsourced).length} Outside
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full text-xs font-medium">
                                                        No Routing
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        generateProcessRoutePDF({ item });
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                                                    title="Download Route Sheet PDF"
                                                >
                                                    <Download size={13} className="text-indigo-600" />
                                                    <span>PDF</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingItem(item);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                                                >
                                                    {item.isRoutingAttached ? <Edit size={13} /> : <Factory size={13} />}
                                                    <span>{item.isRoutingAttached ? "Edit" : "Add Route"}</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {viewingItem && (
                <FGItemRouteDetailsModal
                    item={viewingItem}
                    onClose={() => setViewingItem(null)}
                    onEdit={() => {
                        const itemToEdit = viewingItem;
                        setViewingItem(null);
                        setEditingItem(itemToEdit);
                    }}
                />
            )}

            {editingItem && (
                <RoutingBuilderModal 
                    fgItem={editingItem} 
                    onClose={() => setEditingItem(null)} 
                />
            )}
        </div>
    );
}
