"use client";

import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Wrench,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Download,
  Calendar,
  Layers,
  Sparkles,
  RotateCcw,
  CheckSquare,
  Building2,
  Truck,
  ArrowRight,
  Plus,
  RefreshCw,
  LayoutGrid,
  ListFilter
} from "lucide-react";
import { generateJobWorkQCPDF, JWQCParameterResult } from "@/src/utils/generateJobWorkQCPDF";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface PendingJWLot {
  sourceType: string;
  jobWorkChallanId: string;
  receiveHistoryId?: string;
  challanNumber: string;
  grnNumber: string;
  vendorDcNumber?: string;
  vendorInvoiceDate?: string;
  date: string;
  vendorId?: string;
  vendorName: string;
  vendorCode?: string;
  vendorGst?: string;
  itemId: string;
  returningItemId?: string;
  itemName: string;
  itemType?: string;
  processType: string;
  quantitySent?: number;
  receivedQuantity: number;
  totalReceivedQuantity: number;
  unit: string;
}

interface JWQCRecord {
  _id: string;
  certificateNumber: string;
  challanNumber: string;
  grnNumber?: string;
  vendorDcNumber?: string;
  vendorName: string;
  vendor?: any;
  itemName: string;
  itemCode?: string;
  itemType?: string;
  processType: string;
  quantitySent?: number;
  receivedQuantity: number;
  inspectedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  reworkQuantity?: number;
  scrapQuantity?: number;
  unit: string;
  overallStatus: string;
  rejectionReason?: string;
  defectCategory?: string;
  dispositionAction?: string;
  inspectionResults?: JWQCParameterResult[];
  inspector?: any;
  createdAt: string;
  remarks?: string;
}

export default function JobWorkQC() {
  const [activeSubTab, setActiveSubTab] = useState<"pending" | "history">("pending");
  const [pendingLots, setPendingLots] = useState<PendingJWLot[]>([]);
  const [historyRecords, setHistoryRecords] = useState<JWQCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<PendingJWLot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal Inspection Form
  const [formData, setFormData] = useState({
    acceptedQuantity: 0,
    rejectedQuantity: 0,
    reworkQuantity: 0,
    scrapQuantity: 0,
    defectCategory: "None",
    rejectionReason: "",
    dispositionAction: "Store Inward",
    remarks: ""
  });

  const [paramResults, setParamResults] = useState<JWQCParameterResult[]>([
    { parameterName: "Visual & Surface Finish", specification: "Free of burrs, peeling & blisters", tolerance: "No visual defects", actualObserved: "Good surface finish", status: "Pass", instrumentUsed: "Visual / Magnifier" },
    { parameterName: "Critical Process Dimensions", specification: "As per approved drawing", tolerance: "±0.05 mm", actualObserved: "Within tolerance", status: "Pass", instrumentUsed: "Vernier / Micrometer" },
    { parameterName: "Coating / Plating Thickness", specification: "Specified micron thickness", tolerance: "±2 µm", actualObserved: "Uniform coating", status: "Pass", instrumentUsed: "Thickness Gauge" },
    { parameterName: "Hardness / Heat Treatment", specification: "Specified hardness standard", tolerance: "±2 HRC", actualObserved: "Conforms", status: "Pass", instrumentUsed: "Hardness Tester" }
  ]);

  // Fetch Company Info for PDF
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE_URL}/api/store/company-info`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.data) {
          setCompanyInfo(res.data.data);
        }
      } catch (e) {
        console.warn("Could not fetch store master company info:", e);
      }
    };
    fetchCompanyInfo();
  }, []);

  // Fetch Pending Lots & QC History
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const [pendingRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/quality/jobwork/pending`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/quality/jobwork`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setPendingLots(pendingRes.data?.data || []);
      setHistoryRecords(historyRes.data?.data || []);
    } catch (e) {
      console.error("Error fetching Job Work QC data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Compute Unique Vendors for Dropdown
  const uniqueVendors = useMemo(() => {
    const vendors = new Set<string>();
    pendingLots.forEach(p => p.vendorName && vendors.add(p.vendorName));
    historyRecords.forEach(h => h.vendorName && vendors.add(h.vendorName));
    return Array.from(vendors);
  }, [pendingLots, historyRecords]);

  // KPI Calculations
  const totalPendingUnits = useMemo(() => {
    return pendingLots.reduce((acc, p) => acc + (Number(p.receivedQuantity) || 0), 0);
  }, [pendingLots]);

  const totalClearedUnits = useMemo(() => {
    return historyRecords.reduce((acc, h) => acc + (Number(h.acceptedQuantity) || 0), 0);
  }, [historyRecords]);

  const totalRejectedUnits = useMemo(() => {
    return historyRecords.reduce((acc, h) => acc + (Number(h.rejectedQuantity) || 0), 0);
  }, [historyRecords]);

  const passRate = useMemo(() => {
    const total = totalClearedUnits + totalRejectedUnits;
    if (total === 0) return 100;
    return Math.round((totalClearedUnits / total) * 100);
  }, [totalClearedUnits, totalRejectedUnits]);

  // Open Inspect Modal
  const handleOpenInspect = (lot: PendingJWLot) => {
    setSelectedLot(lot);
    const recQty = Number(lot.receivedQuantity) || 0;
    setFormData({
      acceptedQuantity: recQty,
      rejectedQuantity: 0,
      reworkQuantity: 0,
      scrapQuantity: 0,
      defectCategory: "None",
      rejectionReason: "",
      dispositionAction: "Store Inward",
      remarks: ""
    });
    setParamResults([
      { parameterName: "Visual & Surface Finish", specification: "Free of burrs, peeling & blisters", tolerance: "No visual defects", actualObserved: "Good surface finish", status: "Pass", instrumentUsed: "Visual / Magnifier" },
      { parameterName: `Critical Dimensions (${lot.processType})`, specification: "As per approved drawing", tolerance: "±0.05 mm", actualObserved: "Within tolerance", status: "Pass", instrumentUsed: "Vernier / Micrometer" },
      { parameterName: "Coating / Hardness Check", specification: "Process specification", tolerance: "Standard", actualObserved: "Conforms", status: "Pass", instrumentUsed: "Inspection Gauge" }
    ]);
    setShowModal(true);
  };

  // Submit QC Inspection
  const handleSubmitQC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const recQty = Number(selectedLot.receivedQuantity || 0);
      const rejQty = Math.max(0, Math.min(recQty, Number(formData.rejectedQuantity || 0)));
      const rewQty = Math.max(0, Math.min(recQty - rejQty, Number(formData.reworkQuantity || 0)));
      const scrQty = Math.max(0, Math.min(rejQty, Number(formData.scrapQuantity || 0)));
      const accQty = Math.max(0, recQty - rejQty - rewQty);

      const status = rejQty > 0 ? (accQty > 0 ? "Conditional" : "Rejected") : (rewQty > 0 ? "Rework" : "Accepted");

      const payload = {
        jobWorkChallanId: selectedLot.jobWorkChallanId,
        receiveHistoryId: selectedLot.receiveHistoryId,
        challanNumber: selectedLot.challanNumber,
        grnNumber: selectedLot.grnNumber,
        vendorDcNumber: selectedLot.vendorDcNumber,
        vendorInvoiceDate: selectedLot.vendorInvoiceDate,
        vendor: selectedLot.vendorId,
        vendorName: selectedLot.vendorName,
        itemId: selectedLot.itemId,
        returningItemId: selectedLot.returningItemId,
        itemName: selectedLot.itemName,
        itemType: selectedLot.itemType || "fg",
        processType: selectedLot.processType,
        jobWorkType: (selectedLot as any).jobWorkType || "store-conversion",
        unit: selectedLot.unit || "PCS",
        quantitySent: selectedLot.quantitySent,
        receivedQuantity: recQty,
        inspectedQuantity: recQty,
        acceptedQuantity: accQty,
        rejectedQuantity: rejQty,
        reworkQuantity: rewQty,
        scrapQuantity: scrQty,
        inspectionResults: paramResults,
        overallStatus: status,
        defectCategory: formData.defectCategory,
        rejectionReason: formData.rejectionReason,
        dispositionAction: formData.dispositionAction,
        remarks: formData.remarks
      };

      const res = await axios.post(`${API_BASE_URL}/api/quality/jobwork`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const savedRecord = res.data?.data || payload;

      // Auto-generate JW-SCN Certificate PDF
      generateJobWorkQCPDF({
        certificateNumber: savedRecord.certificateNumber,
        challanNumber: savedRecord.challanNumber,
        grnNumber: savedRecord.grnNumber,
        vendorDcNumber: savedRecord.vendorDcNumber,
        vendorName: savedRecord.vendorName,
        itemName: savedRecord.itemName,
        itemType: savedRecord.itemType,
        processType: savedRecord.processType,
        quantitySent: savedRecord.quantitySent,
        receivedQuantity: recQty,
        inspectedQuantity: recQty,
        acceptedQuantity: accQty,
        rejectedQuantity: rejQty,
        reworkQuantity: rewQty,
        scrapQuantity: scrQty,
        unit: savedRecord.unit,
        inspectionResults: paramResults,
        overallStatus: status,
        defectCategory: formData.defectCategory,
        rejectionReason: formData.rejectionReason,
        dispositionAction: formData.dispositionAction,
        remarks: formData.remarks,
        companyInfo
      });

      setShowModal(false);
      await fetchAllData();
      setSelectedLot(null);
      setActiveSubTab("history");
    } catch (e) {
      console.error("Error submitting Job Work QC:", e);
      alert("Failed to submit Job Work QC inspection. Please check console.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Logic
  const filteredPending = useMemo(() => {
    return pendingLots.filter((lot) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        lot.challanNumber.toLowerCase().includes(q) ||
        lot.vendorName.toLowerCase().includes(q) ||
        lot.itemName.toLowerCase().includes(q) ||
        (lot.grnNumber && lot.grnNumber.toLowerCase().includes(q)) ||
        (lot.processType && lot.processType.toLowerCase().includes(q));

      const matchVendor = selectedVendor === "all" || lot.vendorName === selectedVendor;

      return matchSearch && matchVendor;
    });
  }, [pendingLots, searchQuery, selectedVendor]);

  const filteredHistory = useMemo(() => {
    return historyRecords.filter((rec) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        rec.challanNumber.toLowerCase().includes(q) ||
        rec.vendorName.toLowerCase().includes(q) ||
        rec.itemName.toLowerCase().includes(q) ||
        (rec.certificateNumber && rec.certificateNumber.toLowerCase().includes(q)) ||
        (rec.processType && rec.processType.toLowerCase().includes(q));

      const matchVendor = selectedVendor === "all" || rec.vendorName === selectedVendor;

      let matchStatus = true;
      if (statusFilter === "accepted") matchStatus = rec.overallStatus === "Accepted";
      else if (statusFilter === "rejected") matchStatus = rec.overallStatus === "Rejected" || rec.overallStatus === "Conditional";
      else if (statusFilter === "rework") matchStatus = rec.overallStatus === "Rework";

      // Date filtering
      let matchDate = true;
      if (rec.createdAt) {
        const itemDate = new Date(rec.createdAt);
        const now = new Date();

        if (dateFilter === "today") {
          matchDate = itemDate.toDateString() === now.toDateString();
        } else if (dateFilter === "yesterday") {
          const yest = new Date();
          yest.setDate(yest.getDate() - 1);
          matchDate = itemDate.toDateString() === yest.toDateString();
        } else if (dateFilter === "7days") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          matchDate = itemDate >= sevenDaysAgo;
        } else if (dateFilter === "thisMonth") {
          matchDate = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        } else if (dateFilter === "monthWise" && selectedMonth) {
          const [yr, mo] = selectedMonth.split("-").map(Number);
          matchDate = itemDate.getFullYear() === yr && itemDate.getMonth() + 1 === mo;
        }
      }

      return matchSearch && matchVendor && matchStatus && matchDate;
    });
  }, [historyRecords, searchQuery, selectedVendor, statusFilter, dateFilter, selectedMonth]);

  return (
    <div className="space-y-6">
      {/* 1. TOP KPI SUMMARY TILES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending JW Lots</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-amber-600">
              <RotateCcw size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {pendingLots.length}
            </span>
            <span className="text-xs font-semibold text-slate-400">({totalPendingUnits} units)</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cleared & Inwarded</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {totalClearedUnits}
            </span>
            <span className="text-xs font-semibold text-slate-400">units</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pass Rate</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {passRate}%
            </span>
            <span className="text-xs font-semibold text-emerald-500">Quality target 95%+</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subcontractor Rejection</span>
            <div className="p-2 bg-red-50 dark:bg-red-950/60 rounded-xl text-red-600">
              <XCircle size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400">
              {totalRejectedUnits}
            </span>
            <span className="text-xs font-semibold text-slate-400">units debit/rework</span>
          </div>
        </div>
      </div>

      {/* 2. SUB-TABS & VIEW SWITCHER */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setActiveSubTab("pending")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${
              activeSubTab === "pending"
                ? "bg-white dark:bg-slate-900 text-amber-600 shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            <RotateCcw size={15} />
            <span>Pending Return Lots</span>
            <span className="ml-1 px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-full text-[10px]">
              {pendingLots.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${
              activeSubTab === "history"
                ? "bg-white dark:bg-slate-900 text-teal-600 shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            <CheckSquare size={15} />
            <span>JW QC Clearance History</span>
            <span className="ml-1 px-1.5 py-0.2 bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-full text-[10px]">
              {historyRecords.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="hidden sm:flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "cards" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs" : "text-slate-400"
              }`}
              title="Card Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "table" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs" : "text-slate-400"
              }`}
              title="Table View"
            >
              <ListFilter size={15} />
            </button>
          </div>

          <button
            onClick={fetchAllData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 3. FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search Challan, Vendor, Item, Process..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {/* Subcontractor / Vendor Filter */}
          <div className="relative">
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:outline-none"
            >
              <option value="all">All Subcontractors / Vendors</option>
              {uniqueVendors.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* QC Status Filter (for History) */}
          {activeSubTab === "history" && (
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:outline-none"
              >
                <option value="all">All QC Statuses</option>
                <option value="accepted">100% Cleared / Pass</option>
                <option value="rejected">Has Rejections / Debit</option>
                <option value="rework">Sent for Vendor Rework</option>
              </select>
            </div>
          )}

          {/* Date Presets (for History) */}
          {activeSubTab === "history" && (
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:outline-none"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="monthWise">Specific Month...</option>
              </select>
            </div>
          )}
        </div>

        {/* Specific Month Picker */}
        {activeSubTab === "history" && dateFilter === "monthWise" && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500">Pick Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
            />
          </div>
        )}
      </div>

      {/* 4. MAIN CONTENT AREA */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-semibold animate-pulse">
          Loading Job Work Return QC records...
        </div>
      ) : activeSubTab === "pending" ? (
        // ================= PENDING RETURN LOTS =================
        filteredPending.length === 0 ? (
          <div className="p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200">No Pending Job Work Return Lots</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              All subcontractor returned materials have been inspected and cleared to stock.
            </p>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPending.map((lot, idx) => (
              <div
                key={`${lot.jobWorkChallanId}_${idx}`}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-teal-500/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-[10px] rounded-md uppercase tracking-wider">
                        JW Inward Lot
                      </span>
                      <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-1 line-clamp-1">
                        {lot.itemName}
                      </h4>
                    </div>
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs rounded-lg">
                      {lot.receivedQuantity} {lot.unit}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Subcontractor:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{lot.vendorName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Outward DC No:</span>
                      <span className="font-mono font-bold text-teal-600">{lot.challanNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Inward Receipt:</span>
                      <span className="font-mono text-slate-600 dark:text-slate-300">{lot.grnNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Process Type:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {lot.processType}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {new Date(lot.date).toLocaleDateString("en-IN")}
                  </span>
                  <button
                    onClick={() => handleOpenInspect(lot)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    <span>Inspect Lot</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5">Outward DC No</th>
                    <th className="p-3.5">Subcontractor</th>
                    <th className="p-3.5">Item Name</th>
                    <th className="p-3.5">Process</th>
                    <th className="p-3.5 text-center">Qty to Inspect</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPending.map((lot, idx) => (
                    <tr key={`${lot.jobWorkChallanId}_${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-bold text-teal-600">{lot.challanNumber}</td>
                      <td className="p-3.5 font-medium">{lot.vendorName}</td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">{lot.itemName}</td>
                      <td className="p-3.5 font-semibold text-slate-600">{lot.processType}</td>
                      <td className="p-3.5 text-center font-bold">{lot.receivedQuantity} {lot.unit}</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleOpenInspect(lot)}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        // ================= HISTORY VIEW =================
        filteredHistory.length === 0 ? (
          <div className="p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-200">No Job Work QC History Found</h3>
            <p className="text-xs text-slate-400">Try adjusting your filters or inspection search terms.</p>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredHistory.map((rec) => {
              const isPass = rec.overallStatus === "Accepted";
              const isFail = rec.overallStatus === "Rejected";

              return (
                <div
                  key={rec._id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`px-2 py-0.5 font-bold text-[10px] rounded-md uppercase tracking-wider ${
                            isPass
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : isFail
                              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {rec.overallStatus}
                        </span>
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-1 line-clamp-1">
                          {rec.itemName}
                        </h4>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded">
                        {rec.certificateNumber || "JW-SCN"}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Vendor:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{rec.vendorName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Challan No:</span>
                        <span className="font-mono font-semibold">{rec.challanNumber}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Process:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{rec.processType}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>Accepted: <b className="text-emerald-600">{rec.acceptedQuantity}</b></span>
                        <span>Rejected: <b className="text-red-500">{rec.rejectedQuantity}</b></span>
                        <span>Rework: <b className="text-amber-500">{rec.reworkQuantity || 0}</b></span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {new Date(rec.createdAt).toLocaleDateString("en-IN")}
                    </span>
                    <button
                      onClick={() =>
                        generateJobWorkQCPDF({
                          certificateNumber: rec.certificateNumber,
                          inspectionDate: rec.createdAt,
                          challanNumber: rec.challanNumber,
                          grnNumber: rec.grnNumber,
                          vendorDcNumber: rec.vendorDcNumber,
                          vendorName: rec.vendorName,
                          vendorCode: rec.vendor?.code,
                          vendorGst: rec.vendor?.gstin,
                          itemName: rec.itemName,
                          itemType: rec.itemType,
                          processType: rec.processType,
                          quantitySent: rec.quantitySent,
                          receivedQuantity: rec.receivedQuantity,
                          inspectedQuantity: rec.inspectedQuantity,
                          acceptedQuantity: rec.acceptedQuantity,
                          rejectedQuantity: rec.rejectedQuantity,
                          reworkQuantity: rec.reworkQuantity,
                          scrapQuantity: rec.scrapQuantity,
                          unit: rec.unit,
                          inspectionResults: rec.inspectionResults,
                          overallStatus: rec.overallStatus,
                          rejectionReason: rec.rejectionReason,
                          defectCategory: rec.defectCategory,
                          dispositionAction: rec.dispositionAction,
                          remarks: rec.remarks,
                          companyInfo
                        })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                    >
                      <Download size={13} />
                      <span>JW-SCN PDF</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5">Cert No</th>
                    <th className="p-3.5">Challan No</th>
                    <th className="p-3.5">Subcontractor</th>
                    <th className="p-3.5">Item Name</th>
                    <th className="p-3.5">Process</th>
                    <th className="p-3.5 text-center">Accepted</th>
                    <th className="p-3.5 text-center">Rejected</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredHistory.map((rec) => (
                    <tr key={rec._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-bold text-teal-600">{rec.certificateNumber}</td>
                      <td className="p-3.5 font-mono">{rec.challanNumber}</td>
                      <td className="p-3.5 font-medium">{rec.vendorName}</td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">{rec.itemName}</td>
                      <td className="p-3.5 font-semibold text-slate-600">{rec.processType}</td>
                      <td className="p-3.5 text-center font-bold text-emerald-600">{rec.acceptedQuantity}</td>
                      <td className="p-3.5 text-center font-bold text-red-500">{rec.rejectedQuantity}</td>
                      <td className="p-3.5 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                          {rec.overallStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() =>
                            generateJobWorkQCPDF({
                              certificateNumber: rec.certificateNumber,
                              inspectionDate: rec.createdAt,
                              challanNumber: rec.challanNumber,
                              grnNumber: rec.grnNumber,
                              vendorDcNumber: rec.vendorDcNumber,
                              vendorName: rec.vendorName,
                              itemName: rec.itemName,
                              itemType: rec.itemType,
                              processType: rec.processType,
                              quantitySent: rec.quantitySent,
                              receivedQuantity: rec.receivedQuantity,
                              inspectedQuantity: rec.inspectedQuantity,
                              acceptedQuantity: rec.acceptedQuantity,
                              rejectedQuantity: rec.rejectedQuantity,
                              reworkQuantity: rec.reworkQuantity,
                              unit: rec.unit,
                              inspectionResults: rec.inspectionResults,
                              overallStatus: rec.overallStatus,
                              companyInfo
                            })
                          }
                          className="p-1.5 text-slate-500 hover:text-teal-600"
                        >
                          <Download size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* 5. INSPECTION & DISPOSITION MODAL */}
      {showModal && selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
              <div>
                <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold text-[10px] rounded uppercase">
                  Subcontractor Inward QC
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                  Inspect: {selectedLot.itemName}
                </h3>
                <p className="text-xs text-slate-500">
                  Vendor: <b>{selectedLot.vendorName}</b> | DC: <b>{selectedLot.challanNumber}</b> | Process: <b>{selectedLot.processType}</b>
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitQC} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              {/* Quantity Stepper Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Received Lot</label>
                  <div className="text-base font-black text-slate-900 dark:text-white mt-1">
                    {selectedLot.receivedQuantity} {selectedLot.unit}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-emerald-600">Accepted Qty</label>
                  <input
                    type="number"
                    min="0"
                    max={selectedLot.receivedQuantity}
                    value={formData.acceptedQuantity}
                    onChange={(e) => {
                      const acc = Number(e.target.value) || 0;
                      const rem = Math.max(0, Number(selectedLot.receivedQuantity) - acc);
                      setFormData({
                        ...formData,
                        acceptedQuantity: acc,
                        rejectedQuantity: rem,
                        reworkQuantity: 0
                      });
                    }}
                    className="w-full mt-1 px-2.5 py-1.5 font-bold text-emerald-600 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-red-500">Rejected Qty</label>
                  <input
                    type="number"
                    min="0"
                    max={selectedLot.receivedQuantity}
                    value={formData.rejectedQuantity}
                    onChange={(e) => {
                      const rej = Number(e.target.value) || 0;
                      const acc = Math.max(0, Number(selectedLot.receivedQuantity) - rej - formData.reworkQuantity);
                      setFormData({
                        ...formData,
                        rejectedQuantity: rej,
                        acceptedQuantity: acc
                      });
                    }}
                    className="w-full mt-1 px-2.5 py-1.5 font-bold text-red-500 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-amber-500">Vendor Rework</label>
                  <input
                    type="number"
                    min="0"
                    max={selectedLot.receivedQuantity}
                    value={formData.reworkQuantity}
                    onChange={(e) => {
                      const rew = Number(e.target.value) || 0;
                      const acc = Math.max(0, Number(selectedLot.receivedQuantity) - formData.rejectedQuantity - rew);
                      setFormData({
                        ...formData,
                        reworkQuantity: rew,
                        acceptedQuantity: acc
                      });
                    }}
                    className="w-full mt-1 px-2.5 py-1.5 font-bold text-amber-500 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              {/* Defect Analysis & Reason if any rejected */}
              {(formData.rejectedQuantity > 0 || formData.reworkQuantity > 0) && (
                <div className="p-3 bg-red-50/60 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs">
                    <AlertTriangle size={14} />
                    <span>Rejection Analysis & Vendor Debit Instruction</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Defect Category</label>
                      <select
                        value={formData.defectCategory}
                        onChange={(e) => setFormData({ ...formData, defectCategory: e.target.value })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-xl text-xs"
                      >
                        <option value="Dimensional Deviation">Dimensional Out of Tolerance</option>
                        <option value="Plating / Coating Blister">Plating Peeling / Blister</option>
                        <option value="Under-thickness">Coating Under-thickness</option>
                        <option value="Burrs & Dents">Burrs, Dents & Surface Scratches</option>
                        <option value="Heat Treatment Crack">Hardness / Quenching Crack</option>
                        <option value="Over-machined">Over-machined (Total Scrap)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Action Required</label>
                      <select
                        value={formData.dispositionAction}
                        onChange={(e) => setFormData({ ...formData, dispositionAction: e.target.value })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-xl text-xs"
                      >
                        <option value="Vendor Debit Note">Debit Note on Vendor</option>
                        <option value="Vendor Free Rework">Return to Vendor for Free Rework</option>
                        <option value="Internal Rework">Internal In-House Rework</option>
                        <option value="Scrap & Charge Vendor">Scrap & Charge Material Cost to Vendor</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Process Test Checklist Table */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Process Quality Test Parameters Checklist
                </label>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500">
                      <tr>
                        <th className="p-2.5">Parameter</th>
                        <th className="p-2.5">Observed Value</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paramResults.map((param, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                            {param.parameterName}
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={param.actualObserved}
                              onChange={(e) => {
                                const newParams = [...paramResults];
                                newParams[idx].actualObserved = e.target.value;
                                setParamResults(newParams);
                              }}
                              className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <select
                              value={param.status}
                              onChange={(e) => {
                                const newParams = [...paramResults];
                                newParams[idx].status = e.target.value;
                                setParamResults(newParams);
                              }}
                              className={`px-2 py-1 rounded-lg font-bold text-xs ${
                                param.status === "Pass"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
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

              {/* Remarks */}
              <div>
                <label className="text-xs font-bold text-slate-500">Inspection Remarks & Stamp Note</label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="e.g. Dimensions verified with digital micrometer; coating thickness conforms to standard..."
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-teal-500/20 disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  <span>{submitting ? "Processing & Releasing..." : "Submit QC & Generate JW-SCN"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
