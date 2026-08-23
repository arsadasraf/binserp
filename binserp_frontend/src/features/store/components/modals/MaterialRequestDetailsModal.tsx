import React from 'react';
import { X, Calendar, User, FileText, ShoppingCart, Layers, Package, Boxes, ShieldCheck, Edit3 } from 'lucide-react';

interface MaterialRequestDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: any;
}

export default function MaterialRequestDetailsModal({ isOpen, onClose, request }: MaterialRequestDetailsModalProps) {
    if (!isOpen || !request) return null;

    const renderTypeBadge = (type?: string) => {
        const norm = (type || 'rm').toLowerCase();
        if (norm === 'consumable') {
            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Package size={13} /> Consumables
                </span>
            );
        }
        if (norm === 'fg' || norm === 'inhouse') {
            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    <Boxes size={13} /> Finished Goods (FG)
                </span>
            );
        }
        if (norm === 'bo' || norm === 'bought-out') {
            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <ShoppingCart size={13} /> Bought Out (BO)
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Layers size={13} /> Raw Material (RM)
            </span>
        );
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-800">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gray-50/80 dark:bg-gray-800/80 sticky top-0 z-10 backdrop-blur-md">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">Material Request Details</h2>
                            <span className={`px-3 py-0.5 rounded-full text-xs font-bold
                                ${request.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                    request.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                        request.status === 'Issued' ? 'bg-purple-100 text-purple-700' :
                                            'bg-yellow-100 text-yellow-700'}`}>
                                {request.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-gray-500 dark:text-gray-400 font-mono text-xs font-bold">{request.requestNumber}</span>
                            {renderTypeBadge(request.type)}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">
                                <Calendar size={14} /> Created Date
                            </div>
                            <div className="text-gray-900 dark:text-gray-100 font-bold text-sm">
                                {new Date(request.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                        </div>

                        <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">
                                <User size={14} /> Requested By
                            </div>
                            <div className="text-gray-900 dark:text-gray-100 font-bold text-sm truncate" title={request.requestedBy?.name || request.createdByName || 'Store Admin'}>
                                {request.requestedBy?.name || request.createdByName || 'Store Admin'}
                            </div>
                        </div>

                        <div className="p-3.5 rounded-2xl border bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/60">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold mb-1 text-indigo-700 dark:text-indigo-300">
                                <ShoppingCart size={14} /> Order / MRP Plan
                            </div>
                            <div className="font-bold font-mono text-sm text-indigo-900 dark:text-indigo-200">
                                {request.mrpNumber ? `MRP: ${request.mrpNumber}` : (request.soNumber || request.salesOrder?.orderNumber || 'General Store Request')}
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <FileText size={15} className="text-blue-500" />
                            Requested Materials & Items ({request.items?.length || 0})
                        </h3>
                        <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Item & Code</th>
                                        <th className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-center">Category</th>
                                        <th className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-center">Requested Qty</th>
                                        <th className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Purpose</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {(request.items || []).map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-gray-900 dark:text-gray-100">{item.materialName}</div>
                                                <div className="text-xs text-gray-400 font-mono">{item.materialCode || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                    {item.itemType || (request.type === 'consumable' ? 'Consumable' : request.type === 'fg' ? 'FG Item' : request.type === 'bo' ? 'Bought Out' : 'Raw Material')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="font-bold text-gray-900 dark:text-white text-sm">{item.quantity}</span>
                                                <span className="text-xs text-gray-500 ml-1 font-semibold">{item.unit || 'PCS'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[220px]" title={item.purpose}>
                                                {item.purpose || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Audit & Tracking Information */}
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <ShieldCheck size={15} className="text-indigo-600 dark:text-indigo-400" /> Audit & Tracking
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-start gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-100/60 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                    <User size={14} />
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400">Created By</div>
                                    <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">{request.createdByName || request.requestedBy?.name || 'System'}</div>
                                    <div className="text-[11px] text-gray-500">
                                        {request.createdAt ? new Date(request.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <div className="p-2 rounded-xl bg-indigo-100/60 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                                    <Edit3 size={14} />
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400">Last Modified</div>
                                    <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">{request.updatedByName || request.createdByName || 'System'}</div>
                                    <div className="text-[11px] text-gray-500">
                                        {request.updatedAt ? new Date(request.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 rounded-b-3xl flex justify-end sticky bottom-0 backdrop-blur-md">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-sm text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
