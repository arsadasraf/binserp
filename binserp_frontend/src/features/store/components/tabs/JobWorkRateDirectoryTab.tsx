"use client";

import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Building2,
  Wrench,
  IndianRupee,
  Phone,
  Mail,
  MapPin,
  FileText,
  UserCheck,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Filter,
} from "lucide-react";
import SearchableSelect, { SearchableOption } from "../SearchableSelect";
import { apiPost, apiPut, apiDelete } from "@/src/lib/api";
import { matchesAnyField } from "@/src/utils/spaceFreeSearchHelper";

export interface UnifiedVendorOption {
  id: string;
  source: "Vendor" | "JobWorkSupplier";
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  gst: string;
  address: string;
}

export interface JobWorkRateEntry {
  _id: string;
  componentName: string;
  description?: string;
  processName: string;
  rate: number;
  unit: string;
  vendorId?: string;
  vendorSource?: "Vendor" | "JobWorkSupplier";
  vendorName: string;
  vendorContactPerson?: string;
  vendorPhone?: string;
  vendorEmail?: string;
  vendorGst?: string;
  vendorAddress?: string;
  remarks?: string;
  createdBy?: { _id?: string; name?: string; email?: string; username?: string };
  createdByName?: string;
  createdByDisplay?: string;
  updatedBy?: { _id?: string; name?: string; email?: string; username?: string };
  updatedByName?: string;
  updatedByDisplay?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface JobWorkRateDirectoryTabProps {
  entries: JobWorkRateEntry[];
  vendors: UnifiedVendorOption[];
  loading: boolean;
  token: string;
  onRefresh: () => void;
}

const STANDARD_UNITS = ["PCS", "NOS", "KG", "SET", "MTR", "SQ.FT", "SQ.MTR", "HOUR", "LOT", "LTR"];

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function JobWorkRateDirectoryTab({
  entries,
  vendors,
  loading,
  token,
  onRefresh,
}: JobWorkRateDirectoryTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [processFilter, setProcessFilter] = useState("all");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JobWorkRateEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form state
  const [componentName, setComponentName] = useState("");
  const [description, setDescription] = useState("");
  const [processName, setProcessName] = useState("");
  const [rate, setRate] = useState("");
  const [unit, setUnit] = useState("PCS");
  const [customUnit, setCustomUnit] = useState("");
  const [selectedVendorKey, setSelectedVendorKey] = useState("");
  const [remarks, setRemarks] = useState("");

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  // Vendor options for SearchableSelect (combining Vendor Master + Job Work Suppliers)
  const vendorSelectOptions: SearchableOption[] = useMemo(() => {
    return vendors.map((v) => {
      const subDetails = [v.phone, v.gst ? `GST: ${v.gst}` : "", v.address]
        .filter(Boolean)
        .join(" • ");
      return {
        value: `${v.source}:${v.id}`,
        label: v.name,
        description: subDetails || (v.contactPerson ? `Contact: ${v.contactPerson}` : undefined),
        badge: v.source === "JobWorkSupplier" ? "JW Supplier" : "Vendor",
      };
    });
  }, [vendors]);

  const selectedVendorObj = useMemo(() => {
    if (!selectedVendorKey) return null;
    return vendors.find((v) => `${v.source}:${v.id}` === selectedVendorKey) || null;
  }, [vendors, selectedVendorKey]);

  // Unique processes & vendors for quick filter dropdowns + datalist suggestions
  const uniqueProcesses = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.processName?.trim()) set.add(e.processName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const uniqueVendorNames = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.vendorName?.trim()) set.add(e.vendorName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  // Filtered entries using space-free multi-keyword search
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (vendorFilter !== "all" && entry.vendorName !== vendorFilter) return false;
      if (processFilter !== "all" && entry.processName !== processFilter) return false;
      if (searchTerm.trim()) {
        return matchesAnyField(
          entry,
          [
            "componentName",
            "description",
            "processName",
            "vendorName",
            "vendorPhone",
            "vendorGst",
            "vendorContactPerson",
            "unit",
            "remarks",
            "createdByDisplay",
            "updatedByDisplay",
          ],
          searchTerm
        );
      }
      return true;
    });
  }, [entries, vendorFilter, processFilter, searchTerm]);

  const resetForm = () => {
    setComponentName("");
    setDescription("");
    setProcessName("");
    setRate("");
    setUnit("PCS");
    setCustomUnit("");
    setSelectedVendorKey("");
    setRemarks("");
    setEditingEntry(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entry: JobWorkRateEntry) => {
    setEditingEntry(entry);
    setComponentName(entry.componentName || "");
    setDescription(entry.description || "");
    setProcessName(entry.processName || "");
    setRate(entry.rate !== undefined && entry.rate !== null ? String(entry.rate) : "");
    const entryUnit = (entry.unit || "PCS").toUpperCase();
    if (STANDARD_UNITS.includes(entryUnit)) {
      setUnit(entryUnit);
      setCustomUnit("");
    } else {
      setUnit("CUSTOM");
      setCustomUnit(entry.unit || "");
    }

    // Match vendor from master list
    const matchedVendor =
      vendors.find(
        (v) =>
          entry.vendorId &&
          v.id === String(entry.vendorId) &&
          (!entry.vendorSource || v.source === entry.vendorSource)
      ) ||
      vendors.find((v) => v.name.toLowerCase() === (entry.vendorName || "").toLowerCase());

    setSelectedVendorKey(matchedVendor ? `${matchedVendor.source}:${matchedVendor.id}` : "");
    setRemarks(entry.remarks || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalUnit = unit === "CUSTOM" ? customUnit.trim() : unit;
    if (!componentName.trim()) {
      showToast("error", "Component Name is required.");
      return;
    }
    if (!processName.trim()) {
      showToast("error", "Process Name is required.");
      return;
    }
    if (rate === "" || isNaN(Number(rate)) || Number(rate) < 0) {
      showToast("error", "Please enter a valid non-negative Rate.");
      return;
    }
    if (!finalUnit) {
      showToast("error", "Please specify a valid Unit.");
      return;
    }

    const vendorNameToSave = selectedVendorObj?.name || editingEntry?.vendorName || "";
    if (!vendorNameToSave.trim()) {
      showToast("error", "Please select a Vendor from the master list.");
      return;
    }

    const payload = {
      componentName: componentName.trim(),
      description: description.trim(),
      processName: processName.trim(),
      rate: Number(rate),
      unit: finalUnit,
      vendorId: selectedVendorObj?.id || editingEntry?.vendorId || undefined,
      vendorSource: selectedVendorObj?.source || editingEntry?.vendorSource || "Vendor",
      vendorName: vendorNameToSave.trim(),
      vendorContactPerson:
        selectedVendorObj?.contactPerson ?? editingEntry?.vendorContactPerson ?? "",
      vendorPhone: selectedVendorObj?.phone ?? editingEntry?.vendorPhone ?? "",
      vendorEmail: selectedVendorObj?.email ?? editingEntry?.vendorEmail ?? "",
      vendorGst: selectedVendorObj?.gst ?? editingEntry?.vendorGst ?? "",
      vendorAddress: selectedVendorObj?.address ?? editingEntry?.vendorAddress ?? "",
      remarks: remarks.trim(),
    };

    setSubmitting(true);
    try {
      if (editingEntry?._id) {
        await apiPut(`/api/store/job-work/rate-directory/${editingEntry._id}`, payload, token);
        showToast("success", "Job work rate entry updated successfully.");
      } else {
        await apiPost("/api/store/job-work/rate-directory", payload, token);
        showToast("success", "Job work rate entry saved to directory.");
      }
      setIsModalOpen(false);
      resetForm();
      onRefresh();
    } catch (err: any) {
      showToast("error", err?.message || "Failed to save rate directory entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: JobWorkRateEntry) => {
    const confirmed = window.confirm(
      `Delete rate entry for "${entry.componentName}" (${entry.processName} — ${entry.vendorName})?`
    );
    if (!confirmed) return;

    setDeletingId(entry._id);
    try {
      await apiDelete(`/api/store/job-work/rate-directory/${entry._id}`, token);
      showToast("success", "Rate directory entry deleted.");
      onRefresh();
    } catch (err: any) {
      showToast("error", err?.message || "Failed to delete rate entry.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[70] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-200 ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/90 dark:border-rose-800 dark:text-rose-200"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Compact Search, Filter & Action Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-2xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search component, description, process, vendor, phone, GST, remarks..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2">
              <Filter size={13} className="text-slate-400 shrink-0" />
              <select
                value={processFilter}
                onChange={(e) => setProcessFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Processes</option>
                {uniqueProcesses.map((proc) => (
                  <option key={proc} value={proc}>
                    {proc}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2">
              <Building2 size={13} className="text-slate-400 shrink-0" />
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[180px]"
              >
                <option value="all">All Vendors</option>
                {uniqueVendorNames.map((vName) => (
                  <option key={vName} value={vName}>
                    {vName}
                  </option>
                ))}
              </select>
            </div>

            {(searchTerm || vendorFilter !== "all" || processFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setVendorFilter("all");
                  setProcessFilter("all");
                }}
                className="px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95 shrink-0"
              title="Refresh Directory"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-md shadow-indigo-500/25 transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus size={15} />
              <span>Add Rate Entry</span>
            </button>
          </div>
        </div>
      </div>

      {/* Directory Table / Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs sm:text-sm font-medium flex flex-col items-center gap-2">
            <RefreshCw size={22} className="animate-spin text-indigo-600" />
            <span>Loading Job Work Rate Directory...</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <BookOpen size={22} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {entries.length === 0
                ? "No Job Work Rates Recorded Yet"
                : "No Matching Entries Found"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {entries.length === 0
                ? "Add component names, descriptions, job work processes, rates with units, and vendor details to build your quick reference rate directory."
                : "Try adjusting your search keywords or vendor/process filters."}
            </p>
            {entries.length === 0 && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                <span>Add First Rate Entry</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3 min-w-[260px]">Component &amp; Description</th>
                    <th className="px-4 py-3 min-w-[160px]">Process</th>
                    <th className="px-4 py-3 min-w-[130px] text-right">Rate / Unit</th>
                    <th className="px-4 py-3 min-w-[230px]">Vendor Details</th>
                    <th className="px-4 py-3 min-w-[210px]">Created &amp; Updated By</th>
                    <th className="px-4 py-3 w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {filteredEntries.map((entry, idx) => {
                    const createdByLabel =
                      entry.createdByDisplay ||
                      entry.createdBy?.name ||
                      entry.createdByName ||
                      "System User";
                    const updatedByLabel =
                      entry.updatedByDisplay ||
                      entry.updatedBy?.name ||
                      entry.updatedByName ||
                      createdByLabel;
                    const wasUpdated =
                      entry.updatedAt &&
                      entry.createdAt &&
                      Math.abs(
                        new Date(entry.updatedAt).getTime() - new Date(entry.createdAt).getTime()
                      ) > 2000;

                    return (
                      <tr
                        key={entry._id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 text-center font-mono text-slate-400 font-semibold align-top">
                          {idx + 1}
                        </td>

                        {/* Component Name & Technical Description (Rule 1 Compliant) */}
                        <td className="px-4 py-3 align-top max-w-[320px]">
                          <div
                            className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate"
                            title={entry.componentName}
                          >
                            {entry.componentName}
                          </div>
                          {entry.description ? (
                            <div
                              className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2"
                              title={entry.description}
                            >
                              {entry.description}
                            </div>
                          ) : (
                            <div className="text-[10.5px] text-slate-400 italic mt-0.5">
                              No description provided
                            </div>
                          )}
                          {entry.remarks && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/70 dark:border-amber-800/60">
                              <FileText size={10} />
                              <span className="line-clamp-1">{entry.remarks}</span>
                            </div>
                          )}
                        </td>

                        {/* Process */}
                        <td className="px-4 py-3 align-top">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 font-bold text-xs">
                            <Wrench size={12} />
                            <span>{entry.processName}</span>
                          </span>
                        </td>

                        {/* Rate / Unit */}
                        <td className="px-4 py-3 align-top text-right">
                          <div className="inline-flex items-baseline gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60">
                            <span className="font-mono font-black text-sm text-emerald-800 dark:text-emerald-300">
                              ₹{Number(entry.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                              / {entry.unit || "PCS"}
                            </span>
                          </div>
                        </td>

                        {/* Vendor Details */}
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {entry.vendorName}
                            </span>
                            {entry.vendorSource === "JobWorkSupplier" && (
                              <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                JW
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {entry.vendorContactPerson && (
                              <div className="font-medium text-slate-600 dark:text-slate-300">
                                {entry.vendorContactPerson}
                              </div>
                            )}
                            {entry.vendorPhone && (
                              <div className="flex items-center gap-1 font-mono">
                                <Phone size={10} className="text-slate-400" />
                                <span>{entry.vendorPhone}</span>
                              </div>
                            )}
                            {entry.vendorGst && (
                              <div className="font-mono text-[10px] text-slate-500">
                                GST: {entry.vendorGst}
                              </div>
                            )}
                            {entry.vendorAddress && (
                              <div
                                className="flex items-start gap-1 text-[10.5px] text-slate-400 line-clamp-1"
                                title={entry.vendorAddress}
                              >
                                <MapPin size={10} className="mt-0.5 shrink-0" />
                                <span className="truncate">{entry.vendorAddress}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Audit Trail: Created & Updated */}
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-1.5 text-[11px]">
                            <div className="flex items-start gap-1.5">
                              <UserCheck size={12} className="text-emerald-600 mt-0.5 shrink-0" />
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">
                                  Created:
                                </span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                  {createdByLabel}
                                </span>
                                <div className="text-[10px] font-mono text-slate-400">
                                  {formatDateTime(entry.createdAt)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Clock
                                size={12}
                                className={
                                  wasUpdated
                                    ? "text-amber-600 mt-0.5 shrink-0"
                                    : "text-slate-400 mt-0.5 shrink-0"
                                }
                              />
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">
                                  Updated:
                                </span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                  {updatedByLabel}
                                </span>
                                <div className="text-[10px] font-mono text-slate-400">
                                  {formatDateTime(entry.updatedAt)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 align-top text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(entry)}
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-transparent hover:border-indigo-200 transition-colors cursor-pointer"
                              title="Edit Rate Entry"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry)}
                              disabled={deletingId === entry._id}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                              title="Delete Rate Entry"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Card View */}
            <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredEntries.map((entry) => {
                const createdByLabel =
                  entry.createdByDisplay ||
                  entry.createdBy?.name ||
                  entry.createdByName ||
                  "System User";
                const updatedByLabel =
                  entry.updatedByDisplay ||
                  entry.updatedBy?.name ||
                  entry.updatedByName ||
                  createdByLabel;

                return (
                  <div key={entry._id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {entry.componentName}
                        </div>
                        {entry.description && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                            {entry.description}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 font-mono font-black text-xs text-emerald-800">
                        ₹{Number(entry.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })} / {entry.unit}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px]">
                        <Wrench size={11} />
                        {entry.processName}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        <Building2 size={11} />
                        {entry.vendorName}
                      </span>
                      {entry.vendorPhone && (
                        <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                          <Phone size={10} /> {entry.vendorPhone}
                        </span>
                      )}
                    </div>

                    {entry.remarks && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/70">
                        {entry.remarks}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[10.5px] text-slate-500">
                      <div className="space-y-0.5">
                        <div>
                          <span className="font-semibold">Created:</span> {createdByLabel} (
                          {formatDateTime(entry.createdAt)})
                        </div>
                        <div>
                          <span className="font-semibold">Updated:</span> {updatedByLabel} (
                          {formatDateTime(entry.updatedAt)})
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(entry)}
                          className="p-2 rounded-lg bg-indigo-50 text-indigo-700 cursor-pointer"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry)}
                          disabled={deletingId === entry._id}
                          className="p-2 rounded-lg bg-rose-50 text-rose-700 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Modal (Rule 8 — Modern Card Glassmorphism) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 dark:from-slate-800/80 dark:to-slate-800/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25 shrink-0">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    {editingEntry ? "Edit Job Work Rate Entry" : "Add Job Work Rate Entry"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Standalone directory record — no link to item masters, part numbers, or BOM
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {/* Section 1: Component & Process */}
                <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-700/60 shadow-2xs space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-indigo-600 rounded-full shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Component &amp; Process Details
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Component Name <span className="text-rose-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={componentName}
                        onChange={(e) => setComponentName(e.target.value)}
                        placeholder="e.g. Shaft Coupling, Mounting Bracket..."
                        className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Job Work Process <span className="text-rose-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        list="jw-process-suggestions"
                        value={processName}
                        onChange={(e) => setProcessName(e.target.value)}
                        placeholder="e.g. CNC Turning, Heat Treatment, Plating..."
                        className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-2xs"
                      />
                      <datalist id="jw-process-suggestions">
                        {uniqueProcesses.map((proc) => (
                          <option key={proc} value={proc} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Technical Description
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter material grade, dimensions, tolerance, or process specification..."
                      className="w-full px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-2xs resize-none"
                    />
                  </div>
                </div>

                {/* Section 2: Rate & Unit */}
                <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-700/60 shadow-2xs space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-emerald-600 rounded-full shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Process Rate &amp; Unit
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Job Work Rate (₹) <span className="text-rose-500 ml-0.5">*</span>
                      </label>
                      <div className="relative">
                        <IndianRupee
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          value={rate}
                          onChange={(e) => setRate(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-2xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Rate Unit <span className="text-rose-500 ml-0.5">*</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-2xs"
                        >
                          {STANDARD_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                          <option value="CUSTOM">Custom Unit...</option>
                        </select>
                        {unit === "CUSTOM" && (
                          <input
                            type="text"
                            required
                            value={customUnit}
                            onChange={(e) => setCustomUnit(e.target.value)}
                            placeholder="Unit"
                            className="w-28 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Vendor Details (Fetched from Master) */}
                <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-700/60 shadow-2xs space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-blue-600 rounded-full shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Vendor Details (From Master)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Select Vendor / Job Work Supplier{" "}
                      <span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <SearchableSelect
                      options={vendorSelectOptions}
                      value={selectedVendorKey}
                      onChange={(val) => setSelectedVendorKey(val)}
                      displayLabel={selectedVendorObj?.name || editingEntry?.vendorName || undefined}
                      placeholder="Search Vendor Master or Job Work Supplier..."
                    />
                  </div>

                  {(selectedVendorObj || editingEntry?.vendorName) && (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Building2 size={13} className="text-indigo-500 shrink-0" />
                        <span className="font-bold truncate">
                          {selectedVendorObj?.name || editingEntry?.vendorName}
                        </span>
                      </div>
                      {(selectedVendorObj?.phone || editingEntry?.vendorPhone) && (
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-mono">
                          <Phone size={12} className="text-slate-400 shrink-0" />
                          <span>{selectedVendorObj?.phone || editingEntry?.vendorPhone}</span>
                        </div>
                      )}
                      {(selectedVendorObj?.email || editingEntry?.vendorEmail) && (
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 truncate">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">
                            {selectedVendorObj?.email || editingEntry?.vendorEmail}
                          </span>
                        </div>
                      )}
                      {(selectedVendorObj?.gst || editingEntry?.vendorGst) && (
                        <div className="text-[11px] font-mono text-slate-500">
                          GST: {selectedVendorObj?.gst || editingEntry?.vendorGst}
                        </div>
                      )}
                      {(selectedVendorObj?.address || editingEntry?.vendorAddress) && (
                        <div className="sm:col-span-2 flex items-start gap-2 text-[11px] text-slate-500">
                          <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                          <span>{selectedVendorObj?.address || editingEntry?.vendorAddress}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 4: Remarks */}
                <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-700/60 shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-slate-500 rounded-full shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Additional Remarks (Optional)
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Lead time 3 days, min batch qty 50 pcs, transport extra..."
                    className="w-full px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-2xs resize-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-4.5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-xl shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/35 transition-all cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {submitting
                      ? "Saving..."
                      : editingEntry
                      ? "Update Rate Entry"
                      : "Save to Directory"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
