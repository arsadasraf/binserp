import React, { useState, useEffect } from 'react';
import { 
  X, Layers, Calendar, User, FileText, CheckCircle2, 
  Package, Clock, Check, Building2, Truck, ShieldCheck,
  RefreshCw, ChevronRight, Boxes
} from 'lucide-react';
import { apiGet } from '@/src/lib/api';

interface MRPDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mrpPlan: any;
  onStatusChange?: (id: string, newStatus: string) => void;
}

export default function MRPDetailsModal({ isOpen, onClose, mrpPlan }: MRPDetailsModalProps) {
  const [loadingGRN, setLoadingGRN] = useState(false);
  const [fgGrnHistory, setFgGrnHistory] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && mrpPlan) {
      fetchFGGRNHistory();
    }
  }, [isOpen, mrpPlan]);

  const fetchFGGRNHistory = async () => {
    setLoadingGRN(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await apiGet('/api/store/fg-grn', token);
      const allGrns = res?.grns || [];
      
      // Filter GRNs matching this MRP number or Customer PO
      const matching = allGrns.filter((g: any) => {
        const gMrp = (g.mrpNumber || '').trim();
        const gPo = (g.customerPoNumber || g.poNumber || '').trim();
        return (gMrp && gMrp === mrpPlan.mrpNumber) || 
               (mrpPlan.customerPoNumber && gPo && gPo === mrpPlan.customerPoNumber);
      });

      setFgGrnHistory(matching);
    } catch (err) {
      console.warn("Could not fetch FG GRN history:", err);
    } finally {
      setLoadingGRN(false);
    }
  };

  if (!isOpen || !mrpPlan) return null;

  const fgItems = mrpPlan.fgItems || [];
  const totalFGTarget = fgItems.reduce((sum: number, f: any) => sum + (Number(f.quantity) || 0), 0);
  const totalFGReceived = fgItems.reduce((sum: number, f: any) => sum + (Number(f.receivedQuantity) || 0), 0);
  const totalFGBalance = Math.max(0, totalFGTarget - totalFGReceived);
  const overallPercent = totalFGTarget > 0 ? Math.min(100, Math.round((totalFGReceived / totalFGTarget) * 100)) : 0;

  const allChildMats = [...(mrpPlan.rmRequirements || []), ...(mrpPlan.boRequirements || [])];
  const hasShortages = allChildMats.some((m: any) => m.shortage > 0);
  const isProcurementFulfilled = !hasShortages;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex justify-between items-start shrink-0 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-mono font-bold">
                {mrpPlan.mrpNumber}
              </span>
              {mrpPlan.isConsolidated && (
                <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <Layers size={12} />
                  <span>Consolidated ({mrpPlan.customerPOs?.length || 2} Customer POs)</span>
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                mrpPlan.status === 'Completed' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                mrpPlan.status === 'In Production' ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800' :
                mrpPlan.status === 'Partially Completed' ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800' :
                'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}>
                {mrpPlan.status}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1.5 flex items-center gap-2 truncate">
              <Package className="text-teal-600 dark:text-teal-400 w-5 h-5 shrink-0" />
              <span>MRP Demand Plan & FG Inward Progress</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Customer: <strong className="text-slate-800 dark:text-slate-200">{mrpPlan.customerName || "Internal Production"}</strong>
              {mrpPlan.customerPoNumber && <span> • PO: <strong className="text-slate-800 dark:text-slate-200">{mrpPlan.customerPoNumber}</strong></span>}
              {mrpPlan.poDate && <span> • PO Date: <strong className="text-slate-800 dark:text-slate-200">{new Date(mrpPlan.poDate).toLocaleDateString()}</strong></span>}
              {mrpPlan.targetDate && <span> • Committed: <strong className="text-slate-800 dark:text-slate-200">{new Date(mrpPlan.targetDate).toLocaleDateString()}</strong></span>}
              <span className="ml-2 pl-2 border-l border-slate-300 dark:border-slate-700">
                Created by: <strong className="text-slate-800 dark:text-slate-200">{mrpPlan.createdByName || "Planner"}</strong>
                {mrpPlan.updatedByName && (
                  <span className="text-amber-600 dark:text-amber-400 ml-2">
                    • Edited by: <strong>{mrpPlan.updatedByName}</strong>
                  </span>
                )}
              </span>
            </p>
            {mrpPlan.isConsolidated && mrpPlan.customerPOs && mrpPlan.customerPOs.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">Consolidated POs:</span>
                {mrpPlan.customerPOs.map((cpo: any, idx: number) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] border border-indigo-200 dark:border-indigo-800">
                    {cpo.customerPoNumber} {cpo.customerName ? `(${cpo.customerName})` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm">
          
          {/* 1. Top KPI Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Target Order Qty</span>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {totalFGTarget} <span className="text-xs font-semibold text-slate-400">units</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold uppercase text-teal-600">FG GRN Received</span>
              <div className="text-xl font-black text-teal-600 mt-0.5">
                {totalFGReceived} <span className="text-xs font-semibold text-slate-400">({overallPercent}%)</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold uppercase text-amber-600">Balance Units Left</span>
              <div className="text-xl font-black text-amber-600 mt-0.5">
                {totalFGBalance} <span className="text-xs font-semibold text-slate-400">units</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Procurement State</span>
              <div className="mt-1">
                {isProcurementFulfilled ? (
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold rounded-md text-[10px] border border-emerald-200">
                    ✅ Fulfilled
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold rounded-md text-[10px] border border-amber-200">
                    ⏳ Shortages Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Finished Goods Order Line Items */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Package size={14} className="text-indigo-600" />
              Finished Goods (FG) Items Demand
            </h3>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">FG Item Name & Description</th>
                    <th className="p-3 text-center">BOM Ref</th>
                    <th className="p-3 text-center">Order Target</th>
                    <th className="p-3 text-center">PO Date</th>
                    <th className="p-3 text-center">Committed Date</th>
                    <th className="p-3 text-center">FG GRN Received</th>
                    <th className="p-3 text-center">Balance Qty</th>
                    <th className="p-3 text-center">Completion %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {fgItems.map((fg: any, idx: number) => {
                    const fgQty = Number(fg.quantity) || 1;
                    const recQty = Number(fg.receivedQuantity) || 0;
                    const balQty = Math.max(0, fgQty - recQty);
                    const pct = Math.min(100, Math.round((recQty / fgQty) * 100));

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-slate-900 dark:text-white block">{fg.fgItemName}</strong>
                            {fg.sourceBreakdown && fg.sourceBreakdown.length > 1 ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                {fg.sourceBreakdown.map((b: any, bIdx: number) => (
                                  <span key={bIdx} className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200" title={b.customerName ? `${b.customerName}` : ''}>
                                    {b.customerPoNumber}: {b.quantity} {fg.unit || 'PCS'}
                                  </span>
                                ))}
                              </div>
                            ) : fg.customerPoNumber ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                                PO: {fg.customerPoNumber}
                              </span>
                            ) : null}
                            {fg.customerName && (!fg.sourceBreakdown || fg.sourceBreakdown.length <= 1) && (
                              <span className="text-[10px] text-slate-400 font-medium">({fg.customerName})</span>
                            )}
                          </div>
                          {fg.description && <span className="block text-[11px] text-slate-500 italic mt-0.5">{fg.description}</span>}
                        </td>
                        <td className="p-3 text-center font-mono text-[10px] text-slate-500">
                          {fg.bomNumber || "BOM-Active"}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                          {fgQty} {fg.unit || 'PCS'}
                        </td>
                        <td className="p-3 text-center text-[11px] text-slate-500">
                          {fg.poDeliveryDate ? new Date(fg.poDeliveryDate).toLocaleDateString() : "-"}
                        </td>
                        <td className="p-3 text-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {fg.targetDate ? new Date(fg.targetDate).toLocaleDateString() : "-"}
                        </td>
                        <td className="p-3 text-center font-bold text-teal-600">
                          {recQty} {fg.unit || 'PCS'}
                        </td>
                        <td className="p-3 text-center">
                          {balQty > 0 ? (
                            <span className="font-bold text-amber-600">{balQty} {fg.unit || 'PCS'}</span>
                          ) : (
                            <span className="font-bold text-emerald-600">0 (Fulfilled)</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-teal-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="font-bold text-[10px] text-slate-600 dark:text-slate-400">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. FG GRN Receipts & Inward Dates History Table */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-teal-600" />
                FG GRN Inward History & Dates ({fgGrnHistory.length} Receipts)
              </h3>
              {loadingGRN && <RefreshCw size={12} className="animate-spin text-teal-600" />}
            </div>

            {fgGrnHistory.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-1.5 opacity-60" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No FG GRN Inwards Recorded Yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  When Finished Goods are inspected and inwarded via Store &gt; FG GRN with MRP #{mrpPlan.mrpNumber}, receipt dates will appear here.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">FG GRN Number</th>
                      <th className="p-3">Receipt Date</th>
                      <th className="p-3">Item Received</th>
                      <th className="p-3 text-center">Inward Qty</th>
                      <th className="p-3">Received By / Shift</th>
                      <th className="p-3">Remarks / Batch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {fgGrnHistory.map((grn: any, gIdx: number) => {
                      const recDate = grn.date || grn.createdAt;
                      const formattedDate = recDate ? new Date(recDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "-";
                      const firstItem = (grn.items || [])[0];

                      return (
                        <tr key={gIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-teal-600 dark:text-teal-400">
                            {grn.grnNumber || grn.fgGrnNumber || `FG-GRN-${gIdx + 1}`}
                          </td>

                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            {formattedDate}
                          </td>

                          <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                            {firstItem?.materialName || firstItem?.itemName || "Finished Goods"}
                            {(grn.items || []).length > 1 && (
                              <span className="text-[10px] text-slate-400 ml-1">+{grn.items.length - 1} more</span>
                            )}
                          </td>

                          <td className="p-3 text-center font-bold text-emerald-600">
                            {(grn.items || []).reduce((s: number, i: any) => s + (Number(i.quantity || i.acceptedQuantity) || 0), 0)} PCS
                          </td>

                          <td className="p-3 text-slate-600 dark:text-slate-400">
                            {grn.receivedBy?.name || grn.shift || "Shopfloor Assembly"}
                          </td>

                          <td className="p-3 text-slate-500 text-[11px] truncate max-w-[150px]">
                            {grn.remarks || grn.batchNumber || "Production inward clearance"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
