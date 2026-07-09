"use client";

import { useState } from "react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Package, Search, Factory, Edit, FileText } from "lucide-react";
import { useGetPPCProductsStatusQuery } from "@/src/store/services/ppcService";
import RoutingBuilderModal from "./RoutingBuilderModal";

export default function FGProductsTab() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
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
                                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                                        onClick={() => setSelectedItem(item)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                    <Package size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900 dark:text-white">
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
                                        <td className="px-6 py-4 text-center">
                                            {item.isRoutingAttached ? (
                                                <span className="px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-bold">
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 bg-gray-100 text-gray-500 border border-gray-200 rounded-full text-xs font-bold">
                                                    No
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedItem(item);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors"
                                            >
                                                {item.isRoutingAttached ? <Edit size={14} /> : <Factory size={14} />}
                                                {item.isRoutingAttached ? "Edit Routing" : "Add Routing"}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedItem && (
                <RoutingBuilderModal 
                    fgItem={selectedItem} 
                    onClose={() => setSelectedItem(null)} 
                />
            )}
        </div>
    );
}
