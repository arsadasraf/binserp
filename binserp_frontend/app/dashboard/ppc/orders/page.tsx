"use client";

import React, { useState, useEffect, useMemo } from 'react';
import PPCTabs from "../components/PPCTabs";
import { 
  useGetManufacturingOrdersQuery,
  useDeleteOrderMutation,
  useMoveToManufacturingMutation
} from "@/src/store/services/ppcService";
import { useHeader } from "@/src/context/HeaderContext";
import { 
  Hammer, Eye, Trash2, ChevronRight, ChevronDown, 
  Search, RefreshCw, Factory, Boxes, Plus
} from 'lucide-react';
import CreateOrderModal from "../components/CreateOrderModal";
import OrderDetailModal from "../components/OrderDetailModal";
import MoveToManufacturingModal from "../components/MoveToManufacturingModal";
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { apiGet } from '@/src/lib/api';

type OrderSubTab = "mrp-intake" | "manufacturing-orders";

export default function PPCOrdersPage() {
  const { setHeader } = useHeader();
  const [subTab, setSubTab] = useState<OrderSubTab>("mrp-intake");

  // RTK Query: Manufacturing Orders
  const { 
    data: manufacturingOrders = [], 
    isLoading: loadingMfg, 
    refetch: refetchMfg 
  } = useGetManufacturingOrdersQuery();

  const [deleteOrder] = useDeleteOrderMutation();
  const [moveToMfg] = useMoveToManufacturingMutation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [moveToMfgOrder, setMoveToMfgOrder] = useState<any>(null);

  // MRP Intake Bucket State
  const [mrpBuckets, setMrpBuckets] = useState<any[]>([]);
  const [loadingMrp, setLoadingMrp] = useState<boolean>(false);
  const [mrpSearchTerm, setMrpSearchTerm] = useState<string>('');
  const [mrpStatusFilter, setMrpStatusFilter] = useState<string>('All');
  const [expandedMrpKey, setExpandedMrpKey] = useState<string | null>(null);

  // Manufacturing Orders Filter State
  const [mfgSearchTerm, setMfgSearchTerm] = useState<string>('');
  const [mfgStatusFilter, setMfgStatusFilter] = useState<string>('All');

  const fetchMrpIntake = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    setLoadingMrp(true);
    try {
      const res = await apiGet('/api/ppc/mrp-intake', token);
      if (res?.data?.mrpBuckets) {
        setMrpBuckets(res.data.mrpBuckets);
      }
    } catch (err) {
      console.error("Failed to fetch MRP intake bucket:", err);
    } finally {
      setLoadingMrp(false);
    }
  };

  useEffect(() => {
    setHeader("PPC Orders", "MRP Demand Intake & Manufacturing Orders");
    fetchMrpIntake();
  }, [setHeader]);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this manufacturing order?")) {
      try {
        await deleteOrder(id).unwrap();
        refetchMfg();
      } catch (err: any) {
        alert(err?.data?.message || "Failed to delete order");
      }
    }
  };

  // Filtered MRP Buckets
  const filteredMrpBuckets = useMemo(() => {
    return mrpBuckets.filter(b => {
      // Status filter
      if (mrpStatusFilter !== 'All') {
        if (b.bucketStatus !== mrpStatusFilter) return false;
      }

      // Search filter
      const s = mrpSearchTerm.toLowerCase();
      if (!s) return true;
      const matchesMrp = b.mrpNumber?.toLowerCase().includes(s);
      const matchesCustomer = b.customerName?.toLowerCase().includes(s);
      const matchesPO = b.poReference?.toLowerCase().includes(s);
      const matchesPart = (b.items || []).some((it: any) => 
        (it.productName || it.materialName || '').toLowerCase().includes(s) ||
        (it.description || '').toLowerCase().includes(s) ||
        (it.linkedMoNumber || '').toLowerCase().includes(s)
      );
      return matchesMrp || matchesCustomer || matchesPO || matchesPart;
    });
  }, [mrpBuckets, mrpSearchTerm, mrpStatusFilter]);

  // Total in-house parts count in MRP intake
  const totalMrpPartsCount = useMemo(() => {
    return mrpBuckets.reduce((acc, b) => acc + (b.items?.length || 0), 0);
  }, [mrpBuckets]);

  // Filtered Manufacturing Orders
  const filteredMfgOrders = useMemo(() => {
    return manufacturingOrders.filter((mo: any) => {
      // Status filter
      if (mfgStatusFilter !== 'All') {
        if (mo.status !== mfgStatusFilter) return false;
      }

      // Search filter
      const s = mfgSearchTerm.toLowerCase();
      if (!s) return true;
      const matchesOrderNo = mo.orderNumber?.toLowerCase().includes(s);
      const matchesMrp = (mo.mrpNumber || mo.originMrpNumber || '').toLowerCase().includes(s);
      const matchesCustomer = (mo.customerName || mo.customer?.name || '').toLowerCase().includes(s);
      const matchesPo = (mo.poReference || '').toLowerCase().includes(s);
      const matchesPart = (mo.items || []).some((it: any) => 
        (it.productName || it.materialName || '').toLowerCase().includes(s) ||
        (it.description || '').toLowerCase().includes(s)
      );
      return matchesOrderNo || matchesMrp || matchesCustomer || matchesPo || matchesPart;
    });
  }, [manufacturingOrders, mfgSearchTerm, mfgStatusFilter]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="orders" />

        <div className="mt-4 space-y-4 animate-in fade-in duration-200">
          
          {/* Main 2-Tab Navigation Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800">
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
              
              {/* Tab 1: MRP Intake */}
              <button
                onClick={() => setSubTab("mrp-intake")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  subTab === "mrp-intake"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Factory size={15} />
                <span>MRP Intake</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  subTab === "mrp-intake" ? "bg-purple-800 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}>
                  {mrpBuckets.length} MRPs ({totalMrpPartsCount} Items)
                </span>
              </button>

              {/* Tab 2: Manufacturing Order */}
              <button
                onClick={() => setSubTab("manufacturing-orders")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  subTab === "manufacturing-orders"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Hammer size={15} />
                <span>Manufacturing Order</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  subTab === "manufacturing-orders" ? "bg-blue-800 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}>
                  {manufacturingOrders.length} Orders
                </span>
              </button>
            </div>

            {/* Header Actions */}
            {subTab === "manufacturing-orders" && (
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setIsCreateOpen(true);
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>Create Order</span>
              </button>
            )}
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: MRP INTAKE VIEW                                                   */}
          {/* ========================================================================= */}
          {subTab === "mrp-intake" && (
            <div className="space-y-4">
              
              {/* Search & Status Filters */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="flex flex-1 items-center gap-2 max-w-md">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
                    <input
                      type="text"
                      value={mrpSearchTerm}
                      onChange={(e) => setMrpSearchTerm(e.target.value)}
                      placeholder="Search MRP #, Customer, Part, or MO #..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <button
                    onClick={fetchMrpIntake}
                    className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                    title="Refresh Intake"
                  >
                    <RefreshCw size={13} className={loadingMrp ? "animate-spin" : ""} />
                  </button>
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
                  {["All", "Pending MO Creation", "Partially Created", "All MOs Created"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setMrpStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                        mrpStatusFilter === status
                          ? "bg-purple-600 text-white shadow-2xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* MRP Intake Groups */}
              {loadingMrp ? (
                <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
              ) : filteredMrpBuckets.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900">
                  <Boxes className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No MRP Demands Found</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    MRP in-house components dispatched from Store Procurement will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMrpBuckets.map((bucket: any, bIdx: number) => {
                    const isExpanded = expandedMrpKey === bucket.mrpNumber || filteredMrpBuckets.length === 1;
                    const items = bucket.items || [];
                    const bucketStatus = bucket.bucketStatus || "Pending MO Creation";

                    return (
                      <div 
                        key={bIdx}
                        className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs"
                      >
                        {/* Group Header */}
                        <div 
                          onClick={() => setExpandedMrpKey(isExpanded ? null : bucket.mrpNumber)}
                          className="p-4 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-xs text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800">
                              MRP #{bucket.mrpNumber}
                            </span>
                            <div>
                              <strong className="text-xs text-slate-900 dark:text-white block font-bold">
                                {bucket.customerName || "Internal Production Demand"}
                              </strong>
                              {bucket.poReference && (
                                <span className="text-[11px] text-slate-400 font-mono">PO Ref: {bucket.poReference}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            {/* Bucket Status Badge */}
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              bucketStatus === 'All MOs Created'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : bucketStatus === 'Partially Created'
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {bucketStatus}
                            </span>

                            <span className="font-mono text-slate-500 text-xs">
                              {items.length} Items ({bucket.totalItemsCount} Units)
                            </span>

                            <span className="text-slate-500 text-xs hidden md:inline">
                              Target: <b>{bucket.deliveryDate ? new Date(bucket.deliveryDate).toLocaleDateString('en-GB') : "N/A"}</b>
                            </span>

                            <button
                              type="button"
                              className="p-1 text-slate-400 hover:text-purple-600 transition-colors"
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Items Table with Item Name & Description per AGENTS.md */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 dark:border-slate-800 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase font-bold">
                                <tr>
                                  <th className="px-4 py-3">Item & Technical Description</th>
                                  <th className="px-3 py-3">Classification</th>
                                  <th className="px-3 py-3 text-center">Required Qty</th>
                                  <th className="px-3 py-3 text-center">Moved to MO</th>
                                  <th className="px-3 py-3 text-center">Remaining</th>
                                  <th className="px-4 py-3 text-center">Manufacturing Status</th>
                                  <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {items.map((item: any, itmIdx: number) => {
                                  const name = item.productName || item.materialName || "Part Item";
                                  const desc = item.description || item.descriptions || item.specification;
                                  const type = item.itemType || "Component";
                                  const qty = Number(item.quantity) || 1;
                                  const moved = Number(item.movedQuantity) || 0;
                                  const remaining = Math.max(0, qty - moved);
                                  const isMoCreated = moved >= qty && qty > 0;
                                  const isPartial = moved > 0 && moved < qty;

                                  return (
                                    <tr key={itmIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                      
                                      {/* Item Name & Technical Description */}
                                      <td className="px-4 py-3">
                                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                          {name}
                                        </div>
                                        {desc && (
                                          <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                                            {desc}
                                          </div>
                                        )}
                                      </td>

                                      {/* BOM Classification */}
                                      <td className="px-3 py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                          type.toLowerCase().includes('sub') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' :
                                          type.toLowerCase().includes('assembly') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                          'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                        }`}>
                                          {type}
                                        </span>
                                      </td>

                                      {/* Required Qty */}
                                      <td className="px-3 py-3 text-center font-bold text-slate-900 dark:text-white">
                                        {qty} <span className="text-[10px] text-slate-400 font-normal">{item.unit || "PCS"}</span>
                                      </td>

                                      {/* Moved to MO */}
                                      <td className="px-3 py-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                                        {moved}
                                      </td>

                                      {/* Remaining Qty */}
                                      <td className="px-3 py-3 text-center font-mono font-bold text-purple-600 dark:text-purple-400">
                                        {remaining}
                                      </td>

                                      {/* Manufacturing Status */}
                                      <td className="px-4 py-3 text-center">
                                        {isMoCreated ? (
                                          <div className="inline-flex flex-col items-center">
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                                              MO Created
                                            </span>
                                            {item.linkedMoNumber && (
                                              <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                                                {item.linkedMoNumber}
                                              </span>
                                            )}
                                          </div>
                                        ) : isPartial ? (
                                          <div className="inline-flex flex-col items-center">
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                                              Partial ({moved}/{qty})
                                            </span>
                                            {item.linkedMoNumber && (
                                              <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                                                {item.linkedMoNumber}
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200">
                                            Pending MO Creation
                                          </span>
                                        )}
                                      </td>

                                      {/* Action Button */}
                                      <td className="px-4 py-3 text-right">
                                        {remaining > 0 ? (
                                          <button
                                            onClick={() => {
                                              const targetOrder = (bucket.orders || []).find((o: any) => o._id === item.orderId) || {
                                                _id: item.orderId,
                                                orderNumber: item.orderNumber,
                                                mrpNumber: bucket.mrpNumber,
                                                poReference: bucket.poReference,
                                                customerName: bucket.customerName,
                                                items: [item]
                                              };
                                              setMoveToMfgOrder(targetOrder);
                                            }}
                                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                                          >
                                            <Hammer size={12} />
                                            <span>Create MO</span>
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              setSubTab("manufacturing-orders");
                                              setMfgSearchTerm(item.linkedMoNumber || bucket.mrpNumber);
                                            }}
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all ml-auto cursor-pointer"
                                          >
                                            View MO
                                          </button>
                                        )}
                                      </td>

                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MANUFACTURING ORDER VIEW                                          */}
          {/* ========================================================================= */}
          {subTab === "manufacturing-orders" && (
            <div className="space-y-4">
              
              {/* Search & Status Filters */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="flex flex-1 items-center gap-2 max-w-md">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
                    <input
                      type="text"
                      value={mfgSearchTerm}
                      onChange={(e) => setMfgSearchTerm(e.target.value)}
                      placeholder="Search MO #, MRP #, Customer, or Item..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <button
                    onClick={refetchMfg}
                    className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                    title="Refresh Orders"
                  >
                    <RefreshCw size={13} className={loadingMfg ? "animate-spin" : ""} />
                  </button>
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
                  {["All", "Pending", "Confirmed", "InProduction", "InProgress", "Completed"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setMfgStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                        mfgStatusFilter === status
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manufacturing Orders Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden">
                {loadingMfg ? (
                  <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
                ) : filteredMfgOrders.length === 0 ? (
                  <div className="p-12 text-center">
                    <Hammer className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No Manufacturing Orders Found</h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Create Manufacturing Orders from the MRP Intake tab or click Create Order above.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3.5">MO Number</th>
                          <th className="px-4 py-3.5">Origin Traceability</th>
                          <th className="px-4 py-3.5">Item & Technical Description</th>
                          <th className="px-3 py-3.5 text-center">Quantity & Tracking</th>
                          <th className="px-4 py-3.5">Target Date</th>
                          <th className="px-4 py-3.5 text-center">Status</th>
                          <th className="px-4 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {filteredMfgOrders.map((mo: any) => {
                          const items = mo.items || [];
                          const firstItem = items[0] || {};
                          const name = firstItem.productName || firstItem.materialName || mo.productName || "Part Item";
                          const desc = firstItem.description || firstItem.descriptions || firstItem.specification;
                          const mrpRef = mo.mrpNumber || mo.originMrpNumber;

                          return (
                            <tr key={mo._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                              
                              {/* MO Number */}
                              <td className="px-4 py-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                                <div>{mo.orderNumber}</div>
                                <div className="text-[10px] text-slate-400 font-normal">
                                  {mo.createdAt ? new Date(mo.createdAt).toLocaleDateString('en-GB') : ""}
                                </div>
                              </td>

                              {/* Origin Traceability (MRP # & Customer) */}
                              <td className="px-4 py-3.5">
                                {mrpRef ? (
                                  <span className="font-mono font-extrabold text-[11px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 inline-block mb-0.5">
                                    MRP #{mrpRef}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-mono">Direct Production</span>
                                )}
                                <div className="text-slate-800 dark:text-slate-200 font-semibold text-xs">
                                  {mo.customerName || mo.customer?.name || "Internal Production"}
                                </div>
                                {mo.poReference && (
                                  <div className="text-[10px] text-slate-400 font-mono">Ref: {mo.poReference}</div>
                                )}
                              </td>

                              {/* Item & Technical Description per AGENTS.md */}
                              <td className="px-4 py-3.5 max-w-sm">
                                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                  {name}
                                </div>
                                {desc && (
                                  <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                                    {desc}
                                  </div>
                                )}
                                {items.length > 1 && (
                                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    + {items.length - 1} more item(s)
                                  </span>
                                )}
                              </td>

                              {/* Quantity & Tracking */}
                              <td className="px-3 py-3.5 text-center">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {firstItem.quantity || mo.quantity || 1} {firstItem.unit || "PCS"}
                                </div>
                                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  firstItem.trackingType === 'Batch'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200'
                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200'
                                }`}>
                                  {firstItem.trackingType === 'Batch' ? 'Batch Tracked' : 'Individual'}
                                </span>
                              </td>

                              {/* Target Date */}
                              <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                                {mo.deliveryDate ? new Date(mo.deliveryDate).toLocaleDateString('en-GB') : "N/A"}
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3.5 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  mo.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200' :
                                  mo.status === 'InProduction' || mo.status === 'InProgress' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200' :
                                  'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200'
                                }`}>
                                  {mo.status || 'Pending'}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => setViewingOrder(mo)}
                                    title="View MO Details & Route Cards"
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(mo._id)}
                                    title="Delete Order"
                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
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
          )}
        </div>

        {/* Modals */}
        {isCreateOpen && (
          <CreateOrderModal
            isOpen={isCreateOpen}
            initialOrder={editingOrder}
            onClose={() => {
              setIsCreateOpen(false);
              setEditingOrder(null);
            }}
            onSuccess={() => {
              setIsCreateOpen(false);
              setEditingOrder(null);
              refetchMfg();
            }}
          />
        )}

        {viewingOrder && (
          <OrderDetailModal
            isOpen={!!viewingOrder}
            order={viewingOrder}
            onClose={() => setViewingOrder(null)}
          />
        )}

        {moveToMfgOrder && (
          <MoveToManufacturingModal
            isOpen={!!moveToMfgOrder}
            order={moveToMfgOrder}
            onClose={() => setMoveToMfgOrder(null)}
            onMove={async (itemsToMove) => {
              try {
                await moveToMfg({ id: moveToMfgOrder._id, itemsToMove }).unwrap();
                setMoveToMfgOrder(null);
                await refetchMfg();
                await fetchMrpIntake();
                setSubTab("manufacturing-orders");
              } catch (error: any) {
                alert(error?.data?.message || "Failed to create Manufacturing Order");
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

