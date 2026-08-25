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
  ListFilter,
  Factory,
  Package,
  Sliders,
  ShieldCheck
} from "lucide-react";
import { generateJobWorkQCPDF, JWQCParameterResult } from "@/src/utils/generateJobWorkQCPDF";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface PendingJWLot {
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
  jobWorkType?: string;
  quantitySent?: number;
  receivedQuantity: number;
  totalReceivedQuantity: number;
  unit: string;
}

export interface JWQCRecord {
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
  jobWorkType?: string;
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

const DEFAULT_BUCKET_TESTS: Record<string, JWQCParameterResult[]> = {
  "store-conversion": [
    { parameterName: "Visual & Surface Defects", specification: "Free of cracks, seams & pits", tolerance: "No visual defects", actualObserved: "Clean finish", status: "Pass", instrumentUsed: "Visual / Magnifier" },
    { parameterName: "Material Grade & Chemical Spec", specification: "As per Raw Material Standard", tolerance: "Mill TC Conforms", actualObserved: "Conforms to Grade", status: "Pass", instrumentUsed: "Spectro / Lab Report" },
    { parameterName: "Cross-Section / Thickness", specification: "Standard conversion dimension", tolerance: "±0.05 mm", actualObserved: "Within tolerance", status: "Pass", instrumentUsed: "Digital Micrometer" },
    { parameterName: "Hardness Verification", specification: "Specified RM hardness", tolerance: "±2 HRC", actualObserved: "Conforms", status: "Pass", instrumentUsed: "Hardness Tester" }
  ],
  "store-to-wip": [
    { parameterName: "Machining Dimensions (Critical)", specification: "As per component drawing", tolerance: "±0.03 mm", actualObserved: "Within tolerance", status: "Pass", instrumentUsed: "Digital Bore / Height Gauge" },
    { parameterName: "Concentricity & Runout", specification: "Shaft / Bore concentricity", tolerance: "≤ 0.02 mm", actualObserved: "0.01 mm", status: "Pass", instrumentUsed: "Dial Indicator (DTI)" },
    { parameterName: "Threading / Pitch Fitment", specification: "Thread gauge inspection", tolerance: "6H / 6g Fit", actualObserved: "Free fit", status: "Pass", instrumentUsed: "Thread Plug / Ring Gauge" },
    { parameterName: "Burrs, Chamfer & Deburring", specification: "Edge break & burr-free", tolerance: "Burr Free", actualObserved: "Deburred", status: "Pass", instrumentUsed: "Tactile & Visual" }
  ],
  "wip-to-wip": [
    { parameterName: "Coating / Plating Thickness", specification: "Specified plating thickness", tolerance: "10 to 15 µm", actualObserved: "12 µm Uniform", status: "Pass", instrumentUsed: "Thickness Gauge" },
    { parameterName: "Plating Adhesion & Peel Test", specification: "Cross-hatch tape test", tolerance: "Class 4B/5B", actualObserved: "No peeling / blisters", status: "Pass", instrumentUsed: "Cross-Hatch Cutter" },
    { parameterName: "Surface Hardness After Treatment", specification: "Heat treatment hardness", tolerance: "58 - 62 HRC", actualObserved: "60 HRC", status: "Pass", instrumentUsed: "Micro-Vickers / Rockwell" },
    { parameterName: "Visual Color & Uniformity", specification: "Uniform surface shade", tolerance: "No patchiness", actualObserved: "Uniform finish", status: "Pass", instrumentUsed: "Visual Daylight" }
  ]
};

export default function JobWorkQC() {
  const [activeSubTab, setActiveSubTab] = useState<"pending" | "history">("pending");
  const [activeBucket, setActiveBucket] = useState<"all" | "store-conversion" | "store-to-wip" | "wip-to-wip">("all");

  const [pendingLots, setPendingLots] = useState<PendingJWLot[]>([]);
  const [historyRecords, setHistoryRecords] = useState<JWQCRecord[]>([]);
  const [qualityMasters, setQualityMasters] = useState<any[]>([]);
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
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

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

  const [paramResults, setParamResults] = useState<JWQCParameterResult[]>([]);

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

  // Fetch Quality Masters
  const fetchQualityMasters = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/api/quality/master`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setQualityMasters(res.data.data || []);
      }
    } catch (e) {
      console.warn("Could not fetch quality master templates:", e);
    }
  };

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
    fetchQualityMasters();
  }, []);

  // Unique Vendors for Dropdown
  const uniqueVendors = useMemo(() => {
    const vendors = new Set<string>();
    pendingLots.forEach(p => p.vendorName && vendors.add(p.vendorName));
    historyRecords.forEach(h => h.vendorName && vendors.add(h.vendorName));
    return Array.from(vendors);
  }, [pendingLots, historyRecords]);

  // Bucket Count Metrics
  const bucketCounts = useMemo(() => {
    const isRM = (type?: string) => type === "store-conversion" || type === "inventory-conversion" || !type;
    const isWIP = (type?: string) => type === "store-to-wip";
    const isWIPtoWIP = (type?: string) => type === "wip-to-wip";

    const pRM = pendingLots.filter(l => isRM(l.jobWorkType));
    const pWIP = pendingLots.filter(l => isWIP(l.jobWorkType));
    const pWIPtoWIP = pendingLots.filter(l => isWIPtoWIP(l.jobWorkType));

    return {
      all: { count: pendingLots.length, units: pendingLots.reduce((s, l) => s + (Number(l.receivedQuantity) || 0), 0) },
      "store-conversion": { count: pRM.length, units: pRM.reduce((s, l) => s + (Number(l.receivedQuantity) || 0), 0) },
      "store-to-wip": { count: pWIP.length, units: pWIP.reduce((s, l) => s + (Number(l.receivedQuantity) || 0), 0) },
      "wip-to-wip": { count: pWIPtoWIP.length, units: pWIPtoWIP.reduce((s, l) => s + (Number(l.receivedQuantity) || 0), 0) }
    };
  }, [pendingLots]);

  // Overall KPI Metrics for currently selected bucket
  const bucketFilteredPending = useMemo(() => {
    if (activeBucket === "all") return pendingLots;
    return pendingLots.filter(l => {
      const type = l.jobWorkType || "store-conversion";
      if (activeBucket === "store-conversion") return type === "store-conversion" || type === "inventory-conversion";
      return type === activeBucket;
    });
  }, [pendingLots, activeBucket]);

  const bucketFilteredHistory = useMemo(() => {
    if (activeBucket === "all") return historyRecords;
    return historyRecords.filter(h => {
      const type = h.jobWorkType || "store-conversion";
      if (activeBucket === "store-conversion") return type === "store-conversion" || type === "inventory-conversion";
      return type === activeBucket;
    });
  }, [historyRecords, activeBucket]);

  const totalPendingUnits = useMemo(() => {
    return bucketFilteredPending.reduce((acc, p) => acc + (Number(p.receivedQuantity) || 0), 0);
  }, [bucketFilteredPending]);

  const totalClearedUnits = useMemo(() => {
    return bucketFilteredHistory.reduce((acc, h) => acc + (Number(h.acceptedQuantity) || 0), 0);
  }, [bucketFilteredHistory]);

  const totalRejectedUnits = useMemo(() => {
    return bucketFilteredHistory.reduce((acc, h) => acc + (Number(h.rejectedQuantity) || 0), 0);
  }, [bucketFilteredHistory]);

  const passRate = useMemo(() => {
    const total = totalClearedUnits + totalRejectedUnits;
    if (total === 0) return 100;
    return Math.round((totalClearedUnits / total) * 100);
  }, [totalClearedUnits, totalRejectedUnits]);

  // Open Inspect Modal with Bucket & Master-Tailored Parameters
  const handleOpenInspect = (lot: PendingJWLot) => {
    setSelectedLot(lot);
    setSelectedTemplateId("");
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

    const lotType = lot.jobWorkType || "store-conversion";
    const masterTypeKey = lotType === "store-to-wip" ? "JobWork-Store-To-WIP" :
      lotType === "wip-to-wip" ? "JobWork-WIP-To-WIP" : "JobWork-RM-Conversion";

    // Check if there is a matching Quality Master defined
    const matchedMaster = qualityMasters.find(m => m.type === masterTypeKey || m.type === "JobWork");
    if (matchedMaster && Array.isArray(matchedMaster.parameters) && matchedMaster.parameters.length > 0) {
      setSelectedTemplateId(matchedMaster._id);
      setParamResults(matchedMaster.parameters.map((p: any) => ({
        parameterName: p.name,
        specification: p.method || "Inspection Standard",
        tolerance: p.tolerance || "Standard",
        actualObserved: "Conforms",
        status: "Pass",
        instrumentUsed: p.method || "Inspection Gauge"
      })));
    } else {
      // Fallback to tailored default preset
      const defaultTests = DEFAULT_BUCKET_TESTS[lotType] || DEFAULT_BUCKET_TESTS["store-conversion"];
      setParamResults(defaultTests.map(t => ({ ...t })));
    }

    setShowModal(true);
  };

  // Handle Quality Master Template Switch in Modal
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      const lotType = selectedLot?.jobWorkType || "store-conversion";
      const defaultTests = DEFAULT_BUCKET_TESTS[lotType] || DEFAULT_BUCKET_TESTS["store-conversion"];
      setParamResults(defaultTests.map(t => ({ ...t })));
      return;
    }

    const template = qualityMasters.find(m => m._id === templateId);
    if (template && Array.isArray(template.parameters)) {
      setParamResults(template.parameters.map((p: any) => ({
        parameterName: p.name,
        specification: p.method || template.name,
        tolerance: p.tolerance || "Standard",
        actualObserved: "Conforms",
        status: "Pass",
        instrumentUsed: p.method || "Gauge"
      })));
    }
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
        itemType: selectedLot.itemType || "rm",
        processType: selectedLot.processType,
        jobWorkType: selectedLot.jobWorkType || "store-conversion",
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
        jobWorkType: savedRecord.jobWorkType,
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
      alert("Failed to submit Job Work QC inspection.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Logic with Search & Filters
  const filteredPending = useMemo(() => {
    return bucketFilteredPending.filter((lot) => {
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
  }, [bucketFilteredPending, searchQuery, selectedVendor]);

  const filteredHistory = useMemo(() => {
    return bucketFilteredHistory.filter((rec) => {
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
  }, [bucketFilteredHistory, searchQuery, selectedVendor, statusFilter, dateFilter, selectedMonth]);

  const getBucketBadge = (jobWorkType?: string) => {
    if (jobWorkType === "store-to-wip") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          🔄 Store to WIP
        </span>
      );
    }
    if (jobWorkType === "wip-to-wip") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          📦 WIP to WIP
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
        🏭 RM Conversion
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. THREE RETURNABLE DC BUCKET NAVIGATION SELECTOR */}
      <div className="bg-white dark:bg-slate-900 p-2 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveBucket("all")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeBucket === "all"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Layers size={14} />
              <span>All Returnable DCs</span>
              <span className="px-1.5 py-0.5 bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-800 rounded-md text-[10px]">
                {bucketCounts.all.count}
              </span>
            </button>

            <button
              onClick={() => setActiveBucket("store-conversion")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeBucket === "store-conversion"
                  ? "bg-cyan-600 text-white shadow-xs"
                  : "text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
              }`}
            >
              <Factory size={14} />
              <span>🏭 RM Conversion (RM ➔ RM)</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeBucket === "store-conversion" ? "bg-cyan-800 text-cyan-100" : "bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200"}`}>
                {bucketCounts["store-conversion"].count}
              </span>
            </button>

            <button
              onClick={() => setActiveBucket("store-to-wip")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeBucket === "store-to-wip"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              }`}
            >
              <RotateCcw size={14} />
              <span>🔄 Store to WIP (MRP WIP)</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeBucket === "store-to-wip" ? "bg-amber-800 text-amber-100" : "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"}`}>
                {bucketCounts["store-to-wip"].count}
              </span>
            </button>

            <button
              onClick={() => setActiveBucket("wip-to-wip")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeBucket === "wip-to-wip"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
              }`}
            >
              <Package size={14} />
              <span>📦 WIP to WIP (Treatment)</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeBucket === "wip-to-wip" ? "bg-indigo-800 text-indigo-100" : "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200"}`}>
                {bucketCounts["wip-to-wip"].count}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-[11px] font-bold text-slate-500">
              Active Bucket: <strong className="text-slate-800 dark:text-slate-200">{activeBucket === "all" ? "All Returnable DCs" : activeBucket.toUpperCase()}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 2. TOP KPI SUMMARY TILES */}
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
              {bucketFilteredPending.length}
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

      {/* 3. SUB-TABS & VIEW SWITCHER */}
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
              {bucketFilteredPending.length}
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
              {bucketFilteredHistory.length}
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

      {/* 4. FILTER CONTROLS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Challan, Vendor, Item..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500/20 outline-none"
          />
        </div>

        <div>
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500/20 outline-none"
          >
            <option value="all">All Subcontractors / Vendors</option>
            {uniqueVendors.map((v, i) => (
              <option key={i} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {activeSubTab === "history" && (
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500/20 outline-none"
            >
              <option value="all">All Dispositions</option>
              <option value="accepted">Accepted / Passed</option>
              <option value="rejected">Rejected / Debit Note</option>
              <option value="rework">Rework / Conditional</option>
            </select>
          </div>
        )}

        {activeSubTab === "history" && (
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500/20 outline-none"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="thisMonth">This Month</option>
            </select>
          </div>
        )}
      </div>

      {/* 5. CONTENT: PENDING LOTS */}
      {activeSubTab === "pending" && (
        filteredPending.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              No Pending Job Work Return Lots in {activeBucket === "all" ? "Any Bucket" : activeBucket.toUpperCase()}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              When Returnable DCs are received with QC Required in WIP &gt; Job Work, they appear here for quality inspection.
            </p>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPending.map((lot, idx) => (
              <div
                key={`${lot.jobWorkChallanId}_${idx}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:border-teal-300 dark:hover:border-teal-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                          {lot.challanNumber}
                        </span>
                        {getBucketBadge(lot.jobWorkType)}
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                        {lot.itemName}
                      </h4>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Pending QC
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 my-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between">
                      <span>Vendor:</span>
                      <strong className="text-slate-700 dark:text-slate-300 truncate max-w-[60%]">{lot.vendorName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Process:</span>
                      <strong className="text-slate-700 dark:text-slate-300">{lot.processType}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Receipt (JWGRN):</span>
                      <strong className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">{lot.grnNumber}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Received Qty:</span>
                      <strong className="text-teal-600 text-sm font-black">{lot.receivedQuantity} {lot.unit}</strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenInspect(lot)}
                  className="w-full py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <CheckSquare size={14} />
                  <span>Inspect & Release Lot</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5">Bucket Type</th>
                    <th className="p-3.5">Challan #</th>
                    <th className="p-3.5">Subcontractor</th>
                    <th className="p-3.5">Item Name</th>
                    <th className="p-3.5">Process</th>
                    <th className="p-3.5 text-center">Received Qty</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPending.map((lot, idx) => (
                    <tr key={`${lot.jobWorkChallanId}_${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3.5">{getBucketBadge(lot.jobWorkType)}</td>
                      <td className="p-3.5 font-mono font-bold text-teal-600">{lot.challanNumber}</td>
                      <td className="p-3.5 font-medium">{lot.vendorName}</td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">{lot.itemName}</td>
                      <td className="p-3.5 font-semibold text-slate-600">{lot.processType}</td>
                      <td className="p-3.5 text-center font-bold text-teal-600">{lot.receivedQuantity} {lot.unit}</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleOpenInspect(lot)}
                          className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs"
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
      )}

      {/* 6. CONTENT: HISTORY RECORDS */}
      {activeSubTab === "history" && (
        filteredHistory.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Clearance History in this Bucket</h3>
            <p className="text-xs text-slate-400 mt-1">
              Completed quality inspection notes and certificates will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5">Bucket Type</th>
                    <th className="p-3.5">Cert No</th>
                    <th className="p-3.5">Challan No</th>
                    <th className="p-3.5">Subcontractor</th>
                    <th className="p-3.5">Item Name</th>
                    <th className="p-3.5 text-center">Accepted</th>
                    <th className="p-3.5 text-center">Rejected</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredHistory.map((rec) => (
                    <tr key={rec._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3.5">{getBucketBadge(rec.jobWorkType)}</td>
                      <td className="p-3.5 font-mono font-bold text-teal-600">{rec.certificateNumber}</td>
                      <td className="p-3.5 font-mono">{rec.challanNumber}</td>
                      <td className="p-3.5 font-medium">{rec.vendorName}</td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">{rec.itemName}</td>
                      <td className="p-3.5 text-center font-bold text-emerald-600">{rec.acceptedQuantity}</td>
                      <td className="p-3.5 text-center font-bold text-red-500">{rec.rejectedQuantity}</td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rec.overallStatus === "Accepted" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
                          rec.overallStatus === "Rejected" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        }`}>
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
                              jobWorkType: rec.jobWorkType,
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
                          className="p-1.5 text-slate-500 hover:text-teal-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Download JW-SCN Certificate PDF"
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

      {/* 7. INSPECTION & DISPOSITION MODAL */}
      {showModal && selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
              <div>
                <div className="flex items-center gap-2">
                  {getBucketBadge(selectedLot.jobWorkType)}
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    GRN: {selectedLot.grnNumber}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                  Inspect: {selectedLot.itemName}
                </h3>
                <p className="text-xs text-slate-500">
                  Vendor: <b>{selectedLot.vendorName}</b> • Challan: <b>{selectedLot.challanNumber}</b>
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitQC} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              
              {/* Quality Standard Template Selector */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sliders size={13} className="text-teal-600" />
                    Quality Master Template
                  </label>
                  <span className="text-[10px] text-slate-400">Derived from Quality Master</span>
                </div>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500/20 outline-none"
                >
                  <option value="">-- Tailored Bucket Preset Defaults --</option>
                  {qualityMasters.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.type})
                    </option>
                  ))}
                </select>
              </div>

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
                    <span>Rejection Analysis & Vendor Action</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Defect Category</label>
                      <select
                        value={formData.defectCategory}
                        onChange={(e) => setFormData({ ...formData, defectCategory: e.target.value })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-xl text-xs font-semibold"
                      >
                        <option value="Dimensional Deviation">Dimensional Out of Tolerance</option>
                        <option value="Plating / Coating Blister">Plating Peeling / Blister</option>
                        <option value="Under-thickness">Coating Under-thickness</option>
                        <option value="Burrs & Dents">Burrs, Dents & Surface Scratches</option>
                        <option value="Heat Treatment Crack">Hardness / Quenching Crack</option>
                        <option value="Material Grade Mismatch">Material Grade / Chemical Mismatch</option>
                        <option value="Over-machined">Over-machined (Total Scrap)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Action Required</label>
                      <select
                        value={formData.dispositionAction}
                        onChange={(e) => setFormData({ ...formData, dispositionAction: e.target.value })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-xl text-xs font-semibold"
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

              {/* Bucket Tailored Test Parameters Checklist Table */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Tailored QC Inspection Checklist ({paramResults.length} parameters)</span>
                  <span className="text-[10px] font-normal text-slate-400">Tuned for {selectedLot.jobWorkType || "RM Conversion"}</span>
                </label>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500">
                      <tr>
                        <th className="p-2.5">Parameter Name</th>
                        <th className="p-2.5">Observed Result</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paramResults.map((param, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                            <div>{param.parameterName}</div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {param.specification} ({param.tolerance})
                            </span>
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
                              className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
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
                  placeholder="e.g. Verified dimensions and specifications; stock approved for inward release..."
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
