"use client";

import React, { useState, useMemo } from 'react';
import { 
  Package, Eye, Calendar, Building2, Layers, CheckCircle2, 
  Clock, ArrowUpDown, ExternalLink, FileText, CheckCircle, 
  ShoppingBag, Truck, Info, FileCheck, X, Search, ChevronRight,
  TrendingUp, AlertCircle, ChevronUp, LayoutGrid
} from 'lucide-react';

export interface MRPItemWiseViewProps {
  mrpPlans: any[];
  fgItems?: any[];
  onViewPlanDetails: (plan: any) => void;
  searchTerm?: string;
  filterStatus?: string;
  selectedStatuses?: string[];
  planDateFilter?: string;
  planStartDate?: string;
  planEndDate?: string;
  commitDateFilter?: string;
  commitStartDate?: string;
  commitEndDate?: string;
  onResetFilters?: () => void;
  showDashboard?: boolean;
  onToggleDashboard?: () => void;
}

interface LinkedPlanEntry {
  plan: any;
  planId: string;
  mrpNumber: string;
  customerName: string;
  customerPoNumber?: string;
  planDate?: string;
  poDate?: string;
  committedDate?: string;
  targetDate?: string;
  plannedQty: number;
  receivedQty: number;
  balanceQty: number;
  unit: string;
  bomNumber?: string;
  status: string;
}

interface AggregatedMRPItem {
  id: string;
  name: string;
  description: string;
  unit: string;
  totalPlannedQty: number;
  totalReceivedQty: number;
  totalBalanceQty: number;
  planCount: number;
  linkedPlans: LinkedPlanEntry[];
  fulfillmentRate: number;
  earliestCommittedDate?: string;
  latestTargetDate?: string;
}

// Date preset matching helper
const matchDatePreset = (
  rawDate: any,
  preset: string = 'all',
  customStart?: string,
  customEnd?: string
) => {
  if (!preset || preset === 'all') return true;
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
  } else if (preset === 'next7days') {
    const nextSevenDays = new Date();
    nextSevenDays.setDate(today.getDate() + 7);
    nextSevenDays.setHours(23, 59, 59, 999);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return d >= startOfToday && d <= nextSevenDays;
  } else if (preset === 'thisMonth') {
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  } else if (preset === 'custom') {
    if (customStart && customEnd) {
      const s = new Date(customStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customEnd);
      e.setHours(23, 59, 59, 999);
      return d >= s && d <= e;
    } else if (customStart) {
      const s = new Date(customStart);
      return isSameDay(d, s) || d >= s;
    } else if (customEnd) {
      const e = new Date(customEnd);
      return isSameDay(d, e) || d <= e;
    }
  }
  return true;
};

export default function MRPItemWiseView({
  mrpPlans = [],
  fgItems = [],
  onViewPlanDetails,
  searchTerm = '',
  filterStatus = 'All',
  selectedStatuses = [],
  planDateFilter = 'all',
  planStartDate = '',
  planEndDate = '',
  commitDateFilter = 'all',
  commitStartDate = '',
  commitEndDate = '',
  onResetFilters,
  showDashboard: showDashboardProp,
  onToggleDashboard
}: MRPItemWiseViewProps) {
  const [internalShowDashboard, setInternalShowDashboard] = useState<boolean>(false);
  const isDashboardVisible = showDashboardProp !== undefined ? showDashboardProp : internalShowDashboard;
  const handleToggleDashboard = onToggleDashboard || (() => setInternalShowDashboard(prev => !prev));

  const [selectedItemForPreview, setSelectedItemForPreview] = useState<AggregatedMRPItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Check if any filter is active
  const isAnyFilterActive = Boolean(
    (selectedStatuses && selectedStatuses.length > 0) ||
    (planDateFilter && planDateFilter !== 'all') ||
    Boolean(planStartDate || planEndDate) ||
    (commitDateFilter && commitDateFilter !== 'all') ||
    Boolean(commitStartDate || commitEndDate) ||
    searchTerm
  );

  // Aggregate FG items dynamically across filtered MRP plans
  const aggregatedItems: AggregatedMRPItem[] = useMemo(() => {
    const itemMap = new Map<string, AggregatedMRPItem>();

    (Array.isArray(mrpPlans) ? mrpPlans : []).forEach((plan) => {
      // Status check on plan level
      if (selectedStatuses && selectedStatuses.length > 0 && !selectedStatuses.includes(plan.status)) {
        return;
      }

      // Plan Date filter check on plan level
      const planDateVal = plan.createdAt || plan.planDate || plan.date;
      if (planDateFilter && planDateFilter !== 'all' && !matchDatePreset(planDateVal, planDateFilter, planStartDate, planEndDate)) {
        return;
      }

      const planFgItems = Array.isArray(plan.fgItems) ? plan.fgItems : [];

      planFgItems.forEach((it: any) => {
        // Committed Date filter check on item level (or plan level fallback)
        const committedDate = it.committedDate || it.poDeliveryDate || it.targetDate || plan.committedDate || plan.targetDate || plan.committedDeliveryDate;
        if (commitDateFilter && commitDateFilter !== 'all' && !matchDatePreset(committedDate, commitDateFilter, commitStartDate, commitEndDate)) {
          return;
        }

        const fgObj = it.fgItem && typeof it.fgItem === 'object' ? it.fgItem : null;
        const fgId = (fgObj?._id || (typeof it.fgItem === 'string' ? it.fgItem : null) || it._id || '')?.toString();
        const isPlaceholder = (n: string) => !n || n.toLowerCase().trim() === 'finished good' || n.toLowerCase().trim() === 'finish goods' || n.toLowerCase().trim() === 'finished goods';
        const rawName = (fgObj?.name || (!isPlaceholder(it.fgItemName) ? it.fgItemName : '') || it.name || it.productName || fgObj?.code || 'FG Item').trim();
        const key = fgId || `name_${rawName.toLowerCase()}`;

        const desc = it.description || it.descriptions || fgObj?.description || fgObj?.descriptions || '';
        const unit = it.unit || fgObj?.unit || 'PCS';
        const planned = Number(it.quantity || it.plannedQuantity || 0);
        const received = Number(it.receivedQuantity || it.grnQuantity || it.completedQuantity || 0);
        const balance = Math.max(0, planned - received);

        const targetDate = it.targetDate || plan.targetDate || plan.deliveryDate;
        const poDate = it.poDate || plan.poDate || plan.date || plan.createdAt;

        const linkedPlan: LinkedPlanEntry = {
          plan,
          planId: (plan._id || plan.mrpNumber)?.toString(),
          mrpNumber: plan.mrpNumber || 'MRP-N/A',
          customerName: plan.customerName || 'Internal Demand',
          customerPoNumber: plan.customerPoNumber,
          planDate: planDateVal,
          poDate,
          committedDate,
          targetDate,
          plannedQty: planned,
          receivedQty: received,
          balanceQty: balance,
          unit,
          bomNumber: it.bomNumber,
          status: plan.status || 'Planned'
        };

        if (itemMap.has(key)) {
          const entry = itemMap.get(key)!;
          entry.totalPlannedQty += planned;
          entry.totalReceivedQty += received;
          entry.totalBalanceQty += balance;
          entry.planCount += 1;
          entry.linkedPlans.push(linkedPlan);
          if (!entry.description && desc) entry.description = desc;
        } else {
          itemMap.set(key, {
            id: key,
            name: rawName,
            description: desc,
            unit,
            totalPlannedQty: planned,
            totalReceivedQty: received,
            totalBalanceQty: balance,
            planCount: 1,
            linkedPlans: [linkedPlan],
            fulfillmentRate: 0,
            earliestCommittedDate: committedDate,
            latestTargetDate: targetDate
          });
        }
      });
    });

    return Array.from(itemMap.values()).map((item) => {
      const rate = item.totalPlannedQty > 0 
        ? Math.min(100, Math.round((item.totalReceivedQty / item.totalPlannedQty) * 100)) 
        : 0;
      
      // Calculate earliest committed date among the matching linked plans
      const committedDates = item.linkedPlans
        .map(lp => lp.committedDate)
        .filter(Boolean)
        .map(d => new Date(d!).getTime())
        .filter(t => !isNaN(t));

      const earliestDate = committedDates.length > 0 
        ? new Date(Math.min(...committedDates)).toISOString() 
        : undefined;

      return { 
        ...item, 
        fulfillmentRate: rate,
        earliestCommittedDate: earliestDate
      };
    });
  }, [mrpPlans, selectedStatuses, planDateFilter, planStartDate, planEndDate, commitDateFilter, commitStartDate, commitEndDate]);

  // Filter items by search term and secondary status tab
  const filteredItems = useMemo(() => {
    return aggregatedItems.filter((item) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q) ||
        item.linkedPlans.some(lp => 
          lp.mrpNumber.toLowerCase().includes(q) || 
          lp.customerName.toLowerCase().includes(q) ||
          (lp.customerPoNumber && lp.customerPoNumber.toLowerCase().includes(q))
        );

      if (!matchesSearch) return false;

      if (statusFilter === 'pending') {
        if (item.totalBalanceQty <= 0) return false;
      } else if (statusFilter === 'completed') {
        if (item.totalBalanceQty > 0) return false;
      }

      return true;
    });
  }, [aggregatedItems, searchTerm, statusFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalItems = aggregatedItems.length;
    const totalPlanned = aggregatedItems.reduce((acc, it) => acc + it.totalPlannedQty, 0);
    const totalReceived = aggregatedItems.reduce((acc, it) => acc + it.totalReceivedQty, 0);
    const overallRate = totalPlanned > 0 ? Math.min(100, Math.round((totalReceived / totalPlanned) * 100)) : 0;
    return { totalItems, totalPlanned, totalReceived, overallRate };
  }, [aggregatedItems]);

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden gap-2 sm:gap-2.5">
      {/* KPI Cards Banner (Collapsible Dashboard for Items - Hidden by Default) */}
      {isDashboardVisible && (
        <div className="shrink-0 space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Finished Goods Demand Overview
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">
                ({metrics.totalItems} Products)
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleDashboard}
              className="px-2 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-slate-200 dark:border-slate-700"
              title="Hide Demand Metrics"
            >
              <ChevronUp size={13} />
              <span>Hide</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 sm:p-2.5 rounded-xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400 block">Total FG Items</span>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono leading-tight mt-0.5">
                  {metrics.totalItems} <span className="text-[10px] font-normal text-slate-400">products</span>
                </div>
              </div>
              <Package className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 sm:p-2.5 rounded-xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-indigo-500 block">Total Planned</span>
                <div className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono leading-tight mt-0.5">
                  {metrics.totalPlanned.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">units</span>
                </div>
              </div>
              <Layers className="w-5 h-5 text-indigo-300 dark:text-indigo-600 shrink-0" />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 sm:p-2.5 rounded-xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-teal-600 block">GRN Received</span>
                <div className="text-base sm:text-lg font-black text-teal-600 dark:text-teal-400 font-mono leading-tight mt-0.5">
                  {metrics.totalReceived.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">units</span>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-teal-300 dark:text-teal-600 shrink-0" />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 sm:p-2.5 rounded-xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-600 block">Fulfillment</span>
                <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono leading-tight mt-0.5">
                  {metrics.overallRate}% <span className="text-[10px] font-normal text-slate-400">completed</span>
                </div>
              </div>
              <Truck className="w-5 h-5 text-emerald-300 dark:text-emerald-600 shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* Secondary Filter Row: Status Tabs (PINNED - Compact) */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                statusFilter === 'all' 
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Demand Items ({aggregatedItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                statusFilter === 'pending' 
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-bold shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pending Fulfillment
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                statusFilter === 'completed' 
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Fulfilled
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold text-slate-500">
            Showing <b>{filteredItems.length}</b> of <b>{aggregatedItems.length}</b> items
          </div>
          <button
            type="button"
            onClick={handleToggleDashboard}
            className={`px-2 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
              isDashboardVisible
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-2xs'
                : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title={isDashboardVisible ? "Hide Items KPI Dashboard" : "Show Items KPI Dashboard"}
          >
            <LayoutGrid size={12} className={isDashboardVisible ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"} />
            <span className="hidden sm:inline">{isDashboardVisible ? "Hide Stats" : "Show Stats"}</span>
          </button>
        </div>
      </div>

      {/* Standard Table View Container */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {filteredItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4">
            <Package className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Demand Items Found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">No finished good items match the selected status or date filters.</p>
            {onResetFilters && isAnyFilterActive && (
              <button
                type="button"
                onClick={onResetFilters}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (ONLY TABLE SCROLLS) */}
            <div className="hidden md:block flex-1 min-h-0 overflow-y-auto overflow-x-auto scroll-smooth">
              <table className="w-full min-w-[900px] text-sm text-left">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 shadow-2xs backdrop-blur-xs">
                  <tr>
                    <th className="px-4 py-3.5 text-center w-12">#</th>
                    <th className="px-4 py-3.5">Finished Good Name & Description</th>
                    <th className="px-4 py-3.5 text-center">Unit</th>
                    <th className="px-4 py-3.5 text-right">Total Planned</th>
                    <th className="px-4 py-3.5 text-right">GRN Received</th>
                    <th className="px-4 py-3.5 text-right">Balance</th>
                    <th className="px-4 py-3.5 text-center">MRP Plans</th>
                    <th className="px-4 py-3.5 text-center">Committed Date</th>
                    <th className="px-4 py-3.5 text-center">Fulfillment</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItemForPreview(item)}
                      className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Strict Workspace Rule: Item Name & Technical Description */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {item.name || "Finished Good"}
                        </div>
                        {item.description ? (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-1">
                            {item.description}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">
                            No technical description
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {item.unit}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                        {item.totalPlannedQty.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-teal-600 dark:text-teal-400 text-xs sm:text-sm">
                        {item.totalReceivedQty.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 text-xs sm:text-sm">
                        {item.totalBalanceQty.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          <Layers size={12} /> {item.planCount} {item.planCount === 1 ? 'Plan' : 'Plans'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {item.earliestCommittedDate ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/40">
                            <Clock size={11} /> {new Date(item.earliestCommittedDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {item.totalBalanceQty === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 size={10} /> Fulfilled
                          </span>
                        ) : item.totalReceivedQty > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Truck size={10} /> {item.fulfillmentRate}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <Clock size={10} /> Planned
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItemForPreview(item);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap"
                        >
                          <Eye size={13} /> Preview
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dedicated Native Mobile Cards View */}
            <div className="md:hidden flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredItems.map((item) => (
                <div
                  key={`mob-${item.id}`}
                  onClick={() => setSelectedItemForPreview(item)}
                  className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-xs hover:border-indigo-300 active:scale-[0.99] transition-all cursor-pointer space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {/* Strict Workspace Rule: Item Name on primary line, description in subtle italic below */}
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {item.name || "Finished Good"}
                      </div>
                      {item.description && (
                        <div className="text-[11px] text-slate-500 italic line-clamp-2 mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shrink-0">
                      {item.planCount} Plan{item.planCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-400">Planned</div>
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.totalPlannedQty} {item.unit}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-teal-600">Received</div>
                      <div className="font-mono font-bold text-teal-600 dark:text-teal-400">{item.totalReceivedQty} {item.unit}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-amber-600">Balance</div>
                      <div className="font-mono font-bold text-amber-600 dark:text-amber-400">{item.totalBalanceQty} {item.unit}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {item.totalBalanceQty === 0 ? "Fully Fulfilled" : `${item.fulfillmentRate}% Received`}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItemForPreview(item);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs cursor-pointer"
                    >
                      <Eye size={12} /> View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Clickable Preview Modal: Shows All Details & Linked MRP Plans for Selected Item */}
      {selectedItemForPreview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                  <Package size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>{selectedItemForPreview.name}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-normal border border-indigo-500/30">
                      {selectedItemForPreview.planCount} MRP Demand Plan{selectedItemForPreview.planCount !== 1 ? 's' : ''}
                    </span>
                  </h2>
                  {selectedItemForPreview.description ? (
                    <p className="text-xs text-slate-400 italic mt-0.5 line-clamp-2">
                      {selectedItemForPreview.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 italic mt-0.5">
                      No technical description
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForPreview(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Active Filter Notice if filters are active */}
              {isAnyFilterActive && (
                <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
                  <Info size={14} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-medium">
                    Showing demand filtered by active criteria ({[
                      selectedStatuses?.length ? `Status: ${selectedStatuses.join(', ')}` : null,
                      planDateFilter !== 'all' ? `Plan Date: ${planDateFilter}` : null,
                      commitDateFilter !== 'all' ? `Committed Date: ${commitDateFilter}` : null,
                      searchTerm ? `Search: "${searchTerm}"` : null
                    ].filter(Boolean).join(' • ')})
                  </span>
                </div>
              )}

              {/* Item Aggregate Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Planned Demand</div>
                  <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                    {selectedItemForPreview.totalPlannedQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">{selectedItemForPreview.unit}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">Total Received (GRN)</div>
                  <div className="text-lg font-black text-teal-600 dark:text-teal-400 font-mono mt-0.5">
                    {selectedItemForPreview.totalReceivedQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">{selectedItemForPreview.unit}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Balance</div>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    {selectedItemForPreview.totalBalanceQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">{selectedItemForPreview.unit}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Fulfillment Status</div>
                  <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                    {selectedItemForPreview.fulfillmentRate}% <span className="text-xs font-normal text-slate-400">Complete</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-500">
                  <span>Demand Fulfillment Progress</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItemForPreview.fulfillmentRate}% Completed</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      selectedItemForPreview.fulfillmentRate === 100 
                        ? 'bg-emerald-500' 
                        : 'bg-gradient-to-r from-indigo-500 to-teal-500'
                    }`}
                    style={{ width: `${selectedItemForPreview.fulfillmentRate}%` }}
                  />
                </div>
              </div>

              {/* Linked MRP Plans Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <span>MRP Demand Plans containing this finished good ({selectedItemForPreview.linkedPlans.length}):</span>
                  </h3>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3.5 py-3">MRP Number</th>
                        <th className="px-3.5 py-3">Customer & PO Ref</th>
                        <th className="px-3.5 py-3 text-center">PO Date</th>
                        <th className="px-3.5 py-3 text-center">Committed Date</th>
                        <th className="px-3.5 py-3 text-right">Planned Qty</th>
                        <th className="px-3.5 py-3 text-right">Received Qty</th>
                        <th className="px-3.5 py-3 text-right">Balance</th>
                        <th className="px-3.5 py-3 text-center">Status</th>
                        <th className="px-3.5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedItemForPreview.linkedPlans.map((lp, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-3.5 py-3">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                              {lp.mrpNumber}
                            </span>
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{lp.customerName}</div>
                            {lp.customerPoNumber && (
                              <div className="text-[10px] text-slate-400 font-mono">PO: {lp.customerPoNumber}</div>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-center text-slate-600 dark:text-slate-400">
                            {lp.poDate ? new Date(lp.poDate).toLocaleDateString() : "-"}
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            {lp.committedDate ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/40">
                                <Clock size={10} /> {new Date(lp.committedDate).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            {lp.plannedQty} {lp.unit}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                            {lp.receivedQty} {lp.unit}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            {lp.balanceQty} {lp.unit}
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {lp.status}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItemForPreview(null);
                                onViewPlanDetails(lp.plan);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition-colors cursor-pointer"
                              title="Open Full MRP Plan Details"
                            >
                              <span>View Plan</span>
                              <ExternalLink size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedItemForPreview(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
