import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Layers, Plus, Search, Calendar, User, Eye, Trash2, Package, 
  CheckCircle2, Clock, Filter, ArrowRight, ArrowLeft, X, Building2, Printer, 
  LayoutGrid, List, Edit2, ShieldCheck, Download, ShoppingCart, 
  Sparkles, RefreshCw, FileText, AlertCircle, Send, CheckSquare, Square,
  Check, Boxes, ChevronRight, Factory, Play, ChevronDown, ChevronUp, Target, RotateCcw, Lock,
  IndianRupee, AlertTriangle, TrendingUp, TrendingDown
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/src/lib/api';
import Swal from 'sweetalert2';
import MRPModal from '../modals/MRPModal';
import MRPDetailsModal from '../modals/MRPDetailsModal';
import MRPOutwardRfqModal from '../modals/MRPOutwardRfqModal';
import POModal from '../modals/POModal';
import MRPProcurementWorkbench from './MRPProcurementWorkbench';
import MRP360WipDrawer from '../modals/MRP360WipDrawer';
import MRPItemWiseView from '../views/MRPItemWiseView';
import MRPHistoryView from '../views/MRPHistoryView';
import MRPDemandTab from './MRPDemandTab';
import { calculateMRPLockStatus } from '@/src/features/mrp/utils/mrpStatusHelper';
import { useTimeLockPolicy } from '@/src/hooks/useTimeLockPolicy';
import { isSpaceFreeMatch } from '@/src/utils/spaceFreeSearchHelper';

interface MRPTabProps {
  token?: string | null;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export default function MRPTab({ token: propToken, onError, onSuccess }: MRPTabProps) {
  const [loading, setLoading] = useState(true);
  const [mainView, setMainView] = useState<'demand' | 'plans' | 'workbench' | 'history'>('demand');
  const [preselectedPoIds, setPreselectedPoIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'plans' | 'items'>('plans');
  const [showPlansDashboard, setShowPlansDashboard] = useState<boolean>(false);
  const [showItemsDashboard, setShowItemsDashboard] = useState<boolean>(false);
  const isCurrentDashboardShown = viewMode === 'plans' ? showPlansDashboard : showItemsDashboard;
  const toggleDashboard = () => {
    if (viewMode === 'plans') {
      setShowPlansDashboard(prev => !prev);
    } else {
      setShowItemsDashboard(prev => !prev);
    }
  };
  const [mrpPlans, setMrpPlans] = useState<any[]>([]);
  const [selectedDemandPlan, setSelectedDemandPlan] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 3-Tab Filter System: Status (Multi-select), Plan Date, Committed Date
  const MRP_STATUS_OPTIONS = ['Planned', 'In Production', 'Partially Received', 'Partially Completed', 'Completed'] as const;

  // Tab 1: Status Filter State (Multi-Select)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Tab 2: Plan Date Filter State (Created Date / Plan Date)
  const [planDateFilter, setPlanDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'thisMonth' | 'custom'>('all');
  const [planStartDate, setPlanStartDate] = useState<string>('');
  const [planEndDate, setPlanEndDate] = useState<string>('');
  const [isPlanDateDropdownOpen, setIsPlanDateDropdownOpen] = useState(false);
  const planDateDropdownRef = useRef<HTMLDivElement>(null);

  // Tab 3: Committed Date Filter State (Committed / Target Delivery Date)
  const [commitDateFilter, setCommitDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'next7days' | 'thisMonth' | 'custom'>('all');
  const [commitStartDate, setCommitStartDate] = useState<string>('');
  const [commitEndDate, setCommitEndDate] = useState<string>('');
  const [isCommitDateDropdownOpen, setIsCommitDateDropdownOpen] = useState(false);
  const commitDateDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (planDateDropdownRef.current && !planDateDropdownRef.current.contains(event.target as Node)) {
        setIsPlanDateDropdownOpen(false);
      }
      if (commitDateDropdownRef.current && !commitDateDropdownRef.current.contains(event.target as Node)) {
        setIsCommitDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper function to match date presets and custom ranges
  const matchDatePreset = (
    rawDate: any,
    preset: string,
    customStart: string,
    customEnd: string
  ) => {
    if (preset === 'all') return true;
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

  // Helper function to format preset button label
  const formatPresetLabel = (preset: string, start?: string, end?: string) => {
    if (preset === 'custom') {
      if (start && end) return `${start} → ${end}`;
      if (start) return `From ${start}`;
      if (end) return `Until ${end}`;
      return 'Custom';
    }
    switch (preset) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case '7days': return 'Last 7 Days';
      case 'next7days': return 'Next 7 Days';
      case 'thisMonth': return 'This Month';
      case 'all':
      default:
        return 'All';
    }
  };

  // Count active plans per status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Planned: 0,
      'In Production': 0,
      'Partially Received': 0,
      'Partially Completed': 0,
      Completed: 0
    };
    (Array.isArray(mrpPlans) ? mrpPlans : []).forEach((p) => {
      if (p.status && counts[p.status] !== undefined) {
        counts[p.status]++;
      }
    });
    return counts;
  }, [mrpPlans]);

  // Check if any filter is active
  const isAnyFilterActive = useMemo(() => {
    return (
      selectedStatuses.length > 0 ||
      planDateFilter !== 'all' ||
      Boolean(planStartDate || planEndDate) ||
      commitDateFilter !== 'all' ||
      Boolean(commitStartDate || commitEndDate) ||
      Boolean(searchTerm)
    );
  }, [selectedStatuses, planDateFilter, planStartDate, planEndDate, commitDateFilter, commitStartDate, commitEndDate, searchTerm]);

  // Reset all filters in 1 click
  const handleResetAllFilters = () => {
    setSelectedStatuses([]);
    setPlanDateFilter('all');
    setPlanStartDate('');
    setPlanEndDate('');
    setCommitDateFilter('all');
    setCommitStartDate('');
    setCommitEndDate('');
    setSearchTerm('');
  };

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { getPolicyHours } = useTimeLockPolicy(propToken);

  const getPlanLockStatus = (plan: any) => {
    return calculateMRPLockStatus(plan, currentTime, getPolicyHours('mrpPlan'));
  };

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
  const [inHouseItems, setInHouseItems] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);

  const token = propToken || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '');

  const fetchSecondaryDependencies = async () => {
    if (!token) return;
    try {
      const [venRes, rmRes, boRes, fgRes, plRes] = await Promise.all([
        apiGet('/api/store/vendor', token).catch(() => []),
        apiGet('/api/store/raw-material', token).catch(() => []),
        apiGet('/api/store/bought-out', token).catch(() => []),
        apiGet('/api/store/fg-item', token).catch(() => []),
        apiGet('/api/purchase/price-list', token).catch(() => ({ data: [] }))
      ]);

      const vList = Array.isArray(venRes?.vendors) ? venRes.vendors : (Array.isArray(venRes) ? venRes : []);
      setVendors(vList);
      const rmList = Array.isArray(rmRes) ? rmRes : (rmRes?.rawMaterials || []);
      const boList = Array.isArray(boRes) ? boRes : (boRes?.boughtOuts || []);
      const fgList = Array.isArray(fgRes) ? fgRes : (fgRes?.fgItems || []);
      const plList = Array.isArray(plRes?.data) ? plRes.data : (Array.isArray(plRes) ? plRes : []);
      setAllMaterials([...rmList, ...boList, ...fgList]);
      setInHouseItems(fgList);
      setPriceLists(plList);
    } catch (e) {
      console.warn('Background fetch of PO modal dependencies failed:', e);
    }
  };

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const mrpRes = await apiGet('/api/purchase/mrp/plans', token).catch(() => ({ mrpPlans: [] }));

      const plans = mrpRes.mrpPlans || [];
      setMrpPlans(plans);

      // Keep selectedDemandPlan in sync if open
      if (selectedDemandPlan) {
        const found = plans.find((p: any) => p._id === selectedDemandPlan._id);
        if (found) setSelectedDemandPlan(found);
      }
    } catch (err: any) {
      console.error('Failed to fetch MRP data:', err);
      if (onError) onError(err.message || 'Failed to fetch MRP plans');
    } finally {
      setLoading(false);
      // Non-blocking background fetch for PO modal dependencies if not yet loaded
      if (allMaterials.length === 0) {
        fetchSecondaryDependencies();
      }
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

  // Action: Mark MRP Plan as Completed (Moves to MRP History)
  const handleMarkAsCompleted = async (plan: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirm = await Swal.fire({
      title: 'Mark MRP Plan as Completed?',
      text: `Plan ${plan.mrpNumber} will be marked as Completed and moved to MRP History.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Complete Plan',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#059669'
    });
    if (!confirm.isConfirmed) return;

    try {
      await apiPut(`/api/purchase/mrp/plan/${plan._id}/status`, { status: 'Completed' }, token);
      Swal.fire({
        icon: 'success',
        title: 'Plan Completed',
        text: `MRP Plan ${plan.mrpNumber} is now completed and moved to MRP History.`,
        timer: 2000,
        showConfirmButton: false
      });
      if (selectedDemandPlan && selectedDemandPlan._id === plan._id) {
        setSelectedDemandPlan(null);
      }
      fetchData();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to update plan status', 'error');
    }
  };

  const [syncingPlanId, setSyncingPlanId] = useState<string | null>(null);

  const handleSyncBOM = async (plan: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const token = propToken || localStorage.getItem('token') || '';
    if (!token || !plan?._id) return;

    try {
      setSyncingPlanId(plan._id);
      const res = await apiPost(`/api/purchase/mrp/plan/${plan._id}/sync-bom`, {}, token);
      if (res?.success && res?.mrpPlan) {
        Swal.fire({
          icon: 'success',
          title: 'Plan Synchronized',
          text: `MRP Plan ${plan.mrpNumber} has been synchronized with latest BOM, Customer PO quantities & rates, and Sales Price Lists.`,
          timer: 2500,
          showConfirmButton: false
        });
        if (selectedDemandPlan && selectedDemandPlan._id === plan._id) {
          setSelectedDemandPlan(res.mrpPlan);
        }
        if (selectedPlanForDetails && selectedPlanForDetails._id === plan._id) {
          setSelectedPlanForDetails(res.mrpPlan);
        }
        await fetchData();
      } else {
        throw new Error(res?.message || 'Sync failed');
      }
    } catch (err: any) {
      Swal.fire('Sync Error', err.message || 'Failed to synchronize with latest BOM', 'error');
    } finally {
      setSyncingPlanId(null);
    }
  };

  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  const handleSyncAllBOMs = async () => {
    const token = propToken || localStorage.getItem('token') || '';
    if (!token) return;

    const confirm = await Swal.fire({
      title: 'Sync All Active Plans?',
      text: 'This will check and recalculate RM, BO, and FG requirements for all active MRP plans using their latest BOM definitions from the Finished Goods catalog.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Sync All',
      cancelButtonText: 'Cancel'
    });
    if (!confirm.isConfirmed) return;

    try {
      setIsBulkSyncing(true);
      const res = await apiPost('/api/purchase/mrp/sync-all-bom', {}, token);
      if (res?.success) {
        Swal.fire('Synchronized!', res.message || 'All active MRP plans synchronized with latest BOMs.', 'success');
        await fetchData();
      } else {
        throw new Error(res?.message || 'Sync failed');
      }
    } catch (err: any) {
      Swal.fire('Sync Error', err.message || 'Failed to sync plans', 'error');
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const handleOpenDetails = (plan: any) => {
    setSelectedPlanForDetails(plan);
    setIsDetailsModalOpen(true);
  };

  // Filtered MRP Plans for Master List (Step 1)
  const filteredMrpPlans = useMemo(() => {
    return (Array.isArray(mrpPlans) ? mrpPlans : []).filter((plan: any) => {
      // 1. Status Multi-select Filter
      if (selectedStatuses.length > 0) {
        if (!selectedStatuses.includes(plan.status)) return false;
      } else {
        // By default in Demand Plans, exclude 'Completed' plans (they are archived in MRP History)
        if (plan.status === 'Completed') return false;
      }

      // 2. Plan Date Filter (Created / Plan Date)
      const rawPlanDate = plan.createdAt || plan.planDate || plan.date;
      if (!matchDatePreset(rawPlanDate, planDateFilter, planStartDate, planEndDate)) {
        return false;
      }

      // 3. Committed Date Filter (Target / Delivery / Committed Date)
      const rawCommitDate = plan.targetDate || plan.committedDate || plan.deliveryDate;
      if (!matchDatePreset(rawCommitDate, commitDateFilter, commitStartDate, commitEndDate)) {
        return false;
      }

      // 4. Search Filter
      if (searchTerm && searchTerm.trim()) {
        const s = searchTerm.trim();
        const matchesSearch =
          isSpaceFreeMatch(plan.mrpNumber, s) ||
          isSpaceFreeMatch(plan.customerName, s) ||
          isSpaceFreeMatch(plan.customerPoNumber, s) ||
          (plan.fgItems || []).some((f: any) => 
            isSpaceFreeMatch(f.fgItemName, s) || 
            isSpaceFreeMatch(f.fgItemCode, s) ||
            isSpaceFreeMatch(f.description, s)
          );
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [mrpPlans, searchTerm, selectedStatuses, planDateFilter, planStartDate, planEndDate, commitDateFilter, commitStartDate, commitEndDate]);

  // Compute unique FG items count across filtered MRP plans (dynamically responds to active filters)
  const uniqueFgItemsCount = useMemo(() => {
    const keys = new Set<string>();
    (Array.isArray(filteredMrpPlans) ? filteredMrpPlans : []).forEach((plan: any) => {
      (plan.fgItems || []).forEach((it: any) => {
        const fgId = it.fgItem && typeof it.fgItem === 'object' ? it.fgItem._id : it.fgItem;
        const name = (it.fgItemName || it.name || '').trim().toLowerCase();
        const key = fgId ? String(fgId) : name;
        if (key) keys.add(key);
      });
    });
    return keys.size;
  }, [filteredMrpPlans]);

  // Aggregate financial metrics across filtered MRP plans
  const financialKPIs = useMemo(() => {
    let totalRevenue = 0;
    let totalEstimatedCost = 0;
    let totalCommittedExpense = 0;
    let totalTargetBudget = 0;
    let overBudgetCount = 0;

    (Array.isArray(filteredMrpPlans) ? filteredMrpPlans : []).forEach((plan: any) => {
      totalRevenue += Number(plan.totalIncome || 0);
      totalEstimatedCost += Number(plan.totalEstimatedExpense || 0);
      totalCommittedExpense += Number(plan.committedExpense || 0);
      totalTargetBudget += Number(plan.targetExpense || 0);
      if (plan.budgetStatus === 'Over Budget') {
        overBudgetCount++;
      }
    });

    return {
      totalRevenue,
      totalEstimatedCost,
      totalCommittedExpense,
      totalTargetBudget,
      overBudgetCount
    };
  }, [filteredMrpPlans]);

  // Fast Budget Ceiling Update handler for an MRP plan
  const handleUpdateTargetExpense = async (plan: any) => {
    const currentTarget = plan.targetExpense || 0;
    const rmCost = (plan.rmRequirements || []).reduce((sum: number, r: any) => sum + (Number(r.grossCost) || 0), 0);
    const boCost = (plan.boRequirements || []).reduce((sum: number, b: any) => sum + (Number(b.grossCost) || 0), 0);
    const totalBOMCost = Math.round((rmCost + boCost) * 100) / 100;

    const { value: newBudgetStr } = await Swal.fire({
      title: 'Target Procurement Expense (Budget Ceiling)',
      html: `
        <div class="text-left text-xs text-slate-600 dark:text-slate-300 space-y-1.5 mb-2 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>Plan: <strong class="text-indigo-600 dark:text-indigo-400 font-mono">${plan.mrpNumber}</strong></div>
          <div class="grid grid-cols-2 gap-2 my-1.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div>
              <span class="text-[10px] uppercase font-bold text-slate-400">Raw Material (RM):</span><br/>
              <strong class="text-slate-800 dark:text-slate-100 font-mono">₹${rmCost.toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <span class="text-[10px] uppercase font-bold text-slate-400">Bought Out (BO):</span><br/>
              <strong class="text-indigo-600 dark:text-indigo-400 font-mono">₹${boCost.toLocaleString('en-IN')}</strong>
            </div>
          </div>
          <div>Combined BOM Cost: <strong class="text-slate-900 dark:text-white font-mono">₹${totalBOMCost.toLocaleString('en-IN')}</strong></div>
          <div>Projected Income: <strong class="text-emerald-600 font-mono">₹${(plan.totalIncome || 0).toLocaleString('en-IN')}</strong></div>
          <div>Committed POs: <strong class="text-indigo-600 font-mono">₹${(plan.committedExpense || 0).toLocaleString('en-IN')}</strong></div>
        </div>
        <div class="flex items-center gap-1.5 justify-start mb-2 flex-wrap">
          <span class="text-[11px] font-bold text-slate-500">Quick Set:</span>
          ${totalBOMCost > 0 ? `
            <button type="button" id="swal-set-bom" class="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 cursor-pointer">BOM Cost (₹${Math.round(totalBOMCost).toLocaleString('en-IN')})</button>
            <button type="button" id="swal-set-bom-5" class="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">+5% Buffer</button>
          ` : ''}
          ${(plan.totalIncome || 0) > 0 ? `
            <button type="button" id="swal-set-70" class="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">70% Rev</button>
          ` : ''}
        </div>
        <p class="text-xs text-slate-500 mb-1 text-left">Set max allowable procurement expenses for this plan:</p>
      `,
      input: 'number',
      inputValue: currentTarget > 0 ? currentTarget : '',
      inputPlaceholder: 'Enter budget ceiling amount in ₹',
      showCancelButton: true,
      confirmButtonText: 'Save Budget',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#4f46e5',
      didOpen: () => {
        const input = Swal.getInput();
        const setBomBtn = document.getElementById('swal-set-bom');
        const setBom5Btn = document.getElementById('swal-set-bom-5');
        const set70Btn = document.getElementById('swal-set-70');
        if (setBomBtn && input) setBomBtn.onclick = () => { input.value = String(totalBOMCost); };
        if (setBom5Btn && input) setBom5Btn.onclick = () => { input.value = String(Math.round(totalBOMCost * 1.05)); };
        if (set70Btn && input) set70Btn.onclick = () => { input.value = String(Math.round((plan.totalIncome || 0) * 0.7)); };
      },
      inputValidator: (val) => {
        if (!val || Number(val) < 0) {
          return 'Please enter a valid non-negative number';
        }
        return null;
      }
    });

    if (newBudgetStr !== undefined) {
      const targetExpense = parseFloat(newBudgetStr);
      try {
        const res = await apiPut(`/api/purchase/mrp/plan/${plan._id}/target-expense`, { targetExpense }, token);
        if (res.plan) {
          setSelectedDemandPlan(res.plan);
        }
        fetchData();
        Swal.fire({
          icon: 'success',
          title: 'Budget Ceiling Saved',
          text: `Target budget set to ₹${targetExpense.toLocaleString('en-IN')}`,
          timer: 2000,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to update target budget', 'error');
      }
    }
  };

  // Submit PO directly
  const handlePOSubmit = async (formData: any) => {
    try {
      await apiPost('/api/purchase/po', formData, token);

      // If generated from MRP (single plan or consolidated cross-plan buckets), update requirement status to "PO Raised" and record poNumber
      const mrpPlanId = poInitialData?.mrpPlanId || selectedDemandPlan?._id;
      const initialItems = poInitialData?.items || [];
      const createdPoNumber = formData.poNumber || "";

      if (formData.items && formData.items.length > 0) {
        try {
          const updatePayloadItems = formData.items.map((it: any, idx: number) => {
            const matchInit = initialItems.find((ii: any) => ii.materialName === it.materialName || ii.material === it.material) || initialItems[idx];
            return {
              planId: mrpPlanId || matchInit?.planId || matchInit?.mrpSources?.[0]?.mrpId,
              mrpNumber: poInitialData?.mrpNumber || selectedDemandPlan?.mrpNumber || matchInit?.mrpNumber || matchInit?.mrpSources?.[0]?.mrpNumber,
              materialName: it.materialName,
              materialCode: it.materialCode || matchInit?.materialCode,
              sourceCutSizes: matchInit?.sourceCutSizes || it.sourceCutSizes || [],
              status: "PO Raised",
              poNumber: createdPoNumber
            };
          });

          if (mrpPlanId) {
            await apiPut(`/api/purchase/mrp/plan/${mrpPlanId}/item-status`, {
              items: updatePayloadItems,
              status: "PO Raised",
              poNumber: createdPoNumber
            }, token);
          } else {
            await apiPut('/api/purchase/mrp/update-item-status', {
              items: updatePayloadItems,
              status: "PO Raised",
              poNumber: createdPoNumber
            }, token);
          }
        } catch (e) {
          console.warn("Could not sync item status to MRP Plan:", e);
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Purchase Order Created!',
        text: `PO ${formData.poNumber || ''} created successfully.`,
        timer: 2500
      });
      setIsPoModalOpen(false);
      setPoInitialData(null);
      fetchData();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to submit PO', 'error');
    }
  };

  // Delete MRP Demand Plan with 24-Hour & Transaction Guard Check
  const handleDeletePlan = async (planId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const plan = mrpPlans.find((p) => p._id === planId) || selectedDemandPlan;
    if (!plan) return;

    const lockStatus = getPlanLockStatus(plan);

    if (lockStatus.is24hExpired) {
      const hrs = getPolicyHours('mrpPlan');
      Swal.fire({
        icon: 'error',
        title: hrs <= 0 ? 'Deletion Locked (Immediate Policy)' : 'Deletion Locked (Window Expired)',
        text: hrs <= 0
          ? `MRP Plan ${plan.mrpNumber} cannot be deleted because it is locked immediately upon creation by company policy.`
          : `MRP Plan ${plan.mrpNumber} was created more than ${hrs} hour(s) ago and can no longer be deleted.`,
      });
      return;
    }

    if (lockStatus.hasTransactions) {
      Swal.fire({
        icon: 'error',
        title: 'Deletion Locked (Transactions Active)',
        html: `
          <div class="text-left space-y-2 text-xs">
            <p>Cannot delete MRP Plan <strong>${plan.mrpNumber}</strong> because transactions have already been generated:</p>
            <ul class="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
              ${lockStatus.linkedPOCount > 0 ? `<li><strong>${lockStatus.linkedPOCount}</strong> Purchase Order(s) linked to this plan</li>` : ''}
              ${plan.status !== 'Planned' ? `<li>Plan status has advanced to <strong>${plan.status}</strong></li>` : ''}
              ${plan.ppcStatus === 'Sent' ? `<li>Manufacturing requirements routed to <strong>PPC</strong></li>` : ''}
            </ul>
            <p class="text-rose-600 font-bold mt-2">Plans with downstream transactions cannot be deleted to maintain data integrity.</p>
          </div>
        `
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Delete MRP Plan?',
      html: `
        <div class="text-left text-xs space-y-2">
          <p class="text-slate-600 dark:text-slate-300">Are you sure you want to delete MRP Plan <strong>${plan.mrpNumber}</strong>?</p>
          <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300">
            ⏳ <strong>24h Window Active:</strong> ${lockStatus.countdownText}
          </div>
        </div>
      `,
      icon: 'question',
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
    <div className="w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden space-y-2.5 sm:space-y-3">
      
      {/* 1. TOP-LEVEL VIEW SWITCHER: PLANS | WORKBENCH | HISTORY (PINNED HEADER) */}
      <div className="shrink-0 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scroll-smooth touch-pan-x py-0.5 no-scrollbar">
          <button
            onClick={() => setMainView('demand')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              mainView === 'demand'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40'
            }`}
          >
            <TrendingUp size={14} />
            <span>📊 Demand & Customer POs</span>
          </button>

          <button
            onClick={() => setMainView('plans')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              mainView === 'plans'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers size={14} />
            <span>📑 MRP Demand Plans</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${mainView === 'plans' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {mrpPlans.filter((p: any) => p.status !== 'Completed').length}
            </span>
          </button>

          <button
            onClick={() => setMainView('workbench')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              mainView === 'workbench'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            <ShoppingCart size={14} />
            <span>🛒 Procurement Workbench</span>
          </button>

          <button
            onClick={() => setMainView('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              mainView === 'history'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40'
            }`}
          >
            <Clock size={14} />
            <span>📜 MRP History</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${mainView === 'history' ? 'bg-purple-800 text-purple-100' : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'}`}>
              {statusCounts['Completed'] || 0}
            </span>
          </button>
        </div>
      </div>

      {/* VIEW 0: DEMAND INTAKE & MONTH-WISE PLANNING */}
      {mainView === 'demand' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <MRPDemandTab
            token={token}
            mrpPlans={mrpPlans}
            onPlanSinglePo={(po) => {
              setPreselectedPoIds([po._id]);
              setIsCreateModalOpen(true);
            }}
            onPlanConsolidatedPos={(poIds) => {
              setPreselectedPoIds(poIds);
              setIsCreateModalOpen(true);
            }}
            onPlanMatrixDemand={(matrixPayload) => {
              setPreselectedPoIds(matrixPayload.poIds);
              setEditingPlan(matrixPayload.initialPlanData);
              setIsCreateModalOpen(true);
            }}
            onViewPlanDetails={(plan) => {
              setSelectedPlanForDetails(plan);
              setIsDetailsModalOpen(true);
            }}
            onError={onError}
            onSuccess={onSuccess}
          />
        </div>
      )}

      {/* VIEW 2: PROCUREMENT WORKBENCH */}
      {mainView === 'workbench' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
        </div>
      )}

      {/* VIEW 1: MRP DEMAND PLANS */}
      {mainView === 'plans' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-2.5 sm:space-y-3">
          
          {/* ========================================================================= */}
          {/* STEP 1: MASTER LIST OF MRP DEMAND PLANS (Click an MRP to view FG items)   */}
          {/* ========================================================================= */}
          {!selectedDemandPlan && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-2.5 sm:space-y-3">
              
              {/* Executive Financial & Budget Strip (Dashboard for Plans - Hidden by Default) */}
              {viewMode === 'plans' && showPlansDashboard && (
                <div className="shrink-0 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Executive Financial & Budget Overview
                      </span>
                      {filteredMrpPlans.length !== mrpPlans.length && (
                        <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded text-[9px] font-bold border border-indigo-200 dark:border-indigo-800">
                          Filtered ({filteredMrpPlans.length} of {mrpPlans.length})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPlansDashboard(false)}
                      className="px-2 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-slate-200 dark:border-slate-700"
                      title="Hide Executive Dashboard"
                    >
                      <ChevronUp size={13} />
                      <span>Hide</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <TrendingUp size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">Projected Revenue</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono truncate block">
                          ₹{financialKPIs.totalRevenue.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <ShoppingCart size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">Estimated Materials</span>
                        <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono truncate block">
                          ₹{financialKPIs.totalEstimatedCost.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">Committed POs</span>
                        <span className="text-xs sm:text-sm font-black text-blue-600 dark:text-blue-400 font-mono truncate block">
                          ₹{financialKPIs.totalCommittedExpense.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <Target size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">Target Budget</span>
                        <span className="text-xs sm:text-sm font-black text-purple-600 dark:text-purple-400 font-mono truncate block">
                          {financialKPIs.totalTargetBudget > 0 ? `₹${financialKPIs.totalTargetBudget.toLocaleString('en-IN')}` : 'Unset'}
                        </span>
                      </div>
                    </div>

                    <div className={`col-span-2 sm:col-span-4 lg:col-span-1 p-2.5 rounded-2xl border shadow-2xs flex items-center gap-2.5 ${
                      financialKPIs.overBudgetCount > 0 
                        ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        financialKPIs.overBudgetCount > 0 
                          ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600' 
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'
                      }`}>
                        {financialKPIs.overBudgetCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">Budget Health</span>
                        <span className="text-xs font-black truncate block">
                          {financialKPIs.overBudgetCount > 0 
                            ? `🚨 ${financialKPIs.overBudgetCount} Over Budget` 
                            : '✅ All In Budget'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Controls Toolbar: Search, View Mode, Status Dropdown, Plan Date, Committed Date (PINNED FILTER BAR) */}
              <div className="shrink-0 relative z-30 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap xl:flex-nowrap items-center justify-between gap-2">
                
                {/* Left Group: Search & View Mode Switcher */}
                <div className="flex items-center gap-2 shrink-0 min-w-0 flex-1 max-w-sm sm:max-w-md">
                  {/* Search Box */}
                  <div className="relative flex-1 min-w-[130px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search MRP #, Customer, FG..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-0.5"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* View Mode Toggle: Plans vs Items */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode('plans')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        viewMode === 'plans'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="View MRP Demand Plans"
                    >
                      <Layers size={13} />
                      <span>Plans ({filteredMrpPlans.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('items')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        viewMode === 'items'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="View Finished Goods Demand Item Wise"
                    >
                      <Package size={13} />
                      <span>Items ({uniqueFgItemsCount})</span>
                    </button>
                  </div>
                </div>

                {/* Center / Right Group: The 3 Filter Tabs + Actions */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                  
                  {/* TAB 1: Status Multi-Select Dropdown */}
                  <div className="relative shrink-0" ref={statusDropdownRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsStatusDropdownOpen(prev => !prev);
                        setIsPlanDateDropdownOpen(false);
                        setIsCommitDateDropdownOpen(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        selectedStatuses.length > 0
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                      }`}
                    >
                      <Clock size={13} className="text-indigo-500 shrink-0" />
                      <span className="truncate max-w-[120px]">
                        {selectedStatuses.length === 0
                          ? 'All Statuses'
                          : selectedStatuses.length === 1
                          ? selectedStatuses[0]
                          : `Status (${selectedStatuses.length})`}
                      </span>
                      <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isStatusDropdownOpen && (
                      <div onClick={(e) => e.stopPropagation()} className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-2.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 px-1">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Plan Status</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedStatuses([...MRP_STATUS_OPTIONS])}
                              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                            >
                              Select All
                            </button>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <button
                              type="button"
                              onClick={() => setSelectedStatuses([])}
                              className="text-[11px] text-slate-500 hover:underline font-bold cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {MRP_STATUS_OPTIONS.map((st) => {
                            const isSelected = selectedStatuses.includes(st);
                            const count = statusCounts[st] || 0;
                            return (
                              <div
                                key={st}
                                onClick={() => {
                                  setSelectedStatuses(prev => 
                                    prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
                                  );
                                }}
                                className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                    isSelected 
                                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                                      : 'border-slate-300 dark:border-slate-600'
                                  }`}>
                                    {isSelected && <Check size={11} className="stroke-[3]" />}
                                  </div>
                                  <span className={`text-xs ${isSelected ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                    {st}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                  {count}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TAB 2: Plan Date Dropdown */}
                  <div className="relative shrink-0" ref={planDateDropdownRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPlanDateDropdownOpen(prev => !prev);
                        setIsStatusDropdownOpen(false);
                        setIsCommitDateDropdownOpen(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        planDateFilter !== 'all' || planStartDate || planEndDate
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                      }`}
                    >
                      <Calendar size={13} className="text-blue-500 shrink-0" />
                      <span className="truncate max-w-[130px]">
                        Plan: {formatPresetLabel(planDateFilter, planStartDate, planEndDate)}
                      </span>
                      <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform ${isPlanDateDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isPlanDateDropdownOpen && (
                      <div onClick={(e) => e.stopPropagation()} className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-3 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Plan Date (Created)</span>
                          {(planDateFilter !== 'all' || planStartDate || planEndDate) && (
                            <button
                              type="button"
                              onClick={() => {
                                setPlanDateFilter('all');
                                setPlanStartDate('');
                                setPlanEndDate('');
                              }}
                              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {/* Presets Grid */}
                        <div className="grid grid-cols-2 gap-1">
                          {[
                            { id: 'all', label: 'All Dates' },
                            { id: 'today', label: 'Today' },
                            { id: 'yesterday', label: 'Yesterday' },
                            { id: '7days', label: 'Last 7 Days' },
                            { id: 'thisMonth', label: 'This Month' },
                            { id: 'custom', label: 'Custom Range' },
                          ].map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setPlanDateFilter(p.id as any);
                                if (p.id !== 'custom') {
                                  setPlanStartDate('');
                                  setPlanEndDate('');
                                  setIsPlanDateDropdownOpen(false);
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                                planDateFilter === p.id
                                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>

                        {/* Custom Date Inputs if Custom Selected */}
                        {planDateFilter === 'custom' && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block mb-0.5">From Date</span>
                              <input
                                type="date"
                                value={planStartDate}
                                onChange={(e) => setPlanStartDate(e.target.value)}
                                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block mb-0.5">To Date</span>
                              <input
                                type="date"
                                value={planEndDate}
                                onChange={(e) => setPlanEndDate(e.target.value)}
                                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsPlanDateDropdownOpen(false)}
                              className="w-full py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors mt-1"
                            >
                              Apply Custom
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* TAB 3: Committed Date Dropdown */}
                  <div className="relative shrink-0" ref={commitDateDropdownRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCommitDateDropdownOpen(prev => !prev);
                        setIsStatusDropdownOpen(false);
                        setIsPlanDateDropdownOpen(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        commitDateFilter !== 'all' || commitStartDate || commitEndDate
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                      }`}
                    >
                      <Target size={13} className="text-emerald-500 shrink-0" />
                      <span className="truncate max-w-[130px]">
                        Commit: {formatPresetLabel(commitDateFilter, commitStartDate, commitEndDate)}
                      </span>
                      <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform ${isCommitDateDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isCommitDateDropdownOpen && (
                      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-3 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Committed / Target Due</span>
                          {(commitDateFilter !== 'all' || commitStartDate || commitEndDate) && (
                            <button
                              type="button"
                              onClick={() => {
                                setCommitDateFilter('all');
                                setCommitStartDate('');
                                setCommitEndDate('');
                              }}
                              className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {/* Presets Grid */}
                        <div className="grid grid-cols-2 gap-1">
                          {[
                            { id: 'all', label: 'All Dates' },
                            { id: 'today', label: 'Today' },
                            { id: 'next7days', label: 'Next 7 Days' },
                            { id: '7days', label: 'Last 7 Days' },
                            { id: 'thisMonth', label: 'This Month' },
                            { id: 'custom', label: 'Custom Range' },
                          ].map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setCommitDateFilter(p.id as any);
                                if (p.id !== 'custom') {
                                  setCommitStartDate('');
                                  setCommitEndDate('');
                                  setIsCommitDateDropdownOpen(false);
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                                commitDateFilter === p.id
                                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>

                        {/* Custom Date Inputs if Custom Selected */}
                        {commitDateFilter === 'custom' && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block mb-0.5">From Date</span>
                              <input
                                type="date"
                                value={commitStartDate}
                                onChange={(e) => setCommitStartDate(e.target.value)}
                                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block mb-0.5">To Date</span>
                              <input
                                type="date"
                                value={commitEndDate}
                                onChange={(e) => setCommitEndDate(e.target.value)}
                                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsCommitDateDropdownOpen(false)}
                              className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors mt-1"
                            >
                              Apply Custom
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Reset All Filters Button */}
                  {isAnyFilterActive && (
                    <button
                      type="button"
                      onClick={handleResetAllFilters}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 shrink-0 flex items-center gap-1"
                      title="Reset All Filters"
                    >
                      <RotateCcw size={11} />
                      <span>Reset</span>
                    </button>
                  )}

                  {/* Dashboard Toggle: Plans & Items */}
                  <button
                    type="button"
                    onClick={toggleDashboard}
                    className={`px-2.5 py-1.5 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                      isCurrentDashboardShown
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-2xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                    title={isCurrentDashboardShown ? "Hide Executive KPI Dashboard" : "Show Executive KPI Dashboard"}
                    aria-label="Toggle Dashboard"
                  >
                    <LayoutGrid size={13} className={isCurrentDashboardShown ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"} />
                    <span className="hidden sm:inline">{isCurrentDashboardShown ? "Hide Dashboard" : "Dashboard"}</span>
                  </button>

                  {/* Refresh Button */}
                  <button
                    onClick={fetchData}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900 cursor-pointer shrink-0"
                    title="Refresh Data"
                  >
                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                  </button>

                  {/* Sync All Active Plans BOMs Button */}
                  <button
                    onClick={handleSyncAllBOMs}
                    disabled={isBulkSyncing}
                    className="p-2 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors bg-white dark:bg-slate-900 cursor-pointer shrink-0 disabled:opacity-50"
                    title="Recalculate & Sync All Active Plans with Latest FG BOMs"
                  >
                    <RefreshCw size={13} className={isBulkSyncing ? "animate-spin text-amber-600" : ""} />
                  </button>

                  {/* Create MRP Plan Button */}
                  <button
                    onClick={() => {
                      setEditingPlan(null);
                      setIsCreateModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus size={14} />
                    <span>Create Plan</span>
                  </button>
                </div>
              </div>


              {/* View Mode: Items vs Plans */}
              {viewMode === 'items' ? (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <MRPItemWiseView
                    mrpPlans={filteredMrpPlans}
                    fgItems={inHouseItems}
                    onViewPlanDetails={(plan) => {
                      setSelectedPlanForDetails(plan);
                      setIsDetailsModalOpen(true);
                    }}
                    searchTerm={searchTerm}
                    selectedStatuses={selectedStatuses}
                    planDateFilter={planDateFilter}
                    planStartDate={planStartDate}
                    planEndDate={planEndDate}
                    commitDateFilter={commitDateFilter}
                    commitStartDate={commitStartDate}
                    commitEndDate={commitEndDate}
                    onResetFilters={handleResetAllFilters}
                    showDashboard={showItemsDashboard}
                    onToggleDashboard={() => setShowItemsDashboard(prev => !prev)}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  {loading ? (
                    <div className="flex-1 flex justify-center items-center p-16">
                      <RefreshCw className="animate-spin text-indigo-600 w-8 h-8" />
                    </div>
                  ) : filteredMrpPlans.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No MRP Plans Found</h3>
                      <p className="text-xs text-slate-500 mt-1 mb-4">No demand plans match the selected filters.</p>
                      <button
                        onClick={handleResetAllFilters}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table View (ONLY TABLE SCROLLS) */}
                      <div className="hidden md:block flex-1 min-h-0 overflow-auto scroll-smooth">
                        <table className="w-full min-w-[920px] text-xs text-left">
                          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 shadow-2xs backdrop-blur-xs">
                        <tr>
                          <th className="p-3.5">MRP Number</th>
                          <th className="p-3.5">Customer & Order Ref</th>
                          <th className="p-3.5 text-center">Plan Date & User</th>
                          <th className="p-3.5 text-center">Committed Date</th>
                          <th className="p-3.5 text-center">24h Window / Lock Status</th>
                          <th className="p-3.5">Finished Goods (FG) Demand</th>
                          <th className="p-3.5 text-center min-w-[160px]">Financials & Budget</th>
                          <th className="p-3.5 text-center">Total Order vs GRN Received</th>
                          <th className="p-3.5 text-center">Plan Status</th>
                          <th className="p-3.5 text-right">Actions</th>
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

                          const formattedDate = plan.createdAt ? new Date(plan.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "-";
                          const lockStatus = getPlanLockStatus(plan);

                          return (
                            <tr 
                              key={plan._id}
                              onClick={() => setSelectedDemandPlan(plan)}
                              className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors"
                            >
                              {/* MRP Number */}
                              <td className="p-3.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                    {plan.mrpNumber}
                                  </span>
                                  {plan.isBOMOutdated && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 animate-pulse" title="Finished Goods BOM was modified in catalog. Click Sync BOM to update requirements.">
                                      <RefreshCw size={9} /> BOM Changed
                                    </span>
                                  )}
                                  {plan.isConsolidated && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title={`Consolidated from ${plan.customerPOs?.length || 'multiple'} Customer POs`}>
                                      Consolidated ({plan.customerPOs?.length || 2} POs)
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Customer & PO */}
                              <td className="p-3.5">
                                {plan.isConsolidated && plan.customerPOs && plan.customerPOs.length > 0 ? (
                                  <div>
                                    <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-white text-xs">
                                      <Layers size={12} className="text-amber-500 shrink-0" />
                                      <span>Multi-Customer Demand ({plan.customerPOs.length} POs)</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {plan.customerPOs.map((cpo: any, idx: number) => {
                                        const hasForeignCurrency = cpo.currency && cpo.currency !== 'INR';
                                        const tooltip = `${cpo.customerName || ''}${hasForeignCurrency ? ` (${cpo.currency} @ ₹${cpo.exchangeRate || '-'})` : ''}`;
                                        return (
                                          <span
                                            key={idx}
                                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1"
                                            title={tooltip}
                                          >
                                            <span>{cpo.customerPoNumber}</span>
                                            {hasForeignCurrency && (
                                              <span className="text-[8.5px] font-black tracking-tight text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/60 px-1 rounded border border-amber-200/60 dark:border-amber-800/40">
                                                {cpo.currency}
                                              </span>
                                            )}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <strong className="text-slate-900 dark:text-white block">{plan.customerName || "Internal Demand"}</strong>
                                    {plan.customerPoNumber && (
                                      <span className="font-mono text-[10px] text-slate-400">PO: {plan.customerPoNumber}</span>
                                    )}
                                  </>
                                )}
                              </td>

                              {/* Plan Date & Audit (Created by / Edited by) */}
                              <td className="p-3.5 text-center">
                                <span className="font-medium text-slate-700 dark:text-slate-300 block">{formattedDate}</span>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  By: <strong className="text-slate-700 dark:text-slate-200">{plan.createdByName || "Planner"}</strong>
                                </div>
                                {plan.updatedByName && (
                                  <div className="text-[9.5px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                                    Edited: {plan.updatedByName}
                                  </div>
                                )}
                              </td>

                              {/* Committed Date (OA Committed Date / Target Due Date) */}
                              <td className="p-3.5 text-center">
                                {plan.targetDate ? (
                                  <div>
                                    <span className="font-bold text-emerald-700 dark:text-emerald-400 block text-xs">
                                      {new Date(plan.targetDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                    {plan.poDate && (
                                      <span className="text-[10px] text-slate-400 block font-normal">
                                        PO: {new Date(plan.poDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-medium">-</span>
                                )}
                              </td>

                              {/* Time-Lock Countdown Window / Lock Status */}
                              <td className="p-3.5 text-center min-w-[170px]">
                                {lockStatus.hasTransactions ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200" title="Locked: Downstream transactions created against this MRP">
                                    <ShieldCheck size={11} className="text-blue-600" /> Locked (Txns Active)
                                  </span>
                                ) : lockStatus.isImmediatelyLocked ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200" title="Locked immediately upon creation by company policy">
                                    <Lock size={11} /> Locked
                                  </span>
                                ) : lockStatus.isExpired ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200" title={`Locked: ${getPolicyHours('mrpPlan')}h edit/delete window has expired`}>
                                    <Clock size={11} /> Policy Expired ({getPolicyHours('mrpPlan')}h)
                                  </span>
                                ) : lockStatus.isUnlimited ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-mono font-extrabold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 shadow-2xs" title="Unlimited edit/delete window by company policy">
                                    <CheckCircle2 size={11} className="text-emerald-600" /> Unlimited
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-mono font-extrabold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 shadow-2xs">
                                    <Clock size={11} className="animate-spin text-emerald-600" /> ⏳ {lockStatus.countdownText}
                                  </span>
                                )}
                              </td>

                              {/* FG Demand Summary */}
                              <td className="p-3.5">
                                <div className="space-y-1">
                                  {fgItems.slice(0, 2).map((fg: any, fgIdx: number) => {
                                    const itemName = fg.fgItem?.name || fg.fgItemName || "FG Item";
                                    const itemDesc = fg.fgItem?.description || fg.fgItem?.descriptions || fg.description;
                                    return (
                                      <div key={fgIdx} className="leading-tight">
                                        <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                                          {itemName}
                                          <span className="text-[11px] font-normal text-slate-500 ml-1.5 font-mono">
                                            ({fg.quantity} {fg.unit || 'PCS'})
                                          </span>
                                        </div>
                                        {itemDesc && (
                                          <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                            {itemDesc}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {fgCount > 2 && (
                                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-indigo-600 dark:text-indigo-400">
                                      +{fgCount - 2} more finished goods
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    {fgCount} FG Item{fgCount > 1 ? 's' : ''} planned ({totalTarget} total units)
                                  </span>
                                </div>
                              </td>

                              {/* Financials & Budget */}
                              <td className="p-3.5 text-center">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px] font-mono">
                                    <span className="text-slate-400 text-[10px]">Revenue:</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      ₹{(plan.totalIncome || 0).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] font-mono">
                                    <span className="text-slate-400 text-[10px]">Committed:</span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                      ₹{(plan.committedExpense || 0).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                  {plan.targetExpense > 0 ? (
                                    <div className="flex items-center justify-between text-[10px] font-mono">
                                      <span className="text-slate-400">Budget:</span>
                                      <span className="text-slate-600 dark:text-slate-300 font-semibold">
                                        ₹{plan.targetExpense.toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  ) : null}
                                  <div className="pt-0.5">
                                    {plan.budgetStatus === 'Over Budget' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                                        <AlertTriangle size={10} /> Over Budget
                                      </span>
                                    ) : plan.budgetStatus === 'Near Limit' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                        <Clock size={10} /> Near Limit
                                      </span>
                                    ) : plan.budgetStatus === 'Within Budget' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                                        <CheckCircle2 size={10} /> Within Budget
                                      </span>
                                    ) : (
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                        Budget Unset
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Target vs Received Progress */}
                              <td className="p-3.5 text-center min-w-[150px]">
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

                              {/* Plan Status */}
                              <td className="p-3.5 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  plan.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                  plan.status === 'In Production' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                                  plan.status === 'Partially Received' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300' :
                                  plan.status === 'Partially Completed' ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' :
                                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                  {plan.status}
                                </span>
                              </td>

                              {/* Action Buttons: View, Complete, Edit, Delete */}
                              <td className="p-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => setSelectedDemandPlan(plan)}
                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                    title="View FG Breakdown"
                                  >
                                    <span>View</span>
                                    <ChevronRight size={13} />
                                  </button>

                                  {plan.status !== 'Completed' && (
                                    <button
                                      onClick={(e) => handleMarkAsCompleted(plan, e)}
                                      className="p-1.5 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950 transition-all cursor-pointer"
                                      title="Mark Plan as Completed (Moves to MRP History)"
                                    >
                                      <CheckCircle2 size={13} />
                                    </button>
                                  )}

                                  <button
                                    onClick={(e) => handleSyncBOM(plan, e)}
                                    disabled={syncingPlanId === plan._id}
                                    className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                      plan.isBOMOutdated
                                        ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900'
                                    }`}
                                    title={plan.isBOMOutdated ? "BOM or Customer PO changed! Click to sync latest BOM, Customer PO quantities & prices" : "Sync Plan (BOM, Customer PO & Sales Price)"}
                                  >
                                    <RefreshCw size={13} className={syncingPlanId === plan._id ? "animate-spin text-amber-600" : ""} />
                                  </button>

                                  <button
                                    onClick={() => {
                                      if (!lockStatus.canEdit) {
                                        const hrs = getPolicyHours('mrpPlan');
                                        Swal.fire({
                                          icon: 'info',
                                          title: 'Editing Locked',
                                          text: lockStatus.hasTransactions
                                            ? `Cannot edit MRP Plan ${plan.mrpNumber}: Downstream transactions have already been initiated.`
                                            : hrs <= 0
                                            ? `Cannot edit MRP Plan ${plan.mrpNumber}: It is locked immediately upon creation by company policy.`
                                            : `Cannot edit MRP Plan ${plan.mrpNumber}: The ${hrs}-hour edit window has expired.`
                                        });
                                        return;
                                      }
                                      setEditingPlan(plan);
                                      setIsCreateModalOpen(true);
                                    }}
                                    className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                      lockStatus.canEdit
                                        ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950'
                                        : 'border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                                    }`}
                                    title={lockStatus.canEdit ? "Edit MRP Plan" : "Edit locked"}
                                  >
                                    <Edit2 size={13} />
                                  </button>

                                  <button
                                    onClick={(e) => handleDeletePlan(plan._id, e)}
                                    className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                      lockStatus.canDelete
                                        ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950'
                                        : 'border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                                    }`}
                                    title={lockStatus.canDelete ? "Delete MRP Plan" : "Deletion locked"}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Dedicated Native Mobile Cards View */}
                  <div className="md:hidden flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredMrpPlans.map((plan) => {
                      const fgItems = plan.fgItems || [];
                      const fgCount = fgItems.length;
                      const firstFG = fgItems[0];
                      const totalTarget = fgItems.reduce((s: number, f: any) => s + (Number(f.quantity) || 0), 0);
                      const totalReceived = fgItems.reduce((s: number, f: any) => s + (Number(f.receivedQuantity) || 0), 0);
                      const progressPct = totalTarget > 0 ? Math.min(100, Math.round((totalReceived / totalTarget) * 100)) : 0;
                      const formattedDate = plan.createdAt ? new Date(plan.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "-";
                      const lockStatus = getPlanLockStatus(plan);

                      return (
                        <div
                          key={plan._id}
                          onClick={() => setSelectedDemandPlan(plan)}
                          className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 active:scale-[0.99] transition-all cursor-pointer space-y-3"
                        >
                          {/* Top Row: MRP Number, Badges & Status */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                {plan.mrpNumber}
                              </span>
                              {plan.isBOMOutdated && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 flex items-center gap-1 animate-pulse">
                                  <RefreshCw size={9} /> BOM Changed
                                </span>
                              )}
                              {plan.isConsolidated && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                                  Consolidated ({plan.customerPOs?.length || 2})
                                </span>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold border ${
                              plan.status === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                                : plan.status === 'Partially Received'
                                ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                                : plan.status === 'In Production'
                                ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
                            }`}>
                              {plan.status || 'Planned'}
                            </span>
                          </div>

                          {/* Customer and Order Ref */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold truncate">
                              <Building2 size={13} className="text-slate-400 shrink-0" />
                              <span className="truncate">{plan.customerName || "Internal Demand"}</span>
                            </div>
                            {plan.customerPoNumber && (
                              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                PO: {plan.customerPoNumber}
                              </span>
                            )}
                          </div>

                          {/* Primary FG Item and Technical Description (Strict rule compliance: AGENTS.md) */}
                          <div className="bg-slate-50/80 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                            {fgItems.map((fg: any, fgIdx: number) => {
                              const itemName = fg.fgItem?.name || fg.fgItemName || "FG Item";
                              const itemDesc = fg.fgItem?.description || fg.fgItem?.descriptions || fg.description;
                              return (
                                <div key={fgIdx} className="space-y-0.5 border-b border-slate-100 dark:border-slate-800/80 pb-1.5 last:border-b-0 last:pb-0">
                                  <div className="flex items-center justify-between">
                                    <div className="font-bold text-xs text-slate-900 dark:text-white">
                                      {itemName}
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-slate-500">
                                      {fg.receivedQuantity || 0} / {fg.quantity || 1} {fg.unit || 'PCS'}
                                    </span>
                                  </div>
                                  {itemDesc && (
                                    <div className="text-[11px] text-slate-500 italic line-clamp-2">
                                      {itemDesc}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {/* Progress bar */}
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  progressPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                                }`} 
                                style={{ width: `${progressPct}%` }} 
                              />
                            </div>
                          </div>

                          {/* Financial & Budget Mobile Strip */}
                          <div className="bg-slate-50/80 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium">Revenue (Income):</span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                ₹{(plan.totalIncome || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium">Committed PO Spend:</span>
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                ₹{(plan.committedExpense || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                            {plan.targetExpense > 0 && (
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 font-medium">Target Budget:</span>
                                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                  ₹{plan.targetExpense.toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700">
                              <span className="text-[10px] text-slate-400 font-medium">Budget Status:</span>
                              {plan.budgetStatus === 'Over Budget' ? (
                                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 inline-flex items-center gap-1">
                                  <AlertTriangle size={9} /> Over Budget
                                </span>
                              ) : plan.budgetStatus === 'Near Limit' ? (
                                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 inline-flex items-center gap-1">
                                  <Clock size={9} /> Near Limit
                                </span>
                              ) : plan.budgetStatus === 'Within Budget' ? (
                                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 inline-flex items-center gap-1">
                                  <CheckCircle2 size={9} /> Within Budget
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Unset</span>
                              )}
                            </div>
                          </div>

                          {/* Dates & Action Buttons */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                            <div className="flex items-center gap-2 text-slate-500">
                              <span>Plan: {formattedDate}</span>
                              {plan.targetDate && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Due: {new Date(plan.targetDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {plan.status !== 'Completed' && (
                                <button
                                  type="button"
                                  onClick={(e) => handleMarkAsCompleted(plan, e)}
                                  className="p-1.5 rounded-lg border border-emerald-200 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 cursor-pointer"
                                  title="Mark Plan as Completed (Moves to History)"
                                >
                                  <CheckCircle2 size={12} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleSyncBOM(plan, e)}
                                disabled={syncingPlanId === plan._id}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  plan.isBOMOutdated
                                    ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
                                }`}
                                title={plan.isBOMOutdated ? "BOM or Customer PO changed! Click to sync latest BOM, Customer PO quantities & prices" : "Sync Plan (BOM, Customer PO & Sales Price)"}
                              >
                                <RefreshCw size={12} className={syncingPlanId === plan._id ? "animate-spin text-amber-600" : ""} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!lockStatus.canEdit) {
                                    const hrs = getPolicyHours('mrpPlan');
                                    Swal.fire({
                                      icon: 'info',
                                      title: 'Editing Locked',
                                      text: lockStatus.hasTransactions
                                        ? `Cannot edit MRP Plan ${plan.mrpNumber}: Downstream transactions have already been initiated.`
                                        : hrs <= 0
                                        ? `Cannot edit MRP Plan ${plan.mrpNumber}: It is locked immediately upon creation by company policy.`
                                        : `Cannot edit MRP Plan ${plan.mrpNumber}: The ${hrs}-hour edit window has expired.`
                                    });
                                    return;
                                  }
                                  setEditingPlan(plan);
                                  setIsCreateModalOpen(true);
                                }}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  lockStatus.canEdit
                                    ? 'border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300'
                                    : 'border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600 opacity-50'
                                }`}
                                title={lockStatus.canEdit ? "Edit MRP Plan" : "Edit locked"}
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeletePlan(plan._id, e)}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  lockStatus.canDelete
                                    ? 'border-rose-200 text-rose-600 bg-rose-50/50 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400'
                                    : 'border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600 opacity-50'
                                }`}
                                title={lockStatus.canDelete ? "Delete MRP Plan" : "Deletion locked"}
                              >
                                <Trash2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDemandPlan(plan);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <span>Explore FG</span>
                                <ChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      )}

          {/* ========================================================================= */}
          {/* STEP 2: SELECTED MRP DEMAND PLAN — FINISHED GOODS (FG) ITEMS EXPLORER      */}
          {/* ========================================================================= */}
          {selectedDemandPlan && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-2.5 sm:space-y-3">
              
              {/* Header Bar with Back Button & Plan Info (PINNED HEADER) */}
              <div className="shrink-0 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
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
                      {selectedDemandPlan.isConsolidated && (
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                          <Layers size={12} />
                          <span>Consolidated ({selectedDemandPlan.customerPOs?.length || 2} Customer POs)</span>
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {selectedDemandPlan.customerName}
                      </span>
                      {selectedDemandPlan.customerPoNumber && (
                        <span className="text-[10px] text-slate-400 font-mono">PO: {selectedDemandPlan.customerPoNumber}</span>
                      )}
                    </div>
                    {selectedDemandPlan.isConsolidated && selectedDemandPlan.customerPOs && selectedDemandPlan.customerPOs.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-[11px] text-slate-400 font-semibold">Linked POs:</span>
                        {selectedDemandPlan.customerPOs.map((cpo: any, cIdx: number) => (
                          <span key={cIdx} className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {cpo.customerPoNumber} {cpo.customerName ? `(${cpo.customerName})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                      <span>Created by: <strong className="text-slate-700 dark:text-slate-200">{selectedDemandPlan.createdByName || "Planner"}</strong></span>
                      {selectedDemandPlan.updatedByName && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          • Last Edited by: <strong className="font-bold">{selectedDemandPlan.updatedByName}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Plan Header Actions */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
                  {/* Countdown or Locked Status Badge in Details Header */}
                  {(() => {
                    const lockStatus = getPlanLockStatus(selectedDemandPlan);
                    const hrs = getPolicyHours('mrpPlan');
                    return lockStatus.hasTransactions ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200">
                        <ShieldCheck size={12} className="text-blue-600" /> Locked (Txns Active)
                      </span>
                    ) : lockStatus.isImmediatelyLocked ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200">
                        <Lock size={12} /> Locked (Immediate)
                      </span>
                    ) : lockStatus.isExpired ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200">
                        <Clock size={12} /> Policy Expired ({hrs}h)
                      </span>
                    ) : lockStatus.isUnlimited ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-extrabold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                        <CheckCircle2 size={12} className="text-emerald-600" /> Unlimited
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-extrabold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                        <Clock size={12} className="animate-spin text-emerald-600" /> ⏳ {lockStatus.countdownText}
                      </span>
                    );
                  })()}

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

                  {selectedDemandPlan.status !== 'Completed' && (
                    <button
                      onClick={(e) => handleMarkAsCompleted(selectedDemandPlan, e)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Mark Plan as Completed (Moves to MRP History)"
                    >
                      <CheckCircle2 size={13} />
                      <span>Complete Plan</span>
                    </button>
                  )}

                  {/* Sync Plan (BOM, Customer PO & Sales Price) Button */}
                  <button
                    onClick={(e) => handleSyncBOM(selectedDemandPlan, e)}
                    disabled={syncingPlanId === selectedDemandPlan._id}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold text-xs rounded-xl border border-amber-200 dark:border-amber-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Synchronize latest BOM, Customer PO quantities & prices, and Sales Price Lists"
                  >
                    <RefreshCw size={13} className={syncingPlanId === selectedDemandPlan._id ? "animate-spin text-amber-600" : ""} />
                    <span>{syncingPlanId === selectedDemandPlan._id ? "Syncing..." : "Sync Plan (BOM & PO)"}</span>
                  </button>

                  {/* Edit Plan Button */}
                  {(() => {
                    const lockStatus = getPlanLockStatus(selectedDemandPlan);
                    return (
                      <button
                        onClick={() => {
                          if (!lockStatus.canEdit) {
                            const hrs = getPolicyHours('mrpPlan');
                            Swal.fire({
                              icon: 'info',
                              title: 'Editing Locked',
                              text: lockStatus.hasTransactions
                                ? `Cannot edit MRP Plan ${selectedDemandPlan.mrpNumber}: Downstream transactions have already been initiated.`
                                : hrs <= 0
                                ? `Cannot edit MRP Plan ${selectedDemandPlan.mrpNumber}: It is locked immediately upon creation by company policy.`
                                : `Cannot edit MRP Plan ${selectedDemandPlan.mrpNumber}: The ${hrs}-hour edit window has expired.`
                            });
                            return;
                          }
                          setEditingPlan(selectedDemandPlan);
                          setIsCreateModalOpen(true);
                        }}
                        className={`px-3 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          lockStatus.canEdit
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                        }`}
                        title={lockStatus.canEdit ? "Edit MRP Plan" : "Editing locked"}
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>
                    );
                  })()}

                  {/* Delete Plan Button */}
                  {(() => {
                    const lockStatus = getPlanLockStatus(selectedDemandPlan);
                    return (
                      <button
                        onClick={(e) => handleDeletePlan(selectedDemandPlan._id, e)}
                        className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                          lockStatus.canDelete
                            ? 'border-rose-200 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950'
                            : 'border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                        }`}
                        title={lockStatus.canDelete ? "Delete Plan" : "Deletion locked"}
                      >
                        <Trash2 size={16} />
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Outdated BOM Alert Banner */}
              {selectedDemandPlan.isBOMOutdated && (
                <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl flex items-center justify-between gap-3 text-amber-800 dark:text-amber-300 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-[10px]">!</span>
                    <span><strong>BOM Configuration Changed:</strong> The Bill of Materials for Finished Goods in this plan has been modified in the catalog. Synchronize now to update material requirements and gross profit projections.</span>
                  </div>
                  <button
                    onClick={(e) => handleSyncBOM(selectedDemandPlan, e)}
                    disabled={syncingPlanId === selectedDemandPlan._id}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={syncingPlanId === selectedDemandPlan._id ? "animate-spin" : ""} />
                    Sync Now
                  </button>
                </div>
              )}

              {/* Financial Health & Target Budget Guard Dashboard Card */}
              {(() => {
                const totalIncome = Number(selectedDemandPlan.totalIncome || 0);
                const totalGrossCost = Number(selectedDemandPlan.totalGrossMaterialCost || 0);
                const totalEstExpense = Number(selectedDemandPlan.totalEstimatedExpense || 0);
                const committedExpense = Number(selectedDemandPlan.committedExpense || 0);
                const targetExpense = Number(selectedDemandPlan.targetExpense || 0);
                const profit = Number(selectedDemandPlan.projectedGrossProfit || (totalIncome - totalEstExpense));
                const marginPct = Number(selectedDemandPlan.projectedMarginPercentage || (totalIncome > 0 ? ((profit / totalIncome) * 100) : 0));
                const budgetStatus = selectedDemandPlan.budgetStatus || (
                  targetExpense > 0 
                    ? (committedExpense > targetExpense ? 'Over Budget' : committedExpense >= targetExpense * 0.85 ? 'Near Limit' : 'Within Budget')
                    : 'Unset'
                );

                const budgetUsagePct = targetExpense > 0 
                  ? Math.min(100, Math.round((committedExpense / targetExpense) * 100))
                  : 0;

                const isOverBudget = targetExpense > 0 && committedExpense > targetExpense;
                const overrunAmount = isOverBudget ? committedExpense - targetExpense : 0;

                return (
                  <div className="shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 shadow-xs space-y-3">
                    {/* Header Strip of the Financial Card */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                          <IndianRupee size={15} />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>Financial Intelligence & Budget Guard</span>
                            <Sparkles size={13} className="text-amber-500" />
                          </h4>
                          <span className="text-[10px] text-slate-400 font-medium">Real-time revenue, material costs, and procurement spend tracking</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Budget Status Badge */}
                        {budgetStatus === 'Over Budget' ? (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 flex items-center gap-1.5">
                            <AlertTriangle size={13} />
                            <span>🚨 Over Budget</span>
                          </span>
                        ) : budgetStatus === 'Near Limit' ? (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 flex items-center gap-1.5">
                            <Clock size={13} />
                            <span>⚠️ Near Limit (85-100%)</span>
                          </span>
                        ) : budgetStatus === 'Within Budget' ? (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            <span>✅ Within Budget</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Budget Unset
                          </span>
                        )}

                        {/* Set / Edit Budget Button */}
                        <button
                          type="button"
                          onClick={() => handleUpdateTargetExpense(selectedDemandPlan)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Set or update the target expense budget ceiling for this plan"
                        >
                          <Target size={12} />
                          <span>{targetExpense > 0 ? 'Edit Budget' : '+ Set Budget'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Over-Budget Alert Banner if purchases exceed target */}
                    {isOverBudget && (
                      <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl p-2.5 flex items-start gap-2.5">
                        <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                        <div className="text-xs text-rose-800 dark:text-rose-200">
                          <strong className="font-black">Budget Overrun Alert:</strong> Committed Purchase Orders (<strong>₹{committedExpense.toLocaleString('en-IN')}</strong>) have exceeded the target budget ceiling (<strong>₹{targetExpense.toLocaleString('en-IN')}</strong>) by <strong className="underline">₹{overrunAmount.toLocaleString('en-IN')}</strong> ({Math.round((committedExpense / targetExpense) * 100)}% of budget utilized).
                        </div>
                      </div>
                    )}

                    {/* 4 Financial KPI Blocks */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {/* Metric 1: Total Revenue */}
                      <div className="bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Projected Revenue (Income)</span>
                        <div className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                          ₹{totalIncome.toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                          {selectedDemandPlan.customerPoNumber ? 'From Customer PO line rates' : 'From FG Selling Prices'}
                        </span>
                      </div>

                      {/* Metric 2: Estimated Material Cost */}
                      <div className="bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Est. Material Shortage Cost</span>
                        <div className="text-base sm:text-lg font-black font-mono text-slate-800 dark:text-slate-100 mt-0.5">
                          ₹{totalEstExpense.toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                          Gross: ₹{totalGrossCost.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Metric 3: Committed PO Spend */}
                      <div className="bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Committed PO Spend</span>
                        <div className={`text-base sm:text-lg font-black font-mono mt-0.5 ${
                          isOverBudget ? 'text-rose-600' : 'text-indigo-600 dark:text-indigo-400'
                        }`}>
                          ₹{committedExpense.toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                          {targetExpense > 0 ? `${budgetUsagePct}% of Target Budget` : 'POs released against this MRP'}
                        </span>
                      </div>

                      {/* Metric 4: Target Ceiling & Projected Margin */}
                      <div className="bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Budget</span>
                          <span className="text-[10px] font-bold text-emerald-600">Margin: {marginPct.toFixed(1)}%</span>
                        </div>
                        <div className="text-base sm:text-lg font-black font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                          {targetExpense > 0 ? `₹${targetExpense.toLocaleString('en-IN')}` : 'Not Set'}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                          Est. Profit: ₹{profit.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Visual Budget Progress Bar */}
                    {targetExpense > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-600 dark:text-slate-300">
                            Budget Utilization: <strong className="font-mono">₹{committedExpense.toLocaleString('en-IN')}</strong> / <span className="font-mono text-slate-400">₹{targetExpense.toLocaleString('en-IN')}</span>
                          </span>
                          <span className={`font-mono ${
                            isOverBudget ? 'text-rose-600 font-black' : committedExpense >= targetExpense * 0.85 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            {budgetUsagePct}% {isOverBudget ? '(OVER LIMIT)' : ''}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOverBudget 
                                ? 'bg-rose-500' 
                                : committedExpense >= targetExpense * 0.85 
                                ? 'bg-amber-500' 
                                : 'bg-gradient-to-r from-emerald-500 to-indigo-500'
                            }`}
                            style={{ width: `${Math.min(100, (committedExpense / targetExpense) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* FG Items Container (Isolated Scrollable Area) */}
              <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                {/* Desktop Table View */}
                <div className="hidden md:block flex-1 min-h-0 overflow-auto scroll-smooth">
                  <table className="w-full min-w-[880px] text-xs text-left">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 shadow-2xs backdrop-blur-xs">
                      <tr>
                        <th className="p-3.5">Finished Good (FG) Item & Description</th>
                        <th className="p-3.5 text-center">BOM Number</th>
                        <th className="p-3.5 text-center">Target Quantity</th>
                        <th className="p-3.5 text-right">Selling Rate</th>
                        <th className="p-3.5 text-right">Total Revenue</th>
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
                            {/* FG Name & Description (Strict rule compliance: AGENTS.md) */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <strong className="text-slate-900 dark:text-white block text-sm">
                                  {fg.fgItem?.name || fg.fgItemName || "FG Item"}
                                </strong>
                                {fg.sourceBreakdown && fg.sourceBreakdown.length > 1 ? (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {fg.sourceBreakdown.map((b: any, bIdx: number) => (
                                      <span key={bIdx} className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200" title={b.customerName ? `${b.customerName}` : ''}>
                                        {b.customerPoNumber}: {b.quantity} {fg.unit || 'PCS'}
                                      </span>
                                    ))}
                                  </div>
                                ) : fg.customerPoNumber ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                                    PO: {fg.customerPoNumber}
                                  </span>
                                ) : null}
                                {fg.customerName && (!fg.sourceBreakdown || fg.sourceBreakdown.length <= 1) && (
                                  <span className="text-[10px] text-slate-400 font-medium">({fg.customerName})</span>
                                )}
                              </div>
                              {(fg.fgItem?.description || fg.fgItem?.descriptions || fg.description) && (
                                <span className="text-xs text-slate-500 italic block mt-0.5">
                                  {fg.fgItem?.description || fg.fgItem?.descriptions || fg.description}
                                </span>
                              )}
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

                            {/* Selling Rate */}
                            <td className="p-3.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                              {fg.sellingPrice ? (
                                <div>
                                  <span>₹{Number(fg.sellingPrice).toLocaleString('en-IN')}</span>
                                  {fg.priceSource && (
                                    <span className="block text-[9px] text-slate-400 font-normal">
                                      {fg.priceSource === 'customer_po' ? 'PO Line Rate' : 'FG Master'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-normal">-</span>
                              )}
                            </td>

                            {/* Total Revenue */}
                            <td className="p-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                              {fg.totalPrice ? (
                                `₹${Number(fg.totalPrice).toLocaleString('en-IN')}`
                              ) : fg.sellingPrice ? (
                                `₹${(Number(fg.sellingPrice) * fgQty).toLocaleString('en-IN')}`
                              ) : (
                                <span className="text-slate-400 font-normal">-</span>
                              )}
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

                {/* Dedicated Native Mobile Cards View */}
                <div className="md:hidden flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/80">
                  {(selectedDemandPlan.fgItems || []).map((fg: any, fgIdx: number) => {
                    const fgQty = Number(fg.quantity) || 1;
                    const recQty = Number(fg.receivedQuantity) || 0;
                    const balQty = Math.max(0, fgQty - recQty);
                    const pct = Math.min(100, Math.round((recQty / fgQty) * 100));

                    const allChildMats = [...(selectedDemandPlan.rmRequirements || []), ...(selectedDemandPlan.boRequirements || [])];
                    const hasShortages = allChildMats.some((m: any) => m.shortage > 0);
                    const isProcurementFulfilled = !hasShortages;

                    return (
                      <div
                        key={fgIdx}
                        className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-xs space-y-2.5"
                      >
                        {/* Header: FG Name, Description & BOM Number */}
                        <div className="space-y-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <strong className="text-slate-900 dark:text-white text-sm font-bold block">
                              {fg.fgItem?.name || fg.fgItemName || "FG Item"}
                            </strong>
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg shrink-0">
                              {fg.bomNumber || "BOM-Active"}
                            </span>
                          </div>
                          {(fg.fgItem?.description || fg.fgItem?.descriptions || fg.description) && (
                            <span className="text-[11px] text-slate-500 italic block line-clamp-2">
                              {fg.fgItem?.description || fg.fgItem?.descriptions || fg.description}
                            </span>
                          )}
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                          <div>
                            <div className="text-[9px] uppercase font-bold text-slate-400">Target</div>
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{fgQty} {fg.unit || 'PCS'}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase font-bold text-teal-600">Received</div>
                            <div className="font-mono font-bold text-teal-600 dark:text-teal-400">{recQty} {fg.unit || 'PCS'}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase font-bold text-amber-600">Balance</div>
                            <div className="font-mono font-bold text-amber-600 dark:text-amber-400">{balQty} {fg.unit || 'PCS'}</div>
                          </div>
                        </div>

                        {/* Financial Revenue Info */}
                        {(fg.sellingPrice || fg.totalPrice) && (
                          <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/60">
                            <span className="text-slate-500 font-medium">Rate: <strong className="font-mono text-slate-800 dark:text-slate-200">₹{Number(fg.sellingPrice || 0).toLocaleString('en-IN')}</strong></span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold font-mono">
                              Total: ₹{Number(fg.totalPrice || (Number(fg.sellingPrice || 0) * fgQty)).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}

                        {/* Progress Bar & Status */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-teal-600">{pct}% Completed</span>
                            {isProcurementFulfilled ? (
                              <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                                <CheckCircle2 size={11} /> Fulfilled
                              </span>
                            ) : (
                              <span className="text-amber-600 font-extrabold flex items-center gap-1">
                                <Clock size={11} /> Shortages Pending
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                pct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-teal-500 to-indigo-500'
                              }`} 
                              style={{ width: `${pct}%` }} 
                            />
                          </div>
                        </div>

                        {/* Action: Move to Production */}
                        {selectedDemandPlan.status !== 'In Production' && pct < 100 && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={(e) => handleMoveToProduction(selectedDemandPlan._id, e)}
                              className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                isProcurementFulfilled 
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs' 
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <Play size={12} />
                              <span>Move to Production</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* VIEW 3: MRP HISTORY (COMPLETED PLANS) */}
      {mainView === 'history' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <MRPHistoryView
            mrpPlans={mrpPlans}
            token={token}
            onRefresh={fetchData}
            onViewDetails={(plan) => {
              setSelectedPlanForDetails(plan);
              setIsDetailsModalOpen(true);
            }}
            onOpenDrawer={(planId) => {
              setDrawerPlanId(planId);
              setIs360DrawerOpen(true);
            }}
          />
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

      {/* MRP Create / Edit Modal */}
      {isCreateModalOpen && (
        <MRPModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingPlan(null);
            setPreselectedPoIds([]);
          }}
          onSuccess={() => {
            fetchData();
            setIsCreateModalOpen(false);
            setEditingPlan(null);
            setPreselectedPoIds([]);
            Swal.fire({
              icon: 'success',
              title: 'MRP Demand Plan Created!',
              text: 'BOM exploded and procurement requirements calculated successfully.',
              confirmButtonText: 'View in MRP Plans',
              showCancelButton: true,
              cancelButtonText: 'Stay in Demand Hub',
              confirmButtonColor: '#4f46e5'
            }).then((res) => {
              if (res.isConfirmed) {
                setMainView('plans');
              }
            });
          }}
          token={token}
          initialData={editingPlan}
          preselectedPoIds={preselectedPoIds}
        />
      )}

      {/* MRP Details Modal */}
      {isDetailsModalOpen && selectedPlanForDetails && (
        <MRPDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          mrpPlan={selectedPlanForDetails}
          onPlanUpdated={(updatedPlan) => {
            setSelectedPlanForDetails(updatedPlan);
            if (selectedDemandPlan && selectedDemandPlan._id === updatedPlan._id) {
              setSelectedDemandPlan(updatedPlan);
            }
            fetchData();
          }}
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
          inHouseItems={inHouseItems as any}
          priceLists={priceLists as any}
          initialData={poInitialData}
        />
      )}

    </div>
  );
}
