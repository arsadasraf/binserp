"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Download,
  FileText,
  Camera,
  Calendar,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Package,
  Factory,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Boxes,
  ArrowUpDown
} from "lucide-react";
import { useGetStoreDataQuery } from "@/src/store/services/storeService";
import GRNDetailModal from "../modals/GRNDetailModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface UnifiedGrnHistoryTableProps {
  onEdit?: (item: any) => void;
  onDelete?: (id: string) => void;
  initialTypeFilter?: string;
}

type DateFilterMode = "preset" | "day" | "month" | "range";

const isWithin12Hours = (createdAt: string | Date): boolean => {
  if (!createdAt) return true;
  const now = new Date().getTime();
  const created = new Date(createdAt).getTime();
  const hoursDiff = (now - created) / (1000 * 60 * 60);
  return hoursDiff <= 12;
};

import { generateFrontendGrnPDF } from "@/src/utils/frontendPdfHelper";

const downloadGRNAsPDF = (grn: any) => {
  try {
    generateFrontendGrnPDF({ grn });
  } catch (error: any) {
    console.error("PDF Error:", error);
    alert(`PDF Generation Error: ${error.message}`);
  }
};

export default function UnifiedGrnHistoryTable({ onEdit, onDelete, initialTypeFilter }: UnifiedGrnHistoryTableProps) {
  // Fetch standard GRNs and FG GRNs
  const { data: standardGrns = [], isLoading: isLoadingGrn, refetch: refetchGrn } = useGetStoreDataQuery("grn");
  const { data: fgGrns = [], isLoading: isLoadingFgGrn, refetch: refetchFgGrn } = useGetStoreDataQuery("fg-grn");

  const [selectedGrn, setSelectedGrn] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [photoViewerUrls, setPhotoViewerUrls] = useState<string[] | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>(initialTypeFilter || "all");
  const [qcStatusFilter, setQcStatusFilter] = useState<string>("all");

  // Date Filter State
  const [dateMode, setDateMode] = useState<DateFilterMode>("preset");
  const [activePreset, setActivePreset] = useState<string>("all");
  const [singleDate, setSingleDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 20;

  // Unified normalized list of GRNs
  const allNormalizedGrns = useMemo(() => {
    const list: any[] = [];

    // 1. Process Standard GRNs (RM, BO, Consumables, Inhouse)
    (standardGrns || []).forEach((grn: any) => {
      let grnType = "BO";
      let grnTypeLabel = "Bought Out (BO)";
      let typeBadge = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";

      // Detect RM, Consumable, or FG
      const firstItem = grn.items?.[0];
      const matName = (firstItem?.materialName || "").toLowerCase();
      const matCode = (firstItem?.materialCode || (typeof firstItem?.material === 'object' ? firstItem?.material?.code : '') || "").toUpperCase();
      const rawType = (grn.type || "").toLowerCase();

      if (rawType === "inhouse" || rawType === "fg") {
        grnType = "FG";
        grnTypeLabel = "Finished Goods (FG)";
        typeBadge = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800";
      } else if (matCode.startsWith("RM-") || matName.includes("raw material") || rawType === "rm" || rawType === "raw-material") {
        grnType = "RM";
        grnTypeLabel = "Raw Material (RM)";
        typeBadge = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
      } else if (matCode.startsWith("CON-") || matName.includes("consumable") || rawType === "consumable") {
        grnType = "Consumable";
        grnTypeLabel = "Consumable";
        typeBadge = "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800";
      }

      list.push({
        ...grn,
        isFgGrn: false,
        grnType,
        grnTypeLabel,
        typeBadge,
        displayDate: grn.date || grn.createdAt,
        supplierOrCustomer: grn.supplierName || (typeof grn.supplier === 'object' ? grn.supplier?.name : grn.supplier) || grn.customerName || (typeof grn.customer === 'object' ? grn.customer?.name : grn.customer) || "N/A",
        totalItemsCount: (grn.items || []).length,
        totalQuantity: (grn.items || []).reduce((acc: number, item: any) => acc + (parseFloat(item.quantity) || 0), 0),
      });
    });

    // 2. Process FG GRNs
    (fgGrns || []).forEach((fgGrn: any) => {
      list.push({
        ...fgGrn,
        isFgGrn: true,
        grnType: "FG",
        grnTypeLabel: "Finished Goods (FG)",
        typeBadge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
        displayDate: fgGrn.date || fgGrn.createdAt,
        supplierOrCustomer: fgGrn.customerName || (typeof fgGrn.customer === 'object' ? fgGrn.customer?.name : fgGrn.customer) || (fgGrn.mrpNumber ? `MRP #${fgGrn.mrpNumber}` : "In-House Production"),
        mrpNumber: fgGrn.mrpNumber,
        totalItemsCount: (fgGrn.items || []).length,
        totalQuantity: (fgGrn.items || []).reduce((acc: number, item: any) => acc + (parseFloat(item.quantity) || 0), 0),
      });
    });

    // Sort descending by date
    return list.sort((a, b) => new Date(b.displayDate).getTime() - new Date(a.displayDate).getTime());
  }, [standardGrns, fgGrns]);

  // Filtered GRN records
  const filteredGrns = useMemo(() => {
    return allNormalizedGrns.filter((grn) => {
      // 1. Type Filter
      if (typeFilter !== "all") {
        if (typeFilter === "RM" && grn.grnType !== "RM") return false;
        if (typeFilter === "BO" && grn.grnType !== "BO") return false;
        if (typeFilter === "Consumable" && grn.grnType !== "Consumable") return false;
        if (typeFilter === "FG" && grn.grnType !== "FG") return false;
      }

      // 2. QC / Status Filter
      if (qcStatusFilter !== "all") {
        const qcStatus = (grn.qcStatus || "").toLowerCase();
        const status = (grn.status || "").toLowerCase();
        if (qcStatusFilter === "pending") {
          if (!grn.qcRequired || qcStatus !== "pending") return false;
        } else if (qcStatusFilter === "accepted") {
          if (status !== "accepted" && qcStatus !== "passed" && status !== "received") return false;
        } else if (qcStatusFilter === "rejected") {
          if (status !== "rejected" && qcStatus !== "rejected") return false;
        } else if (qcStatusFilter === "skipped") {
          if (grn.qcRequired) return false;
        }
      }

      // 3. Search Filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const grnNum = (grn.grnNumber || "").toLowerCase();
        const poRef = (grn.poNumber || grn.poReference || "").toLowerCase();
        const party = (grn.supplierOrCustomer || "").toLowerCase();
        const recBy = (grn.receivedBy?.name || grn.receivedByName || "").toLowerCase();
        const hasItemMatch = (grn.items || []).some((item: any) => {
          const name = (item.materialName || item.itemName || (typeof item.fgItem === 'object' ? item.fgItem?.name : item.fgItem) || "").toLowerCase();
          const code = (item.materialCode || item.itemCode || (typeof item.fgItem === 'object' ? item.fgItem?.code : '') || "").toLowerCase();
          return name.includes(query) || code.includes(query);
        });

        if (!grnNum.includes(query) && !poRef.includes(query) && !party.includes(query) && !recBy.includes(query) && !hasItemMatch) {
          return false;
        }
      }

      // 4. Date Filter
      const itemDate = new Date(grn.displayDate);
      if (isNaN(itemDate.getTime())) return true;

      const itemDateStr = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
      const itemMonthStr = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;

      if (dateMode === "day" && singleDate) {
        if (itemDateStr !== singleDate) return false;
      } else if (dateMode === "month" && selectedMonth) {
        if (itemMonthStr !== selectedMonth) return false;
      } else if (dateMode === "range") {
        if (startDate && itemDateStr < startDate) return false;
        if (endDate && itemDateStr > endDate) return false;
      } else if (dateMode === "preset" && activePreset !== "all") {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        if (activePreset === "today") {
          if (itemDateStr !== todayStr) return false;
        } else if (activePreset === "yesterday") {
          const yest = new Date(today);
          yest.setDate(yest.getDate() - 1);
          const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
          if (itemDateStr !== yestStr) return false;
        } else if (activePreset === "this-week") {
          const curr = new Date(today);
          const first = curr.getDate() - curr.getDay();
          const firstDay = new Date(curr.setDate(first));
          const firstDayStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
          if (itemDateStr < firstDayStr || itemDateStr > todayStr) return false;
        } else if (activePreset === "this-month") {
          const curMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          if (itemMonthStr !== curMonth) return false;
        } else if (activePreset === "last-month") {
          const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
          if (itemMonthStr !== lastMonthStr) return false;
        }
      }

      return true;
    });
  }, [allNormalizedGrns, typeFilter, qcStatusFilter, search, dateMode, singleDate, selectedMonth, startDate, endDate, activePreset]);

  // Pagination slice
  const totalPages = Math.ceil(filteredGrns.length / itemsPerPage) || 1;
  const paginatedGrns = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredGrns.slice(start, start + itemsPerPage);
  }, [filteredGrns, currentPage]);

  const handleResetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setQcStatusFilter("all");
    setDateMode("preset");
    setActivePreset("all");
    setSingleDate("");
    setSelectedMonth("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const handleExportExcel = () => {
    const exportData = filteredGrns.map((grn, idx) => {
      const formattedDate = new Date(grn.displayDate).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const itemsSummary = (grn.items || []).map((i: any) => `${i.materialName || i.itemName || 'Item'} (${i.quantity} ${i.unit || 'PCS'})`).join("; ");

      return {
        "S.No": idx + 1,
        "GRN Number": grn.grnNumber || "-",
        "Date": formattedDate,
        "GRN Type": grn.grnTypeLabel || "GRN",
        "Source / Party": grn.supplierOrCustomer || "-",
        "PO Reference": grn.poNumber || grn.poReference || "-",
        "Total Items Count": grn.totalItemsCount,
        "Total Quantity": grn.totalQuantity,
        "Items Details": itemsSummary,
        "QC Required": grn.qcRequired ? "Yes" : "No",
        "QC Status": grn.qcStatus || "N/A",
        "Status": grn.status || "Received",
        "Received By": grn.receivedBy?.name || grn.receivedByName || "Store Executive",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GRN History");
    XLSX.writeFile(wb, `GRN_History_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Metrics
  const totalReceivedQty = filteredGrns.reduce((acc, g) => acc + (g.totalQuantity || 0), 0);
  const pendingQcCount = filteredGrns.filter(g => g.qcRequired && (g.qcStatus === "Pending" || !g.qcStatus)).length;
  const acceptedCount = filteredGrns.filter(g => g.status === "Accepted" || g.qcStatus === "Passed" || g.status === "Received").length;

  const isLoading = isLoadingGrn || isLoadingFgGrn;

  return (
    <div className="space-y-4">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Layers size={18} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Total GRNs</p>
            <h4 className="text-base font-bold text-gray-900 dark:text-white font-mono">{filteredGrns.length}</h4>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Total Items Received</p>
            <h4 className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">{totalReceivedQty.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Pending QC</p>
            <h4 className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono">{pendingQcCount}</h4>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Export GRNs</p>
              <h4 className="text-xs font-bold text-gray-900 dark:text-white">Excel Report</h4>
            </div>
          </div>
          <button
            onClick={handleExportExcel}
            title="Download Excel Spreadsheet"
            className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl transition-all border border-emerald-200/60 dark:border-emerald-800/60"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by GRN #, PO #, Party, Item..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* GRN Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="all">All GRN Types</option>
              <option value="RM">Raw Material (RM) GRN</option>
              <option value="BO">Bought Out (BO) GRN</option>
              <option value="Consumable">Consumable GRN</option>
              <option value="FG">Finished Goods (FG) GRN</option>
            </select>

            {/* QC Status Filter */}
            <select
              value={qcStatusFilter}
              onChange={(e) => { setQcStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="all">All QC Statuses</option>
              <option value="pending">Pending QC</option>
              <option value="accepted">Accepted / Passed</option>
              <option value="rejected">Rejected</option>
              <option value="skipped">QC Skipped</option>
            </select>

            {/* Date Mode Selector */}
            <select
              value={dateMode}
              onChange={(e) => {
                const mode = e.target.value as DateFilterMode;
                setDateMode(mode);
                setCurrentPage(1);
                if (mode === "preset") setActivePreset("all");
              }}
              className="px-3 py-2 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="preset">⚡ Quick Presets</option>
              <option value="day">📅 Single Day</option>
              <option value="month">🗓️ Month-wise</option>
              <option value="range">📆 Custom Range</option>
            </select>

            {/* Refresh & Reset */}
            <button
              onClick={() => { refetchGrn(); refetchFgGrn(); }}
              disabled={isLoading}
              title="Refresh Data"
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 border border-slate-200/60 dark:border-slate-700 shadow-sm"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"} />
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
                  onClick={() => { setActivePreset(p.id); setCurrentPage(1); }}
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
                onChange={(e) => { setSingleDate(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200"
              />
              {singleDate && (
                <button
                  onClick={() => { setSingleDate(""); setCurrentPage(1); }}
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
                onChange={(e) => { setSelectedMonth(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200"
              />
              {selectedMonth && (
                <button
                  onClick={() => { setSelectedMonth(""); setCurrentPage(1); }}
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
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-700 dark:text-gray-300"
              />
              <span className="text-gray-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-700 dark:text-gray-300"
              />
            </div>
          )}

          <div className="text-gray-500 dark:text-gray-400 font-medium">
            Showing <strong className="text-gray-800 dark:text-gray-200">{filteredGrns.length}</strong> entries
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400 space-y-3">
            <RefreshCw size={28} className="animate-spin text-blue-600" />
            <p className="text-sm font-medium">Loading GRN entries...</p>
          </div>
        ) : filteredGrns.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center text-gray-400 space-y-2">
            <Boxes size={36} className="text-gray-300 dark:text-gray-700" />
            <p className="font-semibold text-gray-600 dark:text-gray-300 text-sm">No GRN records found</p>
            <p className="text-xs text-gray-400 max-w-sm">No goods receipt note entries match the current search or filter criteria.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-4">GRN #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">GRN Type</th>
                    <th className="py-3 px-4">Party / Source</th>
                    <th className="py-3 px-4">Items Received</th>
                    <th className="py-3 px-4 text-right">Total Qty</th>
                    <th className="py-3 px-4">QC Status</th>
                    <th className="py-3 px-4">Received By</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {paginatedGrns.map((grn) => {
                    const formattedDate = new Date(grn.displayDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    const canEditOrDelete = isWithin12Hours(grn.createdAt);

                    return (
                      <tr
                        key={grn._id}
                        className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        {/* GRN # */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                            {grn.grnNumber || "-"}
                          </span>
                          {grn.poNumber && (
                            <span className="text-[10px] text-gray-400 block font-mono">
                              PO: {grn.poNumber}
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-mono whitespace-nowrap">
                          {formattedDate}
                        </td>

                        {/* GRN Type Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${grn.typeBadge}`}>
                            {grn.grnTypeLabel}
                          </span>
                        </td>

                        {/* Party / Source */}
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-800 dark:text-gray-200 block truncate max-w-[200px]" title={grn.supplierOrCustomer}>
                            {grn.supplierOrCustomer}
                          </span>
                        </td>

                        {/* Items Received summary */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col max-w-[220px]">
                            {grn.items && grn.items.length > 0 ? (
                              <>
                                <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                  {grn.items[0]?.materialName || grn.items[0]?.itemName || (typeof grn.items[0]?.fgItem === 'object' ? grn.items[0]?.fgItem?.name : grn.items[0]?.fgItem) || "Item"}
                                </span>
                                {grn.items.length > 1 && (
                                  <span className="text-[10px] text-gray-400 font-medium">
                                    +{grn.items.length - 1} more item(s)
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>

                        {/* Total Quantity */}
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap text-gray-900 dark:text-gray-100">
                          {grn.totalQuantity} {grn.items?.[0]?.unit || "PCS"}
                        </td>

                        {/* QC Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {grn.qcRequired ? (
                            grn.qcStatus === "Passed" || grn.status === "Accepted" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300">
                                QC Passed
                              </span>
                            ) : grn.qcStatus === "Rejected" || grn.status === "Rejected" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300">
                                QC Rejected
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300">
                                Pending QC
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              Skipped
                            </span>
                          )}
                        </td>

                        {/* Received By */}
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          <span className="text-xs">{grn.receivedBy?.name || grn.receivedByName || "Store Executive"}</span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* View Details */}
                            <button
                              onClick={() => {
                                setSelectedGrn(grn);
                                setIsDetailModalOpen(true);
                              }}
                              title="View Details"
                              className="p-1.5 hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Download PDF */}
                            <button
                              onClick={() => downloadGRNAsPDF(grn)}
                              title="Download PDF"
                              className="p-1.5 hover:bg-indigo-50 text-indigo-600 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
                            >
                              <Download size={15} />
                            </button>

                            {/* View Attached Photos */}
                            {grn.photos && grn.photos.length > 0 && (
                              <button
                                onClick={() => setPhotoViewerUrls(grn.photos)}
                                title="View Attached Photos"
                                className="p-1.5 hover:bg-teal-50 text-teal-600 dark:hover:bg-teal-950/50 rounded-lg transition-colors"
                              >
                                <Camera size={15} />
                              </button>
                            )}

                            {/* View S3 PDF Document */}
                            {grn.pdf && (
                              <a
                                href={grn.pdf}
                                target="_blank"
                                rel="noreferrer"
                                title="View Original Uploaded PDF"
                                className="p-1.5 hover:bg-purple-50 text-purple-600 dark:hover:bg-purple-950/50 rounded-lg transition-colors"
                              >
                                <FileText size={15} />
                              </a>
                            )}

                            {/* Edit */}
                            {onEdit && (
                              <button
                                onClick={() => onEdit(grn)}
                                disabled={!canEditOrDelete}
                                title={canEditOrDelete ? "Edit GRN" : "Editing window expired (12h limit)"}
                                className="p-1.5 hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                              >
                                <Edit2 size={15} />
                              </button>
                            )}

                            {/* Delete */}
                            {onDelete && (
                              <button
                                onClick={() => onDelete(grn._id)}
                                disabled={!canEditOrDelete}
                                title={canEditOrDelete ? "Delete GRN" : "Deletion window expired (12h limit)"}
                                className="p-1.5 hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 bg-gray-50/60 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 text-xs">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-all font-medium"
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                <span className="text-gray-500 dark:text-gray-400">
                  Page <strong className="text-gray-800 dark:text-gray-200">{currentPage}</strong> of {totalPages}
                </span>

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-all font-medium"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* GRN Detail Modal */}
      {selectedGrn && (
        <GRNDetailModal
          grn={selectedGrn}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedGrn(null);
          }}
        />
      )}

      {/* Photo Viewer Modal */}
      {photoViewerUrls && photoViewerUrls.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPhotoViewerUrls(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl p-4 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Camera size={16} /> Attached GRN Photos ({photoViewerUrls.length})
              </h3>
              <button
                onClick={() => setPhotoViewerUrls(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {photoViewerUrls.map((url, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img src={url} alt={`GRN Photo ${i + 1}`} className="w-full h-48 object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
