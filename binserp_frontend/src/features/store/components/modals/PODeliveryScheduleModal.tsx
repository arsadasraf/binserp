"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Calendar, Plus, Trash2, CheckCircle2, AlertTriangle, 
  Sparkles, Layers, Package, Clock, ArrowRight, RotateCcw, 
  Check, Save, Split
} from 'lucide-react';
import Swal from 'sweetalert2';
import { apiPatch } from '@/src/lib/api';

interface DeliveryScheduleEntry {
  monthKey: string; // "YYYY-MM"
  monthLabel?: string;
  quantity: number;
  plannedQuantity?: number;
  isPlanned?: boolean;
  mrpPlan?: string;
  mrpNumber?: string;
  linkedMrps?: Array<{ mrpPlan?: string; mrpNumber?: string; quantity?: number; plannedAt?: string }>;
  targetDate?: string;
  notes?: string;
}

interface ItemScheduleState {
  _id: string;
  productName: string;
  description?: string;
  quantity: number;
  unit: string;
  deliverySchedule: DeliveryScheduleEntry[];
}

interface PODeliveryScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerPO: any;
  token?: string | null;
  onSuccess?: (updatedPO: any) => void;
  onApplyLocalSchedule?: (updatedItemsSchedule: ItemScheduleState[]) => void;
}

export default function PODeliveryScheduleModal({
  isOpen,
  onClose,
  customerPO,
  token: propToken,
  onSuccess,
  onApplyLocalSchedule
}: PODeliveryScheduleModalProps) {
  const token = propToken || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '');
  const [loading, setLoading] = useState<boolean>(false);
  const [itemsSchedule, setItemsSchedule] = useState<ItemScheduleState[]>([]);

  // Generate next rolling 12 months for quick selection
  const availableMonths = useMemo(() => {
    const list: { key: string; label: string; shortLabel: string }[] = [];
    const now = new Date();
    // Start from current month
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      list.push({
        key: `${yyyy}-${mm}`,
        label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        shortLabel: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      });
    }
    return list;
  }, []);

  const getMonthShortLabel = (key: string): string => {
    if (!key) return '';
    const match = availableMonths.find(m => m.key === key);
    if (match) return match.shortLabel;
    const [y, m] = key.split('-');
    if (y && m) {
      const d = new Date(Number(y), Number(m) - 1, 1);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return key;
  };

  // Initialize line items schedule state when modal opens
  useEffect(() => {
    if (isOpen && customerPO && Array.isArray(customerPO.items)) {
      const defaultMonth = (() => {
        const d = customerPO.committedDispatchDate || customerPO.date;
        if (d) {
          const dateObj = new Date(d);
          if (!isNaN(dateObj.getTime())) {
            return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
          }
        }
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      })();

      const initial: ItemScheduleState[] = customerPO.items.map((it: any, idx: number) => {
        const fgObj = it.fgItem && typeof it.fgItem === 'object' ? it.fgItem : null;
        const name = it.productName || fgObj?.name || `Line Item #${idx + 1}`;
        const desc = it.description || fgObj?.description || fgObj?.descriptions || '';
        const totalQty = Number(it.quantity || 0);

        let sched: DeliveryScheduleEntry[] = [];
        if (Array.isArray(it.deliverySchedule) && it.deliverySchedule.length > 0) {
          sched = it.deliverySchedule.map((s: any) => ({
            monthKey: s.monthKey || defaultMonth,
            monthLabel: s.monthLabel || getMonthShortLabel(s.monthKey || defaultMonth),
            quantity: Number(s.quantity || 0),
            plannedQuantity: s.plannedQuantity != null ? Number(s.plannedQuantity) : (s.isPlanned ? Number(s.quantity || 0) : 0),
            isPlanned: Boolean(s.isPlanned),
            mrpPlan: typeof s.mrpPlan === 'object' ? s.mrpPlan?._id : s.mrpPlan,
            mrpNumber: s.mrpNumber || '',
            linkedMrps: Array.isArray(s.linkedMrps) ? s.linkedMrps : [],
            targetDate: s.targetDate ? s.targetDate.slice(0, 10) : undefined,
            notes: s.notes || ''
          }));
        } else {
          // Default single entry with 100% quantity allocated to PO target month
          const itemTargetDate = it.expectedDeliveryDate || customerPO.committedDispatchDate || customerPO.date;
          let itemMonth = defaultMonth;
          if (itemTargetDate) {
            const dObj = new Date(itemTargetDate);
            if (!isNaN(dObj.getTime())) {
              itemMonth = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}`;
            }
          }
          sched = [
            {
              monthKey: itemMonth,
              monthLabel: getMonthShortLabel(itemMonth),
              quantity: totalQty,
              targetDate: itemTargetDate ? new Date(itemTargetDate).toISOString().slice(0, 10) : undefined,
              notes: ''
            }
          ];
        }

        return {
          _id: it._id ? String(it._id) : `item_${idx}`,
          productName: name,
          description: desc,
          quantity: totalQty,
          unit: it.unit || fgObj?.unit || 'PCS',
          deliverySchedule: sched
        };
      });

      setItemsSchedule(initial);
    }
  }, [isOpen, customerPO]);

  // Handle schedule changes for a specific item
  const handleUpdateScheduleRow = (
    itemIndex: number,
    scheduleIndex: number,
    field: keyof DeliveryScheduleEntry,
    value: any
  ) => {
    setItemsSchedule(prev => {
      const next = [...prev];
      const item = { ...next[itemIndex] };
      const sched = [...item.deliverySchedule];
      sched[scheduleIndex] = {
        ...sched[scheduleIndex],
        [field]: value
      };
      if (field === 'monthKey') {
        sched[scheduleIndex].monthLabel = getMonthShortLabel(value);
      }
      item.deliverySchedule = sched;
      next[itemIndex] = item;
      return next;
    });
  };

  const handleAddScheduleRow = (itemIndex: number) => {
    setItemsSchedule(prev => {
      const next = [...prev];
      const item = { ...next[itemIndex] };
      // Pick next sequential month or current month
      const lastMonth = item.deliverySchedule[item.deliverySchedule.length - 1]?.monthKey;
      let nextMonthKey = availableMonths[0]?.key || '2026-10';
      if (lastMonth) {
        const [y, m] = lastMonth.split('-').map(Number);
        const nextD = new Date(y, m, 1);
        nextMonthKey = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}`;
      }

      // Calculate remaining unallocated qty
      const allocated = item.deliverySchedule.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
      const remaining = Math.max(0, item.quantity - allocated);

      item.deliverySchedule = [
        ...item.deliverySchedule,
        {
          monthKey: nextMonthKey,
          monthLabel: getMonthShortLabel(nextMonthKey),
          quantity: remaining,
          notes: ''
        }
      ];
      next[itemIndex] = item;
      return next;
    });
  };

  const handleRemoveScheduleRow = (itemIndex: number, scheduleIndex: number) => {
    setItemsSchedule(prev => {
      const next = [...prev];
      const item = { ...next[itemIndex] };
      if (item.deliverySchedule.length <= 1) {
        // Clear quantity instead of leaving empty
        item.deliverySchedule = [{
          monthKey: availableMonths[0]?.key || '2026-10',
          monthLabel: availableMonths[0]?.shortLabel || 'Oct 2026',
          quantity: 0
        }];
      } else {
        item.deliverySchedule = item.deliverySchedule.filter((_, i) => i !== scheduleIndex);
      }
      next[itemIndex] = item;
      return next;
    });
  };

  // Helper: Split item quantity evenly across N months
  const handleSplitEvenly = (itemIndex: number, splitCount: number = 2) => {
    setItemsSchedule(prev => {
      const next = [...prev];
      const item = { ...next[itemIndex] };
      const totalQty = item.quantity;
      const count = Math.max(2, Math.min(6, splitCount));
      const baseQty = Math.floor(totalQty / count);
      const remainder = totalQty % count;

      const newSched: DeliveryScheduleEntry[] = [];
      for (let i = 0; i < count; i++) {
        const mObj = availableMonths[i] || availableMonths[0];
        const rowQty = baseQty + (i === 0 ? remainder : 0);
        newSched.push({
          monthKey: mObj.key,
          monthLabel: mObj.shortLabel,
          quantity: rowQty,
          notes: `Split batch #${i + 1}`
        });
      }
      item.deliverySchedule = newSched;
      next[itemIndex] = item;
      return next;
    });
  };

  // Helper: Allocate 100% to first month
  const handleAllocateAllToSingleMonth = (itemIndex: number) => {
    setItemsSchedule(prev => {
      const next = [...prev];
      const item = { ...next[itemIndex] };
      const firstMonth = item.deliverySchedule[0]?.monthKey || availableMonths[0]?.key;
      item.deliverySchedule = [{
        monthKey: firstMonth,
        monthLabel: getMonthShortLabel(firstMonth),
        quantity: item.quantity,
        notes: 'Full allocation'
      }];
      next[itemIndex] = item;
      return next;
    });
  };

  // Save changes to backend or apply locally
  const handleSaveSchedule = async () => {
    // If PO hasn't been saved to DB yet (e.g. creating new PO)
    if (!customerPO?._id) {
      if (onApplyLocalSchedule) {
        onApplyLocalSchedule(itemsSchedule);
      }
      Swal.fire({
        icon: 'success',
        title: 'Delivery Schedule Configured!',
        text: 'Monthly delivery schedule configured for these items.',
        timer: 1800,
        showConfirmButton: false
      });
      onClose();
      return;
    }

    if (!token) return;

    try {
      setLoading(true);

      const payload = {
        items: itemsSchedule.map(it => ({
          itemId: it._id,
          deliverySchedule: it.deliverySchedule
            .filter(s => Number(s.quantity) > 0 && Boolean(s.monthKey))
            .map(s => ({
              monthKey: s.monthKey,
              monthLabel: s.monthLabel || getMonthShortLabel(s.monthKey),
              quantity: Number(s.quantity),
              plannedQuantity: s.plannedQuantity || 0,
              isPlanned: Boolean(s.isPlanned),
              mrpPlan: s.mrpPlan,
              mrpNumber: s.mrpNumber,
              linkedMrps: s.linkedMrps,
              targetDate: s.targetDate ? new Date(s.targetDate) : undefined,
              notes: s.notes || ''
            }))
        }))
      };

      const res: any = await apiPatch(`/api/sales/incoming-po/${customerPO._id}/delivery-schedule`, payload, token);

      Swal.fire({
        icon: 'success',
        title: 'Delivery Schedule Saved!',
        text: `Monthly delivery plan updated for Customer PO #${customerPO.poNumber}.`,
        timer: 2000,
        showConfirmButton: false
      });

      if (onApplyLocalSchedule) {
        onApplyLocalSchedule(itemsSchedule);
      }
      if (onSuccess) {
        onSuccess(res.incomingPO || res.data || res);
      }
      onClose();
    } catch (err: any) {
      console.error('Save schedule error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Failed to Save Schedule',
        text: err.message || 'Could not update delivery schedule. Please try again.',
        confirmButtonColor: '#4f46e5'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !customerPO) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50/95 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Monthly Delivery Schedule Planner
                </h3>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                  PO #{customerPO.poNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customer: <strong className="text-slate-800 dark:text-slate-200">{customerPO.customerName || customerPO.customer?.name || 'Customer'}</strong> • Plan which line items & quantities deliver in which month.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Content: List of Line Items with Month Split Configurator */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
          {itemsSchedule.map((item, itemIdx) => {
            const totalQty = item.quantity;
            const scheduledQty = item.deliverySchedule.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
            const remainingQty = totalQty - scheduledQty;
            const isFullyScheduled = scheduledQty === totalQty;
            const isOverScheduled = scheduledQty > totalQty;

            return (
              <div
                key={item._id}
                className="bg-slate-50/70 dark:bg-slate-850/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 space-y-3 transition-all"
              >
                {/* Line Item Header: Strictly adheres to AGENTS.md rule */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        #{itemIdx + 1}
                      </span>
                      {/* Item Name prominently rendered per rule */}
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {item.productName}
                      </span>
                    </div>
                    {/* Technical Description in subtle italic directly below per rule */}
                    {item.description && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                        {item.description}
                      </div>
                    )}
                  </div>

                  {/* Quantity & Schedule Status Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      Total: {totalQty} {item.unit}
                    </span>

                    {isFullyScheduled ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                        <CheckCircle2 size={12} />
                        <span>100% Scheduled ({scheduledQty} {item.unit})</span>
                      </span>
                    ) : isOverScheduled ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200">
                        <AlertTriangle size={12} />
                        <span>Exceeds by {Math.abs(remainingQty)} {item.unit}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                        <Clock size={12} />
                        <span>{remainingQty} {item.unit} Unscheduled</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Helper Action Buttons */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                      Quick Split:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSplitEvenly(itemIdx, 2)}
                      className="px-2 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer flex items-center gap-1"
                      title="Split quantity evenly across 2 months (e.g. 5 + 5)"
                    >
                      <Split size={11} />
                      <span>2 Months (50/50)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSplitEvenly(itemIdx, 3)}
                      className="px-2 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer flex items-center gap-1"
                      title="Split quantity evenly across 3 months"
                    >
                      <Split size={11} />
                      <span>3 Months</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAllocateAllToSingleMonth(itemIdx)}
                      className="px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                      title="Put 100% into single month"
                    >
                      <RotateCcw size={11} />
                      <span>All in 1 Month</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddScheduleRow(itemIdx)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ml-auto"
                  >
                    <Plus size={13} />
                    <span>+ Add Month Split</span>
                  </button>
                </div>

                {/* Monthly Splits Rows */}
                <div className="space-y-2 pt-1">
                  {item.deliverySchedule.map((sched, schedIdx) => (
                    <div
                      key={schedIdx}
                      className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs"
                    >
                      <span className="text-[10px] font-bold text-slate-400 w-5 text-center">
                        #{schedIdx + 1}
                      </span>

                      {/* Month Dropdown */}
                      <div className="flex-1 min-w-[140px]">
                        <select
                          value={sched.monthKey}
                          onChange={(e) => handleUpdateScheduleRow(itemIdx, schedIdx, 'monthKey', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          {availableMonths.map((m) => (
                            <option key={m.key} value={m.key}>
                              {m.label} ({m.shortLabel})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Planned Quantity */}
                      <div className="w-28 sm:w-32">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={sched.quantity === 0 ? '' : sched.quantity}
                            onChange={(e) => handleUpdateScheduleRow(itemIdx, schedIdx, 'quantity', Number(e.target.value) || 0)}
                            placeholder="Qty"
                            className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 text-right outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                            {item.unit}
                          </span>
                        </div>
                      </div>

                      {/* Planned Status Badge */}
                      {sched.plannedQuantity && sched.plannedQuantity > 0 ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300" title={sched.mrpNumber ? `Planned in ${sched.mrpNumber}` : 'Planned'}>
                            ✓ {sched.plannedQuantity} {item.unit} in {sched.mrpNumber || 'MRP'}
                          </span>
                          {sched.quantity > sched.plannedQuantity && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                              ⚡ {sched.quantity - sched.plannedQuantity} Pending
                            </span>
                          )}
                        </div>
                      ) : null}

                      {/* Optional Target Date */}
                      <div className="hidden sm:block w-36">
                        <input
                          type="date"
                          value={sched.targetDate || ''}
                          onChange={(e) => handleUpdateScheduleRow(itemIdx, schedIdx, 'targetDate', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-600 dark:text-slate-400 outline-none"
                          title="Optional exact target delivery date in this month"
                        />
                      </div>

                      {/* Notes / Tag */}
                      <div className="hidden md:block flex-1 min-w-[120px]">
                        <input
                          type="text"
                          value={sched.notes || ''}
                          onChange={(e) => handleUpdateScheduleRow(itemIdx, schedIdx, 'notes', e.target.value)}
                          placeholder="Note (e.g. Batch 1, Urgent)"
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 outline-none"
                        />
                      </div>

                      {/* Delete Row Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveScheduleRow(itemIdx, schedIdx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Remove this month split"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Sparkles size={14} className="text-indigo-500" />
            <span>Scheduled quantities will automatically reflect on the <strong>Month-Wise Demand Matrix</strong>.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Schedule...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Delivery Schedule</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
