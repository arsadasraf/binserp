"use client";

import React from 'react';
import { 
  X, 
  IndianRupee, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Target, 
  Sparkles, 
  TrendingUp, 
  Wallet, 
  Layers,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';
import Swal from 'sweetalert2';
import { apiPut } from '@/src/lib/api';

export interface MRPBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: any;
  token?: string;
  onPlanUpdated?: (updatedPlan: any) => void;
}

export default function MRPBudgetModal({
  isOpen,
  onClose,
  plan,
  token,
  onPlanUpdated
}: MRPBudgetModalProps) {
  if (!isOpen || !plan) return null;

  const totalIncome = Number(plan.totalIncome || 0);
  const totalGrossCost = Number(plan.totalGrossMaterialCost || 0);
  const totalEstExpense = Number(plan.totalEstimatedExpense || 0);
  const committedExpense = Number(plan.committedExpense || 0);
  const targetExpense = Number(plan.targetExpense || 0);
  const profit = Number(plan.projectedGrossProfit != null ? plan.projectedGrossProfit : (totalIncome - totalEstExpense));
  const marginPct = Number(plan.projectedMarginPercentage != null 
    ? plan.projectedMarginPercentage 
    : (totalIncome > 0 ? ((profit / totalIncome) * 100) : 0));

  const budgetStatus = plan.budgetStatus || (
    targetExpense > 0 
      ? (committedExpense > targetExpense ? 'Over Budget' : committedExpense >= targetExpense * 0.85 ? 'Near Limit' : 'Within Budget')
      : 'Unset'
  );

  const budgetUsagePct = targetExpense > 0 
    ? Math.min(999, Math.round((committedExpense / targetExpense) * 100))
    : 0;

  const isOverBudget = targetExpense > 0 && committedExpense > targetExpense;
  const overrunAmount = isOverBudget ? committedExpense - targetExpense : 0;

  // Material cost breakdowns
  const rmCost = (plan.rmRequirements || []).reduce((sum: number, r: any) => sum + (Number(r.grossCost) || 0), 0);
  const boCost = (plan.boRequirements || []).reduce((sum: number, b: any) => sum + (Number(b.grossCost) || 0), 0);
  const totalBOMCost = Math.round((rmCost + boCost) * 100) / 100;

  const handleUpdateTargetExpense = async () => {
    if (!plan?._id) return;

    const currentTarget = Number(plan.targetExpense || 0);

    const { value: newBudgetStr } = await Swal.fire({
      title: 'Target Procurement Expense (Budget Ceiling)',
      html: `
        <div class="text-left text-xs text-slate-600 dark:text-slate-300 space-y-1.5 mb-2 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>Plan: <strong class="text-indigo-600 dark:text-indigo-400 font-mono">${plan.mrpNumber || ''}</strong></div>
          <div class="grid grid-cols-2 gap-2 my-1.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div>
              <span class="text-[10px] uppercase font-bold text-slate-400">Raw Material (RM):</span><br/>
              <strong class="text-slate-800 dark:text-slate-100 font-mono">₹${rmCost.toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <span class="text-[10px] uppercase font-bold text-slate-400">Bought Out (BO):</span><br/>
              <strong class="text-indigo-600 dark:text-indigo-400 font-mono">₹${boCost.toLocaleString('en-IN')}</strong>
            </div>
          </div>
          <div>Combined BOM Cost: <strong class="text-slate-900 dark:text-white font-mono">₹${totalBOMCost.toLocaleString('en-IN')}</strong></div>
          <div>Projected Income: <strong class="text-emerald-600 font-mono">₹${(plan.totalIncome || 0).toLocaleString('en-IN')}</strong></div>
          <div>Committed POs: <strong class="text-indigo-600 font-mono">₹${(plan.committedExpense || 0).toLocaleString('en-IN')}</strong></div>
        </div>
        <div class="flex items-center gap-1.5 justify-start mb-2 flex-wrap">
          <span class="text-[11px] font-bold text-slate-500">Quick Set:</span>
          ${totalBOMCost > 0 ? `
            <button type="button" id="swal-set-bom" class="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 cursor-pointer">BOM Cost (₹${Math.round(totalBOMCost).toLocaleString('en-IN')})</button>
            <button type="button" id="swal-set-bom-5" class="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">+5% Buffer</button>
          ` : ''}
          ${(plan.totalIncome || 0) > 0 ? `
            <button type="button" id="swal-set-70" class="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">70% Rev</button>
          ` : ''}
        </div>
        <p class="text-xs text-slate-500 mb-1 text-left">Set max allowable procurement expenses for this plan:</p>
      `,
      input: 'number',
      inputValue: currentTarget > 0 ? currentTarget : '',
      inputPlaceholder: 'Enter budget ceiling amount in ₹',
      showCancelButton: true,
      confirmButtonText: 'Save Budget',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#4f46e5',
      didOpen: () => {
        const input = Swal.getInput();
        const setBomBtn = document.getElementById('swal-set-bom');
        const setBom5Btn = document.getElementById('swal-set-bom-5');
        const set70Btn = document.getElementById('swal-set-70');
        if (setBomBtn && input) setBomBtn.onclick = () => { input.value = String(totalBOMCost); };
        if (setBom5Btn && input) setBom5Btn.onclick = () => { input.value = String(Math.round(totalBOMCost * 1.05)); };
        if (set70Btn && input) set70Btn.onclick = () => { input.value = String(Math.round((plan.totalIncome || 0) * 0.7)); };
      },
      inputValidator: (val) => {
        if (!val || Number(val) < 0) {
          return 'Please enter a valid non-negative number';
        }
        return null;
      }
    });

    if (newBudgetStr !== undefined) {
      const parsedTarget = parseFloat(newBudgetStr);
      try {
        const res = await apiPut(`/api/purchase/mrp/plan/${plan._id}/target-expense`, { targetExpense: parsedTarget }, token);
        if (res.plan && onPlanUpdated) {
          onPlanUpdated(res.plan);
        }
        Swal.fire({
          icon: 'success',
          title: 'Budget Ceiling Saved',
          text: `Target budget set to ₹${parsedTarget.toLocaleString('en-IN')}`,
          timer: 2000,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to update target budget', 'error');
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <IndianRupee size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  {plan.mrpNumber || 'MRP Plan'}
                </span>
                
                {/* Health Status Badge */}
                {budgetStatus === 'Over Budget' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    <span>🚨 Over Budget</span>
                  </span>
                ) : budgetStatus === 'Near Limit' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>⚠️ Near Limit (85-100%)</span>
                  </span>
                ) : budgetStatus === 'Within Budget' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 size={12} />
                    <span>✅ Within Budget</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    Budget Unset
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5 truncate">
                <span>Financial Intelligence & Budget Guard</span>
                <Sparkles size={14} className="text-amber-500 shrink-0" />
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Over-Budget Alert Banner */}
          {isOverBudget && (
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl p-3 flex items-start gap-3">
              <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-rose-800 dark:text-rose-200">
                <strong className="font-black text-rose-900 dark:text-rose-100">Budget Overrun Alert:</strong> Committed Purchase Orders (<strong>₹{committedExpense.toLocaleString('en-IN')}</strong>) have exceeded the target budget ceiling (<strong>₹{targetExpense.toLocaleString('en-IN')}</strong>) by <strong className="underline">₹{overrunAmount.toLocaleString('en-IN')}</strong> ({budgetUsagePct}% of budget utilized).
              </div>
            </div>
          )}

          {/* 4 Financial KPI Blocks */}
          <div className="grid grid-cols-2 gap-3">
            {/* Metric 1: Total Revenue */}
            <div className="bg-slate-50/80 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Projected Revenue</span>
                <TrendingUp size={12} className="text-emerald-500" />
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                ₹{totalIncome.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                {plan.customerPoNumber || plan.customerPOs?.length ? 'From Customer PO line rates' : 'From FG Selling Prices'}
              </span>
            </div>

            {/* Metric 2: Estimated Material Shortage Cost */}
            <div className="bg-slate-50/80 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Est. Shortage Cost</span>
                <Wallet size={12} className="text-slate-400" />
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-slate-800 dark:text-slate-100 mt-1">
                ₹{totalEstExpense.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                Gross Material: ₹{totalGrossCost.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Metric 3: Committed PO Spend */}
            <div className="bg-slate-50/80 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Committed PO Spend</span>
                <ArrowUpRight size={12} className={isOverBudget ? 'text-rose-500' : 'text-indigo-500'} />
              </div>
              <div className={`text-lg sm:text-xl font-black font-mono mt-1 ${
                isOverBudget ? 'text-rose-600' : 'text-indigo-600 dark:text-indigo-400'
              }`}>
                ₹{committedExpense.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                {targetExpense > 0 ? `${budgetUsagePct}% of Target Budget` : 'Outward POs issued'}
              </span>
            </div>

            {/* Metric 4: Target Ceiling & Projected Margin */}
            <div className="bg-slate-50/80 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Budget</span>
                <span className="text-[10px] font-bold text-emerald-600">Margin: {marginPct.toFixed(1)}%</span>
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-purple-600 dark:text-purple-400 mt-1">
                {targetExpense > 0 ? `₹${targetExpense.toLocaleString('en-IN')}` : 'Not Set'}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                Est. Profit: ₹{profit.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Visual Budget Progress Bar */}
          {targetExpense > 0 && (
            <div className="bg-slate-50/80 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300">
                  Budget Utilization: <strong className="font-mono text-slate-900 dark:text-white">₹{committedExpense.toLocaleString('en-IN')}</strong> / <span className="font-mono text-slate-400">₹{targetExpense.toLocaleString('en-IN')}</span>
                </span>
                <span className={`font-mono font-bold ${
                  isOverBudget ? 'text-rose-600 font-black' : committedExpense >= targetExpense * 0.85 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {budgetUsagePct}% {isOverBudget ? '(OVER LIMIT)' : ''}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOverBudget 
                      ? 'bg-rose-500' 
                      : committedExpense >= targetExpense * 0.85 
                      ? 'bg-amber-500' 
                      : 'bg-gradient-to-r from-emerald-500 to-indigo-500'
                  }`}
                  style={{ width: `${Math.min(100, (committedExpense / targetExpense) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Cost Reference Card */}
          <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                <Layers size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span>BOM Cost Baseline</span>
              </div>
              <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 text-xs">
                Total BOM: ₹{totalBOMCost.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex justify-between items-center">
                <span className="text-slate-500">Raw Material (RM):</span>
                <strong className="font-mono text-slate-800 dark:text-slate-200">₹{rmCost.toLocaleString('en-IN')}</strong>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex justify-between items-center">
                <span className="text-slate-500">Bought Out (BO):</span>
                <strong className="font-mono text-slate-800 dark:text-slate-200">₹{boCost.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <button
            type="button"
            onClick={handleUpdateTargetExpense}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Target size={13} />
            <span>{targetExpense > 0 ? 'Edit Budget Ceiling' : '+ Set Target Budget'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
