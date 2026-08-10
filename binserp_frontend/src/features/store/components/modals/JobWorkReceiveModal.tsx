import React, { useState } from 'react';
import { X, Check, ArrowRight, Truck } from 'lucide-react';
import { JobWorkChallan } from "@/src/features/store/types/store.types";
import { apiPut } from '@/src/lib/api';

interface JobWorkReceiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
    challan: JobWorkChallan;
    token: string | null;
}

export default function JobWorkReceiveModal({ isOpen, onClose, onSuccess, onError, challan, token }: JobWorkReceiveModalProps) {
    const [loading, setLoading] = useState(false);
    const [receiveData, setReceiveData] = useState<{ itemId: string; returningItemId?: string; quantity: number }[]>([]);

    const handleQuantityChange = (itemId: string, returningItemId: string | undefined, value: string) => {
        const qty = Number(value);
        const key = returningItemId ? `${itemId}_${returningItemId}` : itemId;
        
        const existingIdx = receiveData.findIndex(d => (returningItemId ? d.returningItemId === returningItemId : d.itemId === itemId));
        if (existingIdx >= 0) {
            const updated = [...receiveData];
            updated[existingIdx] = { itemId, returningItemId, quantity: qty };
            setReceiveData(updated);
        } else {
            setReceiveData([...receiveData, { itemId, returningItemId, quantity: qty }]);
        }
    };

    const handleFillAllPending = () => {
        const fullList: { itemId: string; returningItemId?: string; quantity: number }[] = [];
        
        challan.items.forEach(sentItem => {
            const parentId = sentItem._id || sentItem.item || '';
            if (Array.isArray(sentItem.returningItems) && sentItem.returningItems.length > 0) {
                sentItem.returningItems.forEach(ret => {
                    const retId = ret._id || '';
                    const pending = Number(ret.quantityToBeReceived) - Number(ret.quantityReceived || 0);
                    fullList.push({
                        itemId: parentId,
                        returningItemId: retId,
                        quantity: pending > 0 ? pending : 0
                    });
                });
            } else {
                const target = Number(sentItem.quantityToBeReceived || sentItem.quantitySent) || 0;
                const pending = target - Number(sentItem.quantityReceived || 0);
                fullList.push({
                    itemId: parentId,
                    quantity: pending > 0 ? pending : 0
                });
            }
        });

        setReceiveData(fullList);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const itemsToReceive = receiveData.filter(d => d.quantity > 0);

            if (itemsToReceive.length === 0) {
                onError('Please enter quantity for at least one returning material');
                setLoading(false);
                return;
            }

            await apiPut(`/api/store/jobwork/receive/${challan._id}`, { items: itemsToReceive }, token);
            onSuccess();
        } catch (error: any) {
            onError(error.message || "Failed to log received items");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                
                {/* Modal Header (Single Cohesive Indigo/Slate Theme) */}
                <div className="p-6 bg-indigo-950 text-white flex justify-between items-center flex-shrink-0 border-b border-indigo-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-900 rounded-xl flex items-center justify-center border border-indigo-700">
                            <Truck size={20} className="text-indigo-300" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold tracking-tight">Receive Returned Materials</h2>
                            <p className="text-xs text-indigo-300/80 mt-0.5">
                                Challan: <span className="font-mono font-bold text-white">{challan.challanNumber}</span> | Supplier: <span className="font-semibold text-white">{challan.vendor?.name || 'Vendor'}</span>
                                {challan.ewayBillNo && <span> | E-Way Bill: <span className="font-mono text-indigo-200">{challan.ewayBillNo}</span></span>}
                            </p>
                        </div>
                    </div>

                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-indigo-900 hover:bg-indigo-800 flex items-center justify-center text-white transition-colors border border-indigo-700">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Subcontracted Items & Expected Returning Materials
                        </span>
                        <button
                            type="button"
                            onClick={handleFillAllPending}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800"
                        >
                            Receive All Pending Quantities
                        </button>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800/80 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-3">Sent Material</th>
                                    <th className="px-4 py-3">Process</th>
                                    <th className="px-4 py-3">Expected Return Material</th>
                                    <th className="px-4 py-3 text-center">Exp. Qty</th>
                                    <th className="px-4 py-3 text-center">Prev. Recv</th>
                                    <th className="px-4 py-3 text-center">Pending</th>
                                    <th className="px-4 py-3 text-left w-36">Receive Now</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {challan.items.map((sentItem, sentIdx) => {
                                    const parentId = sentItem._id || sentItem.item || `${sentIdx}`;
                                    const retList = Array.isArray(sentItem.returningItems) && sentItem.returningItems.length > 0
                                        ? sentItem.returningItems
                                        : [{
                                            _id: parentId,
                                            receivedItemName: sentItem.receivedItemName || sentItem.itemToBeReceived || sentItem.itemName,
                                            receivedItemType: sentItem.receivedItemType || 'fg',
                                            quantityToBeReceived: Number(sentItem.quantityToBeReceived || sentItem.quantitySent) || 0,
                                            quantityReceived: Number(sentItem.quantityReceived) || 0,
                                            receivingUnit: sentItem.receivingUnit || sentItem.unit || 'PCS'
                                        }];

                                    return retList.map((ret, retIdx) => {
                                        const retId = ret._id || `${sentIdx}_${retIdx}`;
                                        const expectedQty = Number(ret.quantityToBeReceived) || 0;
                                        const receivedQty = Number(ret.quantityReceived) || 0;
                                        const pendingQty = expectedQty - receivedQty;
                                        const isDone = ret.status === 'Completed' || pendingQty <= 0;

                                        const currentValue = receiveData.find(d => (ret._id ? d.returningItemId === ret._id : d.itemId === parentId))?.quantity ?? '';

                                        return (
                                            <tr key={`${sentIdx}_${retIdx}`} className={isDone ? "opacity-50 bg-slate-50/50 dark:bg-slate-900/50" : ""}>
                                                {/* Show Sent Material name on first row of sub-items */}
                                                {retIdx === 0 ? (
                                                    <td rowSpan={retList.length} className="px-4 py-3.5 font-bold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800 align-top bg-slate-50/30 dark:bg-slate-900/30">
                                                        {sentItem.itemName}
                                                        <span className="block text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                                            Sent: {sentItem.quantitySent} {sentItem.unit}
                                                        </span>
                                                    </td>
                                                ) : null}

                                                {retIdx === 0 ? (
                                                    <td rowSpan={retList.length} className="px-4 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 align-top bg-slate-50/30 dark:bg-slate-900/30">
                                                        {sentItem.processType}
                                                    </td>
                                                ) : null}

                                                {/* Return Material */}
                                                <td className="px-4 py-3.5 font-bold text-indigo-700 dark:text-indigo-300">
                                                    <div className="flex items-center gap-1.5">
                                                        <ArrowRight size={14} className="text-indigo-500 flex-shrink-0" />
                                                        {ret.receivedItemName || sentItem.itemName}
                                                    </div>
                                                </td>

                                                {/* Exp Qty */}
                                                <td className="px-4 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                                                    {expectedQty} <span className="text-xs text-slate-400">{ret.receivingUnit || 'PCS'}</span>
                                                </td>

                                                {/* Prev Recv */}
                                                <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                                                    {receivedQty}
                                                </td>

                                                {/* Pending Qty */}
                                                <td className="px-4 py-3.5 text-center font-extrabold text-indigo-600 dark:text-indigo-400">
                                                    {pendingQty > 0 ? pendingQty : 0}
                                                </td>

                                                {/* Receive Input */}
                                                <td className="px-4 py-3.5">
                                                    {isDone ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                                                            <Check size={14} /> Received
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={pendingQty}
                                                                step="any"
                                                                value={currentValue}
                                                                onChange={(e) => handleQuantityChange(parentId, ret._id, e.target.value)}
                                                                placeholder="Qty"
                                                                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500/30 outline-none"
                                                            />
                                                            <span className="text-xs font-medium text-slate-400">{ret.receivingUnit || 'PCS'}</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    });
                                })}
                            </tbody>
                        </table>
                    </div>

                    {challan.items.every(i => i.status === 'Completed') && (
                        <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm">
                            ✓ All returning items for this Job Work Challan have been fully received.
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || receiveData.filter(d => d.quantity > 0).length === 0}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Check size={18} />
                        {loading ? 'Processing Receipt...' : 'Confirm Received Items'}
                    </button>
                </div>

            </div>
        </div>
    );
}
