"use client";

import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Building2, 
  Calendar, 
  Copy, 
  Check, 
  Search,
  Users
} from 'lucide-react';
import { getCurrencySymbol } from '@/src/utils/currencyHelper';

export interface LinkedCustomerPOItem {
  customerPoNumber?: string;
  customerName?: string;
  currency?: string;
  exchangeRate?: number;
  totalAmount?: number;
  totalAmountInINR?: number;
  poDate?: string;
  targetDate?: string;
  deliveryDate?: string;
  status?: string;
}

export interface LinkedFGBreakdownItem {
  customerPoNumber?: string;
  customerName?: string;
  quantity?: number;
  unit?: string;
  originalRate?: number;
  rate?: number;
  currency?: string;
  exchangeRate?: number;
  rateInINR?: number;
  amountInINR?: number;
}

export interface LinkedCustomerPOsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mrpNumber: string;
  planTitle?: string;
  customerName?: string;
  customerPOs?: LinkedCustomerPOItem[];
  fgItemName?: string;
  sourceBreakdown?: LinkedFGBreakdownItem[];
}

export default function LinkedCustomerPOsModal({
  isOpen,
  onClose,
  mrpNumber,
  planTitle,
  customerName,
  customerPOs = [],
  fgItemName,
  sourceBreakdown = []
}: LinkedCustomerPOsModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  const isFGBreakdownMode = Boolean(fgItemName && sourceBreakdown.length > 0);

  const handleCopyPo = (poNumber: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!poNumber || poNumber === 'N/A') return;
    navigator.clipboard.writeText(poNumber);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // Group customer POs by customer name
  const groupedCustomers = useMemo(() => {
    const groups: Record<string, LinkedCustomerPOItem[]> = {};

    if (customerPOs && customerPOs.length > 0) {
      customerPOs.forEach((po) => {
        const cName = po.customerName?.trim() || customerName?.trim() || 'Internal Demand';
        if (!groups[cName]) groups[cName] = [];
        groups[cName].push(po);
      });
    } else if (customerName) {
      const names = customerName.split(',').map((s) => s.trim()).filter(Boolean);
      names.forEach((cName) => {
        if (!groups[cName]) groups[cName] = [];
        groups[cName].push({
          customerName: cName,
          customerPoNumber: 'N/A'
        });
      });
    }

    return groups;
  }, [customerPOs, customerName]);

  const uniqueCustomerCount = Object.keys(groupedCustomers).length;
  const totalPOCount = customerPOs.length;

  // Filter grouped customers by search text
  const filteredCustomerGroups = useMemo(() => {
    if (!filterText.trim()) return groupedCustomers;
    const q = filterText.toLowerCase();
    const result: Record<string, LinkedCustomerPOItem[]> = {};

    Object.entries(groupedCustomers).forEach(([cName, poList]) => {
      const matchesCust = cName.toLowerCase().includes(q);
      const matchingPOs = poList.filter((po) =>
        (po.customerPoNumber || '').toLowerCase().includes(q) ||
        (po.customerName || '').toLowerCase().includes(q)
      );

      if (matchesCust) {
        result[cName] = poList;
      } else if (matchingPOs.length > 0) {
        result[cName] = matchingPOs;
      }
    });

    return result;
  }, [groupedCustomers, filterText]);

  const filteredBreakdown = useMemo(() => {
    return (sourceBreakdown || []).filter((b) => {
      if (!filterText.trim()) return true;
      const q = filterText.toLowerCase();
      return (
        (b.customerPoNumber || '').toLowerCase().includes(q) ||
        (b.customerName || '').toLowerCase().includes(q)
      );
    });
  }, [sourceBreakdown, filterText]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
              {uniqueCustomerCount > 1 ? <Users size={18} /> : <FileText size={18} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  {mrpNumber || 'MRP Plan'}
                </span>
                {isFGBreakdownMode ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {sourceBreakdown.length} Allocations
                  </span>
                ) : (
                  <>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                      <Users size={10} />
                      {uniqueCustomerCount} {uniqueCustomerCount === 1 ? 'Customer' : 'Customers'}
                    </span>
                    {totalPOCount > 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {totalPOCount} {totalPOCount === 1 ? 'Order Ref' : 'Order Refs'}
                      </span>
                    )}
                  </>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                {isFGBreakdownMode 
                  ? `Customer PO Allocation: ${fgItemName}` 
                  : (planTitle || (uniqueCustomerCount > 1 ? `Multi-Customer Demand (${uniqueCustomerCount} Customers)` : customerName) || 'Customer & Order Reference Allocation')}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar if multiple items */}
        {((isFGBreakdownMode && sourceBreakdown.length > 2) || (!isFGBreakdownMode && (totalPOCount > 2 || uniqueCustomerCount > 1))) && (
          <div className="px-4 sm:px-5 pt-3 pb-1 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Customer Name or PO Number..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 min-h-0 text-xs">
          {isFGBreakdownMode ? (
            /* FG-Level Breakdown Mode */
            filteredBreakdown.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No matching customer PO breakdowns found.
              </div>
            ) : (
              filteredBreakdown.map((item, idx) => {
                const origRate = Number(item.originalRate || item.rate || 0);
                const curr = item.currency || 'INR';
                const exRate = Number(item.exchangeRate || 1);
                const inrRate = Number(item.rateInINR || (origRate * exRate) || 0);
                const isForeign = curr !== 'INR';
                const key = `fg-${idx}`;

                return (
                  <div 
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                          {item.customerPoNumber || 'N/A'}
                        </span>
                        {item.customerPoNumber && item.customerPoNumber !== 'N/A' && (
                          <button
                            type="button"
                            onClick={(e) => handleCopyPo(item.customerPoNumber || '', key, e)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
                            title="Copy PO Number"
                          >
                            {copiedKey === key ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                      {item.customerName && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Building2 size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate">{item.customerName}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center sm:text-right gap-3 shrink-0 flex-wrap sm:flex-col sm:items-end sm:gap-0.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {item.quantity || 0} {item.unit || 'PCS'}
                      </div>
                      {origRate > 0 && (
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold font-mono">
                          @ {isForeign 
                            ? `${getCurrencySymbol(curr)}${origRate.toLocaleString()} (${curr}) → ₹${inrRate.toLocaleString('en-IN')}` 
                            : `₹${inrRate.toLocaleString('en-IN')}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* Grouped by Customer Mode */
            Object.keys(filteredCustomerGroups).length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No matching customers or purchase orders found.
              </div>
            ) : (
              Object.entries(filteredCustomerGroups).map(([cName, poList], groupIdx) => {
                return (
                  <div 
                    key={groupIdx}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden shadow-2xs"
                  >
                    {/* Customer Header Card */}
                    <div className="px-3.5 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                          <Building2 size={13} />
                        </div>
                        <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {cName}
                        </strong>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 shrink-0">
                        {poList.length} {poList.length === 1 ? 'Order Ref' : 'Order Refs'}
                      </span>
                    </div>

                    {/* PO List under this Customer */}
                    <div className="p-2.5 space-y-2">
                      {poList.map((po, idx) => {
                        const hasForeignCurrency = po.currency && po.currency !== 'INR';
                        const symbol = getCurrencySymbol(po.currency || 'INR');
                        const key = `${groupIdx}-${idx}`;

                        return (
                          <div 
                            key={idx}
                            className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-2xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                    {po.customerPoNumber || 'N/A'}
                                  </span>
                                  {po.customerPoNumber && po.customerPoNumber !== 'N/A' && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopyPo(po.customerPoNumber || '', key, e)}
                                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
                                      title="Copy PO Number"
                                    >
                                      {copiedKey === key ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                    </button>
                                  )}
                                  {hasForeignCurrency && (
                                    <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                                      {po.currency} @ ₹{po.exchangeRate || 1}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {po.totalAmount !== undefined && po.totalAmount !== null && Number(po.totalAmount) > 0 && (
                                <div className="text-right shrink-0">
                                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Value</div>
                                  <div className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                    {hasForeignCurrency ? (
                                      <span>
                                        {symbol}{Number(po.totalAmount).toLocaleString()}
                                        <span className="text-[10px] text-slate-400 block">(₹{(po.totalAmountInINR || 0).toLocaleString('en-IN')})</span>
                                      </span>
                                    ) : (
                                      <span>₹{Number(po.totalAmount).toLocaleString('en-IN')}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Metadata Dates */}
                            {(po.poDate || po.targetDate || po.deliveryDate) && (
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
                                {po.poDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar size={11} className="text-slate-400" />
                                    <span>PO Date: <strong className="text-slate-700 dark:text-slate-300">{new Date(po.poDate).toLocaleDateString()}</strong></span>
                                  </span>
                                )}
                                {(po.targetDate || po.deliveryDate) && (
                                  <span className="flex items-center gap-1">
                                    <Calendar size={11} className="text-emerald-500" />
                                    <span>Due Date: <strong className="text-emerald-700 dark:text-emerald-400">{new Date(po.targetDate || po.deliveryDate || '').toLocaleDateString()}</strong></span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>Total: <strong className="text-slate-800 dark:text-slate-200 font-bold">{uniqueCustomerCount} {uniqueCustomerCount === 1 ? 'Customer' : 'Customers'}</strong></span>
            <span>•</span>
            <span><strong className="text-slate-800 dark:text-slate-200 font-bold">{totalPOCount} {totalPOCount === 1 ? 'Order Ref' : 'Order Refs'}</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
