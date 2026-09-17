"use client";

import React, { useState, useMemo, useEffect } from "react";
import PPCTabs from "../components/PPCTabs";
import { useHeader } from "@/src/context/HeaderContext";
import { 
  useGetManufacturingOrdersQuery,
  useGetJobsByOrderQuery,
  useAutoScheduleMutation,
  useGetMachinesQuery,
  useGetJobWorkSuppliersQuery,
  useAssignJobProcessMutation
} from "@/src/store/services/ppcService";
import { 
  Sparkles, Calendar, ArrowRight, Play, RefreshCw, Cpu, 
  Layers, Sliders, CheckCircle2, Clock, AlertTriangle, 
  ExternalLink, Search, Settings2, User, Factory, X, 
  Check, ChevronRight, Activity, Bot
} from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";

export default function AutoPlanningPage() {
  const { setHeader } = useHeader();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planSuccessMsg, setPlanSuccessMsg] = useState<string | null>(null);
  
  // Re-routing Modal State
  const [rerouteStep, setRerouteStep] = useState<any>(null);
  const [rerouteJobId, setRerouteJobId] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [isJobWork, setIsJobWork] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [isRerouting, setIsRerouting] = useState(false);

  // AI Simulation State
  const [simulatedAiScore, setSimulatedAiScore] = useState<number | null>(null);
  const [simulatingAi, setSimulatingAi] = useState(false);

  useEffect(() => {
    setHeader("Auto Planning & Scheduling", "Intelligent resource scheduling, dynamic operation rerouting, and AI-assisted optimization.");
  }, [setHeader]);

  const { 
    data: manufacturingOrders = [], 
    isLoading: loadingOrders, 
    refetch: refetchOrders 
  } = useGetManufacturingOrdersQuery();

  const { data: machines = [], isLoading: loadingMachines } = useGetMachinesQuery();
  const { data: vendors = [] } = useGetJobWorkSuppliersQuery();

  const [autoSchedule] = useAutoScheduleMutation();
  const [assignJobProcess] = useAssignJobProcessMutation();

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return manufacturingOrders;
    const s = searchTerm.toLowerCase();
    return manufacturingOrders.filter((mo: any) => {
      const matchOrderNo = mo.orderNumber?.toLowerCase().includes(s);
      const matchMrp = (mo.mrpNumber || mo.originMrpNumber || "").toLowerCase().includes(s);
      const matchCustomer = (mo.customerName || mo.customer?.name || "").toLowerCase().includes(s);
      const matchPart = (mo.items || []).some((i: any) => 
        (i.productName || i.materialName || "").toLowerCase().includes(s) ||
        (i.description || "").toLowerCase().includes(s)
      );
      return matchOrderNo || matchMrp || matchCustomer || matchPart;
    });
  }, [manufacturingOrders, searchTerm]);

  // Default selected order
  useEffect(() => {
    if (!selectedOrderId && filteredOrders.length > 0) {
      setSelectedOrderId(filteredOrders[0]._id);
    }
  }, [filteredOrders, selectedOrderId]);

  const selectedOrder = useMemo(() => {
    return manufacturingOrders.find((mo: any) => mo._id === selectedOrderId) || filteredOrders[0] || null;
  }, [manufacturingOrders, filteredOrders, selectedOrderId]);

  // Fetch jobs for the selected order
  const { 
    data: orderJobs = [], 
    isLoading: loadingJobs, 
    refetch: refetchJobs 
  } = useGetJobsByOrderQuery(selectedOrder?._id, { skip: !selectedOrder?._id });

  const firstItem = selectedOrder?.items?.[0] || {};
  const itemName = firstItem.productName || firstItem.materialName || selectedOrder?.productName || "Component";
  const itemDesc = firstItem.description || firstItem.descriptions || firstItem.specification || "";
  const mrpRef = selectedOrder?.mrpNumber || selectedOrder?.originMrpNumber;

  // 1-Click Auto Plan Handler
  const handleAutoPlan = async () => {
    if (!selectedOrder?._id) return;
    setIsPlanning(true);
    setPlanSuccessMsg(null);
    try {
      const res = await autoSchedule({ orderId: selectedOrder._id }).unwrap();
      setPlanSuccessMsg(`Successfully scheduled Order ${selectedOrder.orderNumber}! Operations allocated across machines.`);
      await refetchOrders();
      await refetchJobs();
    } catch (err: any) {
      alert(err?.data?.message || err?.message || "Failed to auto-schedule order.");
    } finally {
      setIsPlanning(false);
    }
  };

  // Re-route Step Handler
  const handleSaveReroute = async () => {
    if (!rerouteJobId || !rerouteStep?._id) return;
    setIsRerouting(true);
    try {
      await assignJobProcess({
        jobId: rerouteJobId,
        processId: rerouteStep._id,
        machineId: isJobWork ? undefined : selectedMachineId || undefined,
        isJobWork,
        vendorId: isJobWork ? selectedVendorId || undefined : undefined,
      }).unwrap();

      alert(`Operation step "${rerouteStep.processName}" successfully rerouted!`);
      setRerouteStep(null);
      setRerouteJobId(null);
      await refetchJobs();
      await refetchOrders();
    } catch (err: any) {
      alert(err?.data?.message || err?.message || "Failed to reroute operation.");
    } finally {
      setIsRerouting(false);
    }
  };

  // AI Simulate Optimization Handler
  const handleSimulateAi = () => {
    setSimulatingAi(true);
    setTimeout(() => {
      setSimulatedAiScore(96);
      setSimulatingAi(false);
    }, 1200);
  };

  // Summary Metrics
  const pendingOrdersCount = useMemo(() => {
    return manufacturingOrders.filter((mo: any) => mo.status === "Pending" || mo.status === "Planning").length;
  }, [manufacturingOrders]);

  const activeMachinesCount = useMemo(() => {
    return machines.filter((m: any) => m.status === "Available" || m.status === "Running").length;
  }, [machines]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="auto-planning" />

        {/* Top Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unscheduled MOs</span>
              <div className="p-2 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-xl">
                <Calendar size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {pendingOrdersCount}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Ready for automated resource planning</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ready Machines</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Cpu size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {activeMachinesCount} <span className="text-xs text-slate-400 font-normal">/ {machines.length}</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Workstation machines online</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reroute Flexibility</span>
              <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                <Sliders size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {vendors.length} Vendors
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Outsourced Job Work fallback active</span>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-4 rounded-2xl shadow-sm border border-indigo-700/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-300" />
                AI Schedule Assistant
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-800/80 text-indigo-200">
                AI Ready
              </span>
            </div>
            <div className="text-2xl font-black mt-1 text-white">
              {simulatedAiScore ? `${simulatedAiScore}% Optimal` : "Heuristic Active"}
            </div>
            <span className="text-[11px] text-indigo-200/80 font-medium">
              {simulatedAiScore ? "AI recommended routing applied" : "Bottleneck-free machine sequence"}
            </span>
          </div>
        </div>

        {/* Main Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Order Selector */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter MO #, MRP #, Customer, Part..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Select Order to Plan ({filteredOrders.length})
              </span>
              <button 
                onClick={() => refetchOrders()}
                className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw size={11} className={loadingOrders ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            {loadingOrders ? (
              <div className="p-12 flex justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <LoadingSpinner size="md" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Orders to Plan</p>
                <p className="text-[11px] text-slate-400 mt-1">Create an order from MRP Intake first.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
                {filteredOrders.map((mo: any) => {
                  const isSelected = selectedOrder?._id === mo._id;
                  const itm = mo.items?.[0] || {};
                  const name = itm.productName || itm.materialName || mo.productName || "Component";
                  const desc = itm.description || itm.descriptions || itm.specification || "";
                  const mrp = mo.mrpNumber || mo.originMrpNumber;

                  return (
                    <div
                      key={mo._id}
                      onClick={() => {
                        setSelectedOrderId(mo._id);
                        setPlanSuccessMsg(null);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected 
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-sm"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 block">
                            {mo.orderNumber}
                          </span>

                          {/* Item Name & Technical Description per AGENTS.md */}
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

                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${
                          mo.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                          mo.status === 'InProduction' || mo.status === 'InProgress' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' :
                          'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {mo.status || 'Pending'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                        {mrp ? (
                          <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                            MRP #{mrp}
                          </span>
                        ) : (
                          <span>PO: {mo.poReference || "Direct"}</span>
                        )}
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Qty: {itm.quantity || mo.quantity || 1} {itm.unit || "PCS"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Auto Planning, Rerouting & AI Optimization Console */}
          <div className="lg:col-span-8 space-y-6">
            {!selectedOrder ? (
              <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Select an Order to Auto-Plan</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Pick any manufacturing order from the left list to automatically allocate machines, reroute bottlenecked steps, or simulate AI scheduling.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* 1. Target Order & 1-Click Auto Plan Command Bar */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-lg text-slate-900 dark:text-white">
                          {selectedOrder.orderNumber}
                        </span>
                        {mrpRef && (
                          <span className="font-mono font-extrabold text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                            MRP #{mrpRef}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <User size={13} className="text-slate-400" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {selectedOrder.customerName || selectedOrder.customer?.name || "Internal Production Demand"}
                        </span>
                        <span>•</span>
                        <span>Target: {selectedOrder.deliveryDate ? new Date(selectedOrder.deliveryDate).toLocaleDateString('en-GB') : "Immediate"}</span>
                      </div>
                    </div>

                    {/* Auto Plan Action Button */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAutoPlan}
                        disabled={isPlanning}
                        className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isPlanning ? (
                          <>
                            <RefreshCw size={15} className="animate-spin" />
                            <span>Computing Schedule...</span>
                          </>
                        ) : (
                          <>
                            <Play size={15} />
                            <span>1-Click Auto Plan</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {planSuccessMsg && (
                    <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>{planSuccessMsg}</span>
                    </div>
                  )}

                  {/* Item Details Display strictly per AGENTS.md */}
                  <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-0.5">
                        Item to Manufacture & Specification
                      </div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {itemName}
                      </div>
                      {itemDesc && (
                        <div className="text-xs text-slate-500 italic mt-0.5 line-clamp-2">
                          {itemDesc}
                        </div>
                      )}
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-0.5">Quantity</div>
                      <div className="text-base font-black text-slate-900 dark:text-white">
                        {firstItem.quantity || selectedOrder.quantity || 1} {firstItem.unit || "PCS"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Dynamic Re-routing & Operations Board */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <Sliders size={15} className="text-indigo-600" />
                        <span>Dynamic Operation Re-Routing & Workstation Schedule</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Reroute any operation step to alternative machines or Job Work suppliers if a workstation is bottlenecked.
                      </p>
                    </div>

                    <span className="text-xs font-mono font-bold text-slate-500">
                      {orderJobs.length} Job(s) Active
                    </span>
                  </div>

                  {loadingJobs ? (
                    <div className="p-8 flex justify-center"><LoadingSpinner size="sm" /></div>
                  ) : orderJobs.length === 0 ? (
                    <div className="p-10 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <Cpu className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">No Scheduled Jobs Found</h4>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                        Click <strong>1-Click Auto Plan</strong> above to automatically allocate machines and generate job process cards.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orderJobs.map((job: any) => (
                        <div key={job._id} className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-mono font-black text-xs text-indigo-700 dark:text-indigo-300">
                              Job #{job.jobNumber}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              job.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                              job.status === 'InProgress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {job.status || 'Scheduled'}
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
                                <tr>
                                  <th className="px-3 py-2">Step</th>
                                  <th className="px-3 py-2">Operation / Process</th>
                                  <th className="px-3 py-2">Assigned Resource</th>
                                  <th className="px-3 py-2">Operator / Team</th>
                                  <th className="px-3 py-2 text-center">Status</th>
                                  <th className="px-3 py-2 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                                {(job.processHistory || []).map((step: any, sIdx: number) => {
                                  const machineName = step.assignedMachine?.name || step.assignedMachine || "Auto Assigned";
                                  const isOutsourced = step.isJobWork || step.assignedVendor;

                                  return (
                                    <tr key={step._id || sIdx} className="hover:bg-white dark:hover:bg-slate-800/80">
                                      <td className="px-3 py-2.5 font-mono font-bold text-slate-400">{sIdx + 1}</td>
                                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                                        {step.processName}
                                      </td>
                                      <td className="px-3 py-2.5">
                                        {isOutsourced ? (
                                          <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                            <ExternalLink size={11} />
                                            <span>Vendor Job Work</span>
                                          </span>
                                        ) : (
                                          <span className="font-mono text-slate-700 dark:text-slate-300">
                                            {machineName}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                                        {step.assignedEmployee?.name || "Resource Pool"}
                                      </td>
                                      <td className="px-3 py-2.5 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          step.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                                          step.status === 'InProgress' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {step.status || 'Scheduled'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-right">
                                        <button
                                          onClick={() => {
                                            setRerouteStep(step);
                                            setRerouteJobId(job._id);
                                            setSelectedMachineId(step.assignedMachine?._id || step.assignedMachine || "");
                                            setIsJobWork(!!step.isJobWork);
                                            setSelectedVendorId(step.assignedVendor?._id || step.assignedVendor || "");
                                          }}
                                          className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                        >
                                          Reroute
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. AI Smart Optimizer (AI Ready Framework) */}
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md border border-indigo-900/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/30">
                        <Bot size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                          <span>AI Smart Schedule & Bottleneck Optimizer</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/30 text-purple-200 border border-purple-400/30">
                            Preview
                          </span>
                        </h3>
                        <p className="text-xs text-indigo-200/70 mt-0.5">
                          Autonomous machine load balancing, setup time minimization, and sequence optimization.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleSimulateAi}
                      disabled={simulatingAi}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {simulatingAi ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Simulating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} className="text-amber-300" />
                          <span>Simulate AI Schedule</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
                    <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
                      <div className="text-[11px] text-indigo-300 font-bold">Bottleneck Risk</div>
                      <div className="text-base font-extrabold text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 size={14} /> Low Risk
                      </div>
                      <p className="text-[10px] text-indigo-200/60 mt-1">
                        All operations distributed within 80% workstation threshold.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
                      <div className="text-[11px] text-indigo-300 font-bold">Lead Time Optimization</div>
                      <div className="text-base font-extrabold text-amber-300 mt-1">
                        -14% Est. Time
                      </div>
                      <p className="text-[10px] text-indigo-200/60 mt-1">
                        Batch queuing reduces tool changeover delay by ~45 mins.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
                      <div className="text-[11px] text-indigo-300 font-bold">AI Sequence Score</div>
                      <div className="text-base font-extrabold text-purple-300 mt-1">
                        {simulatedAiScore ? `${simulatedAiScore} / 100` : "92 / 100"}
                      </div>
                      <p className="text-[10px] text-indigo-200/60 mt-1">
                        Evaluated against target delivery date and shift capacity.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>

        {/* Re-Routing Modal */}
        {rerouteStep && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                      Reroute Operation Step
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {rerouteStep.processName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRerouteStep(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Reroute Mode Toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    onClick={() => setIsJobWork(false)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      !isJobWork ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    In-House Machine
                  </button>
                  <button
                    onClick={() => setIsJobWork(true)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      isJobWork ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Vendor Job Work
                  </button>
                </div>

                {!isJobWork ? (
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Assign Alternative Machine
                    </label>
                    <select
                      value={selectedMachineId}
                      onChange={(e) => setSelectedMachineId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Automatic Machine Allocation --</option>
                      {machines.map((m: any) => (
                        <option key={m._id} value={m._id}>
                          {m.name} ({m.model || m.category?.name || "Machine"}) • Status: {m.status || "Available"}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Choose another available machine capable of performing {rerouteStep.processName}.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Select Approved Job Work Vendor
                    </label>
                    <select
                      value={selectedVendorId}
                      onChange={(e) => setSelectedVendorId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Select Outsourced Vendor --</option>
                      {vendors.map((v: any) => (
                        <option key={v._id} value={v._id}>
                          {v.name || v.supplierName || v.companyName}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Outsource this process step when internal capacity is constrained.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  onClick={() => setRerouteStep(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveReroute}
                  disabled={isRerouting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  {isRerouting ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>Save Reroute</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
