import React, { useState, useMemo } from 'react';
import { X, Calendar, Layers, ArrowUpRight, ArrowDownLeft, Clock, AlertTriangle, Filter, RotateCcw } from 'lucide-react';

interface WipLedgerDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    wipItem: any;
}

export default function WipLedgerDrawer({ isOpen, onClose, wipItem }: WipLedgerDrawerProps) {
    const [datePreset, setDatePreset] = useState<'all' | 'today' | 'this_month' | 'last_30_days' | 'custom'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    if (!isOpen || !wipItem) return null;

    const transactions = wipItem.transactions || [];

    // Filter transactions by selected date range
    const filteredTx = useMemo(() => {
        let list = [...transactions].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        if (datePreset === 'today') {
            list = list.filter((tx: any) => new Date(tx.date) >= startOfToday);
        } else if (datePreset === 'this_month') {
            list = list.filter((tx: any) => new Date(tx.date) >= startOfMonth);
        } else if (datePreset === 'last_30_days') {
            list = list.filter((tx: any) => new Date(tx.date) >= thirtyDaysAgo);
        } else if (datePreset === 'custom') {
            if (startDate) {
                const sDate = new Date(startDate);
                sDate.setHours(0, 0, 0, 0);
                list = list.filter((tx: any) => new Date(tx.date) >= sDate);
            }
            if (endDate) {
                const eDate = new Date(endDate);
                eDate.setHours(23, 59, 59, 999);
                list = list.filter((tx: any) => new Date(tx.date) <= eDate);
            }
        }

        return list;
    }, [transactions, datePreset, startDate, endDate]);

    let runningWipBalance = 0;
    const totalOutward = (wipItem.totalIssuedQty || 0) + (wipItem.totalJobWorkSentQty || 0) || wipItem.totalSentQty || 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
                
                {/* Drawer Header */}
                <div className="p-5 bg-indigo-950 text-white flex justify-between items-center flex-shrink-0 border-b border-indigo-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-900 rounded-xl flex items-center justify-center border border-indigo-700">
                            <Layers className="text-indigo-300 w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white leading-snug">
                                {wipItem.materialName || wipItem.sentItemName}
                            </h2>
                            <p className="text-xs text-indigo-300">
                                {wipItem.categoryName || wipItem.categoryType || 'WIP Inventory'} {wipItem.vendorName ? `• ${wipItem.vendorName}` : ''}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-indigo-900 hover:bg-indigo-800 transition-colors flex items-center justify-center text-white border border-indigo-700 cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Balance Metrics Strip */}
                <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Inward Issued</span>
                        <strong className="text-amber-600 dark:text-amber-400 font-extrabold text-sm">{totalOutward} {wipItem.unit}</strong>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Returned / QC Pass</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{wipItem.totalReturnedQty || wipItem.totalReceivedQty || 0} {wipItem.receivingUnit || wipItem.unit}</strong>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30">
                        <span className="text-[10px] uppercase font-bold text-indigo-500 block">Current Net WIP Stock</span>
                        <strong className="text-slate-900 dark:text-white font-extrabold text-sm">{wipItem.pendingWipQty} {wipItem.receivingUnit || wipItem.unit}</strong>
                    </div>
                </div>

                {/* Date Filter Toolbar */}
                <div className="p-3 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <Filter size={13} className="text-indigo-600 dark:text-indigo-400" /> Filter Date Range
                        </span>
                        {(datePreset !== 'all' || startDate || endDate) && (
                            <button
                                onClick={() => {
                                    setDatePreset('all');
                                    setStartDate('');
                                    setEndDate('');
                                }}
                                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <RotateCcw size={11} /> Reset Filter
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 items-center">
                        {[
                            { key: 'all', label: 'All Time' },
                            { key: 'today', label: 'Today' },
                            { key: 'this_month', label: 'This Month' },
                            { key: 'last_30_days', label: 'Last 30 Days' },
                            { key: 'custom', label: 'Custom Range' },
                        ].map((btn) => (
                            <button
                                key={btn.key}
                                onClick={() => setDatePreset(btn.key as any)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    datePreset === btn.key
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {datePreset === 'custom' && (
                        <div className="flex items-center gap-2 pt-1">
                            <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                                <span className="text-[11px] text-slate-400 font-medium">From:</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent focus:outline-none text-slate-800 dark:text-slate-200 w-full text-xs"
                                />
                            </div>
                            <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                                <span className="text-[11px] text-slate-400 font-medium">To:</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent focus:outline-none text-slate-800 dark:text-slate-200 w-full text-xs"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Ledger Logs Content */}
                <div className="p-5 overflow-y-auto flex-1 space-y-3">
                    <div className="flex justify-between items-center pb-1">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock size={14} /> Chronological Movement History
                        </h3>
                        <span className="text-xs text-slate-400 font-semibold">{filteredTx.length} Entries</span>
                    </div>

                    {filteredTx.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                            <Layers className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No movement transactions found for selected date range</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {filteredTx.map((tx: any, idx: number) => {
                                const isRejection = tx.isRejection || tx.status === 'Rejected' || (tx.rejectedQty > 0) || tx.type.toLowerCase().includes('rejection');
                                const isOutward = !isRejection && (tx.type.includes("Outward") || tx.type.includes("Issue") || tx.sentQty > 0);
                                const qtyChange = isRejection ? tx.rejectedQty : (isOutward ? tx.sentQty : tx.receivedQty);
                                
                                if (!isRejection) {
                                    runningWipBalance += isOutward ? qtyChange : -qtyChange;
                                }

                                return (
                                    <div
                                        key={idx}
                                        className={`p-3.5 rounded-2xl border shadow-xs space-y-2 transition-colors ${
                                            isRejection
                                                ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 hover:border-rose-300'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                                                    isRejection
                                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                                        : isOutward 
                                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' 
                                                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                }`}>
                                                    {isRejection ? (
                                                        <AlertTriangle size={16} />
                                                    ) : isOutward ? (
                                                        <ArrowUpRight size={16} />
                                                    ) : (
                                                        <ArrowDownLeft size={16} />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                                                            {tx.type}
                                                        </span>
                                                        {isRejection && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                                                QC REJECTED
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                                                        Doc #: <strong>{tx.docNumber || 'N/A'}</strong> {tx.mrpNumber ? `| MRP: ${tx.mrpNumber}` : ''} {tx.ewayBillNo ? `| E-Way: ${tx.ewayBillNo}` : ''}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <span className={`font-black text-sm block ${
                                                    isRejection 
                                                        ? 'text-rose-600 dark:text-rose-400' 
                                                        : isOutward 
                                                            ? 'text-amber-600' 
                                                            : 'text-emerald-600'
                                                }`}>
                                                    {isRejection ? `Rejected: -${qtyChange}` : (isOutward ? `+${qtyChange}` : `-${qtyChange}`)} {tx.unit}
                                                </span>
                                                {!isRejection && (
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        WIP Balance: <strong>{runningWipBalance > 0 ? runningWipBalance : 0}</strong>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {isRejection && tx.rejectionReason && (
                                            <div className="p-2 bg-rose-100/60 dark:bg-rose-950/40 rounded-xl text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                                <strong>Rejection Reason / Defect:</strong> {tx.rejectionReason}
                                            </div>
                                        )}

                                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-400">
                                            <span>Party / Source: <strong className="text-slate-600 dark:text-slate-300">{tx.vendorName || tx.processType || '-'}</strong></span>
                                            <span>{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Drawer Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                        Close Ledger
                    </button>
                </div>

            </div>
        </div>
    );
}
