/**
 * MoveToMrpModal Component
 * 
 * Interactive Modal for Sales Order -> Move to MRP
 * Features:
 * - Shows real-time available FG Inventory stock (Closing Stock vs Reserved)
 * - Allows adjusting how many units to reserve vs how many units to push to Purchase MRP
 */

import React, { useState, useEffect } from 'react';
import { X, Layers, Box, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

interface MoveToMrpModalProps {
    isOpen: boolean;
    order: any;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

export default function MoveToMrpModal({ isOpen, order, onClose, onSuccess }: MoveToMrpModalProps) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [stockDetails, setStockDetails] = useState<any[]>([]);
    const [allocations, setAllocations] = useState<Record<string, { reservedQuantity: number; shortfallQuantity: number }>>({});

    useEffect(() => {
        if (isOpen && order?._id) {
            fetchStockStatus();
        }
    }, [isOpen, order]);

    const fetchStockStatus = async () => {
        setLoading(true);
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/sales/order/${order._id}/stock-status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await res.json();
            if (res.ok && data.stockDetails) {
                setStockDetails(data.stockDetails);

                // Initialize allocations from backend suggested values
                const initialMap: Record<string, { reservedQuantity: number; shortfallQuantity: number }> = {};
                data.stockDetails.forEach((item: any) => {
                    initialMap[item.fgItem] = {
                        reservedQuantity: item.suggestedReserve || 0,
                        shortfallQuantity: item.suggestedShortfall || 0
                    };
                });
                setAllocations(initialMap);
            }
        } catch (err) {
            console.error("Failed to fetch FG stock status:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleReserveChange = (fgItem: string, orderedQty: number, reserveVal: number) => {
        const reservedQuantity = Math.max(0, Math.min(reserveVal, orderedQty));
        const shortfallQuantity = Math.max(0, orderedQty - reservedQuantity);

        setAllocations(prev => ({
            ...prev,
            [fgItem]: { reservedQuantity, shortfallQuantity }
        }));
    };

    const handleShortfallChange = (fgItem: string, orderedQty: number, shortfallVal: number) => {
        const shortfallQuantity = Math.max(0, Math.min(shortfallVal, orderedQty));
        const reservedQuantity = Math.max(0, orderedQty - shortfallQuantity);

        setAllocations(prev => ({
            ...prev,
            [fgItem]: { reservedQuantity, shortfallQuantity }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
            const payload = {
                allocations: Object.entries(allocations).map(([fgItem, val]) => ({
                    fgItem,
                    reservedQuantity: val.reservedQuantity,
                    shortfallQuantity: val.shortfallQuantity
                }))
            };

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/sales/order/${order._id}/move-to-mrp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const resData = await res.json();
            if (!res.ok) throw new Error(resData.message || 'Failed to move shortfall to MRP');

            onSuccess(resData.message || 'Stock allocated & shortfall moved to Purchase MRP');
        } catch (err: any) {
            alert(err.message || 'Failed to move to MRP');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
                
                {/* Modal Header */}
                <div className="p-6 bg-amber-950 text-white flex justify-between items-center flex-shrink-0 border-b border-amber-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-900 rounded-xl flex items-center justify-center border border-amber-700">
                            <Layers size={20} className="text-amber-300" />
                        </div>
                        <div>
                            <h2 className="text-xl font-mono font-extrabold tracking-tight text-amber-200">Move to MRP: {order.orderNumber}</h2>
                            <p className="text-xs text-amber-300/80 mt-0.5">Check FG Stock Availability & Allocate Shortfall to Purchase MRP</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-amber-900 hover:bg-amber-800 flex items-center justify-center text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {loading ? (
                        <div className="py-12 flex justify-center items-center">
                            <LoadingSpinner size="lg" />
                        </div>
                    ) : (
                        <form id="move-to-mrp-form" onSubmit={handleSubmit} className="space-y-6">
                            
                            {/* Alert Banner */}
                            <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-3">
                                <ShieldCheck size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-sm font-bold block">FG Stock Check Summary</strong>
                                    Review available Finished Goods (FG) stock for each order line. Available stock will be reserved in inventory, and any unfulfilled shortfall quantity will be pushed to <strong>Purchase MRP</strong>.
                                </div>
                            </div>

                            {/* Stock Allocation Table */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 uppercase">
                                        <tr>
                                            <th className="p-3">FG Product Name</th>
                                            <th className="p-3 text-center">Ordered Qty</th>
                                            <th className="p-3 text-center">Available FG Stock</th>
                                            <th className="p-3 text-center">Reserve from Stock</th>
                                            <th className="p-3 text-center">Move to MRP (Shortfall)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {stockDetails.map((item, idx) => {
                                            const alloc = allocations[item.fgItem] || { reservedQuantity: 0, shortfallQuantity: item.orderedQuantity };

                                            return (
                                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                                                        <div className="text-[10px] text-slate-500">Closing Stock: {item.closingStock} | Reserved: {item.totalReserved}</div>
                                                    </td>

                                                    <td className="p-3 text-center font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                                                        {item.orderedQuantity}
                                                    </td>

                                                    <td className="p-3 text-center font-bold">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs ${
                                                            item.availableStock >= item.orderedQuantity ? 'bg-emerald-100 text-emerald-800' :
                                                            item.availableStock > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                                        }`}>
                                                            {item.availableStock} Units Available
                                                        </span>
                                                    </td>

                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={item.orderedQuantity}
                                                            className="w-24 px-2 py-1.5 text-center text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                                                            value={alloc.reservedQuantity}
                                                            onChange={(e) => handleReserveChange(item.fgItem, item.orderedQuantity, Number(e.target.value))}
                                                        />
                                                    </td>

                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={item.orderedQuantity}
                                                            className="w-24 px-2 py-1.5 text-center text-xs font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                                                            value={alloc.shortfallQuantity}
                                                            onChange={(e) => handleShortfallChange(item.fgItem, item.orderedQuantity, Number(e.target.value))}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                        </form>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                    <button onClick={onClose} type="button" className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl">
                        Cancel
                    </button>

                    <button
                        form="move-to-mrp-form"
                        type="submit"
                        disabled={loading || submitting}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-600/20 flex items-center gap-2 disabled:opacity-50"
                    >
                        <ArrowRight size={15} />
                        <span>{submitting ? 'Allocating & Moving...' : 'Confirm Stock & Move Shortfall to MRP'}</span>
                    </button>
                </div>

            </div>
        </div>
    );
}
