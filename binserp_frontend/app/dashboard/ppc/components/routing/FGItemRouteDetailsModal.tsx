"use client";

import React, { useState } from "react";
import {
  X,
  Download,
  Edit,
  Package,
  Factory,
  Truck,
  ShieldCheck,
  Paperclip,
  Clock,
  FileText,
  ExternalLink,
  Layers,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { generateProcessRoutePDF } from "@/src/utils/generateProcessRoutePDF";
import RoutingMediaModal from "./RoutingMediaModal";

interface FGItemRouteDetailsModalProps {
  item: any;
  onClose: () => void;
  onEdit: () => void;
}

export default function FGItemRouteDetailsModal({
  item,
  onClose,
  onEdit,
}: FGItemRouteDetailsModalProps) {
  const routing = item.ppcProduct?.routing || [];
  const bom = item.bom || [];

  const [mediaPreview, setMediaPreview] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    type: "image" | "pdf";
  }>({
    isOpen: false,
    url: "",
    title: "",
    type: "image",
  });

  const inHouseSteps = routing.filter((r: any) => r.processType !== "Outside" && !r.isOutsourced);
  const outsideSteps = routing.filter((r: any) => r.processType === "Outside" || r.isOutsourced);
  const totalCycleTime = routing.reduce((acc: number, r: any) => acc + (Number(r.cycleTime) || 0), 0);
  const totalSetupTime = routing.reduce((acc: number, r: any) => acc + (Number(r.setupTime) || 0), 0);
  const qcSteps = routing.filter((r: any) => r.qcRequired);

  const handleDownloadPDF = () => {
    generateProcessRoutePDF({ item });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-gray-150 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Package size={20} />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
                  {item.name}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                  {item.type || "Component"}
                </span>
                {item.code && (
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-200/80 dark:bg-gray-800 text-gray-700 dark:text-gray-300 shrink-0">
                    {item.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Process Route Sheet & Quality Specifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-3.5 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center gap-1.5 shadow-2xs transition-all"
              title="Download Process Route Sheet as PDF"
            >
              <Download size={14} className="text-indigo-600" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Edit size={14} />
              <span>Edit Routing</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-150 dark:hover:bg-gray-800 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="px-6 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 text-xs font-medium text-gray-600 dark:text-gray-400 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-gray-900 dark:text-white">{routing.length}</span> Steps
            <span>({inHouseSteps.length} In-House • {outsideSteps.length} Outside)</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Clock size={13} className="text-blue-500" />
            <span>{totalCycleTime.toFixed(1)}m Cycle Time</span>
          </div>
          {totalSetupTime > 0 && (
            <>
              <span>•</span>
              <div>Setup: {totalSetupTime}m</div>
            </>
          )}
          <span>•</span>
          <div className="flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-500" />
            <span>{qcSteps.length} QC Inspection Gates</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Layers size={13} className="text-amber-500" />
            <span>{bom.length} BOM Materials</span>
          </div>
        </div>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-gray-50/40 dark:bg-gray-950/40">
          {/* 1. ROUTING STEPS TIMELINE */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Process Route Sequence
            </h3>

            {routing.length === 0 ? (
              <div className="p-8 border border-dashed rounded-xl text-center text-xs text-gray-400 bg-white dark:bg-gray-900">
                No manufacturing routing attached yet. Click "Edit Routing" to create the process sheet.
              </div>
            ) : (
              <div className="space-y-3">
                {routing.map((step: any, idx: number) => {
                  const isOut = step.processType === "Outside" || step.isOutsourced;
                  const pName = step.processName || step.process?.processName || step.stepName || "Process";
                  const wsName = step.workstation?.workstationName || step.workstation?.name;
                  const mName = step.machine?.machineName || step.machine?.name;
                  const sName = step.supplier?.name || step.supplierName;
                  const stepDocs = step.documents || [];
                  const stepPhotos = step.photos || [];

                  return (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 p-4 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {pName}
                          </span>
                          {step.stepName && step.stepName !== pName && (
                            <span className="text-xs text-gray-500 font-medium">
                              ({step.stepName})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                              isOut
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                            }`}
                          >
                            {isOut ? <Truck size={12} /> : <Factory size={12} />}
                            <span>{isOut ? "Job Work (Outside)" : "In-House"}</span>
                          </span>

                          {step.qcRequired && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                              <ShieldCheck size={12} />
                              <span>QC {step.qcStage || "In-Proc"}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {!isOut ? (
                          <>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Machine:</span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {mName || "Any Machine"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Workstation:</span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {wsName || "Shop Floor"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Setup Time:</span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {step.setupTime || 0} mins
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Cycle Time:</span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {step.cycleTime || 0} mins/pc
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="sm:col-span-2">
                              <span className="text-gray-400 block text-[10px]">Vendor:</span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {sName || "Subcontracted"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Lead Time:</span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {step.leadTimeDays || 1} days
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Rate:</span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                ₹{step.jobWorkRate || 0}/pc
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Allocated materials & attachments */}
                      {(step.bomRequirements?.length > 0 || stepDocs.length > 0 || stepPhotos.length > 0) && (
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                          {step.bomRequirements?.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-gray-400 font-medium">BOM:</span>
                              {step.bomRequirements.map((req: any, rIdx: number) => (
                                <span
                                  key={rIdx}
                                  className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[11px] font-medium"
                                >
                                  {req.itemName} ({req.quantity} {req.unit || "Nos"})
                                </span>
                              ))}
                            </div>
                          )}

                          {stepDocs.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              {stepDocs.map((doc: any, dIdx: number) => (
                                <button
                                  key={dIdx}
                                  type="button"
                                  onClick={() =>
                                    setMediaPreview({
                                      isOpen: true,
                                      url: doc.url,
                                      title: doc.name || "Drawing.pdf",
                                      type: "pdf",
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded text-[11px] hover:underline"
                                >
                                  <FileText size={12} />
                                  <span className="truncate max-w-[120px]">{doc.name || "Drawing"}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {stepPhotos.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              {stepPhotos.map((photo: any, pIdx: number) => (
                                <img
                                  key={pIdx}
                                  src={photo.url}
                                  alt="Photo"
                                  onClick={() =>
                                    setMediaPreview({
                                      isOpen: true,
                                      url: photo.url,
                                      title: photo.name || "Photo",
                                      type: "image",
                                    })
                                  }
                                  className="w-6 h-6 object-cover rounded border border-gray-300 cursor-pointer hover:scale-110 transition-transform"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* QC parameters list if any */}
                      {step.qcRequired && step.inspectionParameters?.length > 0 && (
                        <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-lg p-2.5 text-xs space-y-1">
                          <div className="font-bold text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                            Inspection Checkpoints:
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {step.inspectionParameters.map((param: any, pIdx: number) => (
                              <div key={pIdx} className="flex items-center justify-between bg-white dark:bg-gray-800 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-850">
                                <span className="font-semibold text-gray-800 dark:text-gray-200">
                                  {param.parameterName}
                                </span>
                                <span className="text-gray-500 font-mono text-[11px]">
                                  {param.specification || ""} {param.tolerance ? `(${param.tolerance})` : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. BASE BOM MATERIALS LIST */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Bill of Materials ({bom.length})
            </h3>
            {bom.length === 0 ? (
              <p className="text-xs text-gray-400">No BOM materials attached.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {bom.map((b: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 flex items-center justify-between text-xs shadow-2xs"
                  >
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {b.item?.name || b.itemName || "Material"}
                      </div>
                      <span className="text-[10px] text-gray-400 uppercase">
                        {b.itemType || "Material"}
                      </span>
                    </div>
                    <div className="font-bold text-gray-700 dark:text-gray-300">
                      {b.quantity} {b.unit || "Nos"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-gray-150 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850/80 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {routing.length} process operations defined
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 shadow-2xs"
            >
              <Download size={14} className="text-indigo-600" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <Edit size={14} />
              <span>Edit Routing</span>
            </button>
          </div>
        </div>
      </div>

      {/* MEDIA PREVIEW LIGHTBOX */}
      <RoutingMediaModal
        isOpen={mediaPreview.isOpen}
        mediaUrl={mediaPreview.url}
        mediaTitle={mediaPreview.title}
        mediaType={mediaPreview.type}
        onClose={() => setMediaPreview({ ...mediaPreview, isOpen: false })}
      />
    </div>
  );
}
