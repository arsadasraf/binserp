"use client";

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { 
  Plus, Check, X, ClipboardCheck, Search, ChevronRight, 
  Filter, Calendar, Download, Eye, AlertTriangle, CheckCircle2, 
  XCircle, FileText, User, Building2, Layers, RotateCcw,
  Clock, ArrowUpRight, ShieldCheck, Sparkles, RefreshCw,
  LayoutGrid, Table as TableIcon, Tag, SlidersHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { generateSCNPDF, SCNReportData, SCNItemData } from "@/src/utils/generateSCNPDF";

const DEFECT_CATEGORIES = [
  "Dimensional Deviation",
  "Visual / Surface Scratch",
  "Material / Hardness Variance",
  "Packaging Damage",
  "Missing Documentation / Mill TC",
  "Incorrect Item / Part No",
  "Corrosion / Rust",
  "Thread / Machining Flaw",
  "Other Quality Defect"
];

export default function IncomingQC() {
  const [records, setRecords] = useState<any[]>([]);
  const [pendingGRNs, setPendingGRNs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [historyViewMode, setHistoryViewMode] = useState<"cards" | "table">("cards");

  // Grouped Inspection State
  const [showModal, setShowModal] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [inspectionData, setInspectionData] = useState<Record<string, {
    rejectedQuantity: number;
    defectCategory: string;
    remarks: string;
  }>>({});

  // View / SCN History State
  const [viewHistoryData, setViewHistoryData] = useState<any[] | null>(null);

  // --- Filtering States (Universal for both Pending & History) ---
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilterType, setDateFilterType] = useState<"all" | "today" | "yesterday" | "last7days" | "thisMonth" | "monthWise" | "custom">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedParty, setSelectedParty] = useState<string>("all");
  const [rejectionFilter, setRejectionFilter] = useState<"all" | "rejectedOnly" | "clearedOnly">("all");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);

  useEffect(() => {
    fetchAllData();
    fetchCompanyInfo();
    fetchVendorsAndCustomers();
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

  const fetchVendorsAndCustomers = async () => {
    try {
      const token = localStorage.getItem("token");
      const [vRes, cRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/store/vendor`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/store/customer`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (vRes.data?.vendors) setVendorsList(vRes.data.vendors);
      if (cRes.data?.customers) setCustomersList(cRes.data.customers);
    } catch (e) {
      console.warn("Could not fetch vendors/customers for SCN metadata:", e);
    }
  };

  const resolvePartyDetails = (partyNameOrObj: any) => {
    const nameStr = typeof partyNameOrObj === 'string' ? partyNameOrObj : (partyNameOrObj?.name || partyNameOrObj?.customerName || partyNameOrObj?.supplierName || "");
    if (!nameStr) return { supplierName: "Vendor / Supplier" };

    const matchedVendor = vendorsList.find(v => 
      (v.name && v.name.toLowerCase() === nameStr.toLowerCase()) || 
      (partyNameOrObj?._id && v._id === partyNameOrObj._id) ||
      (typeof partyNameOrObj === 'string' && v._id === partyNameOrObj)
    );

    if (matchedVendor) {
      const addrRaw = matchedVendor.billingAddress || matchedVendor.address || "";
      const cityState = [matchedVendor.city, matchedVendor.state, matchedVendor.pincode ? `- ${matchedVendor.pincode}` : ""].filter(Boolean).join(" ");
      const fullAddr = [addrRaw, cityState].filter(Boolean).join(", ");
      return {
        supplierName: matchedVendor.name,
        supplierCode: matchedVendor.code || "-",
        supplierAddress: fullAddr || "-",
        supplierGst: matchedVendor.gst || matchedVendor.gstin || "-",
        supplierPhone: matchedVendor.phone || matchedVendor.contactPerson || "-",
        supplierEmail: matchedVendor.email || "-"
      };
    }

    const matchedCust = customersList.find(c => 
      (c.name && c.name.toLowerCase() === nameStr.toLowerCase()) || 
      (partyNameOrObj?._id && c._id === partyNameOrObj._id) ||
      (typeof partyNameOrObj === 'string' && c._id === partyNameOrObj)
    );

    if (matchedCust) {
      const addrRaw = matchedCust.billingAddress || matchedCust.address || "";
      const cityState = [matchedCust.city, matchedCust.state, matchedCust.pincode ? `- ${matchedCust.pincode}` : ""].filter(Boolean).join(" ");
      const fullAddr = [addrRaw, cityState].filter(Boolean).join(", ");
      return {
        supplierName: matchedCust.name,
        supplierCode: matchedCust.code || "-",
        supplierAddress: fullAddr || "-",
        supplierGst: matchedCust.gst || matchedCust.gstin || "-",
        supplierPhone: matchedCust.phone || matchedCust.contactPerson || "-",
        supplierEmail: matchedCust.email || "-"
      };
    }

    return {
      supplierName: nameStr
    };
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    await Promise.all([fetchRecords(), fetchPendingGRNs()]);
    setIsLoading(false);
  };

  const fetchPendingGRNs = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/api/store/grn`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.grns) {
        const pending = res.data.grns.filter((g: any) => 
          g.qcRequired && (g.qcStatus === 'Pending' || g.qcStatus === 'Partial' || !g.qcStatus)
        );
        setPendingGRNs(pending);
      }
    } catch (error) {
      console.error("Error fetching GRNs:", error);
    }
  };

  const fetchRecords = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/api/quality/incoming`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setRecords(res.data.data);
      }
    } catch (error) {
      console.error("Error fetching incoming QC records:", error);
    }
  };

  // --- Dynamic Supplier / Customer List ---
  const allParties = useMemo(() => {
    const parties = new Set<string>();
    pendingGRNs.forEach(g => {
      const p = g.supplierName || g.supplier?.name || g.customerName || g.customer?.name;
      if (p) parties.add(p);
    });
    records.forEach(r => {
      const p = r.supplierName || r.grnId?.supplierName || r.grnId?.supplier?.name || r.grnId?.customerName;
      if (p) parties.add(p);
    });
    return Array.from(parties).sort();
  }, [pendingGRNs, records]);

  // --- Universal Date Filter Checker ---
  const matchDate = (dateVal?: string | Date) => {
    if (!dateVal || dateFilterType === "all") return true;
    const target = new Date(dateVal);
    if (isNaN(target.getTime())) return true;

    const now = new Date();
    const targetDateStr = target.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    if (dateFilterType === "today") {
      return targetDateStr === todayStr;
    }

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

  // --- Filtered Pending GRNs ---
  const filteredPendingGRNs = useMemo(() => {
    return pendingGRNs.filter((grn) => {
      const party = grn.supplierName || grn.supplier?.name || grn.customerName || grn.customer?.name || "Unknown";
      
      if (selectedParty !== "all" && party !== selectedParty) return false;
      if (!matchDate(grn.date || grn.createdAt)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const grnNum = (grn.grnNumber || "").toLowerCase();
        const poRef = (grn.poReference || "").toLowerCase();
        const pName = party.toLowerCase();
        const itemMatch = grn.items?.some((i: any) => 
          (i.materialName || i.name || "").toLowerCase().includes(q)
        );
        if (!grnNum.includes(q) && !poRef.includes(q) && !pName.includes(q) && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [pendingGRNs, selectedParty, dateFilterType, selectedMonth, customStartDate, customEndDate, searchQuery]);

  // --- Filtered QC History Records ---
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const party = rec.supplierName || rec.grnId?.supplierName || rec.grnId?.supplier?.name || rec.grnId?.customerName || "Unknown";

      if (selectedParty !== "all" && party !== selectedParty) return false;
      if (!matchDate(rec.createdAt || rec.inspectionDate)) return false;

      if (rejectionFilter === "rejectedOnly" && (Number(rec.rejectedQuantity || 0) <= 0 && rec.overallStatus !== "Rejected")) {
        return false;
      }
      if (rejectionFilter === "clearedOnly" && (Number(rec.rejectedQuantity || 0) > 0 || rec.overallStatus === "Rejected")) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const grnNum = (rec.grnId?.grnNumber || rec.grnReference || "").toLowerCase();
        const matName = (rec.materialName || "").toLowerCase();
        const pName = party.toLowerCase();
        const insp = (rec.inspector?.username || rec.inspector?.name || "").toLowerCase();
        if (!grnNum.includes(q) && !matName.includes(q) && !pName.includes(q) && !insp.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [records, selectedParty, dateFilterType, selectedMonth, customStartDate, customEndDate, rejectionFilter, searchQuery]);

  // --- KPI Metrics ---
  const kpiMetrics = useMemo(() => {
    const totalPendingLots = pendingGRNs.length;
    const totalInspections = records.length;
    let totalRec = 0;
    let totalAcc = 0;
    let totalRej = 0;

    records.forEach((r) => {
      totalRec += Number(r.receivedQuantity || 0);
      totalAcc += Number(r.acceptedQuantity || 0);
      totalRej += Number(r.rejectedQuantity || 0);
    });

    const accRate = totalRec > 0 ? ((totalAcc / totalRec) * 100).toFixed(1) : "100.0";
    const rejRate = totalRec > 0 ? ((totalRej / totalRec) * 100).toFixed(1) : "0.0";

    return { totalPendingLots, totalInspections, totalRec, totalAcc, totalRej, accRate, rejRate };
  }, [pendingGRNs, records]);

  // --- Handlers ---
  const handleInspectGRN = (grn: any) => {
    if (!grn) return;
    setSelectedGRN(grn);
    const initialData: any = {};
    grn.items.forEach((item: any) => {
      initialData[item._id] = {
        rejectedQuantity: 0,
        defectCategory: "Dimensional Deviation",
        remarks: ""
      };
    });
    setInspectionData(initialData);
    setShowModal(true);
  };

  const handleItemChange = (itemId: string, field: string, value: any) => {
    setInspectionData((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    if (!selectedGRN) return;

    try {
      const token = localStorage.getItem("token");
      const promises = selectedGRN.items.map((item: any) => {
        const data = inspectionData[item._id] || { rejectedQuantity: 0, defectCategory: "", remarks: "" };
        const rejQty = Math.max(0, Math.min(Number(item.quantity || 0), Number(data.rejectedQuantity || 0)));
        const acceptedQty = Number(item.quantity || 0) - rejQty;
        const status = rejQty > 0 ? (acceptedQty > 0 ? "Conditional" : "Rejected") : "Accepted";

        let matName = item.materialName;
        if (!matName) {
          if (item.component && typeof item.component === 'object') {
            matName = item.component.componentName || item.component.name;
          } else if (item.material && typeof item.material === 'object') {
            matName = item.material.name;
          } else if (item.fgItem && typeof item.fgItem === 'object') {
            matName = item.fgItem.name;
          }
        }
        if (!matName) matName = "Material Item";

        const resolvedMatId = item.material?._id || (typeof item.material === 'string' ? item.material : (item.fgItem?._id || (typeof item.fgItem === 'string' ? item.fgItem : null)));

        const payload = {
          grnId: selectedGRN._id,
          grnItemId: item._id,
          materialId: resolvedMatId,
          componentId: item.component?._id || (typeof item.component === 'string' ? item.component : null),
          materialName: matName,
          supplierName: selectedGRN.supplierName || selectedGRN.supplier?.name || selectedGRN.customerName || selectedGRN.customer?.name || "Supplier / Vendor",
          batchNumber: item.heatNo || item.batchNo || "",
          receivedQuantity: Number(item.quantity) || 0,
          inspectedQuantity: Number(item.quantity) || 0,
          acceptedQuantity: acceptedQty,
          rejectedQuantity: rejQty,
          remarks: data.remarks ? `${data.defectCategory ? `[${data.defectCategory}] ` : ''}${data.remarks}` : (data.defectCategory || ""),
          inspectionResults: [],
          overallStatus: status
        };

        return axios.post(`${API_BASE_URL}/api/quality/incoming`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      });

      await Promise.all(promises);

      // Auto-generate SCN PDF for the lot
      const scnItems: SCNItemData[] = selectedGRN.items.map((item: any) => {
        const data = inspectionData[item._id] || { rejectedQuantity: 0, defectCategory: "", remarks: "" };
        const rejQty = Math.max(0, Math.min(Number(item.quantity || 0), Number(data.rejectedQuantity || 0)));
        const acceptedQty = Number(item.quantity || 0) - rejQty;
        return {
          materialName: item.materialName || item.name || "Material",
          unit: item.unit || "PCS",
          receivedQuantity: Number(item.quantity) || 0,
          acceptedQuantity: acceptedQty,
          rejectedQuantity: rejQty,
          rejectionReason: data.remarks || data.defectCategory || (rejQty > 0 ? "Defect Found" : "Passed"),
          defectCategory: data.defectCategory
        };
      });

      const partyDetails = resolvePartyDetails(selectedGRN.supplier || selectedGRN.supplierName || selectedGRN.customer || selectedGRN.customerName);

      generateSCNPDF({
        grnNumber: selectedGRN.grnNumber,
        grnDate: selectedGRN.date,
        poReference: selectedGRN.poReference,
        ...partyDetails,
        items: scnItems,
        companyInfo
      });

      setShowModal(false);
      await fetchAllData();
      setSelectedGRN(null);
      setActiveTab('history');
    } catch (error) {
      console.error("Failed to submit QC:", error);
      alert("Failed to submit inspection. Please check console.");
    }
  };

  const handleDownloadHistorySCN = (recordOrGroup: any) => {
    let group: any[] = [];
    if (Array.isArray(recordOrGroup)) {
      group = recordOrGroup;
    } else {
      const grnId = recordOrGroup.grnId?._id || recordOrGroup.grnId;
      group = records.filter(r => (r.grnId?._id || r.grnId) === grnId);
      if (group.length === 0) group = [recordOrGroup];
    }

    const first = group[0];
    const scnItems: SCNItemData[] = group.map((r) => ({
      materialName: r.materialName || "Material",
      unit: r.unit || "PCS",
      receivedQuantity: Number(r.receivedQuantity || 0),
      acceptedQuantity: Number(r.acceptedQuantity || 0),
      rejectedQuantity: Number(r.rejectedQuantity || 0),
      rejectionReason: r.remarks || (Number(r.rejectedQuantity || 0) > 0 ? "Quality Variance" : "Standard Passed")
    }));

    const partyDetails = resolvePartyDetails(first.supplierName || first.grnId?.supplierName || first.grnId?.supplier || first.grnId?.customerName || first.grnId?.customer);

    generateSCNPDF({
      grnNumber: first.grnId?.grnNumber || first.grnReference || "GRN-LOT",
      grnDate: first.grnId?.date || first.createdAt,
      inspectionDate: first.createdAt,
      poReference: first.grnId?.poReference || "-",
      ...partyDetails,
      inspectorName: first.inspector?.username || first.inspector?.name || "QA Inspector",
      items: scnItems,
      companyInfo
    });
  };

  const handleViewHistory = (record: any) => {
    const grnId = record.grnId?._id || record.grnId;
    let siblings = records.filter(r => (r.grnId?._id || r.grnId) === grnId);
    if (siblings.length === 0) siblings = [record];
    setViewHistoryData(siblings);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setDateFilterType("all");
    setSelectedParty("all");
    setRejectionFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const hasActiveFilters = Boolean(
    searchQuery || dateFilterType !== "all" || selectedParty !== "all" || rejectionFilter !== "all"
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Executive KPI Cards (Optimized 2-col on Mobile, 4-col on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Pending Lots */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Lots</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{kpiMetrics.totalPendingLots}</h3>
            </div>
            <div className="p-2 sm:p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-bold mt-2 truncate">To inspect</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>

        {/* KPI 2: Total Inspected */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Inspected</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{kpiMetrics.totalInspections}</h3>
            </div>
            <div className="p-2 sm:p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-2 truncate">{kpiMetrics.totalRec.toLocaleString()} Units</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
        </div>

        {/* KPI 3: Acceptance Rate */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Accepted</p>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{kpiMetrics.accRate}%</h3>
            </div>
            <div className="p-2 sm:p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-2 truncate">{kpiMetrics.totalAcc.toLocaleString()} Accepted</p>
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
          <p className="text-[10px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold mt-2 truncate">{kpiMetrics.totalRej.toLocaleString()} Rejected</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Navigation & Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Tabs */}
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
              <span>Pending</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] sm:text-xs ${
                activeTab === 'pending'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono font-bold'
                  : 'bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-mono'
              }`}>
                {filteredPendingGRNs.length}
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
              <span>QC History</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] sm:text-xs ${
                activeTab === 'history'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono font-bold'
                  : 'bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-mono'
              }`}>
                {filteredRecords.length}
              </span>
            </button>
          </div>

          {/* Search, View Switcher, and Mobile Filter Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search GRN, item, party..."
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

            {/* View Switcher for History Tab */}
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

            {/* Mobile Filter Expand Toggle */}
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`p-2 rounded-xl border transition-colors md:hidden flex items-center gap-1 text-xs font-bold ${
                hasActiveFilters || showMobileFilters
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-700 dark:text-indigo-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <SlidersHorizontal size={14} />
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
            </button>

            {/* Refresh Button */}
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

        {/* Filters Bar (Responsive / Mobile-Optimized) */}
        <div className={`p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${
          showMobileFilters ? "block" : "hidden md:block"
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
            {/* Date Presets Row (Touch scrollable horizontal chips on mobile) */}
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

            {/* Supplier & Rejection Controls */}
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
              {/* Supplier Dropdown */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <Building2 size={13} className="text-slate-400 shrink-0" />
                <select
                  value={selectedParty}
                  onChange={(e) => setSelectedParty(e.target.value)}
                  className="w-full sm:w-auto px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none font-medium max-w-[200px] truncate"
                >
                  <option value="all">All Suppliers / Customers</option>
                  {allParties.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Rejection Filters */}
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
                  title="Show only records with rejections or defects"
                >
                  <AlertTriangle size={11} /> Rejections
                </button>
                <button
                  onClick={() => setRejectionFilter("clearedOnly")}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    rejectionFilter === "clearedOnly" ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-600 hover:bg-emerald-50"
                  }`}
                  title="Show 100% accepted lots"
                >
                  <Check size={11} /> 100% Pass
                </button>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs shrink-0 cursor-pointer font-bold"
                  title="Reset all filters"
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
            /* ================= PENDING GRNS VIEW ================= */
            filteredPendingGRNs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-72 text-slate-400 dark:text-slate-600">
                <ClipboardCheck className="w-14 h-14 mb-2 opacity-30 stroke-[1.5]" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No pending GRN lots found.</p>
                <p className="text-xs text-slate-400 mt-0.5">All materials have been inspected or check your filter criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {filteredPendingGRNs.map((grn) => {
                  const inwardDate = grn.date ? new Date(grn.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) : "-";
                  const partyName = grn.supplierName || grn.supplier?.name || grn.customerName || grn.customer?.name || "Vendor / Supplier";
                  const totalItems = Array.isArray(grn.items) ? grn.items.length : 0;

                  return (
                    <div
                      key={grn._id}
                      onClick={() => handleInspectGRN(grn)}
                      className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
                    >
                      <div>
                        {/* Header Badge */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-xs font-black font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg inline-block">
                              {grn.grnNumber}
                            </span>
                            <p className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                              <Calendar size={11} /> {inwardDate}
                            </p>
                          </div>
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all shadow-xs shrink-0">
                            <ChevronRight size={16} />
                          </div>
                        </div>

                        {/* Supplier / Party */}
                        <div className="space-y-1.5 mb-3.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Party / Supplier</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={partyName}>
                            {partyName}
                          </p>
                          {grn.poReference && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                              <Tag size={11} className="text-slate-400" />
                              <span className="font-mono font-bold">{grn.poReference}</span>
                            </div>
                          )}
                        </div>

                        {/* Items Preview */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 sm:p-3 border border-slate-100 dark:border-slate-800 mb-3.5">
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between">
                            <span>Materials to Inspect</span>
                            <span className="font-mono text-indigo-600 dark:text-indigo-400">{totalItems} {totalItems === 1 ? 'Item' : 'Items'}</span>
                          </p>
                          <div className="space-y-1 max-h-20 overflow-y-auto">
                            {(grn.items || []).slice(0, 3).map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-xs text-slate-700 dark:text-slate-300 font-medium">
                                <span className="truncate max-w-[170px]">{item.materialName || item.name || "Item"}</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">+{item.quantity} {item.unit || "PCS"}</span>
                              </div>
                            ))}
                            {totalItems > 3 && (
                              <p className="text-[10px] text-slate-400 italic text-right">+ {totalItems - 3} more items...</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectGRN(grn);
                        }}
                        className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <ClipboardCheck size={15} /> Perform Quality Inspection
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* ================= QC HISTORY VIEW (Cards on Mobile / Switchable) ================= */
            filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-72 text-slate-400 dark:text-slate-600">
                <ShieldCheck className="w-14 h-14 mb-2 opacity-30 stroke-[1.5]" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No QC history records found.</p>
                <p className="text-xs text-slate-400 mt-0.5">Try adjusting your date range or search query.</p>
              </div>
            ) : historyViewMode === "cards" ? (
              /* QC HISTORY CARDS VIEW (Mobile & Modern Grid) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {filteredRecords.map((rec) => {
                  const inspDate = rec.createdAt ? new Date(rec.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) : "-";
                  const party = rec.supplierName || rec.grnId?.supplierName || rec.grnId?.supplier?.name || rec.grnId?.customerName || "Vendor / Supplier";
                  const recQty = Number(rec.receivedQuantity || 0);
                  const accQty = Number(rec.acceptedQuantity || 0);
                  const rejQty = Number(rec.rejectedQuantity || 0);
                  const isRejected = rejQty > 0 || rec.overallStatus === "Rejected";

                  return (
                    <div
                      key={rec._id}
                      onClick={() => handleViewHistory(rec)}
                      className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
                    >
                      <div>
                        {/* Top Meta Bar */}
                        <div className="flex justify-between items-start mb-2.5">
                          <div>
                            <span className="text-xs font-black font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-lg inline-block">
                              {rec.grnId?.grnNumber || rec.grnReference || "GRN-LOT"}
                            </span>
                            <p className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                              <Calendar size={11} /> {inspDate}
                            </p>
                          </div>

                          {/* Status Pill */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 border shrink-0 ${
                            rec.overallStatus === "Accepted" && !isRejected
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                              : isRejected && accQty === 0
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              rec.overallStatus === "Accepted" && !isRejected ? "bg-emerald-500" : isRejected && accQty === 0 ? "bg-rose-500" : "bg-amber-500"
                            }`} />
                            {rec.overallStatus || (isRejected ? "Rejected" : "Accepted")}
                          </span>
                        </div>

                        {/* Material & Party */}
                        <div className="space-y-1 mb-3">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1" title={rec.materialName}>
                            {rec.materialName}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1" title={party}>
                            <Building2 size={12} className="text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{party}</span>
                          </p>
                        </div>

                        {/* Quantities Metric Strip */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mb-3 text-center">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Received</p>
                            <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">{recQty}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Accepted</p>
                            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{accQty}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase">Rejected</p>
                            <p className={`text-xs font-black mt-0.5 ${rejQty > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>
                              {rejQty}
                            </p>
                          </div>
                        </div>

                        {/* Remarks if any */}
                        {rec.remarks && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-amber-50/50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-100 dark:border-amber-900/40 mb-3 line-clamp-2">
                            "{rec.remarks}"
                          </p>
                        )}
                      </div>

                      {/* Card Actions Footer */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleViewHistory(rec)}
                          className="flex-1 py-2 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Eye size={13} /> View Cert
                        </button>
                        <button
                          onClick={() => handleDownloadHistorySCN(rec)}
                          className="flex-1 py-2 px-2.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-indigo-200 dark:border-indigo-800 cursor-pointer shadow-xs"
                        >
                          <Download size={13} /> SCN PDF
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* QC HISTORY TABLE VIEW (Desktop Optimized) */
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase font-black tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3.5">Inspection Date</th>
                        <th className="px-4 py-3.5">GRN / SCN No</th>
                        <th className="px-4 py-3.5">Supplier / Party</th>
                        <th className="px-4 py-3.5">Material Description</th>
                        <th className="px-4 py-3.5 text-center">Rec. Qty</th>
                        <th className="px-4 py-3.5 text-center">Acc. Qty</th>
                        <th className="px-4 py-3.5 text-center">Rej. Qty</th>
                        <th className="px-4 py-3.5 text-center">Status</th>
                        <th className="px-4 py-3.5">Inspector</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredRecords.map((rec) => {
                        const inspDate = rec.createdAt ? new Date(rec.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) : "-";
                        const party = rec.supplierName || rec.grnId?.supplierName || rec.grnId?.supplier?.name || rec.grnId?.customerName || "-";
                        const isRejected = Number(rec.rejectedQuantity || 0) > 0 || rec.overallStatus === "Rejected";

                        return (
                          <tr
                            key={rec._id}
                            onClick={() => handleViewHistory(rec)}
                            className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer group"
                            title="Click to view full inspection certificate"
                          >
                            <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {inspDate}
                            </td>
                            <td className="px-4 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                              {rec.grnId?.grnNumber || rec.grnReference || "-"}
                            </td>
                            <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white max-w-[160px] truncate" title={party}>
                              {party}
                            </td>
                            <td className="px-4 py-3.5 font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate" title={rec.materialName}>
                              {rec.materialName}
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold text-slate-900 dark:text-white">
                              {rec.receivedQuantity}
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                              {rec.acceptedQuantity}
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold">
                              {Number(rec.rejectedQuantity || 0) > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-mono font-black">
                                  {rec.rejectedQuantity}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">0</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 border ${
                                rec.overallStatus === "Accepted" && !isRejected
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                  : isRejected && Number(rec.acceptedQuantity || 0) === 0
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  rec.overallStatus === "Accepted" && !isRejected ? "bg-emerald-500" : isRejected && Number(rec.acceptedQuantity || 0) === 0 ? "bg-rose-500" : "bg-amber-500"
                                }`} />
                                {rec.overallStatus || "Accepted"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {rec.inspector?.username || rec.inspector?.name || "System QA"}
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end items-center gap-1.5">
                                <button
                                  onClick={() => handleViewHistory(rec)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                                  title="View Certificate"
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  onClick={() => handleDownloadHistorySCN(rec)}
                                  className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 cursor-pointer shadow-xs"
                                  title="Download Official SCN Report"
                                >
                                  <Download size={13} /> SCN PDF
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ================= BULK INSPECTION MODAL (Responsive Mobile Cards & Desktop Table) ================= */}
      <AnimatePresence>
        {showModal && selectedGRN && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      Inspect Lot: {selectedGRN.grnNumber}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300">
                      QA Inward
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-md">
                    {selectedGRN.supplierName || selectedGRN.customerName || "Party"} • Inward Date: {selectedGRN.date ? new Date(selectedGRN.date).toLocaleDateString("en-IN") : "-"}
                  </p>
                </div>
                <button 
                  onClick={() => setShowModal(false)} 
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body: Mobile Card View on Small Screens, Table on Desktop */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-3 w-[26%]">Item Description</th>
                        <th className="px-3 py-3 text-center w-[12%]">Received</th>
                        <th className="px-3 py-3 text-center w-[12%]">Accepted</th>
                        <th className="px-3 py-3 w-[15%]">Rejected Qty</th>
                        <th className="px-3 py-3 w-[18%]">Defect Category</th>
                        <th className="px-3 py-3 w-[17%]">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedGRN.items.map((item: any) => {
                        const data = inspectionData[item._id] || { rejectedQuantity: 0, defectCategory: "Dimensional Deviation", remarks: "" };
                        const receivedQty = Number(item.quantity || 0);
                        const rejQty = Math.max(0, Math.min(receivedQty, Number(data.rejectedQuantity || 0)));
                        const acceptedQty = receivedQty - rejQty;

                        return (
                          <tr key={item._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="px-3 py-3">
                              <div className="font-bold text-slate-900 dark:text-white">{item.materialName || item.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">Unit: {item.unit || "PCS"}</div>
                            </td>
                            <td className="px-3 py-3 text-center font-black text-slate-900 dark:text-white">
                              {receivedQty}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                {acceptedQty}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min="0"
                                max={receivedQty}
                                value={data.rejectedQuantity}
                                onChange={(e) => handleItemChange(item._id, "rejectedQuantity", Number(e.target.value))}
                                className="w-full border border-rose-300 dark:border-rose-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none font-bold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={data.defectCategory}
                                disabled={rejQty === 0}
                                onChange={(e) => handleItemChange(item._id, "defectCategory", e.target.value)}
                                className={`w-full border rounded-lg px-2 py-1.5 text-xs outline-none font-medium ${
                                  rejQty > 0 
                                    ? 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white' 
                                    : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 text-slate-400'
                                }`}
                              >
                                {DEFECT_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="text"
                                value={data.remarks}
                                onChange={(e) => handleItemChange(item._id, "remarks", e.target.value)}
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                placeholder={rejQty > 0 ? "Reason / defect note..." : "Optional note..."}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Item Inspection Cards */}
                <div className="md:hidden space-y-3">
                  {selectedGRN.items.map((item: any, idx: number) => {
                    const data = inspectionData[item._id] || { rejectedQuantity: 0, defectCategory: "Dimensional Deviation", remarks: "" };
                    const receivedQty = Number(item.quantity || 0);
                    const rejQty = Math.max(0, Math.min(receivedQty, Number(data.rejectedQuantity || 0)));
                    const acceptedQty = receivedQty - rejQty;

                    return (
                      <div key={item._id} className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 font-bold">ITEM #{idx + 1}</span>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">{item.materialName || item.name}</h4>
                            <p className="text-[10px] text-slate-400 font-mono">Unit: {item.unit || "PCS"}</p>
                          </div>
                          <span className="text-xs font-bold text-slate-500 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            Total: {receivedQty}
                          </span>
                        </div>

                        {/* Quantities Row */}
                        <div className="grid grid-cols-2 gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div>
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Accepted Qty</p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{acceptedQty}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Rejected Qty</p>
                            <input
                              type="number"
                              min="0"
                              max={receivedQty}
                              value={data.rejectedQuantity}
                              onChange={(e) => handleItemChange(item._id, "rejectedQuantity", Number(e.target.value))}
                              className="w-full mt-0.5 border border-rose-300 dark:border-rose-800 rounded-lg px-2 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* Defect Category & Remarks */}
                        {rejQty > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Defect Category</p>
                              <select
                                value={data.defectCategory}
                                onChange={(e) => handleItemChange(item._id, "defectCategory", e.target.value)}
                                className="w-full mt-0.5 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                              >
                                {DEFECT_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Remarks / Observations</p>
                              <input
                                type="text"
                                value={data.remarks}
                                onChange={(e) => handleItemChange(item._id, "remarks", e.target.value)}
                                className="w-full mt-0.5 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                placeholder="Specific defect details..."
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center sm:text-left">
                  Submitting generates the official <strong>SCN PDF Certificate</strong>.
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowModal(false)} 
                    className="flex-1 sm:flex-initial px-4 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSubmit} 
                    className="flex-1 sm:flex-initial px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                  >
                    <ClipboardCheck size={15} /> Submit & SCN PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= SCN / HISTORY PREVIEW MODAL ================= */}
      <AnimatePresence>
        {viewHistoryData && viewHistoryData.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      SCN Quality Report
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300">
                      {viewHistoryData[0].grnId?.grnNumber || viewHistoryData[0].grnReference}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-4 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span>Party: <strong>{viewHistoryData[0].supplierName || viewHistoryData[0].grnId?.supplierName || "Supplier"}</strong></span>
                    <span>•</span>
                    <span>Date: {new Date(viewHistoryData[0].createdAt).toLocaleDateString("en-IN")}</span>
                    <span>•</span>
                    <span>Inspector: <strong>{viewHistoryData[0].inspector?.username || "QA Inspector"}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadHistorySCN(viewHistoryData)}
                    className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Download size={13} /> Download SCN PDF
                  </button>
                  <button 
                    onClick={() => setViewHistoryData(null)} 
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Table / Details */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-5">
                <div className="space-y-3 md:hidden">
                  {viewHistoryData.map((rec) => (
                    <div key={rec._id} className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">{rec.materialName}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          rec.overallStatus === "Accepted"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300"
                        }`}>
                          {rec.overallStatus}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">Rec</p>
                          <p className="font-bold">{rec.receivedQuantity}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-emerald-600 uppercase font-bold">Acc</p>
                          <p className="font-bold text-emerald-600">{rec.acceptedQuantity}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-rose-600 uppercase font-bold">Rej</p>
                          <p className="font-bold text-rose-600">{rec.rejectedQuantity || 0}</p>
                        </div>
                      </div>
                      {rec.remarks && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-amber-50/50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-100 dark:border-amber-900/40">
                          {rec.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="hidden md:block">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-3">Material Description</th>
                        <th className="px-3 py-3 text-center">Received</th>
                        <th className="px-3 py-3 text-center">Accepted</th>
                        <th className="px-3 py-3 text-center">Rejected</th>
                        <th className="px-3 py-3 text-center">Disposition Status</th>
                        <th className="px-3 py-3">Observations & Defect Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {viewHistoryData.map((rec) => (
                        <tr key={rec._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                            {rec.materialName}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-slate-800 dark:text-slate-200">
                            {rec.receivedQuantity}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {rec.acceptedQuantity}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-rose-600 dark:text-rose-400">
                            {rec.rejectedQuantity > 0 ? rec.rejectedQuantity : "0"}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              rec.overallStatus === "Accepted"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : rec.overallStatus === "Rejected"
                                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                            }`}>
                              {rec.overallStatus}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-400 italic">
                            {rec.remarks || "Meets inspection specifications."}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
