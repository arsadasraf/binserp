"use client";

import React, { useState, useEffect } from 'react';
import { 
  Building2, Search, Filter, ShoppingCart, CheckCircle2, 
  Clock, AlertCircle, ArrowUpRight, ChevronDown, ChevronUp, 
  Package, FileText, Download, Calendar, DollarSign, Layers
} from 'lucide-react';
import { API_BASE_URL } from '@/src/utils/config';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function VendorPOBucketView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ buckets: any[]; globalMetrics: any } | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);

  const fetchBucketData = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      const res = await fetch(`${API_BASE_URL}/api/purchase/vendor-bucket`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch vendor PO bucket:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBucketData();
  }, []);

  if (loading) return <LoadingSpinner />;

  const buckets = data?.buckets || [];
  const globalMetrics = data?.globalMetrics || {
    totalVendors: 0,
    vendorsWithActivePOs: 0,
    totalPOs: 0,
    totalOrderedValue: 0,
    totalReceivedValue: 0,
    totalPendingValue: 0
  };

  // Filter buckets based on selected vendor and search
  const filteredBuckets = buckets.filter(b => {
    if (selectedVendorId !== 'all' && b.vendor._id !== selectedVendorId) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchVendor = b.vendor.name?.toLowerCase().includes(q) || b.vendor.code?.toLowerCase().includes(q);
      const matchPO = b.pos?.some((po: any) => 
        po.poNumber?.toLowerCase().includes(q) || 
        po.items?.some((it: any) => it.materialName?.toLowerCase().includes(q))
      );
      if (!matchVendor && !matchPO) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-indigo-900/50 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Building2 size={16} /> Vendor Management & Ledger
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Vendor PO Bucket</h1>
          <p className="text-slate-300 text-xs mt-1">
            Track vendor-wise Outward PO balances, material receipts, pending quantities, and GRN transaction settlement.
          </p>
        </div>

        <button 
          onClick={fetchBucketData}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 self-start md:self-auto"
        >
          Refresh Bucket Data
        </button>
      </div>

      {/* Global Analytics Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-start text-slate-500 text-xs font-semibold">
            <span>Total Issued POs</span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
              <ShoppingCart size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {globalMetrics.totalPOs}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Across {globalMetrics.totalVendors} registered vendors
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-start text-slate-500 text-xs font-semibold">
            <span>Total Ordered Value</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-xl">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            ₹{globalMetrics.totalOrderedValue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total Purchase Commitment
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-start text-slate-500 text-xs font-semibold">
            <span>Received Value</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            ₹{globalMetrics.totalReceivedValue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Fulfilled via GRN Inward
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-start text-slate-500 text-xs font-semibold">
            <span>Pending Value</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
            ₹{globalMetrics.totalPendingValue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Awaiting GRN delivery
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        
        {/* Vendor Selector & Search */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input 
              type="text"
              placeholder="Search vendor name, code, PO #, or material..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <select
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">All Vendors ({buckets.length})</option>
            {buckets.map(b => (
              <option key={b.vendor._id} value={b.vendor._id}>
                {b.vendor.name} ({b.metrics.totalPOs} POs)
              </option>
            ))}
          </select>
        </div>

        {/* PO Status Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All PO Statuses' },
            { id: 'Released', label: 'Released / Pending' },
            { id: 'Partially Received', label: 'Partially Received' },
            { id: 'Completed', label: 'Completed' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === f.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vendor Bucket List */}
      {filteredBuckets.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Building2 size={40} className="mx-auto text-slate-300 mb-2" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No Vendor Buckets Found</h3>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your vendor search or status filters.</p>
        </div>
      ) : (
        <div className="space-y-6 pb-28 sm:pb-20">
          {filteredBuckets.map((bucket) => {
            const pos = (bucket.pos || []).filter((po: any) => {
              if (statusFilter === 'all') return true;
              if (statusFilter === 'Released') return po.status === 'Released' || po.status === 'Draft';
              return po.status === statusFilter;
            });

            if (pos.length === 0 && selectedVendorId === 'all' && statusFilter !== 'all') {
              return null;
            }

            return (
              <div 
                key={bucket.vendor._id} 
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden"
              >
                {/* Vendor Bucket Header */}
                <div className="p-6 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 dark:from-slate-800/80 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-600/20 flex-shrink-0">
                      {bucket.vendor.name ? bucket.vendor.name.charAt(0).toUpperCase() : 'V'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                          {bucket.vendor.name}
                        </h2>
                        {bucket.vendor.code && (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold">
                            {bucket.vendor.code}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {bucket.vendor.phone && <span>📞 {bucket.vendor.phone}</span>}
                        {bucket.vendor.email && <span>✉️ {bucket.vendor.email}</span>}
                        {bucket.vendor.gst && <span>📋 GST: {bucket.vendor.gst}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Bucket Summary Metrics */}
                  <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                    <div className="text-center px-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Issued POs</span>
                      <strong className="text-slate-900 dark:text-white text-base font-extrabold">{bucket.metrics.totalPOs}</strong>
                    </div>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                    <div className="text-center px-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Received</span>
                      <strong className="text-emerald-600 font-mono text-sm font-bold">₹{bucket.metrics.totalReceivedValue.toLocaleString()}</strong>
                    </div>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                    <div className="text-center px-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Pending Balance</span>
                      <strong className="text-amber-600 font-mono text-sm font-bold">₹{bucket.metrics.totalPendingValue.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                {/* PO Cards / Ledger */}
                <div className="p-6 space-y-4">
                  {pos.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No Purchase Orders match the selected status filter for this vendor.
                    </div>
                  ) : (
                    pos.map((po: any) => {
                      const isExpanded = expandedPoId === po._id;
                      const items = po.items || [];
                      
                      const totalOrderedQty = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || po.quantity || 1;
                      const totalReceivedQty = items.reduce((s: number, i: any) => s + (i.receivedQuantity || 0), 0) || po.receivedQuantity || 0;
                      const fulfillmentPct = Math.min(100, Math.round((totalReceivedQty / totalOrderedQty) * 100));

                      return (
                        <div 
                          key={po._id} 
                          className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-200 transition-all bg-slate-50/50 dark:bg-slate-800/40"
                        >
                          {/* PO Header Bar */}
                          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                            
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center font-bold text-xs border border-purple-100 dark:border-purple-900">
                                PO
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-extrabold text-sm text-purple-700 dark:text-purple-400">
                                    {po.poNumber}
                                  </span>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    po.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                    po.status === 'Partially Received' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                                    'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                                  }`}>
                                    {po.status || 'Released'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Date: {new Date(po.date || po.createdAt).toLocaleDateString('en-GB')}
                                </div>
                              </div>
                            </div>

                            {/* Progress bar and totals */}
                            <div className="flex items-center gap-6">
                              <div className="w-36 hidden sm:block">
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                  <span>Fulfilled</span>
                                  <span>{fulfillmentPct}%</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-500 ${
                                      fulfillmentPct >= 100 ? 'bg-emerald-500' :
                                      fulfillmentPct > 0 ? 'bg-amber-500' : 'bg-indigo-500'
                                    }`}
                                    style={{ width: `${fulfillmentPct}%` }}
                                  />
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">PO Amount</span>
                                <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                                  ₹{Number(po.totalAmount || 0).toLocaleString()}
                                </span>
                              </div>

                              <button
                                onClick={() => setExpandedPoId(isExpanded ? null : po._id)}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors"
                                title="Toggle Transaction Details"
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>

                          </div>

                          {/* Material Items Ledger Table */}
                          <div className="p-4 overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100/70 dark:bg-slate-800/80 rounded-xl">
                                <tr>
                                  <th className="p-2.5 rounded-l-lg">Material Item</th>
                                  <th className="p-2.5 text-center">Ordered Qty</th>
                                  <th className="p-2.5 text-center">Received Qty</th>
                                  <th className="p-2.5 text-center">Pending Qty</th>
                                  <th className="p-2.5 text-right">Unit Rate (₹)</th>
                                  <th className="p-2.5 text-right rounded-r-lg">Line Total (₹)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800">
                                {items.map((it: any, idx: number) => {
                                  const ordQty = Number(it.quantity || 0);
                                  const recQty = Number(it.receivedQuantity || 0);
                                  const pendQty = it.pendingQuantity !== undefined ? Number(it.pendingQuantity) : Math.max(0, ordQty - recQty);
                                  const rate = Number(it.rate || 0);
                                  const lineTotal = Number(it.amount || (ordQty * rate));

                                  return (
                                    <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                                        {it.materialName || (typeof it.material === 'object' ? it.material?.name : 'Item')}
                                        <span className="text-[10px] text-slate-400 font-normal ml-1.5">({it.unit || 'PCS'})</span>
                                      </td>
                                      <td className="p-2.5 text-center font-bold text-slate-700 dark:text-slate-300">
                                        {ordQty}
                                      </td>
                                      <td className="p-2.5 text-center">
                                        <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                          recQty >= ordQty ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                          recQty > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                                          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                          {recQty}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-center">
                                        <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                          pendQty > 0 ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                          {pendQty}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-right font-medium">
                                        ₹{rate.toLocaleString()}
                                      </td>
                                      <td className="p-2.5 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                                        ₹{lineTotal.toLocaleString()}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Expanded GRN Transactions Section */}
                          {isExpanded && (
                            <div className="p-4 bg-indigo-50/40 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                              <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Package size={14} /> Linked GRN Transaction Log
                              </h4>

                              {(!po.transactions || po.transactions.length === 0) ? (
                                <div className="p-3 text-slate-400 text-xs italic bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                  No GRN shipments recorded yet for this Purchase Order.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {po.transactions.map((grn: any, gIdx: number) => (
                                    <div 
                                      key={gIdx} 
                                      className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold flex items-center justify-center text-[10px]">
                                          GRN
                                        </div>
                                        <div>
                                          <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                            {grn.grnNumber}
                                          </div>
                                          <div className="text-[10px] text-slate-400">
                                            Received Date: {new Date(grn.date).toLocaleDateString('en-GB')}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300 text-[11px]">
                                        <div>
                                          Items: <strong>{grn.items ? grn.items.length : 1}</strong>
                                        </div>
                                        <div>
                                          Received Qty: <strong>{grn.items ? grn.items.reduce((s: number, i: any) => s + (i.quantity || 0), 0) : 0}</strong>
                                        </div>
                                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[10px]">
                                          {grn.status || 'Received'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
