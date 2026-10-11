import React, { useState, useEffect, useMemo } from 'react';
import { X, Play, Factory, CheckCircle2, AlertCircle, CheckSquare, Square, Layers, Sparkles } from 'lucide-react';
import Swal from 'sweetalert2';
import { apiPost } from '@/src/lib/api';

interface FGLineItemConfig {
  selected: boolean;
  quantityToMove: number;
}

interface MoveToProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: any;
  preSelectedFgIndex?: number | null;
  onSuccess: () => void;
  token?: string;
}

export default function MoveToProductionModal({
  isOpen,
  onClose,
  plan,
  preSelectedFgIndex,
  onSuccess,
  token
}: MoveToProductionModalProps) {
  const [lineConfigs, setLineConfigs] = useState<Record<number, FGLineItemConfig>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fgItems = useMemo(() => plan?.fgItems || [], [plan]);

  // Initialize line items configurations
  useEffect(() => {
    if (isOpen && plan) {
      const initial: Record<number, FGLineItemConfig> = {};
      fgItems.forEach((fg: any, idx: number) => {
        const planned = Number(fg.quantity) || 0;
        const moved = Number(fg.movedToProductionQuantity) || 0;
        const balance = Math.max(0, planned - moved);

        const isPreselected =
          preSelectedFgIndex !== null && preSelectedFgIndex !== undefined
            ? preSelectedFgIndex === idx
            : balance > 0;

        initial[idx] = {
          selected: isPreselected && balance > 0,
          quantityToMove: balance > 0 ? balance : 0
        };
      });
      setLineConfigs(initial);
    }
  }, [isOpen, plan, fgItems, preSelectedFgIndex]);

  if (!isOpen || !plan) return null;

  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '');

  // Calculate totals
  const totalSelectedCount = Object.values(lineConfigs).filter((c) => c.selected && c.quantityToMove > 0).length;
  const totalUnitsToMove = Object.entries(lineConfigs).reduce((sum, [idx, c]) => {
    return c.selected ? sum + (Number(c.quantityToMove) || 0) : sum;
  }, 0);

  const allEligibleSelected =
    fgItems.length > 0 &&
    fgItems.every((fg: any, idx: number) => {
      const bal = Math.max(0, (Number(fg.quantity) || 0) - (Number(fg.movedToProductionQuantity) || 0));
      return bal === 0 || lineConfigs[idx]?.selected;
    });

  const toggleSelectAll = () => {
    const nextState = !allEligibleSelected;
    setLineConfigs((prev) => {
      const updated = { ...prev };
      fgItems.forEach((fg: any, idx: number) => {
        const bal = Math.max(0, (Number(fg.quantity) || 0) - (Number(fg.movedToProductionQuantity) || 0));
        if (bal > 0) {
          updated[idx] = {
            ...updated[idx],
            selected: nextState,
            quantityToMove: updated[idx]?.quantityToMove > 0 ? updated[idx].quantityToMove : bal
          };
        }
      });
      return updated;
    });
  };

  const handleCheckboxChange = (idx: number) => {
    setLineConfigs((prev) => {
      const cur = prev[idx];
      const nextSelected = !cur?.selected;
      const fg = fgItems[idx];
      const bal = Math.max(0, (Number(fg.quantity) || 0) - (Number(fg.movedToProductionQuantity) || 0));
      return {
        ...prev,
        [idx]: {
          selected: nextSelected,
          quantityToMove: nextSelected && (!cur?.quantityToMove || cur.quantityToMove <= 0) ? bal : (cur?.quantityToMove || bal)
        }
      };
    });
  };

  const handleQuantityChange = (idx: number, val: number, maxBal: number) => {
    const safeVal = isNaN(val) ? 0 : Math.min(Math.max(0, val), maxBal);
    setLineConfigs((prev) => ({
      ...prev,
      [idx]: {
        selected: safeVal > 0 ? true : prev[idx]?.selected,
        quantityToMove: safeVal
      }
    }));
  };

  const handleSubmit = async () => {
    const itemsToMove: any[] = [];

    fgItems.forEach((fg: any, idx: number) => {
      const cfg = lineConfigs[idx];
      if (cfg?.selected && cfg.quantityToMove > 0) {
        itemsToMove.push({
          fgItemId: fg._id || fg.fgItem?._id || fg.fgItem,
          fgItemName: fg.fgItemName || fg.fgItem?.name,
          fgItemCode: fg.fgItemCode || fg.fgItem?.code || '',
          quantityToMove: cfg.quantityToMove,
          itemIndex: idx
        });
      }
    });

    if (itemsToMove.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Lines Selected',
        text: 'Please select at least one line item with a quantity greater than zero to move to production.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiPost(
        `/api/purchase/mrp/plan/${plan._id}/move-to-production`,
        { items: itemsToMove },
        authToken
      );

      Swal.fire({
        icon: 'success',
        title: 'Moved to Production!',
        text: res.message || `Successfully routed ${totalUnitsToMove} units across ${itemsToMove.length} line(s) to PPC Production.`,
        timer: 3000
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Move to Production Failed',
        text: err?.message || 'Failed to route line items to production.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-3 md:p-4 lg:p-5 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-[96vw] 2xl:max-w-[1650px] xl:max-w-[1480px] lg:max-w-6xl max-h-[94vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
              <Factory size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Move to Production
                </h2>
                <span className="font-mono text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800">
                  MRP #{plan.mrpNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {plan.customerName || 'Internal Production Demand'}
                {plan.customerPoNumber && ` • PO: ${plan.customerPoNumber}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-3 gap-3 p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-xs">
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total FG Lines</span>
            <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-200">{fgItems.length}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-purple-600 block">Selected Lines</span>
            <span className="text-sm font-black font-mono text-purple-600 dark:text-purple-400">
              {totalSelectedCount} of {fgItems.length}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Total Units to Move</span>
            <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{totalUnitsToMove}</span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer"
          >
            {allEligibleSelected ? (
              <CheckSquare size={15} className="text-purple-600" />
            ) : (
              <Square size={15} className="text-slate-400" />
            )}
            <span>{allEligibleSelected ? 'Deselect All Lines' : 'Select All Available Lines'}</span>
          </button>

          <span className="text-[11px] text-slate-400 italic">
            Check the lines you wish to route and adjust quantities as needed.
          </span>
        </div>

        {/* Lines Table */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3">Finished Good & Technical Description</th>
                  <th className="p-3 text-center">Target Qty</th>
                  <th className="p-3 text-center">Already Moved</th>
                  <th className="p-3 text-center">Balance Qty</th>
                  <th className="p-3 w-40 text-right">Qty to Move</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {fgItems.map((fg: any, idx: number) => {
                  const name = fg.fgItem?.name || fg.fgItemName || 'FG Item';
                  const desc = fg.fgItem?.description || fg.fgItem?.descriptions || fg.description;
                  const planned = Number(fg.quantity) || 0;
                  const moved = Number(fg.movedToProductionQuantity) || 0;
                  const balance = Math.max(0, planned - moved);
                  const isFullyMoved = balance === 0;

                  const cfg = lineConfigs[idx] || { selected: false, quantityToMove: 0 };
                  const isChecked = cfg.selected && !isFullyMoved;

                  return (
                    <tr
                      key={idx}
                      className={`transition-colors ${
                        isFullyMoved
                          ? 'bg-slate-50/60 dark:bg-slate-900/40 opacity-75'
                          : isChecked
                          ? 'bg-purple-50/40 dark:bg-purple-950/20'
                          : 'hover:bg-slate-50/40 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          disabled={isFullyMoved}
                          checked={isChecked}
                          onChange={() => handleCheckboxChange(idx)}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-slate-700 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* Item Name & Technical Description per AGENTS.md */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm">
                            {name}
                          </strong>
                          {fg.bomNumber && (
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                              {fg.bomNumber}
                            </span>
                          )}
                        </div>
                        {desc && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                            {desc}
                          </div>
                        )}
                      </td>

                      {/* Target Qty */}
                      <td className="p-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {planned} <span className="text-[10px] text-slate-400 font-normal">{fg.unit || 'PCS'}</span>
                      </td>

                      {/* Already Moved */}
                      <td className="p-3 text-center font-mono font-semibold text-slate-500 dark:text-slate-400">
                        {moved}
                      </td>

                      {/* Balance Available */}
                      <td className="p-3 text-center">
                        {isFullyMoved ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                            Fully Moved
                          </span>
                        ) : (
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                            {balance} <span className="text-[10px] text-slate-400 font-normal">{fg.unit || 'PCS'}</span>
                          </span>
                        )}
                      </td>

                      {/* Editable Qty to Move Input */}
                      <td className="p-3 text-right">
                        {isFullyMoved ? (
                          <span className="text-[11px] text-slate-400 italic">No balance</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={balance}
                              disabled={!isChecked}
                              value={cfg.quantityToMove || ''}
                              onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value, 10), balance)}
                              className={`w-24 px-2 py-1 text-right font-mono font-bold text-xs rounded-lg border outline-none transition-all ${
                                isChecked
                                  ? 'bg-white dark:bg-slate-900 border-purple-400 text-purple-700 dark:text-purple-300 focus:ring-2 focus:ring-purple-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                              }`}
                            />
                            <span className="text-[10px] text-slate-400 font-medium shrink-0">
                              {fg.unit || 'PCS'}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500">
            Selected: <strong className="text-purple-600 dark:text-purple-400 font-bold">{totalSelectedCount} items</strong> ({totalUnitsToMove} units total)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || totalSelectedCount === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={13} />
              <span>{isSubmitting ? 'Routing to Production...' : 'Confirm Move to Production'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
