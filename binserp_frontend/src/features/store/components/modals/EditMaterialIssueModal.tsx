import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, User, FileText, Package, AlertTriangle, Save, Trash2, Info, ArrowRight } from 'lucide-react';
import { resolveIssueType, formatDateTime } from '../tables/MaterialIssueHistoryTable';
import { evaluateItemStock } from '@/src/utils/stockValidationHelper';

interface EditMaterialIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    issue: any;
    onSave: (updatedData: any) => Promise<void>;
    storeData?: any;
}

export default function EditMaterialIssueModal({ isOpen, onClose, issue, onSave, storeData }: EditMaterialIssueModalProps) {
    const [department, setDepartment] = useState('');
    const [remarks, setRemarks] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (issue) {
            setDepartment(issue.department || '');
            setRemarks(issue.remarks || issue.purpose || '');
            setItems(
                (issue.items || []).map((it: any) => ({
                    ...it,
                    originalQuantity: Number(it.quantity) || 0,
                    quantity: Number(it.quantity) || 0,
                }))
            );
            setValidationError(null);
        }
    }, [issue]);

    if (!isOpen || !issue) return null;

    const typeInfo = resolveIssueType(issue);

    const handleQuantityChange = (idx: number, val: string) => {
        const numVal = parseFloat(val);
        setItems(prev => {
            const next = [...prev];
            next[idx] = {
                ...next[idx],
                quantity: isNaN(numVal) ? '' : Math.max(0, numVal)
            };
            return next;
        });
    };

    const handlePurposeChange = (idx: number, val: string) => {
        setItems(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], purpose: val };
            return next;
        });
    };

    const handleRemoveItem = (idx: number) => {
        if (items.length <= 1) {
            setValidationError("A material issue must have at least one item. To cancel the entire issue, please delete it.");
            return;
        }
        setItems(prev => prev.filter((_, i) => i !== idx));
    };

    // Calculate live stock evaluation for each item
    const itemStockStatuses = items.map(item => {
        if (!storeData) return { availableStock: null, hasShortage: false };

        const stockEval = evaluateItemStock(item, storeData);
        // Available stock plus already issued original quantity is the maximum allocatable
        const originalQty = Number(item.originalQuantity) || 0;
        const currentQty = Number(item.quantity) || 0;
        const delta = currentQty - originalQty;
        const currentAvail = Number(stockEval.availableStock) || 0;

        const hasShortage = delta > 0 && currentAvail < delta;
        return {
            availableStock: currentAvail,
            delta,
            hasShortage,
            unit: stockEval.unit || item.unit || 'PCS',
            description: item.description || item.descriptions || ''
        };
    });

    const hasAnyShortage = itemStockStatuses.some(s => s.hasShortage);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        // Validation: Every item must have positive quantity
        for (let i = 0; i < items.length; i++) {
            const qty = Number(items[i].quantity);
            if (!qty || qty <= 0) {
                setValidationError(`Item #${i + 1} (${items[i].materialName}) must have a quantity greater than 0.`);
                return;
            }
        }

        if (hasAnyShortage) {
            setValidationError("One or more items have insufficient warehouse stock for the requested quantity increase. Please adjust quantities.");
            return;
        }

        try {
            setSaving(true);
            await onSave({
                ...issue,
                department,
                remarks,
                items: items.map(it => ({
                    ...it,
                    quantity: Number(it.quantity)
                }))
            });
            onClose();
        } catch (err: any) {
            setValidationError(err?.data?.message || err?.message || "Failed to update material issue.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gray-50/70 dark:bg-gray-800/60 sticky top-0 z-10 backdrop-blur-md">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Material Issue</h2>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold
                                ${issue.status === 'Issued' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                    issue.status === 'Returned' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                        'bg-gray-100 text-gray-700'}`}>
                                {issue.status}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${typeInfo.badgeClass}`}>
                                {typeInfo.label}
                            </span>
                        </div>
                        <p className="text-gray-500 text-xs sm:text-sm mt-1 font-mono font-medium">{issue.issueNumber}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                    {/* Informational Banner */}
                    <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/60 flex items-start gap-3">
                        <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                            <span className="font-bold">Real-Time Inventory Synchronization:</span> Any modifications to issued quantities will automatically adjust warehouse stock. Reducing quantity restores stock back to store inventory; increasing quantity validates and deducts available stock.
                        </div>
                    </div>

                    {validationError && (
                        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <span>{validationError}</span>
                        </div>
                    )}

                    {/* Metadata Header Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                Department / Shop Floor
                            </label>
                            <input
                                type="text"
                                value={department}
                                onChange={e => setDepartment(e.target.value)}
                                placeholder="e.g. Production Line 1"
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                Issued To (Recipient)
                            </label>
                            <input
                                type="text"
                                disabled
                                value={typeof issue.issuedTo === 'object' ? (issue.issuedTo?.name || 'Unknown') : (issue.issuedTo || 'Unknown')}
                                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-500 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                Date & Time
                            </label>
                            <input
                                type="text"
                                disabled
                                value={formatDateTime(issue.date)}
                                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-500 cursor-not-allowed font-mono"
                            />
                        </div>
                    </div>

                    {/* Items List */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <FileText size={16} className="text-indigo-600" />
                                Issued Material Items ({items.length})
                            </h3>
                            <span className="text-xs text-gray-500">
                                Edit quantity to adjust outward stock
                            </span>
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Material & Description</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 w-36">Issued Qty</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 w-36">Stock Impact</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Remarks / Purpose</th>
                                        <th className="px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 text-center w-12">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {items.map((item, idx) => {
                                        const stockInfo = itemStockStatuses[idx] || {};
                                        const desc = item.description || item.descriptions || stockInfo.description || '';
                                        const delta = Number(item.quantity || 0) - Number(item.originalQuantity || 0);

                                        return (
                                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-900 dark:text-gray-100 text-xs sm:text-sm">
                                                        {item.materialName || 'Unnamed Material'}
                                                    </div>
                                                    {desc && (
                                                        <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                                                            {desc}
                                                        </div>
                                                    )}
                                                    <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                                                        <span>Original: <b>{item.originalQuantity} {item.unit}</b></span>
                                                        {stockInfo.availableStock !== null && (
                                                            <span>• Live Warehouse: <b className="text-gray-700 dark:text-gray-300">{stockInfo.availableStock} {item.unit}</b></span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min="0.001"
                                                            value={item.quantity}
                                                            onChange={e => handleQuantityChange(idx, e.target.value)}
                                                            className={`w-24 px-2.5 py-1.5 bg-white dark:bg-gray-800 border rounded-lg text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 ${
                                                                stockInfo.hasShortage
                                                                    ? 'border-rose-400 focus:ring-rose-400/20 text-rose-600'
                                                                    : 'border-gray-200 dark:border-gray-700 focus:ring-indigo-500/20'
                                                            }`}
                                                        />
                                                        <span className="text-gray-500 font-medium text-xs">{item.unit || 'PCS'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {delta === 0 && (
                                                        <span className="text-[11px] text-gray-400 font-medium">No change</span>
                                                    )}
                                                    {delta > 0 && (
                                                        <div>
                                                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                                                +{delta} {item.unit} (Deduct)
                                                            </span>
                                                            {stockInfo.hasShortage && (
                                                                <div className="text-[10px] font-bold text-rose-600 mt-0.5 flex items-center gap-1">
                                                                    <AlertTriangle size={11} /> Shortage: {Number((delta - (stockInfo.availableStock || 0)).toFixed(3))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {delta < 0 && (
                                                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                                            {delta} {item.unit} (Restore)
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        value={item.purpose || ''}
                                                        onChange={e => handlePurposeChange(idx, e.target.value)}
                                                        placeholder="Purpose or remarks"
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(idx)}
                                                        disabled={items.length <= 1}
                                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Remove Item from Issue"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            General Remarks / Note
                        </label>
                        <textarea
                            rows={2}
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                            placeholder="Add reason for update or additional details..."
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                </form>

                {/* Footer Actions */}
                <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/60 flex justify-end gap-3 sticky bottom-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-5 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || hasAnyShortage}
                        className="flex items-center gap-2 px-6 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Updating Stock...</span>
                            </>
                        ) : (
                            <>
                                <Save size={15} />
                                <span>Save & Update Stock</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
