import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  RefreshCw, 
  CreditCard, 
  Eye, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RotateCcw,
  Package, 
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Briefcase,
  Wrench,
  BarChart3,
  Filter
} from 'lucide-react';
import { PurchaseBill, PurchaseBillMetrics } from '@/src/features/purchase/types/purchaseBill.types';
import SearchableSelect from '../SearchableSelect';
import RecordPaymentModal from '../modals/RecordPaymentModal';
import PurchaseBillDetailModal from '../modals/PurchaseBillDetailModal';
import CreateServiceBillModal from '../modals/CreateServiceBillModal';
import { API_BASE_URL } from '@/src/utils/config';

interface PurchaseBillTableProps {
  bills: PurchaseBill[];
  metrics?: PurchaseBillMetrics;
  loading: boolean;
  onRefresh: () => void;
  vendors?: any[];
  selectedBillType?: string;
  onBillTypeChange?: (type: string) => void;
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  selectedVendorId: string;
  onVendorChange: (vendorId: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
}

export default function PurchaseBillTable({
  bills = [],
  metrics,
  loading,
  onRefresh,
  vendors = [],
  selectedBillType = 'all',
  onBillTypeChange,
  startDate,
  endDate,
  onDateChange,
  selectedVendorId,
  onVendorChange,
  selectedStatus,
  onStatusChange,
  selectedCategory,
  onCategoryChange,
  searchTerm,
  onSearchChange
}: PurchaseBillTableProps) {
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<PurchaseBill | null>(null);
  const [selectedBillForDetail, setSelectedBillForDetail] = useState<PurchaseBill | null>(null);
  const [isCreateServiceBillOpen, setIsCreateServiceBillOpen] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>("");
  
  // Dashboard is hidden by default per user specification
  const [showDashboard, setShowDashboard] = useState<boolean>(false);

  // Mobile card multi-item expansion state
  const [expandedCardBillIds, setExpandedCardBillIds] = useState<Record<string, boolean>>({});
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  const toggleCardItems = (id: string) => setExpandedCardBillIds(prev => ({ ...prev, [id]: !prev[id] }));

  // Date Filter Popover state
  const [isDateOpen, setIsDateOpen] = useState<boolean>(false);
  const datePopoverRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  // Close date popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePopoverRef.current && !datePopoverRef.current.contains(event.target as Node)) {
        setIsDateOpen(false);
      }
    };
    if (isDateOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDateOpen]);

  // Vendor options for SearchableSelect with type-ahead search
  const vendorOptions = useMemo(() => {
    const list = [{ value: 'all', label: 'All Vendors / Suppliers' }];
    vendors.forEach((v: any) => {
      const id = v._id || v.id;
      if (!id) return;
      const name = v.name || v.vendorName || 'Unknown Vendor';
      const type = v.vendorType ? ` (${v.vendorType})` : '';
      list.push({
        value: id,
        label: `${name}${type}`
      });
    });
    return list;
  }, [vendors]);

  // Quick Date Preset Handler
  const handleDatePreset = (preset: 'thisMonth' | 'lastMonth' | 'last30Days' | 'all') => {
    const now = new Date();
    if (preset === 'all') {
      onDateChange('', '');
      setIsDateOpen(false);
      return;
    }

    if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      onDateChange(firstDay, lastDay);
      setIsDateOpen(false);
      return;
    }

    if (preset === 'lastMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      onDateChange(firstDay, lastDay);
      setIsDateOpen(false);
      return;
    }

    if (preset === 'last30Days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      onDateChange(past, today);
      setIsDateOpen(false);
      return;
    }
  };

  // Active Date Filter Label
  const dateFilterLabel = useMemo(() => {
    if (startDate && endDate) {
      return `${startDate.slice(5)} to ${endDate.slice(5)}`;
    }
    if (startDate) return `From ${startDate.slice(5)}`;
    if (endDate) return `Until ${endDate.slice(5)}`;
    return "All Dates";
  }, [startDate, endDate]);

  // Active filter count for mobile badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedVendorId && selectedVendorId !== 'all') count++;
    if (selectedCategory && selectedCategory !== 'all') count++;
    if (selectedStatus && selectedStatus !== 'all') count++;
    if (startDate || endDate) count++;
    return count;
  }, [selectedVendorId, selectedCategory, selectedStatus, startDate, endDate]);

  // Active date preset for dropdown select
  const activeDatePreset = useMemo(() => {
    if (!startDate && !endDate) return 'all';
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (startDate === todayStr && endDate === todayStr) return 'today';
    if (startDate === yest && endDate === yest) return 'yesterday';
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    if (startDate === thisMonthStart && endDate === thisMonthEnd) return 'thisMonth';
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    if (startDate === lastMonthStart && endDate === lastMonthEnd) return 'lastMonth';
    return 'custom';
  }, [startDate, endDate]);

  const handleDateDropdownChange = (val: string) => {
    const now = new Date();
    if (val === 'all') {
      onDateChange('', '');
    } else if (val === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      onDateChange(todayStr, todayStr);
    } else if (val === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      onDateChange(yest, yest);
    } else if (val === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      onDateChange(firstDay, lastDay);
    } else if (val === 'lastMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      onDateChange(firstDay, lastDay);
    } else if (val === 'last30Days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      onDateChange(past, today);
    } else if (val === 'custom') {
      if (!startDate && !endDate) {
        const today = now.toISOString().slice(0, 10);
        onDateChange(today, today);
      }
    }
  };

  // Check if any filters are actively applied
  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    (selectedVendorId && selectedVendorId !== "all") ||
    (selectedCategory && selectedCategory !== "all") ||
    (selectedStatus && selectedStatus !== "all") ||
    startDate ||
    endDate
  );

  const handleResetFilters = () => {
    onSearchChange("");
    onVendorChange("all");
    onCategoryChange("all");
    onStatusChange("all");
    onDateChange("", "");
  };

  // One-click sync historical GRNs
  const handleSyncFromGRNs = async () => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/purchase/bill/sync-historical`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message || "Historical GRNs synced successfully");
        onRefresh();
        setTimeout(() => setSyncMessage(""), 4000);
      } else {
        setSyncMessage(data.message || "Sync failed");
      }
    } catch (err: any) {
      setSyncMessage(err.message || "Sync error");
    } finally {
      setSyncing(false);
    }
  };

  // Due Date helper
  const getDueDaysText = (dueDateStr?: string, status?: string) => {
    if (!dueDateStr) return null;
    if (status === 'Paid') return null;

    const due = new Date(dueDateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
          Overdue by {Math.abs(diffDays)}d
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
          Due today
        </span>
      );
    } else {
      return (
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Due in {diffDays}d
        </span>
      );
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Sync Status Banner */}
      {syncMessage && (
        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between animate-in fade-in">
          <span>⚡ {syncMessage}</span>
          <button onClick={() => setSyncMessage("")} className="text-indigo-500 hover:text-indigo-700 font-bold px-1">✕</button>
        </div>
      )}

      {/* KPI Financial Metric Summary Cards (Collapsible, Hidden by Default) */}
      {showDashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Total Bills */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Purchase Bills
              </span>
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Layers size={14} />
              </span>
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
              ₹{(metrics?.totalBillAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
              {metrics?.totalBillsCount || bills.length} Bills recorded
            </div>
          </div>

          {/* Paid Amount */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Total Paid
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} />
              </span>
            </div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{(metrics?.totalPaidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
              {metrics?.paidCount || 0} Fully Paid
            </div>
          </div>

          {/* Outstanding Balance */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Outstanding Balance
              </span>
              <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Clock size={14} />
              </span>
            </div>
            <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
              ₹{(metrics?.totalOutstandingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
              {metrics?.unpaidCount || 0} Pending Payment
            </div>
          </div>

          {/* Overdue Bills */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Overdue Bills
              </span>
              <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <AlertCircle size={14} />
              </span>
            </div>
            <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
              {metrics?.overdueCount || 0} <span className="text-xs font-normal text-slate-400">bills</span>
            </div>
            <div className="text-[11px] text-rose-500 mt-0.5 font-medium">
              Requires immediate follow-up
            </div>
          </div>
        </div>
      )}

      {/* Search, Filter & Action Toolbar - 3-Row Mobile & Responsive Architecture */}
      <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col gap-2.5">
        {/* ROW 1: Search Bar & Add Service Bill Action */}
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search Bill #, GRN #, Inv #, Supplier, Item..."
              className="w-full pl-8 sm:pl-9 pr-7 sm:pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-0.5"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Add Service Bill Button (Icon on mobile, labeled on desktop) */}
          <button
            type="button"
            onClick={() => setIsCreateServiceBillOpen(true)}
            className="p-2 sm:px-4 sm:py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:from-indigo-800 active:to-blue-800 text-white rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
            title="Record Returnable Job Work Invoice or Other Service Bill"
          >
            <Plus size={16} />
            <span className="hidden sm:inline font-bold text-xs">Add Service Bill</span>
          </button>
        </div>

        {/* ROW 2: Bill Type Segmented Floating Pill (Default: All Bills) */}
        <div className="w-full flex overflow-x-auto no-scrollbar bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 sm:w-fit gap-1">
          <button
            type="button"
            onClick={() => onBillTypeChange?.('all')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedBillType === 'all'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers size={13} />
            <span>All Bills</span>
          </button>

          <button
            type="button"
            onClick={() => onBillTypeChange?.('material')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedBillType === 'material'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Package size={13} />
            <span>Material GRNs</span>
          </button>

          <button
            type="button"
            onClick={() => onBillTypeChange?.('job-work-service')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedBillType === 'job-work-service'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wrench size={13} />
            <span>Job Work</span>
          </button>

          <button
            type="button"
            onClick={() => onBillTypeChange?.('other-service')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedBillType === 'other-service'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Briefcase size={13} />
            <span>Services</span>
          </button>
        </div>

        {/* ROW 3: KPI Metrics, Date Filter Dropdown, Filters Drawer, Sync & Refresh */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-1.5 sm:gap-2 w-full max-w-full">
          {/* Toggle KPI Financial Summary */}
          <button
            type="button"
            onClick={() => setShowDashboard(!showDashboard)}
            className={`px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border shrink-0 active:scale-95 ${
              showDashboard
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 shadow-2xs'
                : 'bg-slate-100 text-slate-700 border-gray-200 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
            title="Toggle Financial Metrics & Summary"
          >
            <BarChart3 size={14} className={showDashboard ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"} />
            <span>{showDashboard ? "Hide" : "KPIs"}</span>
            {metrics && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-extrabold">
                {metrics.totalBillsCount || bills.length}
              </span>
            )}
          </button>

          {/* Date Filter Dropdown */}
          <div className="relative flex-1 min-w-[120px] max-w-[200px]">
            <select
              value={activeDatePreset}
              onChange={(e) => handleDateDropdownChange(e.target.value)}
              className="w-full appearance-none pl-7 sm:pl-8 pr-6 sm:pr-7 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 truncate"
            >
              <option value="all">📅 All Dates</option>
              <option value="today">📅 Today</option>
              <option value="yesterday">📅 Yesterday</option>
              <option value="thisMonth">📅 This Month</option>
              <option value="lastMonth">📅 Last Month</option>
              <option value="last30Days">📅 Last 30 Days</option>
              <option value="custom">📅 Custom Range...</option>
            </select>
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-600 dark:text-indigo-400 pointer-events-none" size={13} />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
          </div>

          {/* Mobile Filters Toggle Button */}
          <button
            type="button"
            onClick={() => setShowMobileFilters(prev => !prev)}
            className={`lg:hidden px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border shrink-0 active:scale-95 ${
              showMobileFilters || activeFilterCount > 0
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 shadow-2xs'
                : 'bg-slate-100 text-slate-700 border-gray-200 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
            title="Filter by Vendor, Category, Payment Status"
          >
            <Filter size={13} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-600 text-white font-extrabold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Desktop Inline Selectors (Hidden on mobile, visible on desktop) */}
          <div className="hidden lg:flex items-center gap-2 flex-1">
            {/* Vendor Selector */}
            <div className="w-[180px] shrink-0">
              <SearchableSelect
                options={vendorOptions}
                value={selectedVendorId}
                onChange={(val) => onVendorChange(val)}
                placeholder="All Vendors"
                className="w-full text-xs"
                innerClassName="w-full px-2.5 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none cursor-pointer font-bold truncate"
              />
            </div>

            {/* Item Category */}
            <div className="w-[125px] shrink-0">
              <select
                value={selectedCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">📦 All Types</option>
                <option value="rm">Raw Material (RM)</option>
                <option value="bo">Bought-Out (BO)</option>
                <option value="consumable">Consumables</option>
              </select>
            </div>

            {/* Payment Status */}
            <div className="w-[125px] shrink-0">
              <select
                value={selectedStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">💳 All Statuses</option>
                <option value="Unpaid">⏳ Unpaid</option>
                <option value="Partially Paid">🟡 Partially Paid</option>
                <option value="Paid">🟢 Paid</option>
                <option value="Overdue">🔴 Overdue</option>
              </select>
            </div>
          </div>

          {/* Sync from GRNs Button */}
          <button
            type="button"
            onClick={handleSyncFromGRNs}
            disabled={syncing}
            className="p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-50 active:scale-95"
            title="Scan and sync all RM, BO, and Consumables GRNs into Purchase Bills"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin text-indigo-500" : ""} />
            <span className="hidden sm:inline">{syncing ? "Syncing..." : "Sync GRNs"}</span>
          </button>

          {/* Refresh List Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-50 active:scale-95"
            title="Refresh bills list"
          >
            <RotateCcw size={13} className={loading ? "animate-spin text-indigo-500" : ""} />
          </button>

          {/* Reset active filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer shrink-0 active:scale-95"
              title="Reset all active filters"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Auxiliary Custom Date Range Strip */}
        {activeDatePreset === 'custom' && (
          <div className="w-full p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1.5 max-w-full overflow-hidden animate-in fade-in duration-150">
            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onDateChange(e.target.value, endDate)}
              className="flex-1 min-w-0 h-7 px-1.5 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-mono outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onDateChange(startDate, e.target.value)}
              className="flex-1 min-w-0 h-7 px-1.5 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-mono outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => onDateChange('', '')}
              className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer active:scale-95 shrink-0"
              title="Clear date range"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Mobile Filter Drawer (When toggled open on mobile) */}
        {showMobileFilters && (
          <div className="lg:hidden w-full p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Quick Filters</span>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            
            {/* Vendor */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Supplier / Vendor</label>
              <SearchableSelect
                options={vendorOptions}
                value={selectedVendorId}
                onChange={(val) => onVendorChange(val)}
                placeholder="All Vendors / Suppliers"
                className="w-full text-xs"
                innerClassName="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none cursor-pointer font-medium"
              />
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value="all">📦 All Types</option>
                  <option value="rm">Raw Material (RM)</option>
                  <option value="bo">Bought-Out (BO)</option>
                  <option value="consumable">Consumables</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Payment Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value="all">💳 All Statuses</option>
                  <option value="Unpaid">⏳ Unpaid</option>
                  <option value="Partially Paid">🟡 Partially Paid</option>
                  <option value="Paid">🟢 Paid</option>
                  <option value="Overdue">🔴 Overdue</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card List View (< md) */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200/80 dark:border-slate-800 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
            <span className="text-xs font-semibold">Loading Purchase Bills...</span>
          </div>
        ) : bills.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200/80 dark:border-slate-800 text-center text-slate-400">
            <Package size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-700" />
            <div className="text-sm font-bold text-slate-600 dark:text-slate-300">No Purchase Bills found</div>
            <div className="text-xs text-slate-400 mt-1">
              Click <strong>"Sync GRNs"</strong> to import commercial GRNs or adjust your filter.
            </div>
          </div>
        ) : (
          bills.map((bill, index) => {
            const isExpanded = Boolean(expandedCardBillIds[bill._id]);
            const itemsCount = bill.items?.length || 0;
            const firstItem = bill.items?.[0];

            return (
              <div
                key={bill._id || index}
                className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3 transition-all"
              >
                {/* 1. Header Row: Bill # & Type / Payment Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm">
                        {bill.billNumber}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        • {new Date(bill.date).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Reference Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {bill.grnNumber && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          GRN: {bill.grnNumber}
                        </span>
                      )}
                      {bill.jobWorkChallanNumber && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          DC: {bill.jobWorkChallanNumber}
                        </span>
                      )}
                      {bill.supplierInvoiceNumber && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                          Inv: {bill.supplierInvoiceNumber}
                        </span>
                      )}
                      {bill.poNumber && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
                          PO: {bill.poNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges on right */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {/* Bill Type Badge */}
                    {bill.billType === 'job-work-service' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        ⚙️ Job Work
                      </span>
                    ) : bill.billType === 'other-service' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        🛠️ Service
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        📦 {bill.grnCategory?.toUpperCase() || 'RM'}
                      </span>
                    )}

                    {/* Payment Status Pill */}
                    <button
                      type="button"
                      onClick={() => setSelectedBillForPayment(bill)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-85 transition-opacity ${
                        bill.paymentStatus === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : bill.paymentStatus === 'Partially Paid'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                          : bill.paymentStatus === 'Overdue'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                          : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                      title="Update payment status"
                    >
                      {bill.paymentStatus}
                    </button>
                  </div>
                </div>

                {/* 2. Supplier / Vendor info */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Supplier</span>
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                    {bill.vendorName}
                  </div>
                  {bill.vendorGst && (
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      GSTIN: {bill.vendorGst}
                    </div>
                  )}
                </div>

                {/* 3. Items / Services Section (AGENTS.md Rule 1) */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-750 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Item Details ({itemsCount})</span>
                    {itemsCount > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleCardItems(bill._id)}
                        className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5 cursor-pointer lowercase"
                      >
                        <span>{isExpanded ? "collapse" : `+${itemsCount - 1} more`}</span>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                  </div>

                  {firstItem ? (
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                        {firstItem.serviceName || firstItem.materialName || 'Service / Item'}
                      </div>
                      {firstItem.description && (
                        <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                          📝 {firstItem.description}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <span>
                          {firstItem.quantity} {firstItem.unit || 'PCS'} @ ₹{Number(firstItem.rate || 0).toFixed(2)}
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          ₹{Number(firstItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No items recorded</div>
                  )}

                  {/* Accordion for additional items */}
                  {isExpanded && itemsCount > 1 && (
                    <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2 animate-in fade-in duration-150">
                      {bill.items.slice(1).map((item, itmIdx) => (
                        <div key={itmIdx} className="pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-700 first:border-0 first:pt-0">
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                            {item.serviceName || item.materialName || 'Service / Item'}
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                              📝 {item.description}
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                            <span>
                              {item.quantity} {item.unit || 'PCS'} @ ₹{Number(item.rate || 0).toFixed(2)}
                            </span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              ₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Financial Summary Grid */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-750 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Bill Amount</span>
                    <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                      ₹{Number(bill.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Paid</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                      ₹{Number(bill.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Remaining Balance</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
                      ₹{Number(bill.balanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Due Status</span>
                    <div>{getDueDaysText(bill.dueDate, bill.paymentStatus) || <span className="text-slate-400 text-[10px]">-</span>}</div>
                  </div>
                </div>

                {/* 5. Bottom Action Buttons (50/50 Split) */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedBillForDetail(bill)}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <Eye size={14} className="text-slate-500" />
                    <span>View Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedBillForPayment(bill)}
                    className="py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    <CreditCard size={14} />
                    <span>Record Payment</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table Section: Scrollable Viewport with Sticky Header (>= md) */}
      <div className="hidden md:flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-215px)] min-h-[380px] custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs shadow-2xs border-b border-slate-200 dark:border-slate-700">
              <tr className="text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 min-w-[140px]">Bill # & Date</th>
                <th className="py-3 px-3 min-w-[180px]">Supplier / Vendor</th>
                <th className="py-3 px-2.5 min-w-[110px] text-center">Type & Category</th>
                <th className="py-3 px-3 min-w-[220px]">Item Name & Description</th>
                <th className="py-3 px-3 w-32 text-right">Bill Amount (₹)</th>
                <th className="py-3 px-3 w-32 text-center">Terms & Due Date</th>
                <th className="py-3 px-3 w-32 text-right">Paid / Balance</th>
                <th className="py-3 px-3 w-28 text-center">Payment Status</th>
                <th className="py-3 px-3 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading Purchase Bills...</span>
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Package size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    <div className="text-sm font-bold text-slate-600 dark:text-slate-300">No Purchase Bills found</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Click <strong>"Sync from GRNs"</strong> to import commercial GRNs or adjust your filter.
                    </div>
                  </td>
                </tr>
              ) : (
                bills.map((bill, index) => {
                  const itemsCount = bill.items?.length || 0;
                  const firstItem = bill.items?.[0];

                  return (
                    <tr key={bill._id} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-colors">
                      {/* Index */}
                      <td className="py-3 px-3 text-center text-slate-400 font-bold">{index + 1}</td>

                      {/* Bill # & Date */}
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                          {bill.billNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {new Date(bill.date).toLocaleDateString()}
                        </div>
                        {bill.grnNumber && (
                          <div className="text-[10px] font-mono font-medium text-slate-500 mt-0.5 flex items-center gap-1">
                            <span>GRN:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{bill.grnNumber}</span>
                          </div>
                        )}
                        {bill.supplierInvoiceNumber && (
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Inv: {bill.supplierInvoiceNumber}
                          </div>
                        )}
                      </td>

                      {/* Vendor */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {bill.vendorName}
                        </div>
                        {bill.vendorGst && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            GST: {bill.vendorGst}
                          </div>
                        )}
                        {bill.poNumber && (
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                            PO: {bill.poNumber}
                          </div>
                        )}
                      </td>

                      {/* Type & Category */}
                      <td className="py-3 px-2.5 text-center">
                        {bill.billType === 'job-work-service' ? (
                          <div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              ⚙️ Job Work DC
                            </span>
                            {bill.jobWorkChallanNumber && (
                              <div className="font-mono text-[9px] text-slate-500 mt-0.5 truncate max-w-[100px] mx-auto">
                                {bill.jobWorkChallanNumber}
                              </div>
                            )}
                          </div>
                        ) : bill.billType === 'other-service' ? (
                          <div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              🛠️ Service Bill
                            </span>
                            {bill.serviceCategory && (
                              <div className="text-[9px] text-slate-500 mt-0.5 truncate max-w-[100px] mx-auto">
                                {bill.serviceCategory}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              📦 {bill.grnCategory?.toUpperCase() || 'RM'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Item Name & Technical Description per AGENTS.md */}
                      <td className="py-3 px-3">
                        {firstItem ? (
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {firstItem.serviceName || firstItem.materialName || 'Service / Item'}
                            </div>
                            {firstItem.description && (
                              <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                                📝 {firstItem.description}
                              </div>
                            )}
                            {firstItem.sacCode && (
                              <div className="text-[9.5px] font-mono text-slate-400 mt-0.5">
                                SAC: {firstItem.sacCode}
                              </div>
                            )}
                            {itemsCount > 1 && (
                              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                                + {itemsCount - 1} more item{itemsCount > 2 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No items</span>
                        )}
                      </td>

                      {/* Bill Amount */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs">
                          ₹{Number(bill.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {bill.tdsApplicable && Number(bill.tdsAmount || 0) > 0 && (
                          <div className="text-[9.5px] text-rose-500 font-semibold mt-0.5" title={`TDS deducted under ${bill.tdsSection || '194C'}`}>
                            TDS: -₹{Number(bill.tdsAmount).toFixed(2)}
                          </div>
                        )}
                        {bill.netPayableAmount !== undefined && Number(bill.netPayableAmount) > 0 && bill.netPayableAmount !== bill.grandTotal && (
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold font-mono">
                            Net: ₹{Number(bill.netPayableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                        {(Number(bill.transportationCharges || 0) > 0 || Number(bill.packingCharges || 0) > 0) && (
                          <div className="text-[9.5px] text-slate-400 mt-0.5" title="Additional charges included">
                            Incl. 🚚₹{bill.transportationCharges || 0} 📦₹{bill.packingCharges || 0}
                          </div>
                        )}
                      </td>

                      {/* Terms & Due Date */}
                      <td className="py-3 px-3 text-center">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                          {bill.paymentTerms || `${bill.creditDays || 30} Days Net`}
                        </div>
                        {bill.dueDate && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {new Date(bill.dueDate).toLocaleDateString()}
                          </div>
                        )}
                        <div className="mt-0.5">
                          {getDueDaysText(bill.dueDate, bill.paymentStatus)}
                        </div>
                      </td>

                      {/* Paid / Balance */}
                      <td className="py-3 px-3 text-right">
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                          ₹{Number(bill.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-rose-600 dark:text-rose-400 font-mono text-[11px] mt-0.5 font-bold">
                          Bal: ₹{Number(bill.balanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setSelectedBillForPayment(bill)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full cursor-pointer hover:opacity-85 transition-opacity ${
                            bill.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : bill.paymentStatus === 'Partially Paid'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                              : bill.paymentStatus === 'Overdue'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                              : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                          title="Click to record payment or update terms"
                        >
                          {bill.paymentStatus}
                        </button>
                        {bill.comments && bill.comments.length > 0 && (
                          <div
                            onClick={() => setSelectedBillForPayment(bill)}
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 flex items-center justify-center gap-1 cursor-pointer hover:underline"
                            title="Notes/Comments available"
                          >
                            <MessageSquare size={10} />
                            <span>{bill.comments.length} note{bill.comments.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedBillForDetail(bill)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors cursor-pointer"
                            title="View Full Details"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => setSelectedBillForPayment(bill)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 rounded-lg transition-colors cursor-pointer"
                            title="Record Payment / Terms"
                          >
                            <CreditCard size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment & Terms Modal */}
      {selectedBillForPayment && (
        <RecordPaymentModal
          bill={selectedBillForPayment}
          isOpen={Boolean(selectedBillForPayment)}
          onClose={() => setSelectedBillForPayment(null)}
          onSuccess={() => {
            setSelectedBillForPayment(null);
            onRefresh();
          }}
        />
      )}

      {/* Bill Detail Modal */}
      {selectedBillForDetail && (
        <PurchaseBillDetailModal
          bill={selectedBillForDetail}
          isOpen={Boolean(selectedBillForDetail)}
          onClose={() => setSelectedBillForDetail(null)}
          onRefresh={onRefresh}
          onOpenRecordPayment={() => {
            setSelectedBillForPayment(selectedBillForDetail);
            setSelectedBillForDetail(null);
          }}
        />
      )}

      {/* Create Service Bill Modal */}
      {isCreateServiceBillOpen && (
        <CreateServiceBillModal
          isOpen={isCreateServiceBillOpen}
          onClose={() => setIsCreateServiceBillOpen(false)}
          onSuccess={() => {
            setIsCreateServiceBillOpen(false);
            onRefresh();
          }}
          vendors={vendors}
        />
      )}
    </div>
  );
}
