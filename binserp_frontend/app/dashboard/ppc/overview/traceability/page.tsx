"use client";

import React, { useState, useMemo, useEffect } from "react";
import PPCTabs from "../../components/PPCTabs";
import PPCOverviewNav from "../components/PPCOverviewNav";
import { useHeader } from "@/src/context/HeaderContext";
import { 
  useGetManufacturingOrdersQuery, 
  useGetJobsByOrderQuery 
} from "@/src/store/services/ppcService";
import { 
  Search, PackageCheck, Layers, GitBranch, ShieldCheck, 
  Clock, CheckCircle2, Factory, Calendar, User, FileText, 
  Printer, ArrowRight, AlertCircle, RefreshCw, ChevronRight, Hash
} from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";

export default function MOTraceabilityPage() {
  const { setHeader } = useHeader();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    setHeader("PPC Overview", "Manufacturing Order Lifecycle & End-to-End Traceability");
  }, [setHeader]);

  const { 
    data: manufacturingOrders = [], 
    isLoading: loadingOrders, 
    refetch: refetchOrders 
  } = useGetManufacturingOrdersQuery();

  // Filter orders by search term (MO #, MRP #, Customer, Part Name)
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return manufacturingOrders;
    const term = searchTerm.toLowerCase();
    return manufacturingOrders.filter((mo: any) => {
      const matchOrderNo = mo.orderNumber?.toLowerCase().includes(term);
      const matchMrp = (mo.mrpNumber || mo.originMrpNumber || "").toLowerCase().includes(term);
      const matchPo = (mo.poReference || "").toLowerCase().includes(term);
      const matchCustomer = (mo.customerName || mo.customer?.name || "").toLowerCase().includes(term);
      const matchItem = (mo.items || []).some((i: any) => 
        (i.productName || i.materialName || "").toLowerCase().includes(term) ||
        (i.description || "").toLowerCase().includes(term)
      );
      return matchOrderNo || matchMrp || matchPo || matchCustomer || matchItem;
    });
  }, [manufacturingOrders, searchTerm]);

  // Set initial selected order
  useEffect(() => {
    if (!selectedOrderId && filteredOrders.length > 0) {
      setSelectedOrderId(filteredOrders[0]._id);
    }
  }, [filteredOrders, selectedOrderId]);

  // Selected Order Object
  const selectedOrder = useMemo(() => {
    return manufacturingOrders.find((mo: any) => mo._id === selectedOrderId) || filteredOrders[0] || null;
  }, [manufacturingOrders, filteredOrders, selectedOrderId]);

  // Fetch Jobs for the selected order
  const { 
    data: orderJobs = [], 
    isLoading: loadingJobs 
  } = useGetJobsByOrderQuery(selectedOrder?._id, { skip: !selectedOrder?._id });

  const firstItem = selectedOrder?.items?.[0] || {};
  const itemName = firstItem.productName || firstItem.materialName || selectedOrder?.productName || "Assembly Component";
  const itemDesc = firstItem.description || firstItem.descriptions || firstItem.specification || "";
  const originMrp = selectedOrder?.mrpNumber || selectedOrder?.originMrpNumber || selectedOrder?.poReference;

  // Determine stage completion for the 6-stage lifecycle stepper
  const isPending = selectedOrder?.status === "Pending";
  const isPlanning = selectedOrder?.status === "Planning" || selectedOrder?.status === "Confirmed";
  const isInProduction = selectedOrder?.status === "InProduction" || selectedOrder?.status === "InProgress";
  const isCompleted = selectedOrder?.status === "Completed" || selectedOrder?.status === "Dispatched";

  const lifecycleStages = [
    {
      title: "MRP Demand Intake",
      desc: originMrp ? `Linked to MRP #${originMrp}` : "Direct Intake",
      status: "completed",
      date: selectedOrder?.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString('en-GB') : "Logged",
    },
    {
      title: "Manufacturing Order",
      desc: `${selectedOrder?.orderNumber || "MO Generated"} • ${firstItem.quantity || 1} ${firstItem.unit || "PCS"}`,
      status: "completed",
      date: selectedOrder?.createdAt ? new Date(selectedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Active",
    },
    {
      title: "BOM & Material Plan",
      desc: isPending ? "BOM allocated, pending store release" : "Material plan confirmed & issued",
      status: !isPending ? "completed" : "current",
      date: isPending ? "In Queue" : "Allocated",
    },
    {
      title: "Shopfloor Execution",
      desc: orderJobs.length > 0 
        ? `${orderJobs.length} Production Job(s) Active` 
        : isInProduction ? "Routing steps in progress" : "Awaiting machine scheduling",
      status: isCompleted ? "completed" : isInProduction ? "current" : isPlanning ? "upcoming" : "upcoming",
      date: selectedOrder?.deliveryDate ? `Target: ${new Date(selectedOrder.deliveryDate).toLocaleDateString('en-GB')}` : "Scheduled",
    },
    {
      title: "Quality Inspection (QC)",
      desc: isCompleted ? "All operations QC passed" : "In-process first-piece & routing QC checks",
      status: isCompleted ? "completed" : isInProduction ? "upcoming" : "upcoming",
      date: isCompleted ? "Passed" : "Pending",
    },
    {
      title: "Dispatch & Store Ready",
      desc: selectedOrder?.status === "Dispatched" ? "Dispatched to customer" : isCompleted ? "FG GRN ready for delivery" : "Final store handover pending",
      status: isCompleted ? "completed" : "upcoming",
      date: isCompleted ? "Ready" : "Pending",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="overview" />
        <PPCOverviewNav />

        {/* Search Bar & Header */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 p-4 mb-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3.5 top-3 text-slate-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by MO # (e.g. MO-MRP...), MRP #, PO Ref, Part Name, or Customer..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                onClick={() => refetchOrders()}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                title="Refresh Orders"
              >
                <RefreshCw size={15} className={loadingOrders ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Printer size={14} />
                <span>Print Dossier</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: MO Selector List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Manufacturing Orders ({filteredOrders.length})
              </span>
              <span className="text-[11px] font-mono text-slate-400">Click to trace</span>
            </div>

            {loadingOrders ? (
              <div className="p-12 flex justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <LoadingSpinner size="md" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <PackageCheck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Orders Found</p>
                <p className="text-[11px] text-slate-400 mt-1">Try a different search term or create an MO from Orders.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
                {filteredOrders.map((mo: any) => {
                  const isSelected = selectedOrder?._id === mo._id;
                  const item = mo.items?.[0] || {};
                  const name = item.productName || item.materialName || mo.productName || "Component";
                  const desc = item.description || item.descriptions || item.specification || "";
                  const mrp = mo.mrpNumber || mo.originMrpNumber;

                  return (
                    <div
                      key={mo._id}
                      onClick={() => setSelectedOrderId(mo._id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected 
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-sm"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                            {mo.orderNumber}
                          </div>
                          
                          {/* Item Name & Description per AGENTS.md */}
                          <div className="mt-1">
                            <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {name}
                            </div>
                            {desc && (
                              <div className="text-[10px] text-slate-500 italic truncate mt-0.5">
                                {desc}
                              </div>
                            )}
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold shrink-0 ${
                          mo.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                          mo.status === 'InProduction' || mo.status === 'InProgress' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' :
                          'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {mo.status || 'Pending'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400">
                        {mrp ? (
                          <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                            MRP #{mrp}
                          </span>
                        ) : (
                          <span>PO: {mo.poReference || "Direct"}</span>
                        )}
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Qty: {item.quantity || mo.quantity || 1} {item.unit || "PCS"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Full End-to-End Traceability Dossier */}
          <div className="lg:col-span-8">
            {!selectedOrder ? (
              <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <PackageCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Select an Order to Trace</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Select any manufacturing order from the left list or search by MO/MRP number to view complete end-to-end traceability.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* 1. Dossier Header Card */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-xl font-extrabold font-mono text-slate-900 dark:text-white">
                          {selectedOrder.orderNumber}
                        </h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                          selectedOrder.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200' :
                          selectedOrder.status === 'InProduction' || selectedOrder.status === 'InProgress' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200' :
                          'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200'
                        }`}>
                          {selectedOrder.status || 'Pending Execution'}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-slate-500">
                        {originMrp && (
                          <span className="font-mono font-black text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                            MRP #{originMrp}
                          </span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User size={13} className="text-slate-400" />
                          <strong className="text-slate-800 dark:text-slate-200">{selectedOrder.customerName || selectedOrder.customer?.name || "Internal Demand"}</strong>
                        </span>
                        {selectedOrder.poReference && (
                          <>
                            <span>•</span>
                            <span className="font-mono">Ref: {selectedOrder.poReference}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Target Delivery Date</div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1 justify-end mt-0.5">
                        <Calendar size={13} className="text-indigo-600 dark:text-indigo-400" />
                        {selectedOrder.deliveryDate ? new Date(selectedOrder.deliveryDate).toLocaleDateString('en-GB') : "N/A"}
                      </div>
                    </div>
                  </div>

                  {/* Item Specification Details per AGENTS.md */}
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Manufactured Item & Technical Details
                      </div>
                      
                      {/* Name Prominent & Technical Description in Italics */}
                      <div className="text-base font-bold text-slate-900 dark:text-white">
                        {itemName}
                      </div>
                      {itemDesc && (
                        <div className="text-xs text-slate-600 dark:text-slate-400 italic mt-1 leading-relaxed">
                          {itemDesc}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {firstItem.itemType || "SubAssembly Component"}
                        </span>
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200">
                          {firstItem.trackingType === 'Batch' ? 'Batch / Lot Tracked' : 'Individual Serial Tracked'}
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-4 flex flex-col justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Order Quantity</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                          {firstItem.quantity || selectedOrder.quantity || 1}
                          <span className="text-xs font-normal text-slate-400 ml-1">{firstItem.unit || "PCS"}</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-2">
                        Created: {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString('en-GB') : "N/A"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. 6-Stage Lifecycle Stepper */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6 flex items-center gap-2">
                    <GitBranch size={15} className="text-indigo-600" />
                    <span>6-Stage Traceability & Lifecycle Progression</span>
                  </h3>

                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {lifecycleStages.map((st, idx) => {
                      const isDone = st.status === "completed";
                      const isCurr = st.status === "current";

                      return (
                        <div key={idx} className="relative group">
                          <div className={`absolute -left-[30px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                            isDone 
                              ? "bg-emerald-500 border-white dark:border-slate-900 text-white shadow-xs" 
                              : isCurr 
                              ? "bg-indigo-600 border-white dark:border-slate-900 text-white ring-4 ring-indigo-100 dark:ring-indigo-950" 
                              : "bg-slate-100 dark:bg-slate-800 border-white dark:border-slate-900 text-slate-400"
                          }`}>
                            {isDone ? <CheckCircle2 size={13} /> : <span className="text-[10px] font-bold">{idx + 1}</span>}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div>
                              <h4 className={`text-xs sm:text-sm font-bold ${
                                isDone ? "text-slate-900 dark:text-white" : isCurr ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"
                              }`}>
                                {st.title}
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {st.desc}
                              </p>
                            </div>

                            <span className="text-[10px] font-mono font-semibold text-slate-400 shrink-0">
                              {st.date}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Shopfloor Routing & Live Jobs Card */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <Factory size={15} className="text-indigo-600" />
                      <span>Shopfloor Operation Routing & Machine Jobs</span>
                    </h3>
                    <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                      {orderJobs.length} Job Cards Generated
                    </span>
                  </div>

                  {loadingJobs ? (
                    <div className="p-8 flex justify-center"><LoadingSpinner size="sm" /></div>
                  ) : orderJobs.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <Clock className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Routing Jobs Executed Yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Route cards and machine assignments will automatically show here once scheduled in Auto Planning.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orderJobs.map((job: any, jIdx: number) => (
                        <div key={job._id || jIdx} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                              Job #{job.jobNumber || `JOB-${jIdx + 1}`}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              job.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                              job.status === 'InProgress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                              'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {job.status || 'Scheduled'}
                            </span>
                          </div>

                          {/* Process History Table */}
                          {job.processHistory && job.processHistory.length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px] text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase font-bold">
                                  <tr>
                                    <th className="px-3 py-1.5">Step</th>
                                    <th className="px-3 py-1.5">Process Name</th>
                                    <th className="px-3 py-1.5">Assigned Machine</th>
                                    <th className="px-3 py-1.5">Operator</th>
                                    <th className="px-3 py-1.5 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {job.processHistory.map((p: any, pIdx: number) => (
                                    <tr key={p._id || pIdx} className="hover:bg-slate-100/50">
                                      <td className="px-3 py-2 font-mono font-bold">{pIdx + 1}</td>
                                      <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">{p.processName}</td>
                                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300 font-mono">{p.assignedMachine?.name || p.assignedMachine || "Automatic"}</td>
                                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.assignedEmployee?.name || "Team Pool"}</td>
                                      <td className="px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                          p.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                                          p.status === 'InProgress' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {p.status || 'Pending'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
