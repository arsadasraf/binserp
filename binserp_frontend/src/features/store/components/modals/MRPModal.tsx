import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Layers, Calendar, User, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import { apiGet, apiPost } from '@/src/lib/api';
import Swal from 'sweetalert2';

interface MRPModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    token: string;
}

interface FGRow {
    fgItem: string;
    fgItemName: string;
    fgItemCode: string;
    description: string;
    quantity: number;
    unit: string;
    targetDate: string;
    bomId?: string;
    bomNumber?: string;
}

export default function MRPModal({ isOpen, onClose, onSuccess, token }: MRPModalProps) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Masters Data
    const [fgItemList, setFgItemList] = useState<any[]>([]);
    const [bomsList, setBomsList] = useState<any[]>([]);

    // Form Data
    const [mrpNumber, setMrpNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [remarks, setRemarks] = useState('');

    // FG Items Table
    const [fgRows, setFgRows] = useState<FGRow[]>([
        { fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', targetDate: '' }
    ]);

    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            setMrpNumber(`MRP-${dateStr}-${randomSuffix}`);
            
            // Default target date: 7 days in future
            const future = new Date();
            future.setDate(future.getDate() + 7);
            const defaultDate = future.toISOString().split('T')[0];
            setTargetDate(defaultDate);

            setFgRows([
                { fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', targetDate: defaultDate }
            ]);

            loadDropdownMasters();
        }
    }, [isOpen]);

    const loadDropdownMasters = async () => {
        setLoading(true);
        try {
            const [fgRes, bomRes] = await Promise.allSettled([
                apiGet('/api/store/fg-item', token),
                apiGet('/api/store/bom', token)
            ]);

            if (fgRes.status === 'fulfilled' && fgRes.value) {
                setFgItemList(fgRes.value.fgItems || fgRes.value.data || []);
            }
            if (bomRes.status === 'fulfilled' && bomRes.value) {
                setBomsList(bomRes.value.boms || bomRes.value.data || []);
            }
        } catch (err) {
            console.error('Failed to load masters for MRP modal:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = () => {
        setFgRows([...fgRows, { 
            fgItem: '', 
            fgItemName: '', 
            fgItemCode: '', 
            description: '', 
            quantity: 1, 
            unit: 'PCS', 
            targetDate: targetDate || '' 
        }]);
    };

    const handleRemoveRow = (index: number) => {
        if (fgRows.length <= 1) {
            setFgRows([{ fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', targetDate: targetDate || '' }]);
            return;
        }
        setFgRows(fgRows.filter((_, i) => i !== index));
    };

    const handleFGChange = (index: number, fgId: string) => {
        const selected = fgItemList.find(f => f._id === fgId);
        const matchedBom = bomsList.find(b => 
            (selected && (b.productName?.toLowerCase() === selected.name?.toLowerCase() || b.productCode === selected.code))
        );

        const updated = [...fgRows];
        updated[index] = {
            ...updated[index],
            fgItem: fgId,
            fgItemName: selected?.name || '',
            fgItemCode: selected?.code || '',
            description: selected?.description || selected?.descriptions || updated[index].description || '',
            unit: selected?.unit || 'PCS',
            bomId: matchedBom?._id,
            bomNumber: matchedBom?.bomNumber
        };
        setFgRows(updated);
    };

    const handleRowChange = (index: number, field: keyof FGRow, val: any) => {
        const updated = [...fgRows];
        updated[index] = {
            ...updated[index],
            [field]: val
        };
        setFgRows(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validItems = fgRows.filter(r => r.fgItemName || r.fgItem);
        if (validItems.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No FG Items Selected',
                text: 'Please select at least one Finished Goods (FG) item.'
            });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                mrpNumber,
                customerName,
                targetDate,
                remarks,
                fgItems: validItems
            };

            await apiPost('/api/purchase/mrp/plan', payload, token);

            Swal.fire({
                icon: 'success',
                title: 'MRP Plan Created!',
                text: 'Finished goods requirements exploded into unified RM / BO material plan.',
                timer: 2500
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error creating MRP plan:', err);
            Swal.fire({
                icon: 'error',
                title: 'Calculation Error',
                text: err.message || 'Failed to generate MRP breakdown'
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5 lg:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl xl:max-w-7xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                
                {/* Modal Header */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                            <Layers className="text-indigo-200" size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black">Create MRP Demand Plan</h2>
                            <p className="text-xs text-indigo-200 mt-0.5">Input FG requirements with target dates & explode BOM into RM / BO materials</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
                    
                    {/* Header Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                        {/* Auto-generated MRP Number */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                MRP Plan #
                            </label>
                            <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {mrpNumber}
                            </div>
                        </div>

                        {/* Customer Name (Optional) */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Customer Name <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. ACME Corp"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* Target Due Date */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Target Due Date
                            </label>
                            <input
                                type="date"
                                value={targetDate}
                                onChange={(e) => {
                                    setTargetDate(e.target.value);
                                    // Also sync rows if empty
                                    setFgRows(prev => prev.map(r => ({ ...r, targetDate: r.targetDate || e.target.value })));
                                }}
                                required
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* Purpose / Remarks */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Purpose / Remarks
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Batch #14 Production"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    {/* Finished Goods Items Entry Grid */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                    Finished Goods (FG) Items Entry
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Add multiple FG items with description, required quantity & target date</p>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                                <Plus size={15} /> Add FG Item
                            </button>
                        </div>

                        {/* FG Table */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-3 py-3 w-10 text-center">#</th>
                                        <th className="px-3 py-3 min-w-[180px]">Finished Goods (FG) Item</th>
                                        <th className="px-3 py-3 min-w-[160px]">Description</th>
                                        <th className="px-3 py-3 w-28 text-center">Qty</th>
                                        <th className="px-3 py-3 w-20 text-center">Unit</th>
                                        <th className="px-3 py-3 min-w-[130px]">Target Date</th>
                                        <th className="px-3 py-3 w-12 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {fgRows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                            <td className="px-3 py-3 text-slate-400 font-bold text-center">{idx + 1}</td>
                                            
                                            {/* FG Item Dropdown */}
                                            <td className="px-3 py-3">
                                                <select
                                                    value={row.fgItem}
                                                    onChange={(e) => handleFGChange(idx, e.target.value)}
                                                    required
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                >
                                                    <option value="">-- Select FG Item --</option>
                                                    {fgItemList.map(fg => (
                                                        <option key={fg._id} value={fg._id}>
                                                            {fg.name} {fg.code ? `(${fg.code})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                {row.bomNumber && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold mt-1">
                                                        <CheckCircle2 size={11} /> BOM: {row.bomNumber}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Description */}
                                            <td className="px-3 py-3">
                                                <input
                                                    type="text"
                                                    placeholder="Item specifications / notes..."
                                                    value={row.description}
                                                    onChange={(e) => handleRowChange(idx, 'description', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </td>

                                            {/* Quantity */}
                                            <td className="px-3 py-3 text-center">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={row.quantity}
                                                    onChange={(e) => handleRowChange(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                                                    required
                                                    className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-center font-bold text-indigo-600 dark:text-indigo-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </td>

                                            {/* Unit */}
                                            <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400 font-bold">
                                                {row.unit || 'PCS'}
                                            </td>

                                            {/* Row Target Date */}
                                            <td className="px-3 py-3">
                                                <input
                                                    type="date"
                                                    value={row.targetDate}
                                                    onChange={(e) => handleRowChange(idx, 'targetDate', e.target.value)}
                                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </td>

                                            {/* Delete Action */}
                                            <td className="px-3 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRow(idx)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                                                    title="Remove Row"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        <span className="text-xs text-slate-500">
                            {fgRows.length} FG items entered.
                        </span>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs shadow-md shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                <Sparkles size={16} />
                                {submitting ? 'Calculating Material Requirements...' : 'Calculate & Generate MRP Breakdown'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
