import React, { useState, useEffect } from 'react';
import { 
  X, Layers, Calendar, User, FileText, CheckCircle2, 
  Package, Clock, Check, Building2, Truck, ShieldCheck,
  RefreshCw, ChevronRight, Boxes, AlertTriangle, Cpu, Wrench,
  Wallet, TrendingUp, IndianRupee
} from 'lucide-react';
import { apiGet, apiPost } from '@/src/lib/api';
import { getCurrencySymbol } from '@/src/utils/currencyHelper';

interface MRPDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mrpPlan: any;
  onStatusChange?: (id: string, newStatus: string) => void;
  onPlanUpdated?: (updatedPlan: any) => void;
}

export default function MRPDetailsModal({ isOpen, onClose, mrpPlan, onPlanUpdated }: MRPDetailsModalProps) {
  const [currentPlan, setCurrentPlan] = useState(mrpPlan);
  const [syncingBOM, setSyncingBOM] = useState(false);
  const [loadingGRN, setLoadingGRN] = useState(false);
  const [fgGrnHistory, setFgGrnHistory] = useState<any[]>([]);
  const [activeMaterialTab, setActiveMaterialTab] = useState<'all' | 'rm' | 'bo'>('all');

  useEffect(() => {
    setCurrentPlan(mrpPlan);
  }, [mrpPlan]);

  useEffect(() => {
    if (isOpen && currentPlan) {
      fetchFGGRNHistory();
    }
  }, [isOpen, currentPlan?.mrpNumber]);

  const handleSyncBOM = async () => {
    if (!currentPlan?._id) return;
    const token = localStorage.getItem('token') || '';
    try {
      setSyncingBOM(true);
      const res = await apiPost(`/api/purchase/mrp/plan/${currentPlan._id}/sync-bom`, {}, token);
      if (res?.success && res?.mrpPlan) {
        setCurrentPlan(res.mrpPlan);
        if (onPlanUpdated) {
          onPlanUpdated(res.mrpPlan);
        }
      }
    } catch (err: any) {
      console.error("Failed to sync BOM:", err);
    } finally {
      setSyncingBOM(false);
    }
  };

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
        return (gMrp && gMrp === currentPlan.mrpNumber) || 
               (currentPlan.customerPoNumber && gPo && gPo === currentPlan.customerPoNumber);
      });

      setFgGrnHistory(matching);
    } catch (err) {
      console.warn("Could not fetch FG GRN history:", err);
    } finally {
      setLoadingGRN(false);
    }
  };

  if (!isOpen || !currentPlan) return null;

  const fgItems = currentPlan.fgItems || [];
  const totalFGTarget = fgItems.reduce((sum: number, f: any) => sum + (Number(f.quantity) || 0), 0);
  const totalFGReceived = fgItems.reduce((sum: number, f: any) => sum + (Number(f.receivedQuantity) || 0), 0);
  const totalFGBalance = Math.max(0, totalFGTarget - totalFGReceived);
  const overallPercent = totalFGTarget > 0 ? Math.min(100, Math.round((totalFGReceived / totalFGTarget) * 100)) : 0;

  const rmRequirements = currentPlan.rmRequirements || [];
  const boRequirements = currentPlan.boRequirements || [];
  const allChildMats = [...rmRequirements, ...boRequirements];
  const hasShortages = allChildMats.some((m: any) => (m.shortage || 0) > 0);
  const isProcurementFulfilled = !hasShortages;

  const totalIncome = Number(currentPlan.totalIncome || (currentPlan.fgItems || []).reduce((sum: number, f: any) => sum + (Number(f.totalPrice) || (Number(f.quantity || 0) * Number(f.sellingPrice || 0))), 0));
  const committedExpense = Number(currentPlan.committedExpense || 0);
  const totalEstimatedExpense = Number(currentPlan.totalEstimatedExpense || currentPlan.totalGrossMaterialCost || 0);
  const targetExpense = Number(currentPlan.targetExpense || 0);
  const effectiveExpense = committedExpense > 0 ? committedExpense : totalEstimatedExpense;
  const budgetStatus = currentPlan.budgetStatus || (
    targetExpense > 0
      ? (effectiveExpense > targetExpense ? 'Over Budget' : effectiveExpense >= targetExpense * 0.85 ? 'Near Limit' : 'Within Budget')
      : 'Unset'
  );
  const projectedGrossProfit = Number(currentPlan.projectedGrossProfit != null ? currentPlan.projectedGrossProfit : (totalIncome - effectiveExpense));
  const projectedMarginPercentage = currentPlan.projectedMarginPercentage != null
    ? Number(currentPlan.projectedMarginPercentage)
    : (totalIncome > 0 ? Math.round((projectedGrossProfit / totalIncome) * 10000) / 100 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex justify-between items-start shrink-0 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-mono font-bold">
                {currentPlan.mrpNumber}
              </span>
              {currentPlan.isBOMOutdated && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 flex items-center gap-1 animate-pulse">
                  <RefreshCw size={10} /> BOM Changed
                </span>
              )}
              {currentPlan.isConsolidated && (
                <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <Layers size={12} />
                  <span>Consolidated ({currentPlan.customerPOs?.length || 2} Customer POs)</span>
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                currentPlan.status === 'Completed' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                currentPlan.status === 'In Production' ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800' :
                currentPlan.status === 'Partially Completed' ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800' :
                'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}>
                {currentPlan.status}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1.5 flex items-center gap-2 truncate">
              <Package className="text-teal-600 dark:text-teal-400 w-5 h-5 shrink-0" />
              <span>MRP Demand Plan & FG Inward Progress</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Customer: <strong className="text-slate-800 dark:text-slate-200">{currentPlan.customerName || "Internal Production"}</strong>
              {currentPlan.customerPoNumber && <span> • PO: <strong className="text-slate-800 dark:text-slate-200">{currentPlan.customerPoNumber}</strong></span>}
              {currentPlan.poDate && <span> • PO Date: <strong className="text-slate-800 dark:text-slate-200">{new Date(currentPlan.poDate).toLocaleDateString()}</strong></span>}
              {currentPlan.targetDate && <span> • Committed: <strong className="text-slate-800 dark:text-slate-200">{new Date(currentPlan.targetDate).toLocaleDateString()}</strong></span>}
              <span className="ml-2 pl-2 border-l border-slate-300 dark:border-slate-700">
                Created by: <strong className="text-slate-800 dark:text-slate-200">{currentPlan.createdByName || "Planner"}</strong>
                {currentPlan.updatedByName && (
                  <span className="text-amber-600 dark:text-amber-400 ml-2">
                    • Edited by: <strong>{currentPlan.updatedByName}</strong>
                  </span>
                )}
              </span>
            </p>
            {currentPlan.isConsolidated && currentPlan.customerPOs && currentPlan.customerPOs.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">Consolidated POs:</span>
                {currentPlan.customerPOs.map((cpo: any, idx: number) => {
                  const hasForeignCurrency = cpo.currency && cpo.currency !== 'INR';
                  const symbol = getCurrencySymbol(cpo.currency || 'INR');
                  return (
                    <span 
                      key={idx} 
                      className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] border border-indigo-200 dark:border-indigo-800 inline-flex items-center gap-1"
                      title={cpo.customerName ? `${cpo.customerName}${hasForeignCurrency ? ` (${cpo.currency} @ ₹${cpo.exchangeRate || '-'})` : ''}` : ''}
                    >
                      <strong className="text-slate-900 dark:text-slate-100">{cpo.customerPoNumber}</strong>
                      {cpo.customerName && <span className="text-slate-500 font-sans">({cpo.customerName})</span>}
                      {cpo.totalAmount ? (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 ml-0.5">
                          {hasForeignCurrency ? `${symbol}${Number(cpo.totalAmount).toLocaleString()} (₹${(cpo.totalAmountInINR || 0).toLocaleString('en-IN')})` : `₹${Number(cpo.totalAmount).toLocaleString('en-IN')}`}
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              type="button"
              onClick={handleSyncBOM}
              disabled={syncingBOM}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold text-xs rounded-xl border border-amber-200 dark:border-amber-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Synchronize latest BOM configurations, Customer PO quantities & prices, and Sales Price Lists"
            >
              <RefreshCw size={13} className={syncingBOM ? "animate-spin text-amber-600" : ""} />
              <span>{syncingBOM ? "Syncing..." : "Sync Plan (BOM & PO)"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm">
          
          {/* Outdated BOM Alert Banner */}
          {currentPlan.isBOMOutdated && (
            <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl flex items-center justify-between gap-3 text-amber-800 dark:text-amber-300 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                <span><strong>Finished Goods BOM Changed:</strong> The BOM for items in this plan was updated in the catalog. Click <strong>Sync Latest BOM</strong> to refresh Raw Material, Bought-Out quantities, and cost estimates.</span>
              </div>
              <button
                type="button"
                onClick={handleSyncBOM}
                disabled={syncingBOM}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} className={syncingBOM ? "animate-spin" : ""} />
                Sync Now
              </button>
            </div>
          )}
          
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

          {/* 1.5 Dynamic Financial & Budget Real-Time Overview */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl border border-indigo-900/50 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wallet className="text-emerald-400 w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Dynamic Financials & Outward PO Budget Sync
                </span>
              </div>
              <div className="flex items-center gap-2">
                {budgetStatus === 'Over Budget' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                    <AlertTriangle size={11} className="text-rose-400" /> Over Budget
                  </span>
                ) : budgetStatus === 'Near Limit' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <Clock size={11} className="text-amber-400" /> Near Limit (≥85%)
                  </span>
                ) : budgetStatus === 'Within Budget' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle2 size={11} className="text-emerald-400" /> Within Budget
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    Budget Unset
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {currentPlan.customerPOs?.length > 0 || currentPlan.customerPoNumber ? 'Customer PO Revenue' : 'Planned FG Revenue'}
                </span>
                <div className="text-base font-mono font-bold text-emerald-400 mt-0.5">
                  ₹{totalIncome.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {currentPlan.customerPOs?.length > 0 || currentPlan.customerPoNumber ? 'Contract Selling Price (INR)' : 'Sales Price List (INR)'}
                </div>
              </div>

              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Committed PO Spend</span>
                <div className="text-base font-mono font-bold text-indigo-300 mt-0.5">
                  ₹{committedExpense.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Active Outward POs</div>
              </div>

              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Target Budget Ceiling</span>
                <div className="text-base font-mono font-bold text-slate-200 mt-0.5">
                  {targetExpense > 0 ? `₹${targetExpense.toLocaleString('en-IN')}` : 'Not Specified'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {targetExpense > 0 ? `${Math.min(999, Math.round((effectiveExpense / targetExpense) * 100))}% utilized` : `Est: ₹${totalEstimatedExpense.toLocaleString('en-IN')}`}
                </div>
              </div>

              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Projected Gross Margin</span>
                <div className={`text-base font-mono font-bold mt-0.5 ${projectedGrossProfit >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                  ₹{projectedGrossProfit.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {projectedMarginPercentage}% Margin
                </div>
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
                    <th className="p-3 text-right">Agreed Rate & Revenue</th>
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
                              <div className="mt-1 space-y-1">
                                <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                  <Layers size={10} />
                                  <span>Consolidated ({fg.sourceBreakdown.length} Customer POs):</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {fg.sourceBreakdown.map((b: any, bIdx: number) => {
                                    const origRate = Number(b.originalRate || b.rate || 0);
                                    const curr = b.currency || 'INR';
                                    const exRate = Number(b.exchangeRate || 1);
                                    const inrRate = Number(b.rateInINR || (origRate * exRate) || 0);
                                    const isForeign = curr !== 'INR';

                                    return (
                                      <span
                                        key={bIdx}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                        title={`${b.customerName ? `${b.customerName} — ` : ''}${b.quantity} ${fg.unit || 'PCS'} @ ${curr} ${origRate} ${isForeign ? `(1 ${curr} = ₹${exRate})` : ''} = ₹${(b.amountInINR || (b.quantity * inrRate)).toLocaleString('en-IN')}`}
                                      >
                                        <span>{b.customerPoNumber}: {b.quantity} {fg.unit || 'PCS'}</span>
                                        {origRate > 0 && (
                                          <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold ml-0.5">
                                            @ {isForeign ? `${getCurrencySymbol(curr)}${origRate.toLocaleString()} → ₹${inrRate.toLocaleString('en-IN')}` : `₹${inrRate.toLocaleString('en-IN')}`}
                                          </span>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : fg.customerPoNumber ? (
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                                  PO: {fg.customerPoNumber}
                                </span>
                                {fg.currency && fg.currency !== 'INR' && Number(fg.originalSellingPrice || 0) > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                    {getCurrencySymbol(fg.currency)}{Number(fg.originalSellingPrice).toLocaleString()} {fg.currency} @ ₹{Number(fg.exchangeRate || 1)}
                                  </span>
                                )}
                                {fg.customerName && (
                                  <span className="text-[10px] text-slate-400 font-medium">({fg.customerName})</span>
                                )}
                              </div>
                            ) : null}
                          </div>
                          {fg.description && <span className="block text-[11px] text-slate-500 italic mt-0.5">{fg.description}</span>}
                        </td>
                        <td className="p-3 text-center font-mono text-[10px] text-slate-500">
                          {fg.bomNumber || "BOM-Active"}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                          {fgQty} {fg.unit || 'PCS'}
                        </td>
                        <td className="p-3 text-right font-mono">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            ₹{(Number(fg.totalPrice) || (fgQty * Number(fg.sellingPrice || 0))).toLocaleString('en-IN')}
                          </div>
                          {Number(fg.sellingPrice || 0) > 0 && (
                            <div className="text-[10px] text-slate-400">
                              @ ₹{Number(fg.sellingPrice).toLocaleString('en-IN')}/{fg.unit || 'PCS'}
                            </div>
                          )}
                          {fg.currency && fg.currency !== 'INR' && Number(fg.originalSellingPrice || 0) > 0 && (
                            <div className="text-[9.5px] text-amber-600 dark:text-amber-400 font-bold">
                              Orig: {getCurrencySymbol(fg.currency)}{Number(fg.originalSellingPrice).toLocaleString()} (@ ₹{Number(fg.exchangeRate || 1)})
                            </div>
                          )}
                          {fg.priceSource && (
                            <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mt-0.5">
                              {fg.priceSource.includes('Customer PO') ? fg.priceSource : 'Customer PO Agreed'}
                            </span>
                          )}
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

          {/* 2.5 Material Requirements Breakdown (RM & BO as per Latest BOM) */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Boxes size={14} className="text-cyan-600" />
                Material Requirements (As per Latest BOM)
              </h3>
              
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveMaterialTab('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeMaterialTab === 'all'
                      ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({allChildMats.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMaterialTab('rm')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeMaterialTab === 'rm'
                      ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Raw Materials ({rmRequirements.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMaterialTab('bo')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeMaterialTab === 'bo'
                      ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Bought-Out ({boRequirements.length})
                </button>
              </div>
            </div>

            {/* Materials Table */}
            {allChildMats.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                No material requirements exploded for this plan.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5">Item Name & Technical Description</th>
                        <th className="p-2.5 text-center">Type</th>
                        <th className="p-2.5 text-center">Required Qty</th>
                        <th className="p-2.5 text-center">Stock in Hand</th>
                        <th className="p-2.5 text-center">Shortage Qty</th>
                        <th className="p-2.5 text-right">Unit Rate & Cost</th>
                        <th className="p-2.5 text-center">Procurement Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(activeMaterialTab === 'all'
                        ? allChildMats
                        : activeMaterialTab === 'rm'
                        ? rmRequirements
                        : boRequirements
                      ).map((item: any, mIdx: number) => {
                        const itemName = item.materialName || item.name || "Material";
                        const itemDesc = item.descriptions || item.description || item.specification || "";
                        const reqQty = Number(item.requiredQuantity || item.quantity || 0);
                        const stockQty = Number(item.stockQuantity || item.currentStock || 0);
                        const shortageQty = Number(item.shortage || 0);
                        const isShortage = shortageQty > 0;
                        const unit = item.unit || "NOS";
                        const itemType = item.itemType || (item.isBoughtOut ? "Bought-Out" : "Raw Material");

                        return (
                          <tr key={mIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            {/* Item Name & Description (Strict rule compliance: AGENTS.md) */}
                            <td className="p-2.5">
                              <div className="font-bold text-xs text-slate-900 dark:text-white">
                                {itemName}
                              </div>
                              {itemDesc ? (
                                <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                                  {itemDesc}
                                </div>
                              ) : null}
                            </td>

                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                itemType.toLowerCase().includes('bought')
                                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200'
                                  : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200'
                              }`}>
                                {itemType}
                              </span>
                            </td>

                            <td className="p-2.5 text-center font-bold text-slate-800 dark:text-slate-200">
                              {reqQty} {unit}
                            </td>

                            <td className="p-2.5 text-center font-medium text-slate-600 dark:text-slate-300">
                              {stockQty} {unit}
                            </td>

                            <td className="p-2.5 text-center">
                              {isShortage ? (
                                <span className="font-bold text-rose-600 dark:text-rose-400">
                                  {shortageQty} {unit}
                                </span>
                              ) : (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  0 (In Stock)
                                </span>
                              )}
                            </td>

                            <td className="p-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                              <div>₹{(Number(item.grossCost || item.estimatedCost || (reqQty * Number(item.unitCost || 0))) || 0).toLocaleString('en-IN')}</div>
                              {Number(item.unitCost || 0) > 0 && (
                                <div className="text-[10px] text-slate-400">@ ₹{Number(item.unitCost).toLocaleString('en-IN')}/{unit}</div>
                              )}
                              {item.costSource && (
                                <span className={`inline-block text-[9px] font-semibold px-1 py-0.2 rounded mt-0.5 ${
                                  item.costSource.includes('Contracted')
                                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`} title={item.costSource}>
                                  {item.costSource.includes('Contracted') ? 'PO Contracted' : item.costSource}
                                </span>
                              )}
                            </td>

                            <td className="p-2.5 text-center">
                              {item.poNumber ? (
                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  PO: {item.poNumber}
                                </span>
                              ) : item.status === 'PO Raised' ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  PO Raised
                                </span>
                              ) : isShortage ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                  Needs Purchase
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Stock Covered
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
                  When Finished Goods are inspected and inwarded via Store &gt; FG GRN with MRP #{currentPlan.mrpNumber}, receipt dates will appear here.
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
