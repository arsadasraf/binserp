import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, User, FileText, ShoppingCart, Layers, Package, Boxes, ShieldCheck, Edit3, Printer, Lock, CheckCircle2 } from 'lucide-react';
import { formatDateTime } from '../tables/MaterialIssueHistoryTable';
import { useStoreApprovalSettings } from '@/src/hooks/useStoreApprovalSettings';
import { generateSingleMaterialRequestSlipPDF } from '@/src/utils/generateMaterialRequestReportPDF';
import { API_BASE_URL } from '@/src/utils/config';

interface MaterialRequestDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: any;
    onApprove?: (requestId: string) => Promise<void>;
}

export default function MaterialRequestDetailsModal({ isOpen, onClose, request, onApprove }: MaterialRequestDetailsModalProps) {
    const [currentRequest, setCurrentRequest] = useState<any>(request);
    const [isApproving, setIsApproving] = useState(false);

    useEffect(() => {
        setCurrentRequest(request);
    }, [request]);

    const { isApprovalRequired, canUserApprove, getApproverNames } = useStoreApprovalSettings();
    const currentUser = useMemo(() => {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem('userInfo') : null;
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }, []);
    const userType = useMemo(() => {
        return typeof window !== 'undefined' ? (localStorage.getItem('userType') || 'user') : 'user';
    }, []);

    if (!isOpen || !currentRequest) return null;

    const approvalRequired = isApprovalRequired('materialRequest');
    const isApproved = currentRequest.status === 'Approved' || currentRequest.status === 'Issued';
    const isPdfLocked = approvalRequired && !isApproved;
    const userCanApprove = canUserApprove('materialRequest', currentUser, userType);

    const handleApproveAction = async () => {
        if (!userCanApprove) {
            const approvers = getApproverNames('materialRequest');
            const approversMsg = approvers.length > 0 ? `Authorized approvers: ${approvers.join(', ')}` : "Contact company management.";
            alert(`Approval Permission Denied: You do not have permission to approve this Material Request. ${approversMsg}`);
            return;
        }

        try {
            setIsApproving(true);
            const reqId = currentRequest._id || currentRequest.id;
            if (onApprove) {
                await onApprove(reqId);
            } else {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
                const res = await fetch(`${API_BASE_URL}/api/store/material-request/${reqId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status: 'Approved' })
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || 'Failed to approve requisition');
                }
            }
            setCurrentRequest((prev: any) => ({
                ...prev,
                status: 'Approved',
                approvedByName: currentUser?.name || 'You',
                approvedAt: new Date().toISOString()
            }));
            alert('Material Request approved successfully! PDF generation is now unlocked.');
        } catch (e: any) {
            console.error("Approve error:", e);
            alert(e.message || "Failed to approve requisition");
        } finally {
            setIsApproving(false);
        }
    };

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
                                ${currentRequest.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                    currentRequest.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                        currentRequest.status === 'Issued' ? 'bg-purple-100 text-purple-700' :
                                            'bg-yellow-100 text-yellow-700'}`}>
                                {currentRequest.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-gray-500 dark:text-gray-400 font-mono text-xs font-bold">{currentRequest.requestNumber}</span>
                            {renderTypeBadge(currentRequest.type)}
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
                                <Calendar size={14} /> Created Date & Time
                            </div>
                            <div className="text-gray-900 dark:text-gray-100 font-bold text-xs font-mono">
                                {formatDateTime(currentRequest.createdAt)}
                            </div>
                        </div>

                        <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">
                                <User size={14} /> Requested By
                            </div>
                            <div className="text-gray-900 dark:text-gray-100 font-bold text-sm truncate" title={currentRequest.requestedBy?.name || currentRequest.createdByName || 'Store Admin'}>
                                {currentRequest.requestedBy?.name || currentRequest.createdByName || 'Store Admin'}
                            </div>
                        </div>

                        <div className="p-3.5 rounded-2xl border bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/60">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold mb-1 text-indigo-700 dark:text-indigo-300">
                                <ShoppingCart size={14} /> Order / MRP Plan
                            </div>
                            <div className="font-bold font-mono text-sm text-indigo-900 dark:text-indigo-200">
                                {currentRequest.mrpNumber ? `MRP: ${currentRequest.mrpNumber}` : (currentRequest.soNumber || currentRequest.salesOrder?.orderNumber || 'General Store Request')}
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <FileText size={15} className="text-blue-500" />
                            Requested Materials & Items ({currentRequest.items?.length || 0})
                        </h3>
                        <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Material Name & Description</th>
                                        <th className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-center">Category</th>
                                        <th className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-center">Requested Qty</th>
                                        <th className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Purpose</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {(currentRequest.items || []).map((item: any, idx: number) => {
                                        const desc = item.materialDescription || item.description || item.specification || item.grade || '';
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-900 dark:text-gray-100">{item.materialName || item.name}</div>
                                                    {desc && (
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                            {desc}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                        {item.itemType || (currentRequest.type === 'consumable' ? 'Consumable' : currentRequest.type === 'fg' ? 'FG Item' : currentRequest.type === 'bo' ? 'Bought Out' : 'Raw Material')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div>
                                                        <span className="font-bold text-gray-900 dark:text-white text-sm">
                                                            {item.selectedUnit === item.secondaryUnit ? item.secondaryQuantity : item.quantity}
                                                        </span>
                                                        <span className="text-xs text-gray-500 ml-1 font-semibold">
                                                            {item.selectedUnit || item.unit || 'PCS'}
                                                        </span>
                                                        {item.hasSecondaryUnit && item.selectedUnit === item.secondaryUnit && (
                                                            <span className="ml-1 px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold">2nd</span>
                                                        )}
                                                    </div>
                                                    {item.hasSecondaryUnit && item.secondaryUnit && (
                                                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                                                            {item.selectedUnit === item.secondaryUnit ? (
                                                                <span>↳ = {item.quantity || (item.conversionFactor ? Math.round(Number(item.secondaryQuantity || 0) / item.conversionFactor * 100) / 100 : item.secondaryQuantity)} {item.unit}</span>
                                                            ) : (
                                                                <span>↳ = {item.secondaryQuantity || Math.round(Number(item.quantity || 0) * (item.conversionFactor || 1) * 100) / 100} {item.secondaryUnit}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[220px]" title={item.purpose}>
                                                    {item.purpose || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Audit & Tracking Information */}
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <ShieldCheck size={15} className="text-indigo-600 dark:text-indigo-400" /> Audit & Fulfillment Tracking
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700">
                                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                    <User size={13} />
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400">Created By</div>
                                    <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">{currentRequest.createdByName || currentRequest.requestedBy?.name || 'System'}</div>
                                    <div className="text-[10px] text-gray-500">
                                        {currentRequest.createdAt ? new Date(currentRequest.createdAt).toLocaleDateString() : '-'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700">
                                <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                    <ShieldCheck size={13} />
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400">Approved By</div>
                                    <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">{currentRequest.approvedByName || currentRequest.approvedBy?.name || '-'}</div>
                                    <div className="text-[10px] text-gray-500">
                                        {currentRequest.status === 'Approved' || currentRequest.status === 'Issued' ? 'Approved' : 'Pending'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700">
                                <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                    <Package size={13} />
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400">Issued By</div>
                                    <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">{currentRequest.issuedByName || currentRequest.issuedBy?.name || '-'}</div>
                                    <div className="text-[10px] text-gray-500">
                                        {currentRequest.issuedAt ? new Date(currentRequest.issuedAt).toLocaleDateString() : '-'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700">
                                <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    <Edit3 size={13} />
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400">Last Modified</div>
                                    <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">{currentRequest.updatedByName || currentRequest.createdByName || 'System'}</div>
                                    <div className="text-[10px] text-gray-500">
                                        {currentRequest.updatedAt ? new Date(currentRequest.updatedAt).toLocaleDateString() : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Controls: Close, Approve (if permitted), and PDF button (locked if approval required) */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 rounded-b-3xl flex flex-wrap justify-between items-center gap-3 sticky bottom-0 backdrop-blur-md">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-sm text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                        Close
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Approve Requisition Button */}
                        {currentRequest.status === 'Pending' && (
                            <button
                                type="button"
                                onClick={handleApproveAction}
                                disabled={isApproving}
                                className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                                    userCanApprove 
                                        ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20' 
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                }`}
                                title={userCanApprove ? "Approve Material Requisition" : "Only designated approvers or administrators can approve"}
                            >
                                <CheckCircle2 size={15} />
                                <span>{isApproving ? 'Approving...' : 'Approve Requisition'}</span>
                            </button>
                        )}

                        {/* PDF Generator Button */}
                        {isPdfLocked ? (
                            <button
                                type="button"
                                onClick={() => alert("Approval Required: This Material Request must be approved by an authorized user before generating or downloading the official PDF.")}
                                className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Requisition must be approved before generating PDF"
                            >
                                <Lock size={14} className="text-amber-500" />
                                <span>PDF Locked (Pending Approval)</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => generateSingleMaterialRequestSlipPDF(currentRequest)}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <Printer size={15} />
                                <span>Print / Save PDF Slip</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

