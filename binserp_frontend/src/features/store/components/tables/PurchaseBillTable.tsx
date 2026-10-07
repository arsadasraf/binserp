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
  X
} from 'lucide-react';
import { PurchaseBill, PurchaseBillMetrics } from '@/src/features/purchase/types/purchaseBill.types';
import SearchableSelect from '../SearchableSelect';
import RecordPaymentModal from '../modals/RecordPaymentModal';
import PurchaseBillDetailModal from '../modals/PurchaseBillDetailModal';
import { API_BASE_URL } from '@/src/utils/config';

interface PurchaseBillTableProps {
  bills: PurchaseBill[];
  metrics?: PurchaseBillMetrics;
  loading: boolean;
  onRefresh: () => void;
  vendors?: any[];
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
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>("");
  
  // Dashboard is hidden by default per user specification
  const [showDashboard, setShowDashboard] = useState<boolean>(false);

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

      {/* Unified Single-Line Control & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-wrap lg:flex-nowrap items-center gap-2 text-xs">
        {/* 1. Global Search Box */}
        <div className="relative min-w-[170px] max-w-[230px] flex-1">
          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Bill, GRN, Inv..."
            className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* 2. Customer / Vendor Dropdown with Type-Ahead Search Key */}
        <div className="w-[190px] shrink-0">
          <SearchableSelect
            options={vendorOptions}
            value={selectedVendorId}
            onChange={(val) => onVendorChange(val)}
            placeholder="All Vendors / Suppliers"
            className="w-full text-xs"
            innerClassName="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl outline-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-all font-medium"
          />
        </div>

        {/* 3. Item Category / Type Dropdown (RM, BO, Consumables, All) */}
        <div className="w-[130px] shrink-0">
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-all"
            title="Filter by item material type"
          >
            <option value="all">📦 All Types</option>
            <option value="rm">Raw Material (RM)</option>
            <option value="bo">Bought-Out (BO)</option>
            <option value="consumable">Consumables</option>
          </select>
        </div>

        {/* 4. Payment Status Dropdown (Paid, Unpaid, Partially Paid, Overdue) */}
        <div className="w-[135px] shrink-0">
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-all"
            title="Filter by payment status"
          >
            <option value="all">💳 All Statuses</option>
            <option value="Unpaid">⏳ Unpaid</option>
            <option value="Partially Paid">🟡 Partially Paid</option>
            <option value="Paid">🟢 Paid</option>
            <option value="Overdue">🔴 Overdue</option>
          </select>
        </div>

        {/* 5. Date Filter Dropdown / Popover */}
        <div className="relative shrink-0" ref={datePopoverRef}>
          <button
            type="button"
            onClick={() => setIsDateOpen(!isDateOpen)}
            className={`px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              startDate || endDate
                ? 'border-indigo-400 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
            title="Date Filter"
          >
            <Calendar size={13} className={startDate || endDate ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"} />
            <span className="truncate max-w-[110px]">{dateFilterLabel}</span>
            <ChevronDown size={12} className={`text-slate-400 transition-transform ${isDateOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDateOpen && (
            <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-3 space-y-2.5 animate-in fade-in duration-100">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date Presets</span>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => handleDatePreset('all')}
                    className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDatePreset('thisMonth')}
                  className="px-2 py-1 text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset('lastMonth')}
                  className="px-2 py-1 text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset('last30Days')}
                  className="px-2 py-1 text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset('all')}
                  className="px-2 py-1 text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  All Time
                </button>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custom Range</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">From</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => onDateChange(e.target.value, endDate)}
                      className="w-full px-1.5 py-1 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">To</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => onDateChange(startDate, e.target.value)}
                      className="w-full px-1.5 py-1 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clear Filters Button (shown only when active filters exist) */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
            title="Reset all active filters"
          >
            <X size={12} />
            <span>Clear</span>
          </button>
        )}

        {/* Action Controls Group: Right Aligned */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {/* Show / Hide Dashboard Button */}
          <button
            type="button"
            onClick={() => setShowDashboard(!showDashboard)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 ${
              showDashboard
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 shadow-2xs'
                : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Toggle Financial Metrics & Summary"
          >
            <Layers size={13} />
            <span>{showDashboard ? "Hide Metrics" : "Show Metrics"}</span>
            {metrics && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-extrabold">
                {metrics.totalBillsCount || bills.length}
              </span>
            )}
          </button>

          {/* Sync from GRNs Button */}
          <button
            type="button"
            onClick={handleSyncFromGRNs}
            disabled={syncing}
            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
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
            className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Refresh bills list"
          >
            <RotateCcw size={13} className={loading ? "animate-spin text-indigo-500" : ""} />
          </button>
        </div>
      </div>

      {/* Table Section: Scrollable Viewport with Sticky Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
        <div className="overflow-auto max-h-[calc(100vh-215px)] min-h-[380px] custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs shadow-2xs border-b border-slate-200 dark:border-slate-700">
              <tr className="text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 min-w-[140px]">Bill # & Date</th>
                <th className="py-3 px-3 min-w-[180px]">Supplier / Vendor</th>
                <th className="py-3 px-2.5 w-24 text-center">Category</th>
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

                      {/* Category */}
                      <td className="py-3 px-2.5 text-center">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {bill.grnCategory?.toUpperCase() || 'RM'}
                        </span>
                      </td>

                      {/* Item Name & Technical Description per AGENTS.md */}
                      <td className="py-3 px-3">
                        {firstItem ? (
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {firstItem.materialName || 'Item'}
                            </div>
                            {firstItem.description && (
                              <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                                📝 {firstItem.description}
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
    </div>
  );
}
