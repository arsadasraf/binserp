"use client";

import React, { useState, useRef } from "react";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Factory,
  Truck,
  ShieldCheck,
  Paperclip,
  UploadCloud,
  FileText,
  Plus,
  X,
  CheckCircle2,
  Clock,
  Layers,
  Settings,
  ExternalLink
} from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { useUploadRoutingAttachmentMutation } from "@/src/store/services/ppcService";

interface RoutingStepCardProps {
  step: any;
  index: number;
  totalSteps: number;
  processes: any[];
  machines: any[];
  workstations: any[];
  suppliers: any[];
  qualityMasters: any[];
  baseBom: any[];
  onUpdate: (index: number, updatedStep: any) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onOpenMedia: (url: string, title: string, type: "image" | "pdf") => void;
}

export default function RoutingStepCard({
  step,
  index,
  totalSteps,
  processes,
  machines,
  workstations,
  suppliers,
  qualityMasters,
  baseBom,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onOpenMedia,
}: RoutingStepCardProps) {
  const [activeSection, setActiveSection] = useState<"none" | "bom" | "files" | "qc">("none");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadAttachment] = useUploadRoutingAttachmentMutation();

  const isOutside = step.processType === "Outside" || step.isOutsourced === true;

  const handleFieldChange = (field: string, value: any) => {
    onUpdate(index, { ...step, [field]: value });
  };

  const handleProcessSelect = (processId: string) => {
    const selected = processes.find((p) => p._id === processId);
    onUpdate(index, {
      ...step,
      process: processId,
      processName: selected ? selected.processName : step.processName,
      stepName: step.stepName || (selected ? selected.processName : ""),
    });
  };

  const handleProcessTypeToggle = (type: "Inside" | "Outside") => {
    onUpdate(index, {
      ...step,
      processType: type,
      isOutsourced: type === "Outside",
    });
  };

  // --- Attachments Handling ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newPhotos = [...(step.photos || [])];
      const newDocs = [...(step.documents || [])];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);

        const res = await uploadAttachment(formData).unwrap();
        if (res && res.data) {
          const { url, name, fileType, size } = res.data;
          if (fileType === "pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            newDocs.push({ url, name: name || file.name, fileType: "pdf", size: size || file.size });
          } else {
            newPhotos.push({ url, name: name || file.name, caption: "" });
          }
        }
      }

      onUpdate(index, {
        ...step,
        photos: newPhotos,
        documents: newDocs,
      });
    } catch (err: any) {
      console.error("Failed to upload attachment", err);
      alert(err?.data?.message || err?.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (photoIdx: number) => {
    const updated = (step.photos || []).filter((_: any, i: number) => i !== photoIdx);
    onUpdate(index, { ...step, photos: updated });
  };

  const removeDocument = (docIdx: number) => {
    const updated = (step.documents || []).filter((_: any, i: number) => i !== docIdx);
    onUpdate(index, { ...step, documents: updated });
  };

  // --- BOM Allocation Handling ---
  const toggleBomItem = (bomItem: any) => {
    const reqs = [...(step.bomRequirements || [])];
    const itemId = bomItem.item?._id || bomItem.item;
    const existingIndex = reqs.findIndex((r: any) => (r.item?._id || r.item) === itemId);

    if (existingIndex >= 0) {
      reqs.splice(existingIndex, 1);
    } else {
      reqs.push({
        item: itemId,
        itemType: bomItem.itemType || "Material",
        itemName: bomItem.item?.name || bomItem.itemName || "Item",
        itemCode: bomItem.item?.code || bomItem.itemCode || "",
        quantity: bomItem.quantity || 1,
        unit: bomItem.unit || "Nos",
        scrapPercentage: 0,
        notes: "",
      });
    }
    onUpdate(index, { ...step, bomRequirements: reqs });
  };

  const updateBomRequirement = (reqIdx: number, field: string, value: any) => {
    const reqs = [...(step.bomRequirements || [])];
    reqs[reqIdx] = { ...reqs[reqIdx], [field]: value };
    onUpdate(index, { ...step, bomRequirements: reqs });
  };

  // --- Quality Control Handling ---
  const handleQualityMasterImport = (qmId: string) => {
    if (!qmId) return;
    const qm = qualityMasters.find((q) => q._id === qmId);
    if (!qm) return;

    const importedParams = (qm.parameters || []).map((p: any) => ({
      parameterName: p.name || "",
      specification: "",
      tolerance: p.tolerance || "",
      method: p.method || "",
      sampleSize: "100%",
      mandatory: p.mandatory !== false,
    }));

    onUpdate(index, {
      ...step,
      qcRequired: true,
      qualityMaster: qmId,
      inspectionParameters: importedParams,
    });
  };

  const addInspectionParameter = () => {
    const params = [
      ...(step.inspectionParameters || []),
      {
        parameterName: "",
        specification: "",
        tolerance: "",
        method: "",
        sampleSize: "100%",
        mandatory: true,
      },
    ];
    onUpdate(index, { ...step, inspectionParameters: params });
  };

  const updateInspectionParameter = (paramIdx: number, field: string, value: any) => {
    const params = [...(step.inspectionParameters || [])];
    params[paramIdx] = { ...params[paramIdx], [field]: value };
    onUpdate(index, { ...step, inspectionParameters: params });
  };

  const removeInspectionParameter = (paramIdx: number) => {
    const params = (step.inspectionParameters || []).filter((_: any, i: number) => i !== paramIdx);
    onUpdate(index, { ...step, inspectionParameters: params });
  };

  const allocatedBomCount = step.bomRequirements?.length || 0;
  const filesCount = (step.photos?.length || 0) + (step.documents?.length || 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-xs hover:border-gray-300 dark:hover:border-gray-700 transition-all overflow-hidden">
      {/* 1. COMPACT TOP HEADER */}
      <div className="px-4 py-3 bg-gray-50/70 dark:bg-gray-850/60 border-b border-gray-150 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Step Number, Reorder & Process Selection */}
        <div className="flex items-center gap-2.5 min-w-[280px] flex-1">
          <div className="flex items-center gap-1">
            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {index + 1}
            </span>
            <div className="flex flex-col">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMoveUp(index)}
                className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20"
                title="Move up"
              >
                <ChevronUp size={13} />
              </button>
              <button
                type="button"
                disabled={index === totalSteps - 1}
                onClick={() => onMoveDown(index)}
                className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20"
                title="Move down"
              >
                <ChevronDown size={13} />
              </button>
            </div>
          </div>

          <select
            value={typeof step.process === "object" ? step.process?._id : step.process}
            onChange={(e) => handleProcessSelect(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-250 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-indigo-500 shadow-2xs max-w-[240px]"
          >
            <option value="">Select Process...</option>
            {processes.map((p) => (
              <option key={p._id} value={p._id}>
                {p.processName} ({p.processCode})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Operation name / label"
            value={step.stepName || ""}
            onChange={(e) => handleFieldChange("stepName", e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-750 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 w-44 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Right: In/Out Toggle & Delete Action */}
        <div className="flex items-center gap-2">
          {/* Segmented Inside / Outside Switch */}
          <div className="flex bg-gray-200/70 dark:bg-gray-800 p-0.5 rounded-lg text-xs font-medium border border-gray-250/70 dark:border-gray-700">
            <button
              type="button"
              onClick={() => handleProcessTypeToggle("Inside")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                !isOutside
                  ? "bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-400 font-bold shadow-2xs"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <Factory size={13} />
              <span>In-House</span>
            </button>
            <button
              type="button"
              onClick={() => handleProcessTypeToggle("Outside")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                isOutside
                  ? "bg-amber-500 text-white font-bold shadow-2xs"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <Truck size={13} />
              <span>Job Work</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
            title="Delete step"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* 2. MAIN OPERATION PARAMETERS (COMPACT GRID) */}
      <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        {!isOutside ? (
          // In-House Parameters
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Machine
              </label>
              <select
                value={typeof step.machine === "object" ? step.machine?._id : (step.machine || "")}
                onChange={(e) => handleFieldChange("machine", e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Any Machine</option>
                {machines.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.machineName} ({m.machineCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Workstation
              </label>
              <select
                value={typeof step.workstation === "object" ? step.workstation?._id : (step.workstation || "")}
                onChange={(e) => handleFieldChange("workstation", e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Any Workstation</option>
                {workstations.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.workstationName || w.name} ({w.code || "WS"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Setup Time
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={step.setupTime || 0}
                  onChange={(e) => handleFieldChange("setupTime", Number(e.target.value))}
                  className="w-full pl-2.5 pr-8 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-100 font-semibold"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                  min
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Cycle Time
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={step.cycleTime || 0}
                  onChange={(e) => handleFieldChange("cycleTime", Number(e.target.value))}
                  className="w-full pl-2.5 pr-8 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-100 font-semibold"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                  min/pc
                </span>
              </div>
            </div>
          </div>
        ) : (
          // Outside (Job Work) Parameters
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Job Work Vendor
              </label>
              <select
                value={typeof step.supplier === "object" ? step.supplier?._id : (step.supplier || "")}
                onChange={(e) => {
                  const sel = suppliers.find((s) => s._id === e.target.value);
                  onUpdate(index, {
                    ...step,
                    supplier: e.target.value,
                    supplierName: sel ? sel.name : "",
                  });
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Select Vendor...</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.code || "Vendor"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Lead Time
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={step.leadTimeDays || 1}
                  onChange={(e) => handleFieldChange("leadTimeDays", Number(e.target.value))}
                  className="w-full pl-2.5 pr-10 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-100 font-semibold"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                  days
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Job Work Rate
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={step.jobWorkRate || 0}
                  onChange={(e) => handleFieldChange("jobWorkRate", Number(e.target.value))}
                  className="w-full pl-2.5 pr-10 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-100 font-semibold"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                  ₹/pc
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. SMART EXPANDABLE CHIPS (BOM, FILES, QC) */}
      <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-850/40 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* BOM Toggle Pill */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === "bom" ? "none" : "bom")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
              activeSection === "bom"
                ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-2xs"
                : allocatedBomCount > 0
                ? "bg-white dark:bg-gray-800 border-indigo-200 text-indigo-600 dark:border-indigo-800"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-750 text-gray-500 hover:text-gray-700"
            }`}
          >
            <Layers size={13} />
            <span>BOM Materials</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${allocatedBomCount > 0 ? "bg-indigo-600 text-white font-bold" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>
              {allocatedBomCount}
            </span>
          </button>

          {/* Files Toggle Pill */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === "files" ? "none" : "files")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
              activeSection === "files"
                ? "bg-purple-50 border-purple-300 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 shadow-2xs"
                : filesCount > 0
                ? "bg-white dark:bg-gray-800 border-purple-200 text-purple-600 dark:border-purple-800"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-750 text-gray-500 hover:text-gray-700"
            }`}
          >
            <Paperclip size={13} />
            <span>Drawings & Photos</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filesCount > 0 ? "bg-purple-600 text-white font-bold" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>
              {filesCount}
            </span>
          </button>

          {/* QC Toggle Pill */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === "qc" ? "none" : "qc")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
              activeSection === "qc"
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-2xs"
                : step.qcRequired
                ? "bg-emerald-50/60 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-750 text-gray-500 hover:text-gray-700"
            }`}
          >
            <ShieldCheck size={13} />
            <span>Quality Control</span>
            {step.qcRequired && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>
        </div>

        {/* Quick Operator Note input */}
        <input
          type="text"
          placeholder="Operator notes (optional)"
          value={step.description || (isOutside ? step.outsideInstructions : "") || ""}
          onChange={(e) => {
            handleFieldChange("description", e.target.value);
            if (isOutside) handleFieldChange("outsideInstructions", e.target.value);
          }}
          className="px-2.5 py-1 text-xs border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-gray-300 rounded-lg bg-transparent text-gray-700 dark:text-gray-300 w-48 sm:w-64 truncate text-right focus:text-left focus:bg-white dark:focus:bg-gray-900 transition-all"
        />
      </div>

      {/* 4. ACTIVE EXPANDED DRAWER */}
      {activeSection !== "none" && (
        <div className="p-4 bg-gray-50/40 dark:bg-gray-900/40 border-t border-gray-150 dark:border-gray-800 animate-in fade-in duration-150">
          {/* SECTION A: BOM ALLOCATION */}
          {activeSection === "bom" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-500 font-medium mr-1">Assign Material:</span>
                {baseBom.length === 0 ? (
                  <span className="text-xs text-gray-400">No items in Base BOM.</span>
                ) : (
                  baseBom.map((b, bIdx) => {
                    const itemId = b.item?._id || b.item;
                    const isAllocated = step.bomRequirements?.some(
                      (r: any) => (r.item?._id || r.item) === itemId
                    );

                    return (
                      <button
                        key={bIdx}
                        type="button"
                        onClick={() => toggleBomItem(b)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all flex items-center gap-1 ${
                          isAllocated
                            ? "bg-indigo-600 text-white border-indigo-600 font-semibold shadow-2xs"
                            : "bg-white dark:bg-gray-800 border-gray-250 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300"
                        }`}
                      >
                        {isAllocated ? <CheckCircle2 size={12} /> : <Plus size={12} />}
                        <span>{b.item?.name || b.itemName}</span>
                      </button>
                    );
                  })
                )}
              </div>

              {allocatedBomCount > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {step.bomRequirements.map((req: any, reqIdx: number) => (
                    <div
                      key={reqIdx}
                      className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {req.itemName}
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0.01"
                          step="0.1"
                          value={req.quantity}
                          onChange={(e) =>
                            updateBomRequirement(reqIdx, "quantity", Number(e.target.value))
                          }
                          className="w-14 px-1.5 py-0.5 text-xs text-center border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 font-bold"
                        />
                        <span className="text-[11px] text-gray-400">{req.unit || "Nos"}</span>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = step.bomRequirements.filter(
                              (_: any, i: number) => i !== reqIdx
                            );
                            onUpdate(index, { ...step, bomRequirements: updated });
                          }}
                          className="p-1 text-gray-300 hover:text-red-500 ml-1"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION B: DRAWINGS & PHOTOS */}
          {activeSection === "files" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">
                  Process Drawings, SOPs, and Tooling Photos:
                </span>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isUploading ? <LoadingSpinner size="sm" /> : <UploadCloud size={13} />}
                    <span>{isUploading ? "Uploading..." : "+ Upload File"}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {/* Photos */}
                {(step.photos || []).map((photo: any, pIdx: number) => (
                  <div
                    key={pIdx}
                    className="group relative rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 shadow-2xs w-20 h-20"
                  >
                    <img
                      src={photo.url}
                      alt={photo.name || "Photo"}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() =>
                        onOpenMedia(photo.url, photo.name || `Step ${index + 1} Photo`, "image")
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(pIdx)}
                      className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}

                {/* PDF Documents */}
                {(step.documents || []).map((doc: any, dIdx: number) => (
                  <div
                    key={dIdx}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xs"
                  >
                    <FileText size={15} className="text-rose-500 shrink-0" />
                    <span
                      onClick={() =>
                        onOpenMedia(doc.url, doc.name || `Step ${index + 1} PDF`, "pdf")
                      }
                      className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 truncate max-w-[140px] cursor-pointer"
                      title={doc.name}
                    >
                      {doc.name || "Drawing.pdf"}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDocument(dIdx)}
                      className="text-gray-400 hover:text-red-500 p-0.5"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}

                {filesCount === 0 && (
                  <span className="text-xs text-gray-400 py-1">No files attached to this step.</span>
                )}
              </div>
            </div>
          )}

          {/* SECTION C: QUALITY CONTROL */}
          {activeSection === "qc" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(step.qcRequired)}
                      onChange={(e) => handleFieldChange("qcRequired", e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {step.qcRequired ? "QC Inspection Active" : "QC Inspection Inactive"}
                  </span>
                </div>

                {step.qcRequired && (
                  <div className="flex items-center gap-2">
                    <select
                      value={step.qcStage || "In-Process"}
                      onChange={(e) => handleFieldChange("qcStage", e.target.value)}
                      className="px-2.5 py-1 text-xs font-semibold border border-gray-250 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                    >
                      <option value="In-Process">In-Process</option>
                      <option value="First-Piece">First-Piece (FAI)</option>
                      <option value="Stage-Gate">Stage-Gate Hold</option>
                      <option value="Final">Final QC</option>
                    </select>

                    <select
                      value={typeof step.qualityMaster === "object" ? step.qualityMaster?._id : (step.qualityMaster || "")}
                      onChange={(e) => handleQualityMasterImport(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-gray-250 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 max-w-[160px]"
                    >
                      <option value="">Import Template...</option>
                      {qualityMasters.map((qm) => (
                        <option key={qm._id} value={qm._id}>
                          {qm.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={addInspectionParameter}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-lg flex items-center gap-1 border border-emerald-200 dark:border-emerald-800"
                    >
                      <Plus size={12} /> Add Parameter
                    </button>
                  </div>
                )}
              </div>

              {step.qcRequired && (
                <div className="space-y-1.5">
                  {(step.inspectionParameters || []).length === 0 ? (
                    <p className="text-xs text-gray-400 py-1">
                      No parameters. Click "+ Add Parameter" or import a Quality Master template.
                    </p>
                  ) : (
                    step.inspectionParameters.map((param: any, pIdx: number) => (
                      <div
                        key={pIdx}
                        className="grid grid-cols-12 items-center gap-1.5 bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs"
                      >
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Parameter (e.g. OD)"
                            value={param.parameterName || ""}
                            onChange={(e) =>
                              updateInspectionParameter(pIdx, "parameterName", e.target.value)
                            }
                            className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 font-semibold"
                          />
                        </div>

                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="Spec (25.0)"
                            value={param.specification || ""}
                            onChange={(e) =>
                              updateInspectionParameter(pIdx, "specification", e.target.value)
                            }
                            className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900"
                          />
                        </div>

                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="Tolerance (±0.05)"
                            value={param.tolerance || ""}
                            onChange={(e) =>
                              updateInspectionParameter(pIdx, "tolerance", e.target.value)
                            }
                            className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900"
                          />
                        </div>

                        <div className="col-span-3">
                          <input
                            type="text"
                            placeholder="Instrument (Vernier)"
                            value={param.method || ""}
                            onChange={(e) =>
                              updateInspectionParameter(pIdx, "method", e.target.value)
                            }
                            className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900"
                          />
                        </div>

                        <div className="col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeInspectionParameter(pIdx)}
                            className="text-gray-400 hover:text-red-500 p-1"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
