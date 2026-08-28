import React, { useState, useEffect } from "react";
import { 
    X, CheckCircle2, Calendar, FileText, Printer, Download, Clock, 
    Truck, Building2, ShieldCheck, ArrowRight, AlertCircle 
} from "lucide-react";
import { apiPost } from "@/src/lib/api";
import { 
    generateFrontendOrderAcknowledgementPDF, 
    downloadOrderAcknowledgementJsPDF 
} from "@/src/utils/generateOrderAcknowledgementPDF";
import { getCurrencySymbol } from "@/src/utils/currencyHelper";

interface OrderAcknowledgementModalProps {
    isOpen: boolean;
    po: any;
    companyInfo?: any;
    token: string | null;
    onClose: () => void;
    onSuccess: (updatedPo: any) => void;
    onError: (msg: string) => void;
}

export default function OrderAcknowledgementModal({
    isOpen,
    po,
    companyInfo,
    token,
    onClose,
    onSuccess,
    onError
}: OrderAcknowledgementModalProps) {
    if (!isOpen || !po) return null;

    // Helper to calculate default date (+14 days from today or PO date)
    const getDefaultCommitDate = (daysAhead: number = 14) => {
        const baseDate = po.date ? new Date(po.date) : new Date();
        const future = new Date(baseDate.getTime() + daysAhead * 24 * 60 * 60 * 1000);
        return future.toISOString().slice(0, 10);
    };

    const [globalDispatchDate, setGlobalDispatchDate] = useState<string>(() => {
        if (po.committedDispatchDate) {
            return new Date(po.committedDispatchDate).toISOString().slice(0, 10);
        }
        return getDefaultCommitDate(14);
    });

    const [itemsCommitments, setItemsCommitments] = useState<{ [key: string]: string }>({});
    const [acknowledgementRemarks, setAcknowledgementRemarks] = useState<string>(
        po.acknowledgementRemarks || "We acknowledge and accept your order. Delivery will be executed strictly as per committed dates."
    );
    const [submitting, setSubmitting] = useState(false);

    // Initialize item commitment dates from existing PO items if available
    useEffect(() => {
        if (Array.isArray(po.items)) {
            const initialMap: { [key: string]: string } = {};
            po.items.forEach((item: any, idx: number) => {
                const key = item._id || item.fgItem?._id || item.fgItem || `item-${idx}`;
                if (item.committedDeliveryDate) {
                    initialMap[key] = new Date(item.committedDeliveryDate).toISOString().slice(0, 10);
                } else {
                    initialMap[key] = ""; // empty = inherits global dispatch date
                }
            });
            setItemsCommitments(initialMap);
        }
    }, [po]);

    const handleItemDateChange = (key: string, dateVal: string) => {
        setItemsCommitments(prev => ({
            ...prev,
            [key]: dateVal
        }));
    };

    const handleQuickShortcut = (days: number) => {
        const newDate = getDefaultCommitDate(days);
        setGlobalDispatchDate(newDate);
    };

    const handleSaveAndAccept = async (triggerPrint: boolean = false) => {
        setSubmitting(true);
        try {
            // Build items payload
            const updatedItems = (po.items || []).map((item: any, idx: number) => {
                const key = item._id || item.fgItem?._id || item.fgItem || `item-${idx}`;
                const itemSpecificDate = itemsCommitments[key];
                return {
                    _id: item._id,
                    fgItem: item.fgItem?._id || item.fgItem,
                    productName: item.productName || item.fgItem?.name,
                    committedDeliveryDate: itemSpecificDate || globalDispatchDate
                };
            });

            const payload = {
                committedDispatchDate: globalDispatchDate,
                acknowledgementRemarks: acknowledgementRemarks,
                items: updatedItems
            };

            const res = await apiPost(`/api/sales/incoming-po/${po._id}/acknowledge`, payload, token);
            const updatedPo = res.incomingPO || res.data || res;

            onSuccess(updatedPo);

            if (triggerPrint) {
                generateFrontendOrderAcknowledgementPDF({ po: updatedPo, companyInfo });
            }

            onClose();
        } catch (err: any) {
            console.error("Save OA Error:", err);
            onError(err.message || "Failed to save Order Acknowledgement");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDirectPrintPreview = () => {
        // Construct preview PO with active modal dates
        const previewPo = {
            ...po,
            committedDispatchDate: globalDispatchDate,
            acknowledgementRemarks: acknowledgementRemarks,
            acknowledgementDate: po.acknowledgementDate || new Date(),
            items: (po.items || []).map((item: any, idx: number) => {
                const key = item._id || item.fgItem?._id || item.fgItem || `item-${idx}`;
                const itemSpecificDate = itemsCommitments[key];
                return {
                    ...item,
                    committedDeliveryDate: itemSpecificDate || globalDispatchDate
                };
            })
        };
        generateFrontendOrderAcknowledgementPDF({ po: previewPo, companyInfo });
    };

    const handleDirectJsPDF = () => {
        const previewPo = {
            ...po,
            committedDispatchDate: globalDispatchDate,
            acknowledgementRemarks: acknowledgementRemarks,
            acknowledgementDate: po.acknowledgementDate || new Date(),
            items: (po.items || []).map((item: any, idx: number) => {
                const key = item._id || item.fgItem?._id || item.fgItem || `item-${idx}`;
                const itemSpecificDate = itemsCommitments[key];
                return {
                    ...item,
                    committedDeliveryDate: itemSpecificDate || globalDispatchDate
                };
            })
        };
        downloadOrderAcknowledgementJsPDF({ po: previewPo, companyInfo });
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[96vw] xl:max-w-6xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-blue-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/30 rounded-xl flex items-center justify-center border border-blue-400/30 shadow-inner">
                            <FileText size={22} className="text-blue-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-extrabold tracking-tight">Order Acknowledgement & Acceptance (OA)</h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Commitment Scheduler
                                </span>
                            </div>
                            <p className="text-xs text-blue-200/80 mt-0.5">
                                Customer PO: <strong className="font-mono text-white">{po.poNumber}</strong> &nbsp;|&nbsp; Buyer: <strong className="text-white">{po.customerName || po.customer?.name || 'Customer'}</strong>
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
                    
                    {/* 1. Global Promised Dispatch Date & Quick Shortcuts */}
                    <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-blue-50/70 dark:from-slate-800/80 dark:via-indigo-950/30 dark:to-slate-800/80 p-5 rounded-2xl border border-blue-200 dark:border-blue-900/50 space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                                <label className="block text-xs font-extrabold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                                    Overall PO Committed Dispatch Date *
                                </label>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Standard promised delivery date for all items (individual items can override this below).
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={globalDispatchDate}
                                    onChange={(e) => setGlobalDispatchDate(e.target.value)}
                                    className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-xl text-xs font-bold text-blue-900 dark:text-blue-200 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Quick Shortcut Buttons */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Quick Commit:</span>
                            {[
                                { label: "+7 Days (1 Week)", days: 7 },
                                { label: "+14 Days (2 Weeks)", days: 14 },
                                { label: "+21 Days (3 Weeks)", days: 21 },
                                { label: "+30 Days (1 Month)", days: 30 }
                            ].map((btn) => (
                                <button
                                    key={btn.days}
                                    type="button"
                                    onClick={() => handleQuickShortcut(btn.days)}
                                    className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-blue-100 dark:hover:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[11px] font-bold rounded-lg border border-blue-200 dark:border-blue-800 transition-colors shadow-2xs"
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. Line Items Commitment Scheduler Table */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                    Item-Wise Commitment Schedule
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    Individual item dates are <strong>optional</strong>. If left blank, the item automatically adopts the overall committed dispatch date.
                                </p>
                            </div>
                        </div>

                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="p-3.5 text-center w-10">#</th>
                                        <th className="p-3.5">Product Name & Specifications</th>
                                        <th className="p-3.5 text-center">Ordered Qty</th>
                                        <th className="p-3.5 text-right">Unit Rate ({po.currency || 'INR'})</th>
                                        <th className="p-3.5 text-center">Requested Date</th>
                                        <th className="p-3.5 text-center w-56">Committed Dispatch Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {(po.items || []).map((item: any, idx: number) => {
                                        const key = item._id || item.fgItem?._id || item.fgItem || `item-${idx}`;
                                        const itemVal = itemsCommitments[key] || "";
                                        const pName = item.productName || item.fgItem?.name || 'Product Item';
                                        const qty = Number(item.quantity || 1);
                                        const rate = Number(item.rate || 0);
                                        const reqDate = item.expectedDeliveryDate ? new Date(item.expectedDeliveryDate).toLocaleDateString('en-GB') : '-';

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                                                <td className="p-3.5">
                                                    <strong className="text-slate-800 dark:text-slate-200 block text-xs">{pName}</strong>
                                                    {item.description && (
                                                        <span className="text-[10px] text-slate-400 block line-clamp-1">{item.description}</span>
                                                    )}
                                                </td>
                                                <td className="p-3.5 text-center font-bold text-blue-600 dark:text-blue-400">
                                                    {qty} {item.unit || 'PCS'}
                                                </td>
                                                <td className="p-3.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                                    {getCurrencySymbol(po.currency)}{rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-3.5 text-center text-slate-500 font-medium">
                                                    {reqDate}
                                                </td>
                                                <td className="p-3.5">
                                                    <div className="flex items-center gap-1.5 justify-center">
                                                        <input
                                                            type="date"
                                                            value={itemVal}
                                                            onChange={(e) => handleItemDateChange(key, e.target.value)}
                                                            placeholder="Use Global Date"
                                                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold outline-none transition-all ${
                                                                itemVal 
                                                                    ? "border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-extrabold" 
                                                                    : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 font-normal"
                                                            }`}
                                                        />
                                                        {itemVal && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleItemDateChange(key, "")}
                                                                title="Reset to default global date"
                                                                className="text-[10px] text-rose-500 hover:underline font-bold px-1"
                                                            >
                                                                Reset
                                                            </button>
                                                        )}
                                                    </div>
                                                    <span className="block text-[9px] text-center text-slate-400 mt-0.5">
                                                        {itemVal ? "Item-specific commitment" : `Inherits: ${globalDispatchDate || 'Global Date'}`}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. Acceptance Remarks & Notes */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                            Order Acceptance Remarks & Notes <span className="text-slate-400 font-normal">(Printed on OA Document)</span>
                        </label>
                        <textarea
                            rows={3}
                            value={acknowledgementRemarks}
                            onChange={(e) => setAcknowledgementRemarks(e.target.value)}
                            placeholder="Add commercial acceptance remarks, inspection guidelines, or customer delivery conditions..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                        />
                    </div>

                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-start">
                        <button
                            type="button"
                            onClick={handleDirectPrintPreview}
                            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                        >
                            <Printer size={14} /> Preview Printable OA
                        </button>
                        <button
                            type="button"
                            onClick={handleDirectJsPDF}
                            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                        >
                            <Download size={14} /> Download PDF
                        </button>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSaveAndAccept(true)}
                            disabled={submitting}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <CheckCircle2 size={15} />
                            {submitting ? 'Accepting...' : 'Accept PO & Print OA Document'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
