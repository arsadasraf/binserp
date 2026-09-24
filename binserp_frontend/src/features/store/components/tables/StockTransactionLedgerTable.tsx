import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getApiBaseUrl } from "@/src/utils/config";
import {
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Calendar,
  FileText,
  User,
  Building,
  Tag,
  ChevronLeft,
  ChevronRight,
  Layers,
  Download,
  CheckCircle2,
  Clock,
  Boxes,
  ArrowUpDown,
  LayoutGrid,
  Eye,
  ChevronDown,
  X,
  TrendingUp
} from "lucide-react";
import * as XLSX from "xlsx";

interface Transaction {
  _id: string;
  itemType: string;
  itemCode: string;
  itemName: string;
  unit: string;
  movementType: "INWARD" | "OUTWARD";
  transactionCategory: string;
  quantity: number;
  hasSecondaryUnit?: boolean;
  secondaryUnit?: string;
  secondaryQuantity?: number;
  conversionFactor?: number;
  previousStock: number;
  newStock: number;
  referenceDocType: string;
  referenceDocNumber: string;
  recipientOrSource: string;
  purpose: string;
  performedByName: string;
  timestamp: string;
}

interface StockTransactionLedgerTableProps {
  token: string | null;
  apiUrl?: string;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  GRN_PURCHASE_INWARD: { label: "GRN Purchase Inward", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  GRN_QC_PENDING_INWARD: { label: "GRN QC Pending Inward", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  QC_RELEASE_INWARD: { label: "QC Approved Inward", color: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300" },
  JOB_WORK_RETURN_INWARD: { label: "JW Return Inward", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300" },
  RM_CONVERSION_INWARD: { label: "RM Conversion Inward", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300" },
  RM_CONVERSION_OUTWARD: { label: "RM Conversion Outward", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  JOB_WORK_QC_PENDING_INWARD: { label: "JW QC Pending Inward", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300" },
  JOBWORK_QC_RELEASE_INWARD: { label: "JW QC Approved Inward", color: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300" },
  FG_GRN_INWARD: { label: "FG Production GRN Inward", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300" },
  MATERIAL_ISSUE_SHOPFLOOR_OUTWARD: { label: "Shopfloor Issue Outward", color: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300" },
  MATERIAL_ISSUE_FG_OUTWARD: { label: "Shopfloor FG Outward", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" },
  RETURNABLE_DC_JOB_WORK_OUTWARD: { label: "Returnable DC (Job Work) Outward", color: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300" },
  SALES_DC_OUTWARD: { label: "Sales DC Outward", color: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300" },
  INVOICE_OUTWARD: { label: "Invoice Outward", color: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300" },
  STOCK_ADJUSTMENT: { label: "Stock Adjustment", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
};

type DateFilterMode = "preset" | "day" | "month" | "range";

export default function StockTransactionLedgerTable({ token }: StockTransactionLedgerTableProps) {
  const [showDashboard, setShowDashboard] = useState<boolean>(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState<string>("");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("");
  const [movementFilter, setMovementFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  
  // Date Filtering Mode & Inputs
  const [dateMode, setDateMode] = useState<DateFilterMode>("preset");
  const [activePreset, setActivePreset] = useState<string>("all");
  const [singleDate, setSingleDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Helper to get formatted date string for presets
  const getPresetDates = (preset: string) => {
    const today = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    switch (preset) {
      case "today": {
        const todayStr = formatDate(today);
        return { startDate: todayStr, endDate: todayStr, singleDate: todayStr, month: "" };
      }
      case "yesterday": {
        const yest = new Date(today);
        yest.setDate(yest.getDate() - 1);
        const yestStr = formatDate(yest);
        return { startDate: yestStr, endDate: yestStr, singleDate: yestStr, month: "" };
      }
      case "this-week": {
        const curr = new Date(today);
        const first = curr.getDate() - curr.getDay(); // First day is the day of the month - the day of the week
        const firstDay = new Date(curr.setDate(first));
        return { startDate: formatDate(firstDay), endDate: formatDate(today), singleDate: "", month: "" };
      }
      case "this-month": {
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        return { startDate: "", endDate: "", singleDate: "", month: `${year}-${month}` };
      }
      case "last-month": {
        const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const year = lastMonthDate.getFullYear();
        const month = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
        return { startDate: "", endDate: "", singleDate: "", month: `${year}-${month}` };
      }
      default:
        return { startDate: "", endDate: "", singleDate: "", month: "" };
    }
  };

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      queryParams.append("page", String(page));
      queryParams.append("limit", "25");

      if (search) queryParams.append("search", search);
      if (itemTypeFilter) queryParams.append("itemType", itemTypeFilter);
      if (movementFilter) queryParams.append("movementType", movementFilter);
      if (categoryFilter) queryParams.append("transactionCategory", categoryFilter);

      // Date handling based on active filter mode
      if (dateMode === "day" && singleDate) {
        queryParams.append("date", singleDate);
      } else if (dateMode === "month" && selectedMonth) {
        queryParams.append("month", selectedMonth);
      } else if (dateMode === "range") {
        if (startDate) queryParams.append("startDate", startDate);
        if (endDate) queryParams.append("endDate", endDate);
      } else if (dateMode === "preset" && activePreset !== "all") {
        const { startDate: sDate, endDate: eDate, singleDate: sDay, month: sMonth } = getPresetDates(activePreset);
        if (sDay) queryParams.append("date", sDay);
        else if (sMonth) queryParams.append("month", sMonth);
        else {
          if (sDate) queryParams.append("startDate", sDate);
          if (eDate) queryParams.append("endDate", eDate);
        }
      }

      const baseUrl = getApiBaseUrl();
      const endpoint = `${baseUrl}/api/store/transactions?${queryParams.toString()}`;

      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "Content-Type": "application/json",
        },
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON API Response received:", text.slice(0, 200));
        throw new Error(`Server returned HTML response (${res.status}). Verify API server is running.`);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load transactions");

      setTransactions(data.transactions || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err: any) {
      console.error("Error fetching transactions:", err);
      setError(err.message || "Error connecting to server");
    } finally {
      setLoading(false);
    }
  }, [token, page, search, itemTypeFilter, movementFilter, categoryFilter, dateMode, activePreset, singleDate, selectedMonth, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleResetFilters = () => {
    setSearch("");
    setItemTypeFilter("");
    setMovementFilter("");
    setCategoryFilter("");
    setDateMode("preset");
    setActivePreset("all");
    setSingleDate("");
    setSelectedMonth("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const exportToExcel = () => {
    const exportData = (transactions || []).map((tx, idx) => {
      const formattedDate = new Date(tx.timestamp || (tx as any).createdAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const itemTypeLabel = getItemTypeMeta(tx).label;
      const catLabel = CATEGORY_LABELS[tx.transactionCategory]?.label || tx.transactionCategory;

      return {
        "S.No": idx + 1,
        "Date & Time": formattedDate,
        "Item Name": tx.itemName || "-",
        "Item Code": tx.itemCode || "-",
        "Item Type": itemTypeLabel,
        "Movement": tx.movementType,
        "Transaction Type": catLabel,
        "Quantity": tx.quantity,
        "Unit": tx.unit,
        "Previous Stock": tx.previousStock,
        "New Stock Balance": tx.newStock,
        "Ref Document Type": tx.referenceDocType || "-",
        "Ref Document Number": tx.referenceDocNumber || "-",
        "Party / Department": tx.recipientOrSource || "-",
        "Purpose": tx.purpose || "-",
        "Performed By": tx.performedByName || "System",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Ledger");
    XLSX.writeFile(wb, `Stock_Transaction_Ledger_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Helper to get item type badge styling & normalized label
  const getItemTypeMeta = (tx: Transaction) => {
    const rawType = (tx.itemType || "").toLowerCase();
    const code = (tx.itemCode || "").toUpperCase();

    if (rawType.includes("bought") || rawType === "bo" || code.startsWith("BO-")) {
      return {
        label: "Bought Out (BO)",
        badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
      };
    }
    if (rawType.includes("consumable") || code.startsWith("CON-")) {
      return {
        label: "Consumable",
        badge: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800",
      };
    }
    if (rawType.includes("fg") || rawType === "finished goods") {
      return {
        label: "Finished Goods (FG)",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
      };
    }
    if (rawType.includes("component")) {
      return {
        label: "Component",
        badge: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800",
      };
    }
    // Default to Raw Material
    return {
      label: "Raw Material (RM)",
      badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
    };
  };

  // Quick stats calculations
  const totalInwardQty = transactions.filter(t => t.movementType === "INWARD").reduce((sum, t) => sum + (t.quantity || 0), 0);
  const totalOutwardQty = transactions.filter(t => t.movementType === "OUTWARD").reduce((sum, t) => sum + (t.quantity || 0), 0);
  const uniqueItemsCount = useMemo(() => {
    const set = new Set((transactions || []).map((t: any) => t.itemCode || t.itemName));
    return set.size;
  }, [transactions]);

  return (
    <div className="space-y-4">
      {/* Top Metrics / Executive KPI Cards */}
      {!showDashboard ? (
        /* Collapsed Single-Line Summary Bar */
        <div className="bg-white dark:bg-gray-900 px-3.5 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 text-gray-600 dark:text-gray-300">
            <span className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
              <Boxes size={14} className="text-blue-600" />
              Total Entries: <strong className="text-blue-600 font-mono">{totalCount}</strong>
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>
              Net Inward: <strong className="text-emerald-600 font-mono">+{totalInwardQty.toLocaleString()}</strong>
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>
              Net Outward: <strong className="text-rose-600 font-mono">-{totalOutwardQty.toLocaleString()}</strong>
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>
              Unique Items: <strong className="text-purple-600 font-mono">{uniqueItemsCount}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowDashboard(true)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Show Dashboard</span>
            <ChevronDown size={14} />
          </button>
        </div>
      ) : (
        /* Expanded 4 KPI Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Total Entries */}
          <div className="bg-gradient-to-br from-blue-50/90 via-white to-slate-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Entries</span>
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <ArrowUpDown size={16} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {totalCount} <span className="text-xs font-semibold text-slate-500 font-sans">Movements</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Audit Log Coverage</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">Store Ledger</span>
            </div>
          </div>

          {/* Card 2: Net Inward Movement */}
          <div className="bg-gradient-to-br from-emerald-50/90 via-white to-slate-50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Page Inward Qty</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <ArrowDownLeft size={16} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              +{totalInwardQty.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Receipts / Inwards</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">Stock In</span>
            </div>
          </div>

          {/* Card 3: Net Outward Movement */}
          <div className="bg-gradient-to-br from-rose-50/90 via-white to-slate-50 dark:from-rose-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/40 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Page Outward Qty</span>
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
              -{totalOutwardQty.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Issues & Dispatches</span>
              <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">Stock Out</span>
            </div>
          </div>

          {/* Card 4: Unique Items & Export */}
          <div className="bg-gradient-to-br from-purple-50/90 via-white to-slate-50 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/40 shadow-2xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Unique SKUs & Export</span>
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                  <Boxes size={16} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {uniqueItemsCount} <span className="text-xs font-semibold text-slate-500 font-sans">Items</span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between pt-1 border-t border-purple-100/60 dark:border-purple-900/40">
              <span className="text-[11px] text-slate-500">Export Ledger</span>
              <button
                type="button"
                onClick={exportToExcel}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Download Excel Spreadsheet"
              >
                <Download size={12} />
                <span>Excel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Header Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
        {/* Main Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box with Clear Button */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by Item, Code, Doc #, User, Party..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-9 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Action & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Dashboard Show/Hide Toggle */}
            <button
              type="button"
              onClick={() => setShowDashboard(!showDashboard)}
              className="px-2.5 sm:px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title={showDashboard ? "Hide executive dashboard" : "Show executive dashboard"}
            >
              {showDashboard ? <LayoutGrid size={13} className="text-indigo-600" /> : <Eye size={13} className="text-gray-500" />}
              <span>{showDashboard ? "Hide Dashboard" : "Show Dashboard"}</span>
            </button>

            {/* Item Type (RM, BO, Consumables, FG, Component) */}
            <select
              value={itemTypeFilter}
              onChange={(e) => { setItemTypeFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Item Types (All)</option>
              <option value="RM">Raw Material (RM)</option>
              <option value="BO">Bought Out (BO)</option>
              <option value="Consumable">Consumables</option>
              <option value="FG">Finished Goods (FG)</option>
              <option value="Component">PPC Component</option>
            </select>

            {/* Movement Type */}
            <select
              value={movementFilter}
              onChange={(e) => { setMovementFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Movements</option>
              <option value="INWARD">Inward (+)</option>
              <option value="OUTWARD">Outward (-)</option>
            </select>

            {/* Transaction Category */}
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 max-w-[180px] truncate"
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>

            {/* Date Mode Selector */}
            <select
              value={dateMode}
              onChange={(e) => {
                const mode = e.target.value as DateFilterMode;
                setDateMode(mode);
                setPage(1);
                if (mode === "preset") setActivePreset("all");
              }}
              className="px-3 py-2 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="preset">⚡ Quick Presets</option>
              <option value="day">📅 Single Day</option>
              <option value="month">🗓️ Month-wise</option>
              <option value="range">📆 Custom Range</option>
            </select>

            {/* Refresh / Reset */}
            <button
              onClick={fetchTransactions}
              disabled={loading}
              title="Refresh Data"
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 border border-slate-200/60 dark:border-slate-700 shadow-sm"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"} />
              <span>Refresh Data</span>
            </button>
            <button
              onClick={handleResetFilters}
              title="Reset Filters"
              className="px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors font-semibold"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Date Filter Inputs Row */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {dateMode === "preset" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-gray-400 text-[11px] font-medium mr-1">Period:</span>
              {[
                { id: "all", label: "All Time" },
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "this-week", label: "This Week" },
                { id: "this-month", label: "This Month" },
                { id: "last-month", label: "Last Month" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setActivePreset(p.id); setPage(1); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activePreset === p.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {dateMode === "day" && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Select Specific Day:</span>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => { setSingleDate(e.target.value); setPage(1); }}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200"
              />
              {singleDate && (
                <button
                  onClick={() => { setSingleDate(""); setPage(1); }}
                  className="text-gray-400 hover:text-gray-600 text-[11px]"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {dateMode === "month" && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Select Month:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(e.target.value); setPage(1); }}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200"
              />
              {selectedMonth && (
                <button
                  onClick={() => { setSelectedMonth(""); setPage(1); }}
                  className="text-gray-400 hover:text-gray-600 text-[11px]"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {dateMode === "range" && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Date Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-700 dark:text-gray-300"
              />
              <span className="text-gray-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-700 dark:text-gray-300"
              />
            </div>
          )}

          {/* Counter Summary */}
          <div className="text-gray-500 dark:text-gray-400 font-medium">
            Showing <strong className="text-gray-800 dark:text-gray-200">{transactions.length}</strong> of <strong className="text-gray-800 dark:text-gray-200">{totalCount}</strong> entries
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400 space-y-3">
            <RefreshCw size={28} className="animate-spin text-blue-600" />
            <p className="text-sm font-medium">Fetching transaction ledger entries...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500 font-medium">
            {error}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center text-gray-400 space-y-2">
            <Layers size={36} className="text-gray-300 dark:text-gray-700" />
            <p className="font-semibold text-gray-600 dark:text-gray-300 text-sm">No transaction records found</p>
            <p className="text-xs text-gray-400 max-w-sm">No inventory inward or outward movements match the selected search, item type, or date criteria.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px] relative">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider shadow-2xs">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Item Details</th>
                    <th className="py-3 px-4">Item Type</th>
                    <th className="py-3 px-4">Movement</th>
                    <th className="py-3 px-4">Transaction Type</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-right">Stock Balance</th>
                    <th className="py-3 px-4">Ref Document</th>
                    <th className="py-3 px-4">Party / Department</th>
                    <th className="py-3 px-4">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {transactions.map((tx) => {
                    const isInward = tx.movementType === "INWARD";
                    const catMeta = CATEGORY_LABELS[tx.transactionCategory] || {
                      label: tx.transactionCategory,
                      color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
                    };
                    const typeMeta = getItemTypeMeta(tx);

                    const formattedDate = new Date(tx.timestamp || (tx as any).createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <tr
                        key={tx._id}
                        className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        {/* Date */}
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-mono whitespace-nowrap">
                          {formattedDate}
                        </td>

                        {/* Item Details */}
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 dark:text-gray-100">{tx.itemName}</span>
                          </div>
                        </td>

                        {/* Item Type Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${typeMeta.badge}`}>
                            {typeMeta.label}
                          </span>
                        </td>

                        {/* Movement */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isInward
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50"
                            }`}
                          >
                            {isInward ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                            {tx.movementType}
                          </span>
                        </td>

                        {/* Transaction Type Category */}
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap ${catMeta.color}`}>
                            {catMeta.label}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                          <div className={`font-bold ${isInward ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {isInward ? "+" : "-"}{tx.quantity} {tx.unit}
                          </div>
                          {(tx.hasSecondaryUnit || (tx.secondaryQuantity !== undefined && tx.secondaryQuantity > 0)) && (
                            <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                              ({isInward ? "+" : "-"}{tx.secondaryQuantity || Math.round(Number(tx.quantity) * (tx.conversionFactor || 1) * 100) / 100} {tx.secondaryUnit})
                            </div>
                          )}
                        </td>

                        {/* Prev -> New Stock Balance */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-gray-900 dark:text-gray-100 font-mono">{tx.newStock} {tx.unit}</span>
                            <span className="text-[10px] text-gray-400 font-mono">Prev: {tx.previousStock}</span>
                          </div>
                        </td>

                        {/* Ref Document */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                              {tx.referenceDocNumber || "N/A"}
                            </span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                              {tx.referenceDocType}
                            </span>
                          </div>
                        </td>

                        {/* Recipient / Source */}
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {(() => {
                                if (tx.referenceDocType === "MaterialIssue" || tx.transactionCategory?.includes("MATERIAL_ISSUE")) {
                                  if (!tx.recipientOrSource || tx.recipientOrSource.toLowerCase() === "store") {
                                    return <span className="text-amber-700 dark:text-amber-300">Shop Floor</span>;
                                  }
                                  return tx.recipientOrSource;
                                }
                                if (tx.referenceDocType === "JobWorkChallan" || tx.transactionCategory?.includes("JOB_WORK") || tx.transactionCategory?.includes("RM_CONVERSION")) {
                                  return <span className="text-purple-700 dark:text-purple-300">{tx.recipientOrSource && tx.recipientOrSource !== "Store" ? tx.recipientOrSource : "Job Work Vendor"}</span>;
                                }
                                return tx.recipientOrSource || "-";
                              })()}
                            </span>
                            {tx.purpose && (
                              <span className="text-[10px] text-gray-400 truncate max-w-[170px]" title={tx.purpose}>
                                {tx.referenceDocType === "MaterialIssue" && !tx.purpose.toLowerCase().includes("issue to shop floor")
                                  ? `Issue to Shop Floor (${tx.purpose})`
                                  : tx.purpose}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Performed By */}
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-gray-400" />
                            <span className="font-medium text-gray-800 dark:text-gray-200">{tx.performedByName || "System"}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden max-h-[calc(100vh-270px)] overflow-y-auto p-3 space-y-3 bg-gray-50/50 dark:bg-gray-900/40 pb-28 sm:pb-20">
              {transactions.map((tx) => {
                const isInward = tx.movementType === "INWARD";
                const catMeta = CATEGORY_LABELS[tx.transactionCategory] || {
                  label: tx.transactionCategory,
                  color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
                };
                const typeMeta = getItemTypeMeta(tx);
                const formattedDate = new Date(tx.timestamp || (tx as any).createdAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={tx._id}
                    className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{tx.itemName}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${typeMeta.badge}`}>
                            {typeMeta.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isInward
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60"
                          }`}
                        >
                          {isInward ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                          {isInward ? "+" : "-"}{tx.quantity} {tx.unit}
                        </span>
                        {(tx.hasSecondaryUnit || (tx.secondaryQuantity !== undefined && tx.secondaryQuantity > 0)) && (
                          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                            ({isInward ? "+" : "-"}{tx.secondaryQuantity || Math.round(Number(tx.quantity) * (tx.conversionFactor || 1) * 100) / 100} {tx.secondaryUnit})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${catMeta.color}`}>
                        {catMeta.label}
                      </span>
                      {tx.referenceDocNumber && (
                        <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border border-blue-100 dark:border-blue-900">
                          {tx.referenceDocType}: {tx.referenceDocNumber}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Stock Balance</span>
                        <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                          {tx.newStock} {tx.unit} <span className="text-[10px] font-normal text-gray-400">(Prev: {tx.previousStock})</span>
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Party / Destination</span>
                        <span className="text-gray-900 dark:text-gray-100 font-semibold truncate" title={tx.recipientOrSource}>
                          {(() => {
                            if (tx.referenceDocType === "MaterialIssue" || tx.transactionCategory?.includes("MATERIAL_ISSUE")) {
                              if (!tx.recipientOrSource || tx.recipientOrSource.toLowerCase() === "store") return "Shop Floor";
                              return tx.recipientOrSource;
                            }
                            if (tx.referenceDocType === "JobWorkChallan" || tx.transactionCategory?.includes("JOB_WORK") || tx.transactionCategory?.includes("RM_CONVERSION")) {
                              return tx.recipientOrSource && tx.recipientOrSource !== "Store" ? tx.recipientOrSource : "Job Work Vendor";
                            }
                            return tx.recipientOrSource || "-";
                          })()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-50 dark:border-gray-700/30">
                      <span>{formattedDate}</span>
                      <span className="flex items-center gap-1">
                        <User size={11} /> {tx.performedByName || "System"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between p-3 bg-gray-50/60 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 text-xs">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-all font-medium"
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <span className="text-gray-500 dark:text-gray-400">
              Page <strong className="text-gray-800 dark:text-gray-200">{page}</strong> of {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-all font-medium"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
