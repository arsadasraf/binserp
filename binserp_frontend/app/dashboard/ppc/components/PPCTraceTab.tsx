"use client";

import React, { useState } from 'react';
import { Activity, Search, Package, ChevronDown, ChevronRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { useLazyGetJobsQuery } from '@/src/store/services/ppcService';

export default function PPCTraceTab() {
    const [searchTerm, setSearchTerm] = useState("");
    const [searched, setSearched] = useState(false);
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    const [trigger, { data: jobsResponse, isFetching: loading }] = useLazyGetJobsQuery();
    const items = jobsResponse || [];

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchTerm.trim()) return;

        setSearched(true);
        setExpandedItem(null);
        trigger(searchTerm);
    };

    const toggleExpand = (id: string) => {
        setExpandedItem(expandedItem === id ? null : id);
    };

    return (
        <div className="space-y-6">
            {/* Search Header */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Activity className="text-indigo-600" />
                    Product Traceability
                </h2>
                <form onSubmit={handleSearch} className="relative max-w-2xl">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Scan or Enter Item Code (e.g. ORD-PART-001), PO Number, or Part Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-lg font-medium"
                    />
                    <button
                        type="submit"
                        className="absolute right-2 top-2 bottom-2 px-6 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                    >
                        Trace
                    </button>
                </form>
                <p className="mt-3 text-sm text-gray-500">
                    Track individual item lifecycle, location, and process history.
                </p>
            </div>

            {/* Results */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : items.length > 0 ? (
                    items.map((item) => (
                        <div key={item._id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden group hover:shadow-md transition-shadow">

                            {/* Item Header */}
                            <div
                                onClick={() => toggleExpand(item._id)}
                                className="p-5 flex items-center justify-between cursor-pointer bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{item.jobNumber}</h3>
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${item.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    item.status === 'InProgress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                            <span>PO: {item.poNumber || item.order?.orderNumber}</span>
                                            <span>•</span>
                                            <span>Part: {item.partName}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    {expandedItem === item._id ? <ChevronDown className="text-gray-400" /> : <ChevronRight className="text-gray-400" />}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedItem === item._id && (
                                <div className="p-6 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2">

                                    {/* Timeline */}
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-6">Manufacturing Lifecycle</h4>

                                    <div className="relative pl-8 space-y-8 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                                        {/* Created Step */}
                                        <div className="relative">
                                            <div className="absolute -left-[34px] w-7 h-7 bg-green-100 text-green-600 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                                                <CheckCircle size={14} />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-white">Order Created & Job Generated</div>
                                                <div className="text-sm text-gray-500">{new Date(item.createdAt).toLocaleString()}</div>
                                            </div>
                                        </div>

                                        {/* Processes */}
                                        {item.processHistory?.map((process: any, idx: number) => {
                                            const isDone = process.status === 'Completed';
                                            const isActive = process.status === 'InProgress';

                                            // Status Icon Color
                                            let iconBg = 'bg-gray-100 text-gray-400';
                                            if (isDone) iconBg = 'bg-green-100 text-green-600';
                                            if (isActive) iconBg = 'bg-blue-100 text-blue-600 animate-pulse';

                                            return (
                                                <div key={idx} className="relative">
                                                    <div className={`absolute -left-[34px] w-7 h-7 ${iconBg} rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900`}>
                                                        {isDone ? <CheckCircle size={14} /> : isActive ? <Activity size={14} /> : <Clock size={14} />}
                                                    </div>

                                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                                        <div className="flex justify-between mb-2">
                                                            <div className="font-semibold text-gray-900 dark:text-white">
                                                                Operation: {process.operationName}
                                                            </div>
                                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isDone ? 'bg-green-100 text-green-700' :
                                                                    isActive ? 'bg-blue-100 text-blue-700' :
                                                                        'bg-gray-200 text-gray-600'
                                                                }`}>
                                                                {process.status}
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                            <div>
                                                                <span className="text-gray-500 block text-xs uppercase">Machine</span>
                                                                <span className="font-medium">{process.assignedMachine?.machineName || "Pending Assignment"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 block text-xs uppercase">Operator</span>
                                                                <span className="font-medium">{process.assignedEmployee?.name || "Unassigned"}</span>
                                                            </div>
                                                            {process.startTime && (
                                                                <div>
                                                                    <span className="text-gray-500 block text-xs uppercase">Started</span>
                                                                    <span className="font-medium">{new Date(process.startTime).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            {process.endTime && (
                                                                <div>
                                                                    <span className="text-gray-500 block text-xs uppercase">Ended</span>
                                                                    <span className="font-medium">{new Date(process.endTime).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {(!item.processHistory || item.processHistory.length === 0) && (
                                            <div className="text-gray-400 italic text-sm">No process history available. Pending production planning.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                ) : searched ? (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <h3 className="font-medium text-lg">No Items Found</h3>
                        <p>We couldn't find any items matching "{searchTerm}".</p>
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-400">
                        Enter a unique item code or PO number to start tracing.
                    </div>
                )}
            </div>
        </div>
    );
}
