import React from 'react';
import { BadgeCheck, XCircle, Clock, Eye, Calendar, ArrowRight, FileText, Layers, ShoppingCart, Package, Boxes, User } from 'lucide-react';

interface MaterialRequestTableProps {
    requests: any[];
    onIssue: (request: any) => void;
    onReject: (request: any) => void;
    onView: (request: any) => void;
}

export default function MaterialRequestTable({ requests, onIssue, onReject, onView }: MaterialRequestTableProps) {
    if (!requests || requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 h-64">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <FileText className="text-gray-300 dark:text-gray-600" size={32} />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No New Requests</h3>
                <p className="text-gray-500 text-sm mt-1">Material requests across RM, BO, Consumables, and FG will appear here.</p>
            </div>
        );
    }

    const renderTypeBadge = (type?: string) => {
        const norm = (type || 'rm').toLowerCase();
        if (norm === 'consumable') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                    <Package size={12} /> Consumable
                </span>
            );
        }
        if (norm === 'fg' || norm === 'inhouse') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60">
                    <Boxes size={12} /> FG / Inhouse
                </span>
            );
        }
        if (norm === 'bo' || norm === 'bought-out') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                    <ShoppingCart size={12} /> Bought Out (BO)
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                <Layers size={12} /> Raw Material (RM)
            </span>
        );
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Request #</th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Target SO / MRP</th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Inventory Type</th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Requester</th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500 hidden md:table-cell">Items Summary</th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {requests.map((request) => (
                            <tr
                                key={request._id}
                                className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group cursor-pointer"
                                onClick={() => onView(request)}
                            >
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs border border-blue-100 dark:border-blue-900/50">
                                            {request.items?.length || 0}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-white">{request.requestNumber}</div>
                                            <div className="text-xs font-semibold text-gray-500">{request.status}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    {request.mrpNumber ? (
                                        <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono text-xs px-2.5 py-1 rounded-lg font-bold">
                                            MRP: {request.mrpNumber}
                                        </span>
                                    ) : request.soNumber || request.salesOrder?.orderNumber ? (
                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-mono text-xs px-2.5 py-1 rounded-lg font-bold">
                                            {request.soNumber || request.salesOrder?.orderNumber}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 text-xs italic">General Store</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    {renderTypeBadge(request.type)}
                                </td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-center gap-1.5 text-xs font-medium">
                                        <Calendar size={13} className="text-gray-400" />
                                        {new Date(request.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{request.requestedBy?.name || request.createdByName || 'Store Admin'}</div>
                                    <div className="text-xs text-gray-400">{request.requestedBy?.email || request.department || ''}</div>
                                </td>
                                <td className="p-4 hidden md:table-cell">
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                        {(request.items || []).slice(0, 2).map((item: any, i: number) => (
                                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs border border-gray-200 dark:border-gray-700 font-medium">
                                                {item.materialName} ({item.quantity} {item.unit || 'PCS'})
                                            </span>
                                        ))}
                                        {(request.items || []).length > 2 && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-50 dark:bg-gray-800/80 text-gray-400 text-xs border border-gray-200 dark:border-gray-700">
                                                +{request.items.length - 2} more
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => onView(request)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl transition-colors"
                                            title="View Details"
                                        >
                                            <Eye size={17} />
                                        </button>
                                        <button
                                            onClick={() => onReject(request)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-xl transition-colors"
                                            title="Reject"
                                        >
                                            <XCircle size={17} />
                                        </button>
                                        <button
                                            onClick={() => onIssue(request)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-xs font-bold transition-all transform active:scale-95"
                                        >
                                            Issue Items <ArrowRight size={13} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col divide-y divide-gray-100 dark:divide-gray-800 pb-28 sm:pb-20">
                {requests.map((request) => (
                    <div
                        key={request._id}
                        className="p-4 flex flex-col gap-3 active:bg-gray-50 dark:active:bg-gray-800/50"
                        onClick={() => onView(request)}
                    >
                        {/* Card Header */}
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 font-bold text-xs border border-blue-100 dark:border-blue-900/50">
                                    {request.items?.length || 0}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-white">{request.requestNumber}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {renderTypeBadge(request.type)}
                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                            <Calendar size={11} /> {new Date(request.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                {request.status}
                            </span>
                        </div>

                        {/* Requester & Items Hint */}
                        <div className="text-sm border-l-2 border-blue-400 pl-3 py-1 bg-gray-50/50 dark:bg-gray-800/30 rounded-r-xl">
                            <div className="text-gray-900 dark:text-gray-100 font-semibold">{request.requestedBy?.name || request.createdByName || 'Store Admin'}</div>
                            <div className="text-gray-500 text-xs">{request.requestedBy?.email || request.department || ''}</div>
                            <div className="mt-2 flex flex-wrap gap-1">
                                {(request.items || []).slice(0, 3).map((item: any, i: number) => (
                                    <span key={i} className="text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 font-medium">
                                        {item.materialName} ({item.quantity} {item.unit || 'PCS'})
                                    </span>
                                ))}
                                {(request.items || []).length > 3 && <span className="text-xs text-gray-400">+{request.items.length - 3}</span>}
                            </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => onView(request)}
                                className="flex-1 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-bold flex justify-center items-center gap-1"
                            >
                                <Eye size={14} /> View
                            </button>
                            <button
                                onClick={() => onReject(request)}
                                className="flex-1 py-2 text-red-600 bg-red-50 dark:bg-red-950/50 rounded-xl text-xs font-bold flex justify-center items-center gap-1"
                            >
                                <XCircle size={14} /> Reject
                            </button>
                            <button
                                onClick={() => onIssue(request)}
                                className="flex-[2] py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold flex justify-center items-center gap-1 shadow-sm"
                            >
                                Issue <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
