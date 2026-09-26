import React from 'react';
import { BadgeCheck, XCircle, Clock, Eye, Calendar, ArrowRight, FileText, Layers, ShoppingCart, Package, Boxes, User } from 'lucide-react';
import { formatDateTime } from './MaterialIssueHistoryTable';

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
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col flex-1 min-h-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] scrollbar-thin">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs border-b border-gray-100 dark:border-gray-800 shadow-2xs">
                        <tr>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Request #</th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Target SO / MRP</th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Inventory Type</th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Date & Time</th>
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
                                <td className="p-4 text-xs font-mono text-gray-600 dark:text-gray-300">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={13} className="text-gray-400" />
                                        {formatDateTime(request.createdAt)}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{request.requestedBy?.name || request.createdByName || 'Store Admin'}</div>
                                    <div className="text-xs text-gray-400">{request.requestedBy?.email || request.department || ''}</div>
                                </td>
                                <td className="p-4 hidden md:table-cell">
                                    <div className="flex flex-col gap-1.5 max-w-xs">
                                        {(request.items || []).slice(0, 2).map((item: any, i: number) => {
                                            const desc = item.materialDescription || item.description || item.descriptions;
                                            return (
                                                <div key={i} className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 text-xs">
                                                    <div className="flex items-center justify-between gap-1 font-bold text-gray-800 dark:text-gray-200">
                                                        <span className="truncate">{item.materialName || item.name || 'Unnamed Item'}</span>
                                                        <span className="shrink-0 text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                                                            {item.quantity} {item.unit || 'PCS'}
                                                        </span>
                                                    </div>
                                                    {desc && (
                                                        <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                                            {desc}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {(request.items || []).length > 2 && (
                                            <span className="text-[11px] font-semibold text-slate-400 px-1">
                                                +{request.items.length - 2} more item{(request.items.length - 2) > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => onView(request)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl transition-colors cursor-pointer"
                                            title="View Details"
                                        >
                                            <Eye size={17} />
                                        </button>
                                        <button
                                            onClick={() => onReject(request)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-xl transition-colors cursor-pointer"
                                            title="Reject"
                                        >
                                            <XCircle size={17} />
                                        </button>
                                        <button
                                            onClick={() => onIssue(request)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs text-xs font-bold transition-all transform active:scale-95 cursor-pointer"
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

            {/* Mobile Card View (Optimized for Mobile App Feel) */}
            <div className="md:hidden flex flex-col divide-y divide-gray-100 dark:divide-gray-800/80 max-h-[calc(100vh-240px)] overflow-y-auto overscroll-contain pb-24 sm:pb-8">
                {requests.map((request) => (
                    <div
                        key={request._id}
                        className="p-3.5 sm:p-4 flex flex-col gap-3 active:bg-gray-50 dark:active:bg-gray-800/40 transition-colors"
                        onClick={() => onView(request)}
                    >
                        {/* Top Meta Bar */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                    {request.requestNumber}
                                </span>
                                {renderTypeBadge(request.type)}
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide uppercase ${
                                request.status === 'Approved'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : request.status === 'Rejected'
                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                                {request.status}
                            </span>
                        </div>

                        {/* Linked SO / MRP & Date Line */}
                        <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 gap-1.5 pt-0.5">
                            <div>
                                {request.mrpNumber ? (
                                    <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono text-[11px] px-2 py-0.5 rounded-md font-bold">
                                        MRP: {request.mrpNumber}
                                    </span>
                                ) : request.soNumber || request.salesOrder?.orderNumber ? (
                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-mono text-[11px] px-2 py-0.5 rounded-md font-bold">
                                        SO: {request.soNumber || request.salesOrder?.orderNumber}
                                    </span>
                                ) : (
                                    <span className="text-gray-400 text-[11px] italic">General Store</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1 font-mono text-[11px] text-gray-400">
                                <Calendar size={12} />
                                <span>{formatDateTime(request.createdAt)}</span>
                            </div>
                        </div>

                        {/* Requester Row */}
                        <div className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl">
                            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                                {(request.requestedBy?.name || request.createdByName || 'SA').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                    {request.requestedBy?.name || request.createdByName || 'Store Admin'}
                                </div>
                                <div className="text-[10px] text-gray-400 truncate">
                                    {request.department || request.requestedBy?.email || 'Store & WIP'}
                                </div>
                            </div>
                            <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-850 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700">
                                {request.items?.length || 0} Item{(request.items?.length || 0) !== 1 ? 's' : ''}
                            </div>
                        </div>

                        {/* Items Preview with Item Name & Technical Description (Rule Compliance) */}
                        <div className="space-y-1.5">
                            {(request.items || []).slice(0, 3).map((item: any, i: number) => {
                                const desc = item.materialDescription || item.description || item.descriptions;
                                return (
                                    <div key={i} className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-2xs">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">
                                                    {item.materialName || item.name || 'Unnamed Material'}
                                                </div>
                                                {desc && (
                                                    <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                                        {desc}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="font-bold text-xs text-blue-600 dark:text-blue-400">
                                                    {item.quantity} {item.unit || 'PCS'}
                                                </span>
                                                {item.hasSecondaryUnit && item.secondaryUnit && (
                                                    <div className="text-[10px] text-indigo-500 font-semibold">
                                                        ↳ {item.secondaryQuantity} {item.secondaryUnit}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {(request.items || []).length > 3 && (
                                <div className="text-[11px] font-semibold text-slate-400 text-center py-0.5">
                                    + {(request.items || []).length - 3} more items in this request
                                </div>
                            )}
                        </div>

                        {/* Thumb-Accessible Action Buttons (Native App Feel) */}
                        <div className="grid grid-cols-3 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => onView(request)}
                                className="h-10 px-2 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                                <Eye size={14} />
                                <span>Details</span>
                            </button>
                            <button
                                onClick={() => onReject(request)}
                                className="h-10 px-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                                <XCircle size={14} />
                                <span>Reject</span>
                            </button>
                            <button
                                onClick={() => onIssue(request)}
                                className="h-10 px-2 text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                            >
                                <span>Issue</span>
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
