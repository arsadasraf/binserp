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
  ArrowUpDown,
  Lock,
  LayoutGrid,
  ChevronDown,
  X,
  CheckSquare
} from "lucide-react";
import { useGetStoreDataQuery, useDeleteStoreRecordMutation } from "@/src/store/services/storeService";
import GRNDetailModal from "../modals/GRNDetailModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";

interface UnifiedGrnHistoryTableProps {
  onEdit?: (item: any) => void;
  onDelete?: (id: string) => void;
  initialTypeFilter?: string;
}

type DateFilterMode = "preset" | "day" | "month" | "range";

import { generateFrontendGrnPDF } from "@/src/utils/frontendPdfHelper";
import { ItemNameAndDescription, getItemDescription } from "@/src/utils/itemDisplayHelper";
import { API_BASE_URL } from "@/src/utils/config";

const downloadGRNAsPDF = (grn: any, companyInfo?: any) => {
  try {
    generateFrontendGrnPDF({ grn, companyInfo });
  } catch (error: any) {
    console.error("PDF Error:", error);
    alert(`PDF Generation Error: ${error.message}`);
  }
};

export default function UnifiedGrnHistoryTable({ onEdit, onDelete, initialTypeFilter }: UnifiedGrnHistoryTableProps) {
  const [showDashboard, setShowDashboard] = useState<boolean>(true);
  // Fetch standard GRNs and FG GRNs
  const { data: standardGrns = [], isLoading: isLoadingGrn, refetch: refetchGrn } = useGetStoreDataQuery("grn");
  const { data: fgGrns = [], isLoading: isLoadingFgGrn, refetch: refetchFgGrn } = useGetStoreDataQuery("fg-grn");
  const [deleteStoreRecord, { isLoading: isDeleting }] = useDeleteStoreRecordMutation();

  const [companyInfo, setCompanyInfo] = useState<any>(null);

  React.useEffect(() => {
    try {
      const cached = localStorage.getItem("storeCompanyInfo") || localStorage.getItem("companyInfo");
      if (cached) setCompanyInfo(JSON.parse(cached));
    } catch (e) {}

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      fetch(`${API_BASE_URL}/api/store/company-info`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && (data.companyName || data.name)) {
            setCompanyInfo(data);
            try {
              localStorage.setItem("storeCompanyInfo", JSON.stringify(data));
            } catch (e) {}
          }
        })
        .catch(() => {});
    }
  }, []);

  // Live 1-second ticking timer for 24h edit/delete countdown
  const [nowTime, setNowTime] = useState(Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getRemainingEditSeconds = (createdAt: string | Date | undefined) => {
    if (!createdAt) return 0;
    const created = new Date(createdAt).getTime();
    const elapsed = Math.floor((nowTime - created) / 1000);
    const limit = 24 * 3600; // 24 hours standard
    return Math.max(0, limit - elapsed);
  };

  const formatRemainingTime = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '00:00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleDeleteGrn = async (grn: any) => {
    const rem = getRemainingEditSeconds(grn.createdAt || grn.date);
    if (rem <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Action Expired',
        text: 'This GRN cannot be deleted because the 24-hour edit/delete window has expired.',
      });
      return;
    }

    const grnNum = grn.grnNumber || 'Selected';
    const result = await Swal.fire({
      title: `Delete GRN #${grnNum}?`,
      html: `
        <div class="text-left text-sm space-y-2">
          <p>Are you sure you want to delete this GRN?</p>
          <div class="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
            ⚠️ <strong>Warning:</strong> Deleting this GRN will <strong>automatically reverse the received stock</strong> from inventory. This action cannot be undone.
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete & Reverse Stock',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        const targetTab = grn.isFgGrn ? "fg-grn" : "grn";
        await deleteStoreRecord({ tab: targetTab, id: grn._id }).unwrap();

        // Refetch queries
        refetchGrn();
        refetchFgGrn();

        // Also call parent onDelete if provided
        if (onDelete) {
          try {
            onDelete(grn._id);
          } catch (e) {}
        }

        Swal.fire({
          icon: 'success',
          title: 'GRN Deleted',
          text: `GRN #${grnNum} deleted successfully and inventory stock reversed.`,
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (err: any) {
        console.error("Failed to delete GRN:", err);
        const errMsg = err?.data?.message || err?.message || 'Failed to delete GRN';
        Swal.fire({
          icon: 'error',
          title: 'Delete Failed',
          text: errMsg,
        });
      }
    }
  };

  const [selectedGrn, setSelectedGrn] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [photoViewerUrls, setPhotoViewerUrls] = useState<string[] | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>(initialTypeFilter || "all");
  const [qcStatusFilter, setQcStatusFilter] = useState<string>("all");
  const [receivedByFilter, setReceivedByFilter] = useState<string>("all");

  const formatDateTime = (dateStr?: string | Date) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

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
      const rawType = (grn.type || "").toLowerCase().trim();
      const grnNum = (grn.grnNumber || "").toUpperCase().trim();

      const items = grn.items || [];
      const itemNames = items.map((i: any) => (i.materialName || i.itemName || "").toLowerCase());
      const itemCodes = items.map((i: any) => (i.materialCode || i.itemCode || (typeof i.material === 'object' ? i.material?.code : '') || "").toUpperCase());
      const itemCategories = items.map((i: any) => (i.category || (typeof i.material === 'object' ? (i.material?.category?.name || i.material?.category) : '') || "").toLowerCase());
      const itemTypes = items.map((i: any) => (i.itemType || (typeof i.material === 'object' ? i.material?.itemType : '') || "").toLowerCase());

      // 1. FG / Inhouse detection
      const hasFgItem = grn.isFgGrn || rawType === "fg" || rawType === "inhouse" || grnNum.startsWith("GRN-FG") || grnNum.includes("-FG/") || grnNum.includes("/FG/") || items.some((i: any) => i.fgItem || i.component) || Boolean(grn.mrpPlan || grn.mrpNumber);
      
      // 2. Consumable detection
      const hasConPrefix = grnNum.startsWith("GRN-CON") || grnNum.includes("-CON/") || grnNum.includes("/CON/") || grnNum.includes("CONSUMABLE");
      const hasConItem = items.some((i: any) => i.consumable) || itemCodes.some((c: string) => c.startsWith("CON-")) || itemCategories.some((c: string) => c.includes("consumable")) || itemTypes.some((t: string) => t.includes("consumable")) || rawType === "consumable" || rawType === "consumables";

      // 3. Explicit number prefixes (highest confidence for intended document series)
      const hasRmPrefix = grnNum.startsWith("GRN-RM") || grnNum.includes("-RM/") || grnNum.includes("/RM/");
      const hasBoPrefix = grnNum.startsWith("GRN-BO") || grnNum.includes("-BO/") || grnNum.includes("/BO/");

      // 4. Item-level master types & codes
      const hasRmMasterType = itemTypes.some((t: string) => t === "raw material" || t === "rawmaterial" || t === "rm");
      const hasBoMasterType = itemTypes.some((t: string) => t === "bought out" || t === "boughtout" || t === "bo");

      const hasRmCode = itemCodes.some((c: string) => c.startsWith("RM-") || c.startsWith("RAW-"));
      const hasBoCode = itemCodes.some((c: string) => c.startsWith("BO-") || c.startsWith("BOUGHT-"));

      const hasRmCategory = itemCategories.some((c: string) => c.includes("raw material") || c === "rm" || c.includes("sheet") || c.includes("metal") || c.includes("steel") || c.includes("pipe") || c.includes("bar"));
      const hasBoCategory = itemCategories.some((c: string) => c.includes("bought out") || c.includes("boughtout") || c.includes("hardware") || c.includes("fastener"));

      let grnType = "RM";
      let grnTypeLabel = "Raw Material (RM)";
      let typeBadge = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";

      if (hasFgItem) {
        grnType = "FG";
        grnTypeLabel = "Finished Goods (FG)";
        typeBadge = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800";
      } else if (hasConPrefix || hasConItem) {
        grnType = "Consumable";
        grnTypeLabel = "Consumable";
        typeBadge = "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800";
      } else if (hasRmPrefix) {
        grnType = "RM";
        grnTypeLabel = "Raw Material (RM)";
        typeBadge = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
      } else if (hasBoPrefix) {
        grnType = "BO";
        grnTypeLabel = "Bought Out (BO)";
        typeBadge = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
      } else if (hasRmMasterType || hasRmCode || hasRmCategory) {
        grnType = "RM";
        grnTypeLabel = "Raw Material (RM)";
        typeBadge = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
      } else if (hasBoMasterType || hasBoCode || hasBoCategory) {
        grnType = "BO";
        grnTypeLabel = "Bought Out (BO)";
        typeBadge = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
      } else if (rawType === "bo" || rawType === "bought-out") {
        grnType = "BO";
        grnTypeLabel = "Bought Out (BO)";
        typeBadge = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
      } else {
        grnType = "RM";
        grnTypeLabel = "Raw Material (RM)";
        typeBadge = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
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

  // Unique receivers for dropdown filter
  const uniqueReceivers = useMemo(() => {
    const set = new Set<string>();
    allNormalizedGrns.forEach((g) => {
      const name = g.receivedBy?.name || g.receivedByName;
      if (name && typeof name === "string" && name.trim()) {
        set.add(name.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allNormalizedGrns]);

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

      // Received By User Filter
      if (receivedByFilter !== "all") {
        const recName = (grn.receivedBy?.name || grn.receivedByName || "").trim();
        if (recName !== receivedByFilter) return false;
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
        const invNum = (grn.invoiceNumber || grn.invoiceNo || "").toLowerCase();
        const party = (grn.supplierOrCustomer || "").toLowerCase();
        const recBy = (grn.receivedBy?.name || grn.receivedByName || "").toLowerCase();
        const hasItemMatch = (grn.items || []).some((item: any) => {
          const name = (item.materialName || item.itemName || (typeof item.fgItem === 'object' ? item.fgItem?.name : item.fgItem) || "").toLowerCase();
          const code = (item.materialCode || item.itemCode || (typeof item.fgItem === 'object' ? item.fgItem?.code : '') || "").toLowerCase();
          const hsn = (item.hsnCode || "").toLowerCase();
          return name.includes(query) || code.includes(query) || hsn.includes(query);
        });

        if (!grnNum.includes(query) && !poRef.includes(query) && !invNum.includes(query) && !party.includes(query) && !recBy.includes(query) && !hasItemMatch) {
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
  }, [allNormalizedGrns, typeFilter, qcStatusFilter, receivedByFilter, search, dateMode, singleDate, selectedMonth, startDate, endDate, activePreset]);

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
    setReceivedByFilter("all");
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
        "Receipt Date": formattedDate,
        "Created At": formatDateTime(grn.createdAt || grn.date),
        "Edited At": grn.updatedAt && (new Date(grn.updatedAt).getTime() - new Date(grn.createdAt || grn.date).getTime() > 60000) ? formatDateTime(grn.updatedAt) : "-",
        "GRN Type": grn.grnTypeLabel || "GRN",
        "Source / Party": grn.supplierOrCustomer || "-",
        "PO Reference": grn.poNumber || grn.poReference || "-",
        "Invoice Number": grn.invoiceNumber || grn.invoiceNo || "-",
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
      {/* Metric Cards Row / Executive KPI Dashboard */}
      {!showDashboard ? (
        /* Collapsed Single-Line Summary Bar */
        <div className="bg-white dark:bg-gray-900 px-3.5 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 text-gray-600 dark:text-gray-300">
            <span className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
              <Layers size={14} className="text-blue-600" />
              Total GRNs: <strong className="text-blue-600 font-mono">{filteredGrns.length}</strong>
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>
              Received Units: <strong className="text-emerald-600 font-mono">{totalReceivedQty.toLocaleString()}</strong>
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>
              Pending QC: <strong className="text-amber-600 font-mono">{pendingQcCount}</strong>
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>
              Cleared / Accepted: <strong className="text-teal-600 font-mono">{acceptedCount}</strong>
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
          {/* Card 1: Total GRNs */}
          <div className="bg-gradient-to-br from-blue-50/90 via-white to-slate-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total GRNs</span>
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <Layers size={16} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {filteredGrns.length} <span className="text-xs font-semibold text-slate-500 font-sans">Records</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>All Inward Types</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">Store Intake</span>
            </div>
          </div>

          {/* Card 2: Total Items Received */}
          <div className="bg-gradient-to-br from-emerald-50/90 via-white to-slate-50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Received Qty</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              {totalReceivedQty.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Physical Units Received</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">Verified Qty</span>
            </div>
          </div>

          {/* Card 3: Pending QC */}
          <div className="bg-gradient-to-br from-amber-50/90 via-white to-slate-50 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/40 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending QC Inspection</span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Clock size={16} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {pendingQcCount} <span className="text-xs font-semibold text-slate-500 font-sans">GRNs</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Awaiting QA Inspection</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                {pendingQcCount > 0 ? "Action Required" : "All Inspected"}
              </span>
            </div>
          </div>

          {/* Card 4: Accepted / Passed & Export */}
          <div className="bg-gradient-to-br from-teal-50/90 via-white to-slate-50 dark:from-teal-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-teal-100 dark:border-teal-900/40 shadow-2xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-teal-600 dark:text-teal-400 mb-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Accepted / Cleared</span>
                <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
                  <CheckSquare size={16} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {acceptedCount} <span className="text-xs font-semibold text-slate-500 font-sans">Cleared</span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between pt-1 border-t border-teal-100/60 dark:border-teal-900/40">
              <span className="text-[11px] text-slate-500">Export GRNs</span>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Download Excel Spreadsheet"
              >
                <FileSpreadsheet size={12} />
                <span>Excel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Control Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box with Clear Button */}
          <div className="relative flex-1 min-w-[220px] w-full sm:w-auto max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by GRN #, PO #, Inv #, Party, Item, HSN..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-9 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters Row */}
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

            {/* Received By User Filter */}
            <select
              value={receivedByFilter}
              onChange={(e) => { setReceivedByFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="all">👤 All Receivers</option>
              {uniqueReceivers.map((user) => (
                <option key={user} value={user}>
                  👤 {user}
                </option>
              ))}
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
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px] relative">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider shadow-2xs">
                    <th className="py-3 px-4">GRN #</th>
                    <th className="py-3 px-4">Receipt Date</th>
                    <th className="py-3 px-4">Created / Edited</th>
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

                    const remainingSecs = getRemainingEditSeconds(grn.createdAt || grn.date);
                    const canEditOrDelete = remainingSecs > 0;

                    const firstItem = grn.items?.[0];
                    const firstItemName =
                      firstItem?.materialName ||
                      firstItem?.itemName ||
                      (typeof firstItem?.fgItem === "object" ? firstItem?.fgItem?.name : firstItem?.fgItem) ||
                      "Item";
                    const firstItemDesc =
                      getItemDescription(firstItem) ||
                      (typeof firstItem?.material === "object" ? getItemDescription(firstItem.material) : "") ||
                      (typeof firstItem?.fgItem === "object" ? getItemDescription(firstItem.fgItem) : "");

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
                          {grn.invoiceNumber && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                              Inv: {grn.invoiceNumber}
                            </span>
                          )}
                        </td>

                        {/* Receipt Date */}
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300 font-mono whitespace-nowrap">
                          <span className="font-semibold">{formattedDate}</span>
                        </td>

                        {/* Created / Edited Date & Time */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created:</span>
                              <span className="font-mono text-xs font-medium">{formatDateTime(grn.createdAt || grn.date)}</span>
                            </div>
                            {grn.updatedAt && (new Date(grn.updatedAt).getTime() - new Date(grn.createdAt || grn.date).getTime() > 60000) && (
                              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                                <span className="text-[10px] font-bold uppercase tracking-wider">Edited:</span>
                                <span className="font-mono text-xs font-medium">{formatDateTime(grn.updatedAt)}</span>
                              </div>
                            )}
                          </div>
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
                                <ItemNameAndDescription
                                  name={firstItemName}
                                  description={firstItemDesc}
                                  nameClassName="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate"
                                  descClassName="text-[10px] text-gray-500 dark:text-gray-400 italic truncate"
                                />
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
                          <div>{grn.totalQuantity} {grn.items?.[0]?.unit || "PCS"}</div>
                          {grn.items?.[0]?.hasSecondaryUnit && grn.items?.[0]?.secondaryUnit && (
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                              ({grn.items.reduce((s: number, it: any) => s + (Number(it.secondaryQuantity || it.secondaryReceivedQuantity) || 0), 0)} {grn.items[0].secondaryUnit})
                            </div>
                          )}
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
                              onClick={() => downloadGRNAsPDF(grn, companyInfo)}
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

                            {/* Edit & Delete Countdown & Action Buttons */}
                            {canEditOrDelete ? (
                              <>
                                <span 
                                  title={`Edit and delete allowed for another ${formatRemainingTime(remainingSecs)}`}
                                  className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1 shrink-0"
                                >
                                  <Clock size={11} className="text-amber-600 animate-pulse" />
                                  {formatRemainingTime(remainingSecs)}
                                </span>

                                {/* Edit */}
                                {onEdit && (
                                  <button
                                    onClick={() => onEdit(grn)}
                                    title={`Edit GRN (${formatRemainingTime(remainingSecs)} left)`}
                                    className="p-1.5 hover:bg-gray-100 text-indigo-600 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                )}

                                {/* Delete */}
                                <button
                                  onClick={() => handleDeleteGrn(grn)}
                                  disabled={isDeleting}
                                  title={`Delete GRN (${formatRemainingTime(remainingSecs)} left)`}
                                  className="p-1.5 hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            ) : (
                              <span 
                                title="Editing and deleting window expired (24h limit)" 
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-semibold rounded-lg inline-flex items-center gap-1 opacity-70"
                              >
                                <Lock size={11} /> Locked
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden max-h-[calc(100vh-270px)] overflow-y-auto p-2.5 sm:p-3 space-y-3 bg-gray-50/50 dark:bg-gray-900/30 pb-20">
              {paginatedGrns.map((grn) => {
                const formattedDate = new Date(grn.displayDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                const remainingSecs = getRemainingEditSeconds(grn.createdAt || grn.date);
                const canEditOrDelete = remainingSecs > 0;

                const firstItem = grn.items?.[0];
                const firstItemName =
                  firstItem?.materialName ||
                  firstItem?.itemName ||
                  (typeof firstItem?.fgItem === "object" ? firstItem?.fgItem?.name : firstItem?.fgItem) ||
                  "Item";
                const firstItemDesc =
                  getItemDescription(firstItem) ||
                  (typeof firstItem?.material === "object" ? getItemDescription(firstItem.material) : "") ||
                  (typeof firstItem?.fgItem === "object" ? getItemDescription(firstItem.fgItem) : "");

                const secondaryQtyTotal = grn.items?.reduce(
                  (s: number, it: any) => s + (Number(it.secondaryQuantity || it.secondaryReceivedQuantity) || 0),
                  0
                );

                return (
                  <div
                    key={grn._id}
                    className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl shadow-xs border border-gray-200/80 dark:border-gray-800 flex flex-col gap-2.5"
                  >
                    {/* Top Header: GRN Number + Type & QC Status */}
                    <div className="flex items-start justify-between gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            onClick={() => {
                              setSelectedGrn(grn);
                              setIsDetailModalOpen(true);
                            }}
                            className="font-bold text-blue-600 dark:text-blue-400 font-mono text-xs sm:text-sm cursor-pointer hover:underline"
                          >
                            {grn.grnNumber || "-"}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${grn.typeBadge}`}>
                            {grn.grnTypeLabel}
                          </span>
                        </div>
                        {grn.poNumber && (
                          <span className="text-[10px] text-gray-400 font-mono block mt-0.5">
                            PO: {grn.poNumber}
                          </span>
                        )}
                        {grn.invoiceNumber && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block mt-0.5">
                            Inv: {grn.invoiceNumber}
                          </span>
                        )}
                      </div>

                      <div className="shrink-0">
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
                      </div>
                    </div>

                    {/* Party & Date row */}
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-gray-400 block font-medium uppercase tracking-wider">Party / Source</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block text-xs" title={grn.supplierOrCustomer}>
                          {grn.supplierOrCustomer || "N/A"}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-gray-400 block font-medium uppercase tracking-wider">Receipt Date</span>
                        <span className="font-mono text-gray-700 dark:text-gray-300 text-xs font-semibold">{formattedDate}</span>
                      </div>
                    </div>

                    {/* Created and Edited Timestamps */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Created:</span>
                        <span className="font-mono text-xs font-medium">{formatDateTime(grn.createdAt || grn.date)}</span>
                      </div>
                      {grn.updatedAt && (new Date(grn.updatedAt).getTime() - new Date(grn.createdAt || grn.date).getTime() > 60000) && (
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                          <span className="text-[10px] font-bold uppercase">Edited:</span>
                          <span className="font-mono text-xs font-medium">{formatDateTime(grn.updatedAt)}</span>
                        </div>
                      )}
                    </div>

                    {/* Item Summary (per AGENTS.md: Name + Description, never raw item code) */}
                    <div className="bg-gray-50/80 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {grn.items && grn.items.length > 0 ? (
                            <>
                              <ItemNameAndDescription
                                name={firstItemName}
                                description={firstItemDesc}
                                nameClassName="font-semibold text-xs text-gray-900 dark:text-white"
                                descClassName="text-[11px] text-gray-500 dark:text-gray-400 italic mt-0.5 line-clamp-2"
                              />
                              {grn.items.length > 1 && (
                                <span className="inline-block mt-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                                  +{grn.items.length - 1} more item{grn.items.length > 2 ? "s" : ""}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs italic">No items listed</span>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-gray-400 block font-medium uppercase tracking-wider">Total Qty</span>
                          <span className="font-mono font-bold text-xs text-gray-900 dark:text-white">
                            {grn.totalQuantity} {grn.items?.[0]?.unit || "PCS"}
                          </span>
                          {grn.items?.[0]?.hasSecondaryUnit && grn.items?.[0]?.secondaryUnit && secondaryQtyTotal > 0 && (
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold font-mono">
                              ({secondaryQtyTotal} {grn.items[0].secondaryUnit})
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadata row: Received By + Attachments */}
                    <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-0.5">
                      <div>
                        Received by: <span className="font-medium text-gray-700 dark:text-gray-300">{grn.receivedBy?.name || grn.receivedByName || "Store Executive"}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {grn.photos && grn.photos.length > 0 && (
                          <button
                            onClick={() => setPhotoViewerUrls(grn.photos)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-[10px] font-semibold border border-teal-200 dark:border-teal-800"
                          >
                            <Camera size={11} /> {grn.photos.length} Photo{grn.photos.length > 1 ? "s" : ""}
                          </button>
                        )}
                        {grn.pdf && (
                          <a
                            href={grn.pdf}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[10px] font-semibold border border-purple-200 dark:border-purple-800"
                          >
                            <FileText size={11} /> PDF Doc
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Action Row & 24h Countdown */}
                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-1.5 flex-1">
                        <button
                          onClick={() => {
                            setSelectedGrn(grn);
                            setIsDetailModalOpen(true);
                          }}
                          className="flex-1 py-1.5 px-2 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 rounded-xl flex items-center justify-center gap-1 transition-colors"
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          onClick={() => downloadGRNAsPDF(grn, companyInfo)}
                          className="flex-1 py-1.5 px-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-1 shadow-xs transition-colors"
                        >
                          <Download size={13} /> PDF
                        </button>
                      </div>

                      {/* Edit / Delete / Countdown */}
                      {canEditOrDelete ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            title={`Edit and delete allowed for another ${formatRemainingTime(remainingSecs)}`}
                            className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1"
                          >
                            <Clock size={11} className="text-amber-600 animate-pulse" />
                            {formatRemainingTime(remainingSecs)}
                          </span>

                          {onEdit && (
                            <button
                              onClick={() => onEdit(grn)}
                              title={`Edit GRN (${formatRemainingTime(remainingSecs)} left)`}
                              className="p-1.5 hover:bg-indigo-50 text-indigo-600 dark:hover:bg-indigo-950/50 rounded-xl transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteGrn(grn)}
                            disabled={isDeleting}
                            title={`Delete GRN (${formatRemainingTime(remainingSecs)} left)`}
                            className="p-1.5 hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/50 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <span
                          title="Editing and deleting window expired (24h limit)"
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-semibold rounded-xl inline-flex items-center gap-1 opacity-70 shrink-0"
                        >
                          <Lock size={11} /> Locked
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
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
