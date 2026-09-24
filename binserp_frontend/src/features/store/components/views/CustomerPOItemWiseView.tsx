"use client";

import React, { useState, useMemo } from 'react';
import { 
  Package, Eye, Calendar, Building2, Layers, CheckCircle2, 
  Clock, ArrowUpDown, ExternalLink, FileText, CheckCircle, 
  ShoppingBag, Truck, Info, FileCheck, X, Search
} from 'lucide-react';
import { getCurrencySymbol } from '@/src/utils/currencyHelper';

export interface CustomerPOItemWiseViewProps {
  poList: any[];
  fgItems?: any[];
  customers?: any[];
  onViewPo: (po: any) => void;
  searchTerm?: string;
  filterCustomer?: string;
}

interface LinkedPoEntry {
  po: any;
  poId: string;
  poNumber: string;
  customerName: string;
  customerId?: string;
  poDate: string;
  currency: string;
  orderedQty: number;
  unit: string;
  rate: number;
  amount: number;
  dispatchedQty: number;
  billedQty: number;
  pendingQty: number;
  expectedDeliveryDate?: string;
  committedDeliveryDate?: string;
  status: string;
}

interface AggregatedItem {
  id: string;
  name: string;
  description: string;
  unit: string;
  fgItemObj?: any;
  totalOrderedQty: number;
  totalDispatchedQty: number;
  totalBilledQty: number;
  totalPendingQty: number;
  totalAmount: number;
  currency: string;
  poCount: number;
  linkedPos: LinkedPoEntry[];
  fulfillmentRate: number;
}

export default function CustomerPOItemWiseView({
  poList,
  fgItems = [],
  customers = [],
  onViewPo,
  searchTerm = '',
  filterCustomer = 'All'
}: CustomerPOItemWiseViewProps) {
  const [selectedItemForPreview, setSelectedItemForPreview] = useState<AggregatedItem | null>(null);
  const [scope, setScope] = useState<'in-po' | 'all'>('in-po');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Aggregate items across all Customer POs and optionally catalog FG items
  const aggregatedItems: AggregatedItem[] = useMemo(() => {
    const itemMap = new Map<string, AggregatedItem>();

    // Preload all FG items from catalog if scope is 'all'
    if (scope === 'all' && Array.isArray(fgItems)) {
      fgItems.forEach((fg) => {
        const fgId = (fg._id || fg.id || '').toString();
        if (!fgId) return;
        itemMap.set(fgId, {
          id: fgId,
          name: fg.name || fg.itemName || 'Finished Good',
          description: fg.description || fg.descriptions || '',
          unit: fg.unit || 'PCS',
          fgItemObj: fg,
          totalOrderedQty: 0,
          totalDispatchedQty: 0,
          totalBilledQty: 0,
          totalPendingQty: 0,
          totalAmount: 0,
          currency: 'INR',
          poCount: 0,
          linkedPos: [],
          fulfillmentRate: 0,
        });
      });
    }

    // Aggregate through PO items
    (Array.isArray(poList) ? poList : []).forEach((po) => {
      if (po.status === 'Cancelled') return;

      const poItems = Array.isArray(po.items) ? po.items : [];
      poItems.forEach((it: any) => {
        const fgObj = it.fgItem && typeof it.fgItem === 'object' ? it.fgItem : null;
        const fgId = fgObj?._id?.toString() || (typeof it.fgItem === 'string' && it.fgItem ? it.fgItem : null);
        const rawName = (it.productName || fgObj?.name || 'Item').trim();
        const key = fgId || `name_${rawName.toLowerCase()}`;

        const desc = it.description || fgObj?.description || fgObj?.descriptions || '';
        const unit = it.unit || fgObj?.unit || 'PCS';
        const ordered = Number(it.quantity || 0);
        const dispatched = Number(it.dispatchedQuantity || 0);
        const billed = Number(it.billedQuantity || 0);
        const rate = Number(it.rate || 0);
        const amount = Number(it.amount || ordered * rate);
        const pending = Math.max(0, ordered - dispatched);

        const linkedPo: LinkedPoEntry = {
          po,
          poId: (po._id || po.poNumber)?.toString(),
          poNumber: po.poNumber || 'N/A',
          customerName: po.customerName || po.customer?.name || po.customer?.companyName || 'Customer',
          customerId: (po.customer?._id || po.customer)?.toString(),
          poDate: po.date || po.createdAt || '',
          currency: po.currency || 'INR',
          orderedQty: ordered,
          unit,
          rate,
          amount,
          dispatchedQty: dispatched,
          billedQty: billed,
          pendingQty: pending,
          expectedDeliveryDate: it.expectedDeliveryDate || it.committedDeliveryDate || po.committedDispatchDate,
          committedDeliveryDate: it.committedDeliveryDate,
          status: po.status || 'Received',
        };

        if (itemMap.has(key)) {
          const entry = itemMap.get(key)!;
          entry.totalOrderedQty += ordered;
          entry.totalDispatchedQty += dispatched;
          entry.totalBilledQty += billed;
          entry.totalPendingQty += pending;
          entry.totalAmount += amount;
          entry.currency = po.currency || entry.currency;
          entry.poCount += 1;
          entry.linkedPos.push(linkedPo);
          if (!entry.description && desc) entry.description = desc;
        } else {
          itemMap.set(key, {
            id: key,
            name: rawName,
            description: desc,
            unit,
            fgItemObj: fgObj,
            totalOrderedQty: ordered,
            totalDispatchedQty: dispatched,
            totalBilledQty: billed,
            totalPendingQty: pending,
            totalAmount: amount,
            currency: po.currency || 'INR',
            poCount: 1,
            linkedPos: [linkedPo],
            fulfillmentRate: 0,
          });
        }
      });
    });

    return Array.from(itemMap.values()).map((item) => {
      const rate = item.totalOrderedQty > 0 
        ? Math.min(100, Math.round((item.totalDispatchedQty / item.totalOrderedQty) * 100)) 
        : 0;
      return { ...item, fulfillmentRate: rate };
    });
  }, [poList, fgItems, scope]);

  // Filter items by search term, customer, and status
  const filteredItems = useMemo(() => {
    return aggregatedItems.filter((item) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q) ||
        item.linkedPos.some(lp => 
          lp.poNumber.toLowerCase().includes(q) || 
          lp.customerName.toLowerCase().includes(q)
        );

      if (!matchesSearch) return false;

      if (filterCustomer !== 'All') {
        const hasCustomerPo = item.linkedPos.some(lp => lp.customerId === filterCustomer);
        if (!hasCustomerPo) return false;
      }

      if (statusFilter === 'pending') {
        if (item.totalPendingQty <= 0 || item.poCount === 0) return false;
      } else if (statusFilter === 'completed') {
        if (item.poCount === 0 || item.totalPendingQty > 0) return false;
      }

      return true;
    });
  }, [aggregatedItems, searchTerm, filterCustomer, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><CheckCircle2 size={10} /> Completed</span>;
      case 'Partially Dispatched':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><Truck size={10} /> Partial</span>;
      case 'Accepted':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"><CheckCircle size={10} /> Accepted</span>;
      case 'MRP Done':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"><Layers size={10} /> MRP Done</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"><Clock size={10} /> {status || 'Received'}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Secondary Filter Row: Scope & Status Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          {/* Status Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            >
              All Items ({aggregatedItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'pending' ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Pending Fulfillment
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'completed' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Fulfilled
            </button>
          </div>
        </div>

        {/* Scope Toggle: Items in POs vs All Finished Goods Catalog */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setScope('in-po')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${scope === 'in-po' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            In Customer POs
          </button>
          <button
            onClick={() => setScope('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${scope === 'all' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            All Catalog FG
          </button>
        </div>
      </div>

      {/* Normal Standard Items Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <Package className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Items Found</h3>
            <p className="text-xs text-slate-500 mt-1">No items match the current search or customer filter.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View - Scrollable with Sticky Header */}
            <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
              <table className="w-full text-sm text-left relative">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                  <tr>
                    <th className="px-4 py-3.5 text-center w-12">#</th>
                    <th className="px-4 py-3.5">Item Name & Description</th>
                    <th className="px-4 py-3.5 text-center">Unit</th>
                    <th className="px-4 py-3.5 text-right">Total Ordered</th>
                    <th className="px-4 py-3.5 text-right">Dispatched</th>
                    <th className="px-4 py-3.5 text-right">Pending</th>
                    <th className="px-4 py-3.5 text-center">In POs</th>
                    <th className="px-4 py-3.5 text-center">Fulfillment</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItemForPreview(item)}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Item Name & Technical Description (Strict Workspace Standard) */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.name || "Unnamed Item"}
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
                        {item.totalOrderedQty.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                        {item.totalDispatchedQty.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 text-xs sm:text-sm">
                        {item.totalPendingQty.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {item.poCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <FileCheck size={12} /> {item.poCount} {item.poCount === 1 ? 'PO' : 'POs'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">0 POs</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {item.poCount === 0 ? (
                          <span className="text-[11px] text-slate-400">No Orders</span>
                        ) : item.totalPendingQty === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 size={10} /> Fulfilled
                          </span>
                        ) : item.totalDispatchedQty > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Truck size={10} /> {item.fulfillmentRate}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            <Clock size={10} /> Pending
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
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap"
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
                        {item.name || "Unnamed Item"}
                      </div>
                      {item.description && (
                        <div className="text-[11px] text-slate-500 italic line-clamp-2 mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shrink-0">
                      {item.poCount} PO{item.poCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-400">Ordered</div>
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.totalOrderedQty} {item.unit}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-emerald-500">Dispatched</div>
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.totalDispatchedQty} {item.unit}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-amber-500">Pending</div>
                      <div className="font-mono font-bold text-amber-600 dark:text-amber-400">{item.totalPendingQty} {item.unit}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {item.totalPendingQty === 0 && item.poCount > 0 ? "Fully Fulfilled" : `${item.fulfillmentRate}% Dispatched`}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItemForPreview(item);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs"
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

      {/* Clickable Preview Modal: Shows All Details & Customer POs for Selected Item */}
      {selectedItemForPreview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                  <Package size={20} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>{selectedItemForPreview.name}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-normal border border-blue-500/30">
                      {selectedItemForPreview.poCount} Customer PO{selectedItemForPreview.poCount !== 1 ? 's' : ''}
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
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Item Aggregate Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Ordered</div>
                  <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                    {selectedItemForPreview.totalOrderedQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">{selectedItemForPreview.unit}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Dispatched</div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    {selectedItemForPreview.totalDispatchedQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">{selectedItemForPreview.unit}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Balance</div>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    {selectedItemForPreview.totalPendingQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">{selectedItemForPreview.unit}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total Value</div>
                  <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                    {getCurrencySymbol(selectedItemForPreview.currency)}{selectedItemForPreview.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {selectedItemForPreview.poCount > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span>Fulfillment Progress</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItemForPreview.fulfillmentRate}% Dispatched</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        selectedItemForPreview.fulfillmentRate === 100 
                          ? 'bg-emerald-500' 
                          : 'bg-gradient-to-r from-blue-500 to-amber-500'
                      }`}
                      style={{ width: `${selectedItemForPreview.fulfillmentRate}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Customer Purchase Orders Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <FileCheck size={16} className="text-blue-600 dark:text-blue-400" />
                    <span>Customer Purchase Orders containing this item ({selectedItemForPreview.linkedPos.length}):</span>
                  </h3>
                </div>

                {selectedItemForPreview.linkedPos.length === 0 ? (
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-xs text-slate-400">This catalog item is not currently part of any Customer Purchase Order.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-3.5 py-3">Customer PO #</th>
                          <th className="px-3.5 py-3">Customer Name</th>
                          <th className="px-3.5 py-3 text-center">PO Date</th>
                          <th className="px-3.5 py-3 text-right">Ordered Qty</th>
                          <th className="px-3.5 py-3 text-right">Dispatched</th>
                          <th className="px-3.5 py-3 text-right">Pending</th>
                          <th className="px-3.5 py-3 text-right">Unit Rate</th>
                          <th className="px-3.5 py-3 text-right">Total Amount</th>
                          <th className="px-3.5 py-3 text-center">Expected Delivery</th>
                          <th className="px-3.5 py-3 text-center">Status</th>
                          <th className="px-3.5 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedItemForPreview.linkedPos.map((lp, idx) => (
                          <tr key={`${lp.poId}-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-3.5 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {lp.poNumber}
                            </td>

                            <td className="px-3.5 py-3 font-bold text-slate-800 dark:text-slate-200">
                              <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                                <Building2 size={12} className="text-blue-500 shrink-0" />
                                <span className="truncate">{lp.customerName}</span>
                              </div>
                            </td>

                            <td className="px-3.5 py-3 text-center font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {lp.poDate ? new Date(lp.poDate).toLocaleDateString('en-GB') : '-'}
                            </td>

                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {lp.orderedQty.toLocaleString()} {lp.unit}
                            </td>

                            <td className="px-3.5 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {lp.dispatchedQty.toLocaleString()} {lp.unit}
                            </td>

                            <td className="px-3.5 py-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                              {lp.pendingQty.toLocaleString()} {lp.unit}
                            </td>

                            <td className="px-3.5 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                              {getCurrencySymbol(lp.currency)}{lp.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {getCurrencySymbol(lp.currency)}{lp.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            <td className="px-3.5 py-3 text-center font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {lp.expectedDeliveryDate ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Calendar size={11} className="text-slate-400" />
                                  <span>{new Date(lp.expectedDeliveryDate).toLocaleDateString('en-GB')}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            <td className="px-3.5 py-3 text-center">
                              {getStatusBadge(lp.status)}
                            </td>

                            <td className="px-3.5 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  onViewPo(lp.po);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Eye size={12} /> View PO
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedItemForPreview(null)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
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
