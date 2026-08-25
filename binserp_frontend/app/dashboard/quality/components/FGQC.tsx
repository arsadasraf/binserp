"use client";

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import {
  Plus, Check, X, ClipboardCheck, Search, ChevronRight,
  Filter, Calendar, Download, Eye, AlertTriangle, CheckCircle2,
  XCircle, FileText, User, Building2, Layers, RotateCcw,
  Clock, ArrowUpRight, ShieldCheck, Sparkles, RefreshCw,
  LayoutGrid, Table as TableIcon, Tag, SlidersHorizontal, Box, CheckSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { generatePDIPDF, PDIReportData, PDIParameterResult } from "@/src/utils/generatePDIPDF";

const DEFAULT_FG_PARAMETERS: PDIParameterResult[] = [
  { parameterName: "Visual & Surface Finish", specification: "Burr-free, uniform surface, clean coating", tolerance: "No visual defects", actualObserved: "Conforms", status: "Pass", instrumentUsed: "Visual Inspection" },
  { parameterName: "Critical Dimensions", specification: "As per approved drawing / CAD model", tolerance: "±0.05 mm", actualObserved: "Within tolerance", status: "Pass", instrumentUsed: "Digital Vernier Caliper" },
  { parameterName: "Functional & Fitment Check", specification: "Smooth fit with mating assembly", tolerance: "100% Fit", actualObserved: "Pass", status: "Pass", instrumentUsed: "Go / No-Go Gauge" },
  { parameterName: "Packaging & Barcode Label", specification: "Protective wrap, batch sticker, box label", tolerance: "Standard Pack", actualObserved: "Verified", status: "Pass", instrumentUsed: "Visual Check" }
];

export default function FGQC() {
  const [records, setRecords] = useState<any[]>([]);
  const [pendingLots, setPendingLots] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [historyViewMode, setHistoryViewMode] = useState<"cards" | "table">("cards");

  // Inspection Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<any>(null);
  const [formData, setFormData] = useState({
    rejectedQuantity: 0,
    reworkQuantity: 0,
    remarks: "",
    batchNumber: "",
    heatNumber: ""
  });
  const [paramResults, setParamResults] = useState<PDIParameterResult[]>(DEFAULT_FG_PARAMETERS);

  // View Certificate Modal State
  const [viewRecord, setViewRecord] = useState<any | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilterType, setDateFilterType] = useState<"all" | "today" | "yesterday" | "last7days" | "thisMonth" | "monthWise" | "custom">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [rejectionFilter, setRejectionFilter] = useState<"all" | "rejectedOnly" | "clearedOnly">("all");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    fetchAllData();
    fetchCompanyInfo();
  }, []);

  const fetchCompanyInfo = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/api/store/company-info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data?.companyInfo || res.data;
      if (data && (data.companyName || data.legalName || data.name)) {
        setCompanyInfo(data);
        localStorage.setItem("storeCompanyInfo", JSON.stringify(data));
      }
    } catch {
      try {
        const cached = localStorage.getItem("storeCompanyInfo") || localStorage.getItem("companyInfo");
        if (cached) setCompanyInfo(JSON.parse(cached));
      } catch {}
    }
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    await Promise.all([fetchRecords(), fetchPendingLots()]);
    setIsLoading(false);
  };

  const fetchPendingLots = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/api/quality/fg/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.data) {
        setPendingLots(res.data.data);
      }
    } catch (e) {
      console.error("Error fetching pending FG lots:", e);
    }
  };

  const fetchRecords = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/api/quality/fg`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.data) {
        setRecords(res.data.data);
      }
    } catch (e) {
      console.error("Error fetching FG QC records:", e);
    }
  };

  // Dynamic Customers list
  const allCustomers = useMemo(() => {
    const custs = new Set<string>();
    pendingLots.forEach(l => {
      if (l.customerName) custs.add(l.customerName);
    });
    records.forEach(r => {
      if (r.customerName) custs.add(r.customerName);
    });
    return Array.from(custs).sort();
  }, [pendingLots, records]);

  // Universal Date Filter
  const matchDate = (dateVal?: string | Date) => {
    if (!dateVal || dateFilterType === "all") return true;
    const target = new Date(dateVal);
    if (isNaN(target.getTime())) return true;

    const now = new Date();
    const targetDateStr = target.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    if (dateFilterType === "today") return targetDateStr === todayStr;
    if (dateFilterType === "yesterday") {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      return targetDateStr === yest.toISOString().split("T")[0];
    }
    if (dateFilterType === "last7days") {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return target >= sevenDaysAgo && target <= now;
    }
    if (dateFilterType === "thisMonth") {
      return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth();
    }
    if (dateFilterType === "monthWise") {
      if (!selectedMonth) return true;
      const [y, m] = selectedMonth.split("-").map(Number);
      return target.getFullYear() === y && target.getMonth() + 1 === m;
    }
    if (dateFilterType === "custom") {
      if (customStartDate && targetDateStr < customStartDate) return false;
      if (customEndDate && targetDateStr > customEndDate) return false;
      return true;
    }
    return true;
  };

  // Filtered Pending Lots
  const filteredPendingLots = useMemo(() => {
    return pendingLots.filter((lot) => {
      if (selectedCustomer !== "all" && lot.customerName !== selectedCustomer) return false;
      if (!matchDate(lot.date)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const srcNum = (lot.sourceNumber || "").toLowerCase();
        const iName = (lot.itemName || "").toLowerCase();
        const cName = (lot.customerName || "").toLowerCase();
        const bNum = (lot.batchNumber || "").toLowerCase();
        if (!srcNum.includes(q) && !iName.includes(q) && !cName.includes(q) && !bNum.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [pendingLots, selectedCustomer, dateFilterType, selectedMonth, customStartDate, customEndDate, searchQuery]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (selectedCustomer !== "all" && rec.customerName !== selectedCustomer) return false;
      if (!matchDate(rec.createdAt)) return false;

      if (rejectionFilter === "rejectedOnly" && (Number(rec.rejectedQuantity || 0) <= 0 && rec.overallStatus !== "Rejected")) {
        return false;
      }
      if (rejectionFilter === "clearedOnly" && (Number(rec.rejectedQuantity || 0) > 0 || rec.overallStatus === "Rejected")) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cNum = (rec.certificateNumber || "").toLowerCase();
        const iName = (rec.fgItemName || "").toLowerCase();
        const bNum = (rec.batchNumber || "").toLowerCase();
        const cName = (rec.customerName || "").toLowerCase();
        if (!cNum.includes(q) && !iName.includes(q) && !bNum.includes(q) && !cName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [records, selectedCustomer, dateFilterType, selectedMonth, customStartDate, customEndDate, rejectionFilter, searchQuery]);

  // KPI Metrics
  const kpiMetrics = useMemo(() => {
    const totalPending = pendingLots.length;
    const totalInspected = records.length;
    let totalUnits = 0;
    let totalAcc = 0;
    let totalRej = 0;

    records.forEach(r => {
      totalUnits += Number(r.lotQuantity || 0);
      totalAcc += Number(r.acceptedQuantity || 0);
      totalRej += Number(r.rejectedQuantity || 0);
    });

    const accRate = totalUnits > 0 ? ((totalAcc / totalUnits) * 100).toFixed(1) : "100.0";
    const rejRate = totalUnits > 0 ? ((totalRej / totalUnits) * 100).toFixed(1) : "0.0";

    return { totalPending, totalInspected, totalUnits, totalAcc, totalRej, accRate, rejRate };
  }, [pendingLots, records]);

  // Open Inspect Modal
  const handleOpenInspect = (lot: any) => {
    setSelectedLot(lot);
    setFormData({
      rejectedQuantity: 0,
      reworkQuantity: 0,
      remarks: "",
      batchNumber: lot.batchNumber !== "-" ? lot.batchNumber : `BATCH-${new Date().toISOString().slice(2,10).replace(/-/g,'')}`,
      heatNumber: ""
    });
    setParamResults(DEFAULT_FG_PARAMETERS.map(p => ({ ...p })));
    setShowModal(true);
  };

  const handleParamChange = (index: number, field: string, value: any) => {
    setParamResults(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmitQC = async () => {
    if (!selectedLot) return;

    try {
      const token = localStorage.getItem("token");
      const lotQty = Number(selectedLot.quantity || 0);
      const rejQty = Math.max(0, Math.min(lotQty, Number(formData.rejectedQuantity || 0)));
      const rewQty = Math.max(0, Math.min(lotQty - rejQty, Number(formData.reworkQuantity || 0)));
      const accQty = Math.max(0, lotQty - rejQty - rewQty);

      const status = rejQty > 0 ? (accQty > 0 ? "Conditional" : "Rejected") : (rewQty > 0 ? "Rework" : "Accepted");

      const payload = {
        fgItemId: selectedLot.itemId,
        fgItemName: selectedLot.itemName,
        fgItemCode: selectedLot.itemCode,
        productionJobId: selectedLot.sourceType === "PRODUCTION_JOB" ? selectedLot.sourceId : undefined,
        jobCardNumber: selectedLot.sourceType === "PRODUCTION_JOB" ? selectedLot.sourceNumber : undefined,
        fgGrnId: selectedLot.sourceType === "FG_GRN" ? selectedLot.sourceId : undefined,
        fgGrnItemId: selectedLot.grnItemId,
        fgGrnNumber: selectedLot.sourceType === "FG_GRN" ? selectedLot.sourceNumber : undefined,
        customerName: selectedLot.customerName,
        customerPoReference: selectedLot.customerPoReference,
        batchNumber: formData.batchNumber || selectedLot.batchNumber,
        heatNumber: formData.heatNumber,
        unit: selectedLot.unit || "PCS",
        lotQuantity: lotQty,
        inspectedQuantity: lotQty,
        acceptedQuantity: accQty,
        rejectedQuantity: rejQty,
        reworkQuantity: rewQty,
        inspectionResults: paramResults,
        overallStatus: status,
        remarks: formData.remarks
      };

      const res = await axios.post(`${API_BASE_URL}/api/quality/fg`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const savedRecord = res.data?.data || payload;

      // Auto-generate PDI Certificate PDF
      generatePDIPDF({
        certificateNumber: savedRecord.certificateNumber,
        fgItemName: savedRecord.fgItemName,
        fgItemCode: savedRecord.fgItemCode,
        batchNumber: savedRecord.batchNumber,
        customerName: savedRecord.customerName,
        customerPoReference: savedRecord.customerPoReference,
        lotQuantity: lotQty,
        inspectedQuantity: lotQty,
        acceptedQuantity: accQty,
        rejectedQuantity: rejQty,
        unit: savedRecord.unit,
        inspectionResults: paramResults,
        remarks: formData.remarks,
        companyInfo
      });

      setShowModal(false);
      await fetchAllData();
      setSelectedLot(null);
      setActiveTab('history');
    } catch (e) {
      console.error("Error submitting FG QC:", e);
      alert("Failed to submit FG inspection. Please check console.");
    }
  };

  const handleDownloadCertificate = (rec: any) => {
    generatePDIPDF({
      certificateNumber: rec.certificateNumber,
      inspectionDate: rec.createdAt,
      fgItemName: rec.fgItemName,
      fgItemCode: rec.fgItemCode,
      batchNumber: rec.batchNumber,
      heatNumber: rec.heatNumber,
      jobCardNumber: rec.jobCardNumber,
      fgGrnNumber: rec.fgGrnNumber,
      customerName: rec.customerName,
      customerPoReference: rec.customerPoReference,
      lotQuantity: rec.lotQuantity,
      inspectedQuantity: rec.inspectedQuantity,
      acceptedQuantity: rec.acceptedQuantity,
      rejectedQuantity: rec.rejectedQuantity,
      unit: rec.unit,
      inspectionResults: rec.inspectionResults,
      inspectorName: rec.inspector?.username || rec.inspector?.name || "QA Inspector",
      remarks: rec.remarks,
      companyInfo
    });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setDateFilterType("all");
    setSelectedCustomer("all");
    setRejectionFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const hasActiveFilters = Boolean(
    searchQuery || dateFilterType !== "all" || selectedCustomer !== "all" || rejectionFilter !== "all"
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* KPI Cards (2x2 on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Pending FG Lots */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending FG Lots</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{kpiMetrics.totalPending}</h3>
            </div>
            <div className="p-2 sm:p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400">
              <Box className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-bold mt-2">Awaiting PDI Clearance</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>

        {/* KPI 2: Total FG Cleared */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">PDI Certificates</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{kpiMetrics.totalInspected}</h3>
            </div>
            <div className="p-2 sm:p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-2">{kpiMetrics.totalUnits.toLocaleString()} FG Units</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
        </div>

        {/* KPI 3: Acceptance Rate */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pass Rate</p>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{kpiMetrics.accRate}%</h3>
            </div>
            <div className="p-2 sm:p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-2">{kpiMetrics.totalAcc.toLocaleString()} Cleared</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>

        {/* KPI 4: Rejection Rate */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rejection</p>
              <h3 className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{kpiMetrics.rejRate}%</h3>
            </div>
            <div className="p-2 sm:p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold mt-2">{kpiMetrics.totalRej.toLocaleString()} Defects</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
        </div>
      </div>

      {/* Main Box */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Navigation & Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 md:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock size={15} />
              <span>Pending FG Lots</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono font-bold">
                {filteredPendingLots.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 md:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldCheck size={15} />
              <span>PDI / COA History</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono font-bold">
                {filteredRecords.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search FG item, batch, PO, cert..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {activeTab === 'history' && (
              <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setHistoryViewMode("cards")}
                  className={`p-1.5 rounded-lg transition-colors ${
                    historyViewMode === "cards" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Card View"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setHistoryViewMode("table")}
                  className={`p-1.5 rounded-lg transition-colors ${
                    historyViewMode === "table" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Table View"
                >
                  <TableIcon size={15} />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`p-2 rounded-xl border transition-colors md:hidden flex items-center gap-1 text-xs font-bold ${
                hasActiveFilters || showMobileFilters
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-700 dark:text-indigo-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <SlidersHorizontal size={14} />
            </button>

            <button
              onClick={fetchAllData}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className={`p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${
          showMobileFilters ? "block" : "hidden md:block"
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              <span className="font-bold text-slate-400 text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Calendar size={12} /> Date:
              </span>
              {[
                { id: "all", label: "All" },
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "last7days", label: "7 Days" },
                { id: "thisMonth", label: "This Month" },
                { id: "monthWise", label: "Month" },
                { id: "custom", label: "Custom" }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDateFilterType(p.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs shrink-0 transition-colors cursor-pointer ${
                    dateFilterType === p.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}

              {dateFilterType === "monthWise" && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-2 py-1 border border-indigo-300 dark:border-indigo-700 rounded-lg text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 outline-none font-bold shrink-0"
                />
              )}

              {dateFilterType === "custom" && (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <Building2 size={13} className="text-slate-400 shrink-0" />
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full sm:w-auto px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none font-medium max-w-[200px] truncate"
                >
                  <option value="all">All Customers / Sources</option>
                  {allCustomers.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg shrink-0">
                <button
                  onClick={() => setRejectionFilter("all")}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    rejectionFilter === "all" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setRejectionFilter("rejectedOnly")}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    rejectionFilter === "rejectedOnly" ? "bg-rose-500 text-white shadow-xs" : "text-rose-600 hover:bg-rose-50"
                  }`}
                >
                  <AlertTriangle size={11} /> Rejections
                </button>
                <button
                  onClick={() => setRejectionFilter("clearedOnly")}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    rejectionFilter === "clearedOnly" ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-600 hover:bg-emerald-50"
                  }`}
                >
                  <Check size={11} /> 100% Cleared
                </button>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs shrink-0 cursor-pointer font-bold"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-3 sm:p-5 bg-slate-50/50 dark:bg-slate-950/50 min-h-[420px]">
          {activeTab === 'pending' ? (
            /* PENDING FG LOTS */
            filteredPendingLots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-72 text-slate-400 dark:text-slate-600">
                <Box className="w-14 h-14 mb-2 opacity-30 stroke-[1.5]" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No pending FG lots found.</p>
                <p className="text-xs text-slate-400 mt-0.5">All production and store FG receipts have been inspected.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {filteredPendingLots.map((lot, idx) => {
                  const dateStr = lot.date ? new Date(lot.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) : "-";
                  return (
                    <div
                      key={idx}
                      onClick={() => handleOpenInspect(lot)}
                      className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-xs font-black font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg inline-block">
                              {lot.sourceNumber}
                            </span>
                            <p className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                              <Calendar size={11} /> {dateStr}
                            </p>
                          </div>
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all shadow-xs shrink-0">
                            <ChevronRight size={16} />
                          </div>
                        </div>

                        <div className="space-y-1.5 mb-3.5">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">{lot.itemName}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Building2 size={12} className="text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{lot.customerName}</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mb-3.5">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Lot Quantity</p>
                            <p className="text-xs font-black text-slate-900 dark:text-white">{lot.quantity} {lot.unit || "PCS"}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Batch / Heat</p>
                            <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">{lot.batchNumber || "-"}</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInspect(lot);
                        }}
                        className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <ShieldCheck size={15} /> Perform PDI & Final QC
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* PDI / COA HISTORY */
            filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-72 text-slate-400 dark:text-slate-600">
                <CheckSquare className="w-14 h-14 mb-2 opacity-30 stroke-[1.5]" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No FG inspection records found.</p>
              </div>
            ) : historyViewMode === "cards" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {filteredRecords.map((rec) => {
                  const inspDate = rec.createdAt ? new Date(rec.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) : "-";
                  const isRejected = Number(rec.rejectedQuantity || 0) > 0 || rec.overallStatus === "Rejected";

                  return (
                    <div
                      key={rec._id}
                      onClick={() => setViewRecord(rec)}
                      className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2.5">
                          <div>
                            <span className="text-xs font-black font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-lg inline-block">
                              {rec.certificateNumber || "PDI-CERT"}
                            </span>
                            <p className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                              <Calendar size={11} /> {inspDate}
                            </p>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 border shrink-0 ${
                            rec.overallStatus === "Accepted" && !isRejected
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300"
                          }`}>
                            {rec.overallStatus}
                          </span>
                        </div>

                        <div className="space-y-1 mb-3">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">{rec.fgItemName}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                            <Building2 size={12} className="text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{rec.customerName || "Standard Stock"}</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mb-3 text-center">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Lot Qty</p>
                            <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">{rec.lotQuantity}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-emerald-600 uppercase">Accepted</p>
                            <p className="text-xs font-black text-emerald-600 mt-0.5">{rec.acceptedQuantity}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-rose-600 uppercase">Rejected</p>
                            <p className={`text-xs font-black mt-0.5 ${Number(rec.rejectedQuantity || 0) > 0 ? "text-rose-600" : "text-slate-400"}`}>
                              {rec.rejectedQuantity || 0}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setViewRecord(rec)}
                          className="flex-1 py-2 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Eye size={13} /> View COA
                        </button>
                        <button
                          onClick={() => handleDownloadCertificate(rec)}
                          className="flex-1 py-2 px-2.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-indigo-200 dark:border-indigo-800 cursor-pointer shadow-xs"
                        >
                          <Download size={13} /> PDI PDF
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase font-black tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3.5">Cert Date</th>
                        <th className="px-4 py-3.5">PDI Cert No</th>
                        <th className="px-4 py-3.5">Product Name</th>
                        <th className="px-4 py-3.5">Customer</th>
                        <th className="px-4 py-3.5 text-center">Lot Qty</th>
                        <th className="px-4 py-3.5 text-center">Accepted</th>
                        <th className="px-4 py-3.5 text-center">Rejected</th>
                        <th className="px-4 py-3.5 text-center">Status</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredRecords.map((rec) => (
                        <tr key={rec._id} onClick={() => setViewRecord(rec)} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer">
                          <td className="px-4 py-3.5">{new Date(rec.createdAt).toLocaleDateString("en-IN")}</td>
                          <td className="px-4 py-3.5 font-mono font-bold text-indigo-600">{rec.certificateNumber}</td>
                          <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{rec.fgItemName}</td>
                          <td className="px-4 py-3.5">{rec.customerName || "-"}</td>
                          <td className="px-4 py-3.5 text-center font-bold">{rec.lotQuantity}</td>
                          <td className="px-4 py-3.5 text-center font-bold text-emerald-600">{rec.acceptedQuantity}</td>
                          <td className="px-4 py-3.5 text-center font-bold text-rose-600">{rec.rejectedQuantity || 0}</td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {rec.overallStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => setViewRecord(rec)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                <Eye size={15} />
                              </button>
                              <button onClick={() => handleDownloadCertificate(rec)} className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-lg font-bold text-[11px] border border-indigo-200 flex items-center gap-1">
                                <Download size={13} /> PDI PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* INSPECTION MODAL */}
      <AnimatePresence>
        {showModal && selectedLot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800"
            >
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    PDI & Final Clearance: {selectedLot.itemName}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Source: {selectedLot.sourceNumber} • Customer: {selectedLot.customerName} • Lot: {selectedLot.quantity} {selectedLot.unit}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* Quantities Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="text-[10px] font-bold text-emerald-600 uppercase">Accepted Qty (Auto)</label>
                    <p className="text-lg font-black text-emerald-600 mt-1">
                      {Math.max(0, Number(selectedLot.quantity || 0) - Number(formData.rejectedQuantity || 0) - Number(formData.reworkQuantity || 0))}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-rose-600 uppercase">Rejected Qty</label>
                    <input
                      type="number"
                      min="0"
                      max={selectedLot.quantity}
                      value={formData.rejectedQuantity}
                      onChange={(e) => setFormData({ ...formData, rejectedQuantity: Number(e.target.value) })}
                      className="w-full mt-1 border border-rose-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50/50"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-600 uppercase">Rework Qty</label>
                    <input
                      type="number"
                      min="0"
                      max={selectedLot.quantity}
                      value={formData.reworkQuantity}
                      onChange={(e) => setFormData({ ...formData, reworkQuantity: Number(e.target.value) })}
                      className="w-full mt-1 border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-600 bg-amber-50/50"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Parameters Checklist Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                    Quality Inspection Test Parameters
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2.5">Parameter</th>
                          <th className="px-3 py-2.5">Specification</th>
                          <th className="px-3 py-2.5">Observed Value</th>
                          <th className="px-3 py-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {paramResults.map((param, pIdx) => (
                          <tr key={pIdx}>
                            <td className="px-3 py-2 font-bold">{param.parameterName}</td>
                            <td className="px-3 py-2 text-slate-500">{param.specification}</td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={param.actualObserved}
                                onChange={(e) => handleParamChange(pIdx, "actualObserved", e.target.value)}
                                className="w-full border rounded-lg px-2 py-1 text-xs outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <select
                                value={param.status}
                                onChange={(e) => handleParamChange(pIdx, "status", e.target.value)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold outline-none ${
                                  param.status === "Pass" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                }`}
                              >
                                <option value="Pass">Pass</option>
                                <option value="Fail">Fail</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">QA Notes / Remarks</label>
                  <input
                    type="text"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full mt-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
                    placeholder="General inspection observations..."
                  />
                </div>
              </div>

              <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center">
                <span className="text-xs text-slate-500">Submitting generates official <strong>PDI Certificate PDF</strong>.</span>
                <div className="flex gap-2">
                  <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-white rounded-xl">
                    Cancel
                  </button>
                  <button onClick={handleSubmitQC} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                    <Check size={16} /> Submit & PDI PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW CERTIFICATE MODAL */}
      <AnimatePresence>
        {viewRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800"
            >
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    PDI Certificate: {viewRecord.certificateNumber}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{viewRecord.fgItemName} • Batch: {viewRecord.batchNumber}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDownloadCertificate(viewRecord)} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                    <Download size={13} /> Download PDF
                  </button>
                  <button onClick={() => setViewRecord(null)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Total Lot</p>
                    <p className="text-base font-bold">{viewRecord.lotQuantity} {viewRecord.unit}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-emerald-600">Accepted</p>
                    <p className="text-base font-bold text-emerald-600">{viewRecord.acceptedQuantity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-rose-600">Rejected</p>
                    <p className="text-base font-bold text-rose-600">{viewRecord.rejectedQuantity || 0}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Test Checklist</h4>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Parameter</th>
                          <th className="px-3 py-2">Observation</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(viewRecord.inspectionResults || []).map((res: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-bold">{res.parameterName}</td>
                            <td className="px-3 py-2">{res.actualObserved || res.specification}</td>
                            <td className="px-3 py-2 text-center font-bold text-emerald-600">{res.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
