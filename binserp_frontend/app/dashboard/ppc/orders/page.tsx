"use client";

import React, { useState, useEffect, useMemo } from 'react';
import PPCTabs from "../components/PPCTabs";
import { 
  useGetProductionOrdersQuery, 
  useGetPpcOrdersQuery, 
  useDeleteOrderMutation,
  useUpdatePpcOrderStatusMutation,
  useMoveToManufacturingMutation
} from "@/src/store/services/ppcService";
import { useHeader } from "@/src/context/HeaderContext";
import { 
  FileText, Hammer, Plus, Eye, Edit2, Trash2, ChevronRight, ChevronDown, 
  CheckCircle2, Clock, Layers, Search, RefreshCw, Factory, Boxes, GitBranch, Package, ArrowLeft
} from 'lucide-react';
import CreateOrderModal from "../components/CreateOrderModal";
import OrderDetailModal from "../components/OrderDetailModal";
import MoveToManufacturingModal from "../components/MoveToManufacturingModal";
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { apiGet } from '@/src/lib/api';

type OrderSubTab = "mrp-intake-bucket" | "intake-bucket" | "production-orders" | "manufacturing-orders";

export default function PPCOrdersPage() {
  const { setHeader } = useHeader();
  const [subTab, setSubTab] = useState<OrderSubTab>("mrp-intake-bucket");

  const { data: productionOrders = [], isLoading: loadingProd, refetch: refetchProd } = useGetProductionOrdersQuery();
  const { data: ppcOrders = [], isLoading: loadingPpc, refetch: refetchPpc } = useGetPpcOrdersQuery();

  const [deleteOrder] = useDeleteOrderMutation();
  const [updatePpcOrderStatus] = useUpdatePpcOrderStatusMutation();
  const [moveToMfg] = useMoveToManufacturingMutation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [moveToMfgOrder, setMoveToMfgOrder] = useState<any>(null);

  // MRP Intake Bucket State
  const [mrpBuckets, setMrpBuckets] = useState<any[]>([]);
  const [loadingMrp, setLoadingMrp] = useState<boolean>(false);
  const [mrpSearchTerm, setMrpSearchTerm] = useState<string>('');
  const [expandedMrpKey, setExpandedMrpKey] = useState<string | null>(null);

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
    setHeader("Production & Manufacturing Orders", "Manage customer sales/production orders and shop floor manufacturing orders.");
    fetchMrpIntake();
  }, [setHeader]);

  const intakeOrders = productionOrders.filter((ord: any) => 
    ord.orderNumber?.includes('INTAKE') || ord.remarks?.includes('PPC Order Intake') || ord.status === 'Pending'
  );

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this order?")) {
      try {
        await deleteOrder(id).unwrap();
        refetchProd();
      } catch (err: any) {
        alert(err?.data?.message || "Failed to delete order");
      }
    }
  };

  // Filtered MRP Buckets
  const filteredMrpBuckets = useMemo(() => {
    return mrpBuckets.filter(b => {
      const s = mrpSearchTerm.toLowerCase();
      if (!s) return true;
      const matchesMrp = b.mrpNumber?.toLowerCase().includes(s);
      const matchesCustomer = b.customerName?.toLowerCase().includes(s);
      const matchesPart = (b.items || []).some((it: any) => 
        it.productName?.toLowerCase().includes(s) || it.productCode?.toLowerCase().includes(s)
      );
      return matchesMrp || matchesCustomer || matchesPart;
    });
  }, [mrpBuckets, mrpSearchTerm]);

  // Total in-house parts waiting in MRP intake
  const totalMrpPartsCount = useMemo(() => {
    return mrpBuckets.reduce((acc, b) => acc + (b.items?.length || 0), 0);
  }, [mrpBuckets]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="orders" />

        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Toolbar: SubTabs & Action */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit flex-wrap">
              
              {/* MRP Demand Intake Bucket */}
              <button
                onClick={() => setSubTab("mrp-intake-bucket")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                  subTab === "mrp-intake-bucket"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              >
                <Factory size={16} />
                <span>📑 MRP Demand Intake Bucket</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  subTab === "mrp-intake-bucket" ? "bg-purple-800 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}>
                  {mrpBuckets.length} MRPs ({totalMrpPartsCount} Parts)
                </span>
              </button>

              {/* Sales Order Intake Bucket */}
              <button
                onClick={() => setSubTab("intake-bucket")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                  subTab === "intake-bucket"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              >
                <Clock size={16} />
                <span>Sales Order Intake Bucket ({intakeOrders.length})</span>
              </button>

              {/* All Production Orders */}
              <button
                onClick={() => setSubTab("production-orders")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                  subTab === "production-orders"
                    ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              >
                <FileText size={16} />
                <span>All Production Orders ({productionOrders.length})</span>
              </button>

              {/* Manufacturing Orders */}
              <button
                onClick={() => setSubTab("manufacturing-orders")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                  subTab === "manufacturing-orders"
                    ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              >
                <Hammer size={16} />
                <span>Manufacturing Orders ({ppcOrders.length})</span>
              </button>
            </div>

            {subTab === "production-orders" && (
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setIsCreateOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all justify-center cursor-pointer"
              >
                <Plus size={16} />
                <span>Create Production Order</span>
              </button>
            )}
          </div>

          {/* SubTab Content */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6">
            
            {/* ========================================================================= */}
            {/* SUBTAB 1: MRP DEMAND INTAKE BUCKET (TWO-TIER EXPLORER GROUPED BY MRP)    */}
            {/* ========================================================================= */}
            {subTab === "mrp-intake-bucket" ? (
              loadingMrp ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
              ) : (
                <div className="space-y-4">
                  
                  {/* Banner & Search Filter */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-purple-50 dark:bg-purple-950/40 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div>
                      <strong className="text-sm font-bold text-purple-900 dark:text-purple-300 block flex items-center gap-2">
                        <Factory className="w-4 h-4 text-purple-600" />
                        MRP Demand In-House Manufacturing Bucket
                      </strong>
                      <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">
                        In-house manufactured <b>Components</b>, <b>Sub-Assemblies</b>, and <b>Assemblies</b> dispatched from MRP Procurement Workbench.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-purple-400 w-3.5 h-3.5" />
                        <input
                          type="text"
                          value={mrpSearchTerm}
                          onChange={(e) => setMrpSearchTerm(e.target.value)}
                          placeholder="Search MRP #, Customer, Part..."
                          className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-xl text-xs outline-none"
                        />
                      </div>
                      <button
                        onClick={fetchMrpIntake}
                        className="p-2 bg-white dark:bg-purple-900/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-200 dark:border-purple-700 cursor-pointer"
                        title="Refresh"
                      >
                        <RefreshCw size={13} className={loadingMrp ? "animate-spin" : ""} />
                      </button>
                    </div>
                  </div>

                  {/* MRP Master Table */}
                  <div className="space-y-3">
                    {filteredMrpBuckets.length === 0 ? (
                      <div className="p-12 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                        <Boxes className="w-10 h-10 text-gray-300 mx-auto mb-2 opacity-60" />
                        <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">No MRP Intake Demands Found</h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          In the Store Procurement Workbench, select Components, Sub-Assemblies, or Assemblies and click <b>"🏭 Send to PPC Intake"</b>.
                        </p>
                      </div>
                    ) : (
                      filteredMrpBuckets.map((bucket: any, bIdx: number) => {
                        const isExpanded = expandedMrpKey === bucket.mrpNumber;
                        const items = bucket.items || [];

                        return (
                          <div 
                            key={bIdx}
                            className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-2xs bg-white dark:bg-gray-900"
                          >
                            {/* Tier 1: MRP Demand Header */}
                            <div 
                              onClick={() => setExpandedMrpKey(isExpanded ? null : bucket.mrpNumber)}
                              className="p-4 bg-gray-50/70 dark:bg-gray-800/40 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-black text-xs text-purple-700 bg-purple-100 dark:bg-purple-950 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800">
                                  MRP #{bucket.mrpNumber}
                                </span>
                                <div>
                                  <strong className="text-xs text-gray-900 dark:text-white block">
                                    {bucket.customerName || "Internal Demand"}
                                  </strong>
                                  {bucket.poReference && (
                                    <span className="text-[10px] text-gray-400 font-mono">PO Ref: {bucket.poReference}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-4 text-xs">
                                <span className="font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800 text-[11px]">
                                  {items.length} In-House Part{items.length > 1 ? 's' : ''} ({bucket.totalItemsCount} Total Units)
                                </span>

                                <span className="text-gray-500 text-[11px]">
                                  Target: <b>{bucket.deliveryDate ? new Date(bucket.deliveryDate).toLocaleDateString('en-GB') : "N/A"}</b>
                                </span>

                                <button
                                  type="button"
                                  className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                                >
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                              </div>
                            </div>

                            {/* Tier 2: Expanded Components & Assemblies Table */}
                            {isExpanded && (
                              <div className="border-t border-gray-200 dark:border-gray-800 overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-purple-50/50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300 uppercase font-bold">
                                    <tr>
                                      <th className="px-4 py-2.5">Component / Part Name</th>
                                      <th className="px-4 py-2.5">BOM Classification</th>
                                      <th className="px-4 py-2.5 text-center">Required Qty</th>
                                      <th className="px-4 py-2.5">PPC Intake Batch #</th>
                                      <th className="px-4 py-2.5 text-center">Status</th>
                                      <th className="px-4 py-2.5 text-right">Shopfloor Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {items.map((item: any, itmIdx: number) => {
                                      const type = item.itemType || 'Component';

                                      return (
                                        <tr key={itmIdx} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                                          
                                          {/* Name & Code */}
                                          <td className="px-4 py-3">
                                            <div className="font-bold text-gray-900 dark:text-white">
                                              {item.productName || item.materialName}
                                            </div>
                                            {item.productCode && (
                                              <span className="font-mono text-[10px] text-gray-400">{item.productCode}</span>
                                            )}
                                          </td>

                                          {/* Type Badge */}
                                          <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                              type.toLowerCase().includes('sub') ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' :
                                              type.toLowerCase().includes('assembly') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                              'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                            }`}>
                                              {type === 'SubAssembly' ? '🧩 Sub-Assembly' : type === 'Assembly' ? '🏆 Assembly' : '⚙️ Component'}
                                            </span>
                                          </td>

                                          {/* Required Qty */}
                                          <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                                            {item.quantity} <span className="text-[10px] text-gray-400 font-normal">{item.unit || "PCS"}</span>
                                          </td>

                                          {/* PPC Intake Batch # */}
                                          <td className="px-4 py-3 font-mono text-[10px] text-gray-500">
                                            {item.orderNumber}
                                          </td>

                                          {/* Status */}
                                          <td className="px-4 py-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                              {item.orderStatus || 'Pending'}
                                            </span>
                                          </td>

                                          {/* Action */}
                                          <td className="px-4 py-3 text-right">
                                            <button
                                              onClick={() => {
                                                const targetOrder = (bucket.orders || []).find((o: any) => o._id === item.orderId) || {
                                                  _id: item.orderId,
                                                  orderNumber: item.orderNumber,
                                                  customerName: bucket.customerName,
                                                  items: [item]
                                                };
                                                setMoveToMfgOrder(targetOrder);
                                              }}
                                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                                            >
                                              <Hammer size={12} />
                                              <span>⚡ Create Mfg Order</span>
                                            </button>
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
                      })
                    )}
                  </div>
                </div>
              )
            ) : subTab === "intake-bucket" ? (
              loadingProd ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300 flex justify-between items-center">
                    <div>
                      <strong className="text-sm font-bold block">Sales Order Intake Bucket</strong>
                      Incoming Finished Goods (FG) demand auto-transferred from Sales Orders with inventory shortfalls.
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-amber-100/60 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 uppercase font-bold">
                        <tr>
                          <th className="px-4 py-3">Intake Order #</th>
                          <th className="px-4 py-3">Customer / PO Ref</th>
                          <th className="px-4 py-3">Product Name</th>
                          <th className="px-4 py-3 text-right">Shortfall Qty</th>
                          <th className="px-4 py-3">Target Date</th>
                          <th className="px-4 py-3 text-center">Intake Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {intakeOrders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                              No pending intake orders in bucket. Sales Order shortfalls will automatically arrive here.
                            </td>
                          </tr>
                        ) : (
                          intakeOrders.map((ord: any) => {
                            const firstItem = ord.items?.[0] || {};
                            return (
                              <tr key={ord._id} className="hover:bg-amber-50/50 dark:hover:bg-gray-800/40">
                                <td className="px-4 py-3 font-bold text-amber-800 dark:text-amber-300 font-mono">
                                  {ord.orderNumber}
                                </td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-semibold">
                                  {ord.customerName || ord.customer?.name || "Direct Customer"}
                                  {ord.poReference && <span className="block text-[10px] text-slate-400 font-mono">Ref: {ord.poReference}</span>}
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                                  {firstItem.productName || ord.productName || "FG Product"}
                                </td>
                                <td className="px-4 py-3 text-right font-extrabold text-amber-600">
                                  {firstItem.quantity || ord.quantity || 1}
                                </td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                  {ord.deliveryDate ? new Date(ord.deliveryDate).toLocaleDateString('en-GB') : "N/A"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                                    {ord.status || 'Pending'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => setMoveToMfgOrder(ord)}
                                    title="Create Manufacturing Order"
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                                  >
                                    <Hammer size={14} />
                                    <span>Create Mfg Order</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : subTab === "production-orders" ? (
              loadingProd ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3">Order Number</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">PO Reference</th>
                        <th className="px-4 py-3">Delivery Date</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {productionOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                            No production orders found. Click "+ Create Production Order" to add one.
                          </td>
                        </tr>
                      ) : (
                        productionOrders.map((ord: any) => (
                          <tr key={ord._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                              {ord.orderNumber}
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                              {ord.customerName || "N/A"}
                            </td>
                            <td className="px-4 py-3 text-gray-500 font-mono">
                              {ord.poReference || "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                              {ord.deliveryDate ? new Date(ord.deliveryDate).toLocaleDateString() : "N/A"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                ord.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                ord.status === 'In-Progress' || ord.status === 'Manufacturing' ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {ord.status || 'Pending'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setViewingOrder(ord)}
                                  title="View Details"
                                  className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  onClick={() => setMoveToMfgOrder(ord)}
                                  title="Move to Manufacturing"
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1 text-xs font-semibold cursor-pointer"
                                >
                                  <Hammer size={14} />
                                  <span>Move to Mfg</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingOrder(ord);
                                    setIsCreateOpen(true);
                                  }}
                                  title="Edit Order"
                                  className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => handleDelete(ord._id)}
                                  title="Delete Order"
                                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              loadingPpc ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3">Manufacturing Order</th>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3">Target Date</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {ppcOrders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                            No active manufacturing orders.
                          </td>
                        </tr>
                      ) : (
                        ppcOrders.map((mo: any) => (
                          <tr key={mo._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                              {mo.orderNumber || mo._id}
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-semibold">
                              {mo.productName || mo.product?.name || "FG Item"}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{mo.quantity || 1}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                              {mo.deliveryDate ? new Date(mo.deliveryDate).toLocaleDateString() : "N/A"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                mo.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                mo.status === 'In Progress' || mo.status === 'InProgress' ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {mo.status || 'Planned'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
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
            onSuccess={(msg) => {
              setIsCreateOpen(false);
              setEditingOrder(null);
              refetchProd();
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
                refetchProd();
                refetchPpc();
                fetchMrpIntake();
              } catch (error: any) {
                alert(error?.data?.message || "Failed to move to manufacturing");
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
