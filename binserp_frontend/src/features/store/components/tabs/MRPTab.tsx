import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Plus, Search, Calendar, User, Eye, Trash2, Package, 
  CheckCircle2, Clock, Filter, ArrowRight, ArrowLeft, X, Building2, Printer, 
  LayoutGrid, List, Edit2, ShieldCheck, Download, ShoppingCart, 
  Sparkles, RefreshCw, FileText, AlertCircle, Send, CheckSquare, Square,
  Check, Boxes, ChevronRight, Factory, Play
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/src/lib/api';
import Swal from 'sweetalert2';
import MRPModal from '../modals/MRPModal';
import MRPDetailsModal from '../modals/MRPDetailsModal';
import MRPOutwardRfqModal from '../modals/MRPOutwardRfqModal';
import POModal from '../modals/POModal';
import MRPProcurementWorkbench from './MRPProcurementWorkbench';
import MRP360WipDrawer from '../modals/MRP360WipDrawer';

interface MRPTabProps {
  token?: string | null;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export default function MRPTab({ token: propToken, onError, onSuccess }: MRPTabProps) {
  const [loading, setLoading] = useState(true);
  const [mainView, setMainView] = useState<'plans' | 'workbench'>('plans');
  const [mrpPlans, setMrpPlans] = useState<any[]>([]);
  const [selectedDemandPlan, setSelectedDemandPlan] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  
  // Date & Day Filters
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'thisMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateType, setDateType] = useState<'created' | 'target'>('created');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPlanForDetails, setSelectedPlanForDetails] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // 360 WIP Drawer State
  const [drawerPlanId, setDrawerPlanId] = useState<string | null>(null);
  const [is360DrawerOpen, setIs360DrawerOpen] = useState(false);

  // RFQ & PO Modal States for MRP
  const [isRfqModalOpen, setIsRfqModalOpen] = useState(false);
  const [rfqModalItems, setRfqModalItems] = useState<any[]>([]);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [poInitialData, setPoInitialData] = useState<any>(null);

  // Store data for PO modal
  const [vendors, setVendors] = useState<any[]>([]);
  const [allMaterials, setAllMaterials] = useState<any[]>([]);

  const token = propToken || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '');

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [mrpRes, venRes, rmRes, boRes] = await Promise.all([
        apiGet('/api/purchase/mrp/plans', token).catch(() => ({ mrpPlans: [] })),
        apiGet('/api/store/vendor', token).catch(() => []),
        apiGet('/api/store/raw-material', token).catch(() => []),
        apiGet('/api/store/bought-out', token).catch(() => [])
      ]);

      const plans = mrpRes.mrpPlans || [];
      setMrpPlans(plans);

      // Keep selectedDemandPlan in sync if open
      if (selectedDemandPlan) {
        const found = plans.find((p: any) => p._id === selectedDemandPlan._id);
        if (found) setSelectedDemandPlan(found);
      }

      const vList = Array.isArray(venRes?.vendors) ? venRes.vendors : (Array.isArray(venRes) ? venRes : []);
      setVendors(vList);
      const rmList = Array.isArray(rmRes) ? rmRes : (rmRes?.rawMaterials || []);
      const boList = Array.isArray(boRes) ? boRes : (boRes?.boughtOuts || []);
      setAllMaterials([...rmList, ...boList]);
    } catch (err: any) {
      console.error('Failed to fetch MRP data:', err);
      if (onError) onError(err.message || 'Failed to fetch MRP plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Action: Move MRP to Production
  const handleMoveToProduction = async (planId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await apiPost(`/api/purchase/mrp/plan/${planId}/move-to-production`, {}, token);
      Swal.fire({
        icon: 'success',
        title: 'Sent to Production!',
        text: res.message || 'MRP Demands successfully routed to PPC Production Queue.',
        timer: 3000
      });
      fetchData();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to route to production', 'error');
    }
  };

  const handleOpenDetails = (plan: any) => {
    setSelectedPlanForDetails(plan);
    setIsDetailsModalOpen(true);
  };

  // Filtered MRP Plans for Master List (Step 1)
  const filteredMrpPlans = useMemo(() => {
    const today = new Date();
    const isSameDay = (d1: Date, d2: Date) => 
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    return (Array.isArray(mrpPlans) ? mrpPlans : []).filter((plan: any) => {
      // Date Resolution
      const rawDate = dateType === 'target' 
        ? (plan.targetDate || plan.deliveryDate || plan.createdAt) 
        : (plan.createdAt || plan.planDate || plan.date || plan.targetDate);
      const planDate = new Date(rawDate || Date.now());

      let matchesDate = true;
      if (dateFilter === 'today') {
        matchesDate = isSameDay(planDate, today);
      } else if (dateFilter === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        matchesDate = isSameDay(planDate, yesterday);
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        matchesDate = planDate >= sevenDaysAgo && planDate <= today;
      } else if (dateFilter === 'thisMonth') {
        matchesDate = planDate.getMonth() === today.getMonth() && planDate.getFullYear() === today.getFullYear();
      } else if (dateFilter === 'custom') {
        if (startDate && endDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          matchesDate = planDate >= s && planDate <= e;
        } else if (startDate) {
          const s = new Date(startDate);
          matchesDate = isSameDay(planDate, s) || planDate >= s;
        } else if (endDate) {
          const e = new Date(endDate);
          matchesDate = isSameDay(planDate, e) || planDate <= e;
        }
      }

      if (!matchesDate) return false;

      // Search Filter
      const s = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        plan.mrpNumber.toLowerCase().includes(s) ||
        (plan.customerName && plan.customerName.toLowerCase().includes(s)) ||
        (plan.customerPoNumber && plan.customerPoNumber.toLowerCase().includes(s)) ||
        (plan.fgItems || []).some((f: any) => (f.fgItemName && f.fgItemName.toLowerCase().includes(s)) || (f.fgItemCode && f.fgItemCode.toLowerCase().includes(s)));

      if (!matchesSearch) return false;

      // Status Filter
      const matchesStatus = filterStatus === 'All' || plan.status === filterStatus;
      return matchesStatus;
    });
  }, [mrpPlans, searchTerm, filterStatus, dateFilter, startDate, endDate, dateType]);

  // Submit PO directly
  const handlePOSubmit = async (formData: any) => {
    try {
      await apiPost('/api/purchase/po', formData, token);
      Swal.fire({
        icon: 'success',
        title: 'Purchase Order Created!',
        text: `PO created successfully.`,
        timer: 2500
      });
      setIsPoModalOpen(false);
      setPoInitialData(null);
      fetchData();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to submit PO', 'error');
    }
  };

  // Delete MRP Demand Plan with Safety Check
  const handleDeletePlan = async (planId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const plan = mrpPlans.find((p) => p._id === planId) || selectedDemandPlan;
    if (!plan) return;

    const isInProduction = plan.status === 'In Production' || plan.status === 'Partially Completed';
    const isSentToPPC = plan.ppcStatus === 'Sent' || plan.status === 'In Production';

    let warningHtml = `<p class="text-xs text-slate-600 dark:text-slate-300">Are you sure you want to delete MRP Plan <strong>${plan.mrpNumber}</strong>?</p>`;

    if (isInProduction || isSentToPPC) {
      warningHtml = `
        <div class="text-left space-y-2 text-xs">
          <div class="p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200">
            <strong>⚠️ Caution: Active Production / PPC Link</strong>
            <p class="mt-1">This MRP Demand Plan is currently <strong>${plan.status}</strong> and has active manufacturing operations routed to PPC or procurement.</p>
          </div>
          <p class="text-rose-600 font-bold">Deleting this plan will remove all associated material breakdowns and may desynchronize active production jobs!</p>
        </div>
      `;
    }

    const result = await Swal.fire({
      title: isInProduction ? 'Warning: Plan in Production!' : 'Delete MRP Plan?',
      html: warningHtml,
      icon: isInProduction ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete Plan',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await apiDelete(`/api/purchase/mrp/plan/${planId}`, token);
        Swal.fire({
          icon: 'success',
          title: 'Plan Deleted',
          text: `MRP Plan ${plan.mrpNumber} has been deleted.`,
          timer: 2000
        });
        if (selectedDemandPlan && selectedDemandPlan._id === planId) {
          setSelectedDemandPlan(null);
        }
        fetchData();
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to delete MRP Plan', 'error');
      }
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* 1. TOP-LEVEL VIEW SWITCHER: PLANS | WORKBENCH | 360 WIP */}
      <div className="bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setMainView('plans')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              mainView === 'plans'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers size={14} />
            <span>📑 MRP Demand Plans</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${mainView === 'plans' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {mrpPlans.length}
            </span>
          </button>

          <button
            onClick={() => setMainView('workbench')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              mainView === 'workbench'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            <ShoppingCart size={14} />
            <span>🛒 Procurement Workbench</span>
          </button>
        </div>
      </div>

      {/* VIEW 2: PROCUREMENT WORKBENCH */}
      {mainView === 'workbench' && (
        <MRPProcurementWorkbench
          token={token}
          onOpenRfqModal={(items) => {
            setRfqModalItems(items);
            setIsRfqModalOpen(true);
          }}
          onOpenPoModal={(poData) => {
            setPoInitialData(poData);
            setIsPoModalOpen(true);
          }}
          onRefreshPlans={fetchData}
        />
      )}

      {/* VIEW 1: MRP DEMAND PLANS */}
      {mainView === 'plans' && (
        <div className="space-y-4">
          
          {/* ========================================================================= */}
          {/* STEP 1: MASTER LIST OF MRP DEMAND PLANS (Click an MRP to view FG items)   */}
          {/* ========================================================================= */}
          {!selectedDemandPlan && (
            <div className="space-y-4">
              
              {/* Controls Toolbar: Search & Action Buttons */}
              <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
                
                {/* Search Box */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    placeholder="Search MRP #, Customer, PO Ref, Finished Goods..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                  />
                </div>

                {/* Status Filter Pills & Create Button */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar gap-0.5">
                    {['All', 'Planned', 'In Production', 'Partially Completed', 'Completed'].map(status => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                          filterStatus === status 
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs font-bold' 
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={fetchData}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900 cursor-pointer"
                    title="Refresh"
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  </button>

                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Plus size={14} /> Create MRP Plan
                  </button>
                </div>
              </div>

              {/* Date & Day Filter Bar */}
              <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full lg:w-auto flex-wrap sm:flex-nowrap">
                  
                  {/* Date Type Selector */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-bold shrink-0 mr-1">
                    <button
                      onClick={() => setDateType('created')}
                      className={`px-2 py-0.8 rounded-md transition-all cursor-pointer ${
                        dateType === 'created' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-bold' : 'text-slate-500'
                      }`}
                    >
                      Plan Date
                    </button>
                    <button
                      onClick={() => setDateType('target')}
                      className={`px-2 py-0.8 rounded-md transition-all cursor-pointer ${
                        dateType === 'target' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-bold' : 'text-slate-500'
                      }`}
                    >
                      Target Date
                    </button>
                  </div>

                  {[
                    { id: 'all', label: 'All Dates' },
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: '7days', label: 'Last 7 Days' },
                    { id: 'thisMonth', label: 'This Month' },
                    { id: 'custom', label: 'Custom Range' },
                  ].map((df) => (
                    <button
                      key={df.id}
                      onClick={() => setDateFilter(df.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        dateFilter === df.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {df.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Range Inputs */}
                {dateFilter === 'custom' && (
                  <div className="flex items-center gap-1.5 w-full lg:w-auto flex-wrap sm:flex-nowrap">
                    <span className="text-[11px] text-slate-400 font-semibold">From:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                    />
                    <span className="text-[11px] text-slate-400 font-semibold">To:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                    />
                    {(startDate || endDate) && (
                      <button 
                        onClick={() => { setStartDate(''); setEndDate(''); }}
                        className="p-1 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        title="Clear Dates"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Master MRP Plans Table */}
              {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <RefreshCw className="animate-spin text-indigo-600 w-8 h-8" />
                </div>
              ) : filteredMrpPlans.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No MRP Plans Found</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">No demand plans match the selected filters.</p>
                  <button
                    onClick={() => {
                      setDateFilter('all');
                      setFilterStatus('All');
                      setSearchTerm('');
                    }}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-3.5">MRP Number</th>
                          <th className="p-3.5">Customer & Order Ref</th>
                          <th className="p-3.5 text-center">Plan Date</th>
                          <th className="p-3.5">Finished Goods (FG) Demand</th>
                          <th className="p-3.5 text-center">Total Order vs GRN Received</th>
                          <th className="p-3.5 text-center">Procurement Status</th>
                          <th className="p-3.5 text-center">Plan Status</th>
                          <th className="p-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredMrpPlans.map((plan) => {
                          const fgItems = plan.fgItems || [];
                          const fgCount = fgItems.length;
                          const firstFG = fgItems[0];

                          const totalTarget = fgItems.reduce((s: number, f: any) => s + (Number(f.quantity) || 0), 0);
                          const totalReceived = fgItems.reduce((s: number, f: any) => s + (Number(f.receivedQuantity) || 0), 0);
                          const progressPct = totalTarget > 0 ? Math.min(100, Math.round((totalReceived / totalTarget) * 100)) : 0;

                          const allChildMats = [...(plan.rmRequirements || []), ...(plan.boRequirements || [])];
                          const shortagesCount = allChildMats.filter((m: any) => m.shortage > 0).length;
                          const isProcurementFulfilled = shortagesCount === 0;

                          const formattedDate = plan.createdAt ? new Date(plan.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "-";

                          return (
                            <tr 
                              key={plan._id}
                              onClick={() => setSelectedDemandPlan(plan)}
                              className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors"
                            >
                              {/* MRP Number */}
                              <td className="p-3.5">
                                <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                  {plan.mrpNumber}
                                </span>
                              </td>

                              {/* Customer & PO */}
                              <td className="p-3.5">
                                <strong className="text-slate-900 dark:text-white block">{plan.customerName || "Internal Demand"}</strong>
                                {plan.customerPoNumber && (
                                  <span className="font-mono text-[10px] text-slate-400">PO: {plan.customerPoNumber}</span>
                                )}
                              </td>

                              {/* Plan Date */}
                              <td className="p-3.5 text-center font-medium text-slate-600 dark:text-slate-400">
                                {formattedDate}
                              </td>

                              {/* FG Demand Summary */}
                              <td className="p-3.5">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {firstFG?.fgItemName || "Finished Good"}
                                  {fgCount > 1 && <span className="text-slate-400 font-normal ml-1">+{fgCount - 1} more</span>}
                                </div>
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  {fgCount} FG Item{fgCount > 1 ? 's' : ''} planned
                                </span>
                              </td>

                              {/* Target vs Received Progress */}
                              <td className="p-3.5 text-center min-w-[160px]">
                                <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                                  <span className="text-teal-600">{totalReceived} / {totalTarget} Units</span>
                                  <span className="text-slate-400">{progressPct}%</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      progressPct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-teal-500 to-indigo-500'
                                    }`} 
                                    style={{ width: `${progressPct}%` }} 
                                  />
                                </div>
                              </td>

                              {/* Procurement Status */}
                              <td className="p-3.5 text-center">
                                {isProcurementFulfilled ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                                    <CheckCircle2 size={11} /> Fulfilled
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                                    <Clock size={11} /> {shortagesCount} Shortages
                                  </span>
                                )}
                              </td>

                              {/* Plan Status */}
                              <td className="p-3.5 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  plan.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                  plan.status === 'In Production' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                                  plan.status === 'Partially Completed' ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' :
                                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                  {plan.status}
                                </span>
                              </td>

                              {/* Action: Open FG Explorer */}
                              <td className="p-3.5 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDemandPlan(plan);
                                  }}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 ml-auto cursor-pointer"
                                >
                                  <span>View FG Items</span>
                                  <ChevronRight size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: SELECTED MRP DEMAND PLAN — FINISHED GOODS (FG) ITEMS EXPLORER      */}
          {/* ========================================================================= */}
          {selectedDemandPlan && (
            <div className="space-y-4">
              
              {/* Header Bar with Back Button & Plan Info */}
              <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedDemandPlan(null)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>All MRP Plans</span>
                  </button>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-mono font-black">
                        {selectedDemandPlan.mrpNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {selectedDemandPlan.customerName}
                      </span>
                      {selectedDemandPlan.customerPoNumber && (
                        <span className="text-[10px] text-slate-400 font-mono">PO: {selectedDemandPlan.customerPoNumber}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Plan Header Actions */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
                  <button
                    onClick={() => {
                      setDrawerPlanId(selectedDemandPlan._id);
                      setIs360DrawerOpen(true);
                    }}
                    className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold text-xs rounded-xl border border-teal-200 dark:border-teal-800 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Boxes size={13} />
                    <span>360° WIP</span>
                  </button>

                  <button
                    onClick={() => handleOpenDetails(selectedDemandPlan)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>Details & GRN</span>
                  </button>

                  <button
                    onClick={(e) => handleDeletePlan(selectedDemandPlan._id, e)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                    title="Delete Plan"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* FG Items Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3.5">Finished Good (FG) Item</th>
                        <th className="p-3.5 text-center">BOM Number</th>
                        <th className="p-3.5 text-center">Target Quantity</th>
                        <th className="p-3.5 text-center">FG GRN Received</th>
                        <th className="p-3.5 text-center">Balance Remaining</th>
                        <th className="p-3.5 text-center">Completion Progress</th>
                        <th className="p-3.5 text-center">Procurement Status</th>
                        <th className="p-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(selectedDemandPlan.fgItems || []).map((fg: any, fgIdx: number) => {
                        const fgQty = Number(fg.quantity) || 1;
                        const recQty = Number(fg.receivedQuantity) || 0;
                        const balQty = Math.max(0, fgQty - recQty);
                        const pct = Math.min(100, Math.round((recQty / fgQty) * 100));

                        const allChildMats = [...(selectedDemandPlan.rmRequirements || []), ...(selectedDemandPlan.boRequirements || [])];
                        const hasShortages = allChildMats.some((m: any) => m.shortage > 0);
                        const isProcurementFulfilled = !hasShortages;

                        return (
                          <tr key={fgIdx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            {/* FG Name & Code */}
                            <td className="p-3.5">
                              <strong className="text-slate-900 dark:text-white block text-sm">{fg.fgItemName}</strong>
                              {fg.fgItemCode && <span className="font-mono text-[10px] text-slate-400">{fg.fgItemCode}</span>}
                            </td>

                            {/* BOM Number */}
                            <td className="p-3.5 text-center font-mono text-[10px] text-slate-500">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {fg.bomNumber || "BOM-Active"}
                              </span>
                            </td>

                            {/* Target Qty */}
                            <td className="p-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                              {fgQty} {fg.unit || 'PCS'}
                            </td>

                            {/* Received Qty */}
                            <td className="p-3.5 text-center font-bold text-teal-600">
                              {recQty} {fg.unit || 'PCS'}
                            </td>

                            {/* Balance Qty */}
                            <td className="p-3.5 text-center">
                              {balQty > 0 ? (
                                <span className="font-bold text-amber-600">{balQty} {fg.unit || 'PCS'}</span>
                              ) : (
                                <span className="font-bold text-emerald-600">0 (Fulfilled)</span>
                              )}
                            </td>

                            {/* Progress Bar */}
                            <td className="p-3.5 text-center min-w-[140px]">
                              <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                                <span className="text-teal-600">{pct}% Done</span>
                                <span className="text-slate-400">{recQty}/{fgQty}</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${
                                    pct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-teal-500 to-indigo-500'
                                  }`} 
                                  style={{ width: `${pct}%` }} 
                                />
                              </div>
                            </td>

                            {/* Procurement Status */}
                            <td className="p-3.5 text-center">
                              {isProcurementFulfilled ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                                  <CheckCircle2 size={11} /> Fulfilled
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                                  <Clock size={11} /> Shortages Pending
                                </span>
                              )}
                            </td>

                            {/* Action: Move to Production */}
                            <td className="p-3.5 text-right">
                              {selectedDemandPlan.status !== 'In Production' && pct < 100 && (
                                <button
                                  onClick={(e) => handleMoveToProduction(selectedDemandPlan._id, e)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ml-auto ${
                                    isProcurementFulfilled 
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer'
                                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer'
                                  }`}
                                  title="Move to Production"
                                >
                                  <Play size={11} /> Move to Prod
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* 360 WIP Drawer */}
      {drawerPlanId && (
        <MRP360WipDrawer
          isOpen={is360DrawerOpen}
          onClose={() => {
            setIs360DrawerOpen(false);
            setDrawerPlanId(null);
          }}
          mrpPlanId={drawerPlanId}
          token={token}
        />
      )}

      {/* MRP Create Modal */}
      {isCreateModalOpen && (
        <MRPModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={fetchData}
          token={token}
        />
      )}

      {/* MRP Details Modal */}
      {isDetailsModalOpen && selectedPlanForDetails && (
        <MRPDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          mrpPlan={selectedPlanForDetails}
        />
      )}

      {/* MRP Outward RFQ Creation Modal */}
      {isRfqModalOpen && (
        <MRPOutwardRfqModal
          isOpen={isRfqModalOpen}
          onClose={() => setIsRfqModalOpen(false)}
          token={token}
          initialItems={rfqModalItems}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}

      {/* Outward PO Creation Modal */}
      {isPoModalOpen && (
        <POModal
          isOpen={isPoModalOpen}
          loading={false}
          onClose={() => {
            setIsPoModalOpen(false);
            setPoInitialData(null);
          }}
          onSubmit={handlePOSubmit}
          materials={allMaterials as any}
          vendors={vendors as any}
          initialData={poInitialData}
        />
      )}

    </div>
  );
}
