"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Calendar, Search, Filter, RotateCcw, Eye, Printer, Layers, 
  CheckCircle2, Clock, ChevronDown, ArrowRight, Building2, 
  Boxes, Package, IndianRupee, Download, Sparkles, X, AlertCircle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { apiPut } from '@/src/lib/api';
import { isSpaceFreeMatch } from '@/src/utils/spaceFreeSearchHelper';

interface MRPHistoryViewProps {
  mrpPlans: any[];
  token: string;
  onRefresh: () => void;
  onViewDetails: (plan: any) => void;
  onOpenDrawer?: (planId: string) => void;
}

export default function MRPHistoryView({
  mrpPlans,
  token,
  onRefresh,
  onViewDetails,
  onOpenDrawer
}: MRPHistoryViewProps) {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [dateType, setDateType] = useState<'completedAt' | 'createdAt'>('completedAt');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | '7days' | 'thisMonth' | 'lastMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setIsDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter completed plans only
  const completedPlans = useMemo(() => {
    return (Array.isArray(mrpPlans) ? mrpPlans : []).filter(
      (p) => p.status === 'Completed'
    );
  }, [mrpPlans]);

  // Date match helper
  const matchesDate = (rawDate: any, preset: string, start: string, end: string) => {
    if (preset === 'all' && !start && !end) return true;
    if (!rawDate) return false;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return false;

    const today = new Date();
    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    if (preset === 'today') {
      return isSameDay(d, today);
    } else if (preset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      return isSameDay(d, yesterday);
    } else if (preset === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return d >= sevenDaysAgo && d <= today;
    } else if (preset === 'thisMonth') {
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    } else if (preset === 'lastMonth') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      return d >= lastMonth && d <= endLastMonth;
    } else if (preset === 'custom' || start || end) {
      if (start && end) {
        const s = new Date(start);
        s.setHours(0, 0, 0, 0);
        const e = new Date(end);
        e.setHours(23, 59, 59, 999);
        return d >= s && d <= e;
      } else if (start) {
        const s = new Date(start);
        s.setHours(0, 0, 0, 0);
        return d >= s;
      } else if (end) {
        const e = new Date(end);
        e.setHours(23, 59, 59, 999);
        return d <= e;
      }
    }
    return true;
  };

  // Filtered Completed Plans
  const filteredPlans = useMemo(() => {
    return completedPlans.filter((p) => {
      // 1. Text Search
      if (searchTerm && searchTerm.trim()) {
        const s = searchTerm.trim();
        const mrpMatch = isSpaceFreeMatch(p.mrpNumber, s);
        const poMatch = isSpaceFreeMatch(p.customerPoNumber, s);
        const custMatch = isSpaceFreeMatch(p.customerName, s);
        const fgMatch = (p.fgItems || []).some((fg: any) =>
          isSpaceFreeMatch(fg.fgItemName || fg.name, s) ||
          isSpaceFreeMatch(fg.description, s)
        );
        if (!mrpMatch && !poMatch && !custMatch && !fgMatch) return false;
      }

      // 2. Date Filter
      const targetDateField = dateType === 'completedAt' 
        ? (p.completedAt || p.updatedAt) 
        : (p.createdAt || p.poDate);

      return matchesDate(targetDateField, datePreset, startDate, endDate);
    });
  }, [completedPlans, searchTerm, dateType, datePreset, startDate, endDate]);

  // Overall KPIs
  const kpis = useMemo(() => {
    let totalFGUnits = 0;
    let totalBudget = 0;
    const now = new Date();
    let completedThisMonth = 0;

    filteredPlans.forEach((p) => {
      (p.fgItems || []).forEach((fg: any) => {
        totalFGUnits += Number(fg.quantity || 0);
      });
      totalBudget += Number(p.totalTargetBudget || p.targetExpense || p.totalEstimatedCost || 0);

      const compDate = new Date(p.completedAt || p.updatedAt);
      if (!isNaN(compDate.getTime()) && compDate.getMonth() === now.getMonth() && compDate.getFullYear() === now.getFullYear()) {
        completedThisMonth++;
      }
    });

    return {
      count: filteredPlans.length,
      totalFGUnits,
      totalBudget,
      completedThisMonth
    };
  }, [filteredPlans]);

  // Reopen Plan Handler (Move from History back to Active Plans)
  const handleReopenPlan = async (plan: any) => {
    const { value: remarks } = await Swal.fire({
      title: 'Reopen MRP Plan?',
      text: `Reopening MRP #${plan.mrpNumber} will move it back to Active Demand Plans with status 'In Production'.`,
      icon: 'question',
      input: 'text',
      inputPlaceholder: 'Enter reason for reopening (optional)',
      showCancelButton: true,
      confirmButtonText: 'Yes, Reopen Plan',
      confirmButtonColor: '#4f46e5',
      cancelButtonText: 'Cancel'
    });

    if (remarks !== undefined) {
      try {
        await apiPut(
          `/api/purchase/mrp/plan/${plan._id}/status`,
          { status: 'In Production', remarks: remarks || 'Reopened from MRP History' },
          token
        );
        Swal.fire({
          icon: 'success',
          title: 'MRP Plan Reopened!',
          text: `MRP #${plan.mrpNumber} is now active in MRP Demand Plans.`,
          timer: 2000
        });
        onRefresh();
      } catch (err: any) {
        Swal.fire({
          icon: 'error',
          title: 'Action Failed',
          text: err.message || 'Failed to reopen MRP plan'
        });
      }
    }
  };

  const isFilterActive = datePreset !== 'all' || startDate !== '' || endDate !== '' || searchTerm !== '';

  const resetFilters = () => {
    setSearchTerm('');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
  };

  const formatPresetLabel = (preset: string) => {
    switch (preset) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case '7days': return 'Last 7 Days';
      case 'thisMonth': return 'This Month';
      case 'lastMonth': return 'Last Month';
      case 'custom': return 'Custom Range';
      default: return 'All Dates';
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-3">
      {/* 1. KPI SUMMARY STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Completed Plans</div>
            <div className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              {kpis.count} <span className="text-xs font-normal text-slate-400">/ {completedPlans.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Boxes size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">FG Units Completed</div>
            <div className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              {kpis.totalFGUnits.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Calendar size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">This Month Done</div>
            <div className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              {kpis.completedThisMonth}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <IndianRupee size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Realized Budget</div>
            <div className="text-lg font-black text-slate-900 dark:text-white leading-tight truncate">
              {kpis.totalBudget > 0 ? `₹${kpis.totalBudget.toLocaleString('en-IN')}` : '₹0'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. DATE-WISE FILTER & SEARCH TOOLBAR */}
      <div className="shrink-0 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          {/* Search Box */}
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by MRP #, PO #, Customer, FG Item..."
              className="w-full pl-9 pr-7 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Date Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Target Date Field Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDateType('completedAt')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                dateType === 'completedAt'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Completed Date
            </button>
            <button
              type="button"
              onClick={() => setDateType('createdAt')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                dateType === 'createdAt'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Plan Date
            </button>
          </div>

          {/* Date Range Dropdown */}
          <div className="relative" ref={dateDropdownRef}>
            <button
              type="button"
              onClick={() => setIsDateDropdownOpen(prev => !prev)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                datePreset !== 'all' || startDate || endDate
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
              }`}
            >
              <Calendar size={13} className="text-indigo-500 shrink-0" />
              <span>
                {datePreset === 'custom' && startDate && endDate
                  ? `${startDate} → ${endDate}`
                  : formatPresetLabel(datePreset)}
              </span>
              <ChevronDown size={12} className={`text-slate-400 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDateDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-3 space-y-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-slate-800">
                  Select Date Range
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {(['all', 'today', 'yesterday', '7days', 'thisMonth', 'lastMonth'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setDatePreset(preset);
                        setStartDate('');
                        setEndDate('');
                        setIsDateDropdownOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-all ${
                        datePreset === preset && !startDate && !endDate
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {formatPresetLabel(preset)}
                    </button>
                  ))}
                </div>

                {/* Custom Date Pickers */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Range</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">From</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setDatePreset('custom');
                        }}
                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">To</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setDatePreset('custom');
                        }}
                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset('all');
                      setStartDate('');
                      setEndDate('');
                      setIsDateDropdownOpen(false);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDateDropdownOpen(false)}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reset All Filters Button */}
          {isFilterActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. COMPLETED PLANS TABLE / LIST */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
        {filteredPlans.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isFilterActive ? 'No Completed Plans Match Filter' : 'No Completed MRP Plans Yet'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {isFilterActive 
                  ? 'Try expanding your date range or clearing your search criteria.'
                  : 'Plans marked as Completed via full FG GRN receipts or manual completion will be archived here.'}
              </p>
            </div>
            {isFilterActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredPlans.map((plan) => {
              const compDate = plan.completedAt || plan.updatedAt;
              const formattedCompDate = compDate 
                ? new Date(compDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'N/A';
              const formattedPlanDate = plan.createdAt 
                ? new Date(plan.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'N/A';

              const fgList = Array.isArray(plan.fgItems) ? plan.fgItems : [];
              const totalFgUnits = fgList.reduce((acc: number, f: any) => acc + (Number(f.quantity) || 0), 0);
              const totalFgReceived = fgList.reduce((acc: number, f: any) => acc + (Number(f.receivedQuantity) || 0), 0);
              const budgetVal = Number(plan.totalTargetBudget || plan.targetExpense || plan.totalEstimatedCost || 0);

              return (
                <div 
                  key={plan._id} 
                  className="p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3.5"
                >
                  {/* Left Column: MRP Number, Customer PO, Customer Name */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                        {plan.mrpNumber}
                      </span>
                      {plan.isConsolidated && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Consolidated Batch
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={11} />
                        Completed
                      </span>
                    </div>

                    {/* Customer & PO References */}
                    <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                      {plan.customerPoNumber && (
                        <span className="flex items-center gap-1 font-medium">
                          <span className="text-slate-400">PO:</span> 
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{plan.customerPoNumber}</span>
                        </span>
                      )}
                      {plan.customerName && (
                        <span className="flex items-center gap-1">
                          <Building2 size={12} className="text-slate-400" />
                          <span className="truncate max-w-[220px]">{plan.customerName}</span>
                        </span>
                      )}
                    </div>

                    {/* Finished Goods Items List (Strict Workspace Rule: Item Name & Technical Description) */}
                    <div className="pt-1 space-y-1">
                      {fgList.slice(0, 3).map((fg: any, idx: number) => {
                        const name = fg.fgItemName || fg.name || (typeof fg.fgItem === 'object' ? fg.fgItem?.name : '') || 'Finished Good';
                        const desc = fg.description || (typeof fg.fgItem === 'object' ? fg.fgItem?.description || fg.fgItem?.descriptions : '') || '';
                        const qty = Number(fg.quantity || 0);
                        const rcvQty = Number(fg.receivedQuantity || 0);

                        return (
                          <div key={idx} className="text-xs bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {name}
                              </span>
                              <span className="shrink-0 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                {rcvQty > 0 ? `${rcvQty} / ` : ''}{qty} {fg.unit || 'PCS'}
                              </span>
                            </div>
                            {desc && (
                              <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                {desc}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {fgList.length > 3 && (
                        <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                          + {fgList.length - 3} more Finished Goods item(s)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Dates, Financials & Actions */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-right space-y-1">
                      <div className="text-xs flex items-center md:justify-end gap-1.5 text-slate-500">
                        <Clock size={12} className="text-emerald-500" />
                        <span>Completed: <b className="text-slate-800 dark:text-slate-200 font-semibold">{formattedCompDate}</b></span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Planned on: {formattedPlanDate}
                      </div>
                      {budgetVal > 0 && (
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Budget: <span className="font-mono text-indigo-600 dark:text-indigo-400">₹{budgetVal.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onViewDetails(plan)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        title="View Full MRP Demand Plan Details"
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </button>

                      {onOpenDrawer && (
                        <button
                          type="button"
                          onClick={() => onOpenDrawer(plan._id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          title="Open 360° WIP & Receipt Tracker"
                        >
                          <Layers size={13} />
                          <span>360° WIP</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleReopenPlan(plan)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        title="Reopen Plan and move back to Active MRP Demand Plans"
                      >
                        <RotateCcw size={13} />
                        <span>Reopen</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
