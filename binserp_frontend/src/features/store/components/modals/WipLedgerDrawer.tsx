import React from 'react';
import { X, Calendar, Truck, Layers, ArrowUpRight, ArrowDownLeft, FileText, CheckCircle2, Clock, Factory } from 'lucide-react';

interface WipLedgerDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    wipItem: any;
}

export default function WipLedgerDrawer({ isOpen, onClose, wipItem }: WipLedgerDrawerProps) {
    if (!isOpen || !wipItem) return null;

    const transactions = wipItem.transactions || [];
    
    // Sort transactions chronologically
    const sortedTx = [...transactions].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningWipBalance = 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
                
                {/* Drawer Header */}
                <div className="p-6 bg-indigo-950 text-white flex justify-between items-center flex-shrink-0 border-b border-indigo-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-900 rounded-xl flex items-center justify-center border border-indigo-700">
                            <Layers className="text-indigo-300 w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">
                                {wipItem.sentItemName}
                            </h2>
                            <p className="text-xs text-indigo-300">
                                Subcontractor: <strong className="text-white">{wipItem.vendorName}</strong> ({wipItem.processType})
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-indigo-900 hover:bg-indigo-800 transition-colors flex items-center justify-center text-white border border-indigo-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Balance Metrics Strip */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Sent Out</span>
                        <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">{wipItem.totalSentQty} {wipItem.unit}</strong>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Returned</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{wipItem.totalReceivedQty} {wipItem.receivingUnit || wipItem.unit}</strong>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30">
                        <span className="text-[10px] uppercase font-bold text-indigo-500 block">Current Net WIP</span>
                        <strong className="text-slate-900 dark:text-white font-extrabold text-sm">{wipItem.pendingWipQty} {wipItem.receivingUnit || wipItem.unit}</strong>
                    </div>
                </div>

                {/* Ledger Logs Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock size={14} /> Chronological Movement History
                        </h3>
                        <span className="text-xs text-slate-400">{sortedTx.length} Entries</span>
                    </div>

                    {sortedTx.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <Layers className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                            <p className="text-sm text-slate-500 font-medium">No movement transactions recorded yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sortedTx.map((tx: any, idx: number) => {
                                const isOutward = tx.type === "Outward Dispatch";
                                const qtyChange = isOutward ? tx.sentQty : tx.receivedQty;
                                runningWipBalance += isOutward ? qtyChange : -qtyChange;

                                return (
                                    <div
                                        key={idx}
                                        className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 hover:border-indigo-300 transition-colors"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                                                    isOutward 
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' 
                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                }`}>
                                                    {isOutward ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                                                        {tx.type}
                                                    </span>
                                                    <div className="text-xs text-slate-500 font-mono">
                                                        DC #: <strong>{tx.docNumber || 'N/A'}</strong> {tx.ewayBillNo ? `| E-Way: ${tx.ewayBillNo}` : ''}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <span className={`font-black text-sm block ${isOutward ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                    {isOutward ? `+${qtyChange}` : `-${qtyChange}`} {tx.unit}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    WIP Balance: <strong>{runningWipBalance > 0 ? runningWipBalance : 0}</strong>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-400">
                                            <span>Process: <strong className="text-slate-600 dark:text-slate-300">{tx.processType}</strong></span>
                                            <span>{new Date(tx.date).toLocaleString('en-GB')}</span>
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
                        className="px-5 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-all shadow-sm"
                    >
                        Close Ledger
                    </button>
                </div>

            </div>
        </div>
    );
}
