"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Package,
  Layers,
  ClipboardList,
  Search,
  Sparkles,
  ShieldCheck,
  Check,
  SlidersHorizontal,
  Info
} from "lucide-react";
import { API_BASE_URL } from "@/src/utils/config";
import { ItemNameAndDescription } from "@/src/utils/itemDisplayHelper";
import Swal from "sweetalert2";

export interface SyncMasterUomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface AuditRecord {
  id?: string;
  materialCode?: string;
  materialName?: string;
  itemType?: string;
  currentUnit: string;
  masterUnit: string;
  currentSecondaryUnit?: string;
  masterSecondaryUnit?: string;
  currentConversionFactor?: number;
  masterConversionFactor?: number;
  hasSecondaryUnit?: boolean;
  locationSource?: string;
  // BOM specific
  fgName?: string;
  fgCode?: string;
  componentName?: string;
  // Material Request specific
  requestNumber?: string;
  sourceType: "master" | "inventory" | "bom" | "mr";
  description?: string;
}

export default function SyncMasterUomModal({
  isOpen,
  onClose,
  onSuccess,
}: SyncMasterUomModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "master" | "inventory" | "bom" | "mr">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [syncStats, setSyncStats] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAudit = async () => {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${API_BASE_URL}/api/store/audit-master-uoms`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load UOM audit data");
      }
      setAuditData(data);
    } catch (err: any) {
      console.error("Audit Master UOM error:", err);
      setAuditError(err.message || "Failed to communicate with master sync service");
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSyncStats(null);
      fetchAudit();
    }
  }, [isOpen]);

  const handleExecuteSync = async () => {
    const totalIssues = auditData?.totalDiscrepancies || 0;
    const confirmResult = await Swal.fire({
      title: "Correct All Master UOMs?",
      html: `
        <div class="text-left text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2">
          <p>This action will harmonize Unit of Measure definitions across your entire system:</p>
          <ul class="list-disc pl-5 space-y-1 font-medium text-slate-700 dark:text-slate-200">
            <li><strong>${auditData?.masterMismatchesCount || 0}</strong> Master catalog items will have their primary UOM corrected to standard (e.g. Bought Out to PCS).</li>
            <li><strong>${auditData?.inventoryMismatchesCount || 0}</strong> Inventory stock records will be matched to their master UOM.</li>
            <li><strong>${auditData?.bomMismatchesCount || 0}</strong> Attached BOM component lines will adopt their true master UOM.</li>
            <li><strong>${auditData?.materialRequestMismatchesCount || 0}</strong> Open Material Request items will reflect current canonical UOMs.</li>
          </ul>
          <p class="text-[11px] text-slate-500 italic mt-2">Existing numerical stock quantities remain 100% intact.</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Correct All Places Now",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#4f46e5",
      cancelButtonColor: "#64748b",
    });

    if (!confirmResult.isConfirmed) return;

    setSyncing(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${API_BASE_URL}/api/store/sync-master-uoms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to execute UOM sync");
      }

      setSyncStats(data.stats);

      await Swal.fire({
        title: "Synchronization Complete!",
        html: `
          <div class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <p class="font-bold text-emerald-600 dark:text-emerald-400">All master UOM definitions have been successfully aligned!</p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg text-center mt-3 text-xs">
              <div>
                <div class="font-bold text-slate-800 dark:text-slate-100 text-base">${data.stats?.mastersFixed || 0}</div>
                <div class="text-[10px] text-slate-500">Masters Fixed</div>
              </div>
              <div>
                <div class="font-bold text-slate-800 dark:text-slate-100 text-base">${data.stats?.inventoryFixed || 0}</div>
                <div class="text-[10px] text-slate-500">Inventory Fixed</div>
              </div>
              <div>
                <div class="font-bold text-slate-800 dark:text-slate-100 text-base">${data.stats?.bomItemsFixed || 0}</div>
                <div class="text-[10px] text-slate-500">BOM Lines Fixed</div>
              </div>
              <div>
                <div class="font-bold text-slate-800 dark:text-slate-100 text-base">${data.stats?.materialRequestsFixed || 0}</div>
                <div class="text-[10px] text-slate-500">MR Items Fixed</div>
              </div>
            </div>
          </div>
        `,
        icon: "success",
        confirmButtonColor: "#4f46e5",
      });

      // Notify parent listeners or global event to refresh cache
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("store-data-updated"));
      }
      if (onSuccess) {
        onSuccess();
      }

      // Re-run audit to show fresh clean state
      await fetchAudit();
    } catch (err: any) {
      console.error("Sync execution error:", err);
      Swal.fire({
        title: "Sync Error",
        text: err.message || "Failed to complete Master UOM synchronization.",
        icon: "error",
      });
    } finally {
      setSyncing(false);
    }
  };

  // Compile flat list of all records with normalized structure
  const allMismatches = useMemo<AuditRecord[]>(() => {
    if (!auditData) return [];
    const list: AuditRecord[] = [];

    (auditData.masterMismatches || []).forEach((m: any) => {
      list.push({
        id: m.id,
        materialCode: m.materialCode,
        materialName: m.materialName,
        itemType: m.itemType || "Master Catalog",
        currentUnit: m.currentUnit,
        masterUnit: m.masterUnit,
        locationSource: m.locationSource || "Master Catalog",
        sourceType: "master",
      });
    });

    (auditData.inventoryMismatches || []).forEach((inv: any) => {
      list.push({
        id: inv.id,
        materialCode: inv.materialCode,
        materialName: inv.materialName,
        itemType: inv.itemType || "Raw Material",
        currentUnit: inv.currentUnit,
        masterUnit: inv.masterUnit,
        currentSecondaryUnit: inv.currentSecondaryUnit,
        masterSecondaryUnit: inv.masterSecondaryUnit,
        currentConversionFactor: inv.currentConversionFactor,
        masterConversionFactor: inv.masterConversionFactor,
        hasSecondaryUnit: inv.hasSecondaryUnit,
        locationSource: "Inventory Record",
        sourceType: "inventory",
      });
    });

    (auditData.bomMismatches || []).forEach((bom: any) => {
      list.push({
        id: bom.componentId || bom.bomId || bom.fgId,
        materialCode: bom.fgCode || "-",
        materialName: bom.componentName,
        itemType: bom.componentType || "BOM Component",
        currentUnit: bom.currentUnit,
        masterUnit: bom.masterUnit,
        fgName: bom.fgName || bom.productName,
        fgCode: bom.fgCode || bom.bomNumber,
        locationSource: bom.fgName ? `FG BOM: ${bom.fgName}` : `BOM #${bom.bomNumber || "-"}`,
        sourceType: "bom",
      });
    });

    (auditData.materialRequestMismatches || []).forEach((mr: any) => {
      list.push({
        id: mr.itemId || mr.requestId,
        materialCode: mr.materialCode,
        materialName: mr.materialName,
        itemType: mr.itemType || "Item",
        currentUnit: mr.currentUnit,
        masterUnit: mr.masterUnit,
        requestNumber: mr.requestNumber,
        locationSource: `MR #${mr.requestNumber || "-"}`,
        sourceType: "mr",
      });
    });

    return list;
  }, [auditData]);

  // Filter based on active tab and search query
  const filteredRecords = useMemo(() => {
    return allMismatches.filter((rec) => {
      if (activeTab !== "all" && rec.sourceType !== activeTab) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (rec.materialName || "").toLowerCase().includes(q);
        const codeMatch = (rec.materialCode || "").toLowerCase().includes(q);
        const sourceMatch = (rec.locationSource || "").toLowerCase().includes(q);
        const typeMatch = (rec.itemType || "").toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !sourceMatch && !typeMatch) {
          return false;
        }
      }
      return true;
    });
  }, [allMismatches, activeTab, searchQuery]);

  if (!isOpen || !mounted) return null;

  const totalDiscrepancies = auditData?.totalDiscrepancies || 0;
  const masterCount = auditData?.masterMismatchesCount || 0;
  const invCount = auditData?.inventoryMismatchesCount || 0;
  const bomCount = auditData?.bomMismatchesCount || 0;
  const mrCount = auditData?.materialRequestMismatchesCount || 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-white dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
              <RefreshCw size={20} className={loadingAudit ? "animate-spin" : ""} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Master UOM Synchronization & Health Check
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  <Sparkles size={11} /> Global Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically identifies and rectifies unit discrepancies across Master Catalog, Inventory, BOMs, and Material Requests.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAudit}
              disabled={loadingAudit || syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Re-run health check"
            >
              <RefreshCw size={13} className={loadingAudit ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Re-scan</span>
            </button>
            <button
              onClick={onClose}
              disabled={syncing}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Audit Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
            {/* Metric 1 */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Master Items</span>
                <Package size={14} className="text-indigo-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {loadingAudit ? "..." : (auditData?.totalMasters ?? "-")}
                </span>
                <span className="text-[10px] text-slate-500">RM, BO, FG</span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className={`p-3 border rounded-xl transition-all ${
              totalDiscrepancies > 0
                ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50"
                : "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
            }`}>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Discrepancies</span>
                {totalDiscrepancies > 0 ? (
                  <AlertTriangle size={14} className="text-amber-500" />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-xl sm:text-2xl font-black ${
                  totalDiscrepancies > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  {loadingAudit ? "..." : totalDiscrepancies}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  totalDiscrepancies > 0
                    ? "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                }`}>
                  {totalDiscrepancies > 0 ? "Needs Fix" : "Synchronized"}
                </span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Master Items</span>
                <Sparkles size={14} className="text-purple-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {loadingAudit ? "..." : masterCount}
                </span>
                <span className="text-[10px] text-slate-500">to fix</span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Inventory</span>
                <Layers size={14} className="text-blue-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {loadingAudit ? "..." : invCount}
                </span>
                <span className="text-[10px] text-slate-500">records</span>
              </div>
            </div>

            {/* Metric 5 */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">BOM / MR</span>
                <ClipboardList size={14} className="text-violet-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {loadingAudit ? "..." : (bomCount + mrCount)}
                </span>
                <span className="text-[10px] text-slate-500">lines</span>
              </div>
            </div>
          </div>

          {/* Action Callout Banner */}
          {totalDiscrepancies > 0 ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/5 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-xs shrink-0 mt-0.5">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    One-Click Master UOM Harmonization Available
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Clicking <strong>Correct All Places at Once</strong> will automatically update all {totalDiscrepancies} mismatched
                    records to align with their canonical master definitions across Inventory, BOMs, and Material Requests.
                  </p>
                </div>
              </div>

              <button
                onClick={handleExecuteSync}
                disabled={syncing || loadingAudit}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Synchronizing Records...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Correct All Places at Once</span>
                  </>
                )}
              </button>
            </div>
          ) : !loadingAudit ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold">All Master Units of Measure are 100% Synchronized</h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300/90 mt-0.5">
                  No desynchronizations detected. Inventory stock, attached BOM components, and active Material Requests currently match all canonical Master items.
                </p>
              </div>
            </div>
          ) : null}

          {/* Table Toolbar & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "all"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All Mismatches ({allMismatches.length})
              </button>
              <button
                onClick={() => setActiveTab("master")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "master"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Master Items ({masterCount})
              </button>
              <button
                onClick={() => setActiveTab("inventory")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "inventory"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Inventory ({invCount})
              </button>
              <button
                onClick={() => setActiveTab("bom")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "bom"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                BOM Components ({bomCount})
              </button>
              <button
                onClick={() => setActiveTab("mr")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "mr"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Material Requests ({mrCount})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search item, source, type..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Discrepancies Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xs z-10 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3.5">Item Name & Description</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3">Location / Source</th>
                    <th className="py-2.5 px-3 text-center">Current Unit</th>
                    <th className="py-2.5 px-3 text-center">Master Canonical</th>
                    <th className="py-2.5 px-3 text-center">Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingAudit ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw size={24} className="animate-spin text-indigo-600" />
                          <span className="font-semibold text-xs">Scanning all master dictionaries and modules...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <CheckCircle2 size={24} className="text-emerald-500" />
                          <span className="font-semibold text-xs text-slate-600 dark:text-slate-300">
                            {allMismatches.length === 0
                              ? "Zero discrepancies found! All modules are perfectly in sync."
                              : "No records match the active filter/search."}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((item, idx) => (
                      <tr
                        key={`${item.sourceType}-${item.id || idx}-${idx}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        {/* Item Name & Description (Strict Standard: Never show raw code as primary) */}
                        <td className="py-2.5 px-3.5 max-w-[260px]">
                          <ItemNameAndDescription
                            name={item.materialName || "Unnamed Item"}
                            description={item.description}
                          />
                        </td>

                        {/* Item Classification */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                            {item.itemType || "Raw Material"}
                          </span>
                        </td>

                        {/* Source Location */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            {item.locationSource}
                          </span>
                        </td>

                        {/* Current Mismatched Unit */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60">
                            {item.currentUnit || "—"}
                          </span>
                        </td>

                        {/* Master Unit */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/60">
                            {item.masterUnit}
                          </span>
                        </td>

                        {/* Visual Resolution Badge */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-900/60">
                            <span>{item.currentUnit || "—"}</span>
                            <ArrowRight size={11} className="text-indigo-500" />
                            <span className="font-black text-indigo-900 dark:text-white">{item.masterUnit}</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Info size={13} className="text-indigo-500" />
            <span>Harmonizes units without modifying physical quantity balances.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={syncing}
              className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>

            {totalDiscrepancies > 0 && (
              <button
                onClick={handleExecuteSync}
                disabled={syncing || loadingAudit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {syncing ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>Correct All ({totalDiscrepancies})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
