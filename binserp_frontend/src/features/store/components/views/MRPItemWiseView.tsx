"use client";

import React, { useState, useMemo } from 'react';
import { 
  Package, Eye, Calendar, Building2, Layers, CheckCircle2, 
  Clock, ArrowUpDown, ExternalLink, FileText, CheckCircle, 
  ShoppingBag, Truck, Info, FileCheck, X, Search, ChevronRight,
  TrendingUp, AlertCircle
} from 'lucide-react';

export interface MRPItemWiseViewProps {
  mrpPlans: any[];
  fgItems?: any[];
  onViewPlanDetails: (plan: any) => void;
  searchTerm?: string;
  filterStatus?: string;
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

export default function MRPItemWiseView({
  mrpPlans = [],
  fgItems = [],
  onViewPlanDetails,
  searchTerm = '',
  filterStatus = 'All'
}: MRPItemWiseViewProps) {
  const [selectedItemForPreview, setSelectedItemForPreview] = useState<AggregatedMRPItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Aggregate FG items across all MRP plans
  const aggregatedItems: AggregatedMRPItem[] = useMemo(() => {
    const itemMap = new Map<string, AggregatedMRPItem>();

    (Array.isArray(mrpPlans) ? mrpPlans : []).forEach((plan) => {
      const planFgItems = Array.isArray(plan.fgItems) ? plan.fgItems : [];

      planFgItems.forEach((it: any) => {
        const fgObj = it.fgItem && typeof it.fgItem === 'object' ? it.fgItem : null;
        const fgId = fgObj?._id?.toString() || (typeof it.fgItem === 'string' && it.fgItem ? it.fgItem : null);
        const rawName = (it.fgItemName || fgObj?.name || it.name || it.productName || 'Finished Good').trim();
        const key = fgId || `name_${rawName.toLowerCase()}`;

        const desc = it.description || it.descriptions || fgObj?.description || fgObj?.descriptions || '';
        const unit = it.unit || fgObj?.unit || 'PCS';
        const planned = Number(it.quantity || it.plannedQuantity || 0);
        const received = Number(it.receivedQuantity || it.grnQuantity || it.completedQuantity || 0);
        const balance = Math.max(0, planned - received);

        const committedDate = it.committedDate || plan.committedDate || plan.committedDeliveryDate || it.poDeliveryDate;
        const targetDate = it.targetDate || plan.targetDate || plan.deliveryDate;
        const poDate = it.poDate || plan.poDate || plan.date || plan.createdAt;

        const linkedPlan: LinkedPlanEntry = {
          plan,
          planId: (plan._id || plan.mrpNumber)?.toString(),
          mrpNumber: plan.mrpNumber || 'MRP-N/A',
          customerName: plan.customerName || 'Internal Demand',
          customerPoNumber: plan.customerPoNumber,
          planDate: plan.planDate || plan.date || plan.createdAt,
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
      
      // Calculate earliest committed date
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
  }, [mrpPlans]);

  // Filter items by search term and status tab
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
    <div className="space-y-4">
      {/* KPI Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total FG Items</span>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
            {metrics.totalItems} <span className="text-xs font-normal text-slate-400">products</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500">Total Planned Demand</span>
          <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
            {metrics.totalPlanned.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600">Total GRN Received</span>
          <div className="text-xl font-black text-teal-600 dark:text-teal-400 font-mono mt-0.5">
            {metrics.totalReceived.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Fulfillment Rate</span>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            {metrics.overallRate}% <span className="text-xs font-normal text-slate-400">completed</span>
          </div>
        </div>
      </div>

      {/* Secondary Filter Row: Status Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'all' 
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Demand Items ({aggregatedItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'pending' 
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-bold shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pending Fulfillment
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'completed' 
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Fulfilled
            </button>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <b>{filteredItems.length}</b> of <b>{aggregatedItems.length}</b> items
        </div>
      </div>

      {/* Standard Table View */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <Package className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Demand Items Found</h3>
            <p className="text-xs text-slate-500 mt-1">No finished good items match the current search or status filter.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
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

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
              {filteredItems.map((item) => (
                <div
                  key={`mob-${item.id}`}
                  onClick={() => setSelectedItemForPreview(item)}
                  className="p-4 space-y-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
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
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs"
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
