"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Check,
  Package,
  Factory,
  LayoutList,
  Layers,
  Clock,
  ShieldCheck,
  Paperclip,
  Truck
} from "lucide-react";
import {
  useSavePPCProductMutation,
  useGetProcessesQuery,
  useGetMachinesQuery,
  useGetWorkstationsQuery,
  useGetJobWorkSuppliersQuery,
  useGetQualityMastersQuery,
} from "@/src/store/services/ppcService";
import { storeService } from "@/src/store/services/storeService";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import RoutingStepCard from "./routing/RoutingStepCard";
import RoutingMediaModal from "./routing/RoutingMediaModal";

interface RoutingBuilderModalProps {
  fgItem: any;
  onClose: () => void;
}

export default function RoutingBuilderModal({ fgItem, onClose }: RoutingBuilderModalProps) {
  const [savePPCProduct, { isLoading: isSaving }] = useSavePPCProductMutation();

  // Queries for masters
  const { data: processes = [], isLoading: isLoadingProcesses } = useGetProcessesQuery();
  const { data: machines = [] } = useGetMachinesQuery();
  const { data: workstations = [] } = useGetWorkstationsQuery();
  const { data: suppliers = [] } = useGetJobWorkSuppliersQuery();
  const { data: qualityMasters = [] } = useGetQualityMastersQuery();

  // Store raw materials for adding to base BOM
  const { data: rawMaterials = [] } = storeService.useGetStoreDataQuery("raw-material");
  const { data: boughtOuts = [] } = storeService.useGetStoreDataQuery("bought-out");

  // State
  const [bom, setBom] = useState<any[]>([]);
  const [routing, setRouting] = useState<any[]>([]);
  const [selectedAddType, setSelectedAddType] = useState<"RawMaterial" | "BoughtOut">("RawMaterial");
  const [selectedAddItem, setSelectedAddItem] = useState<string>("");
  const [showAddBomModal, setShowAddBomModal] = useState(false);
  const [newBomQty, setNewBomQty] = useState<number>(1);
  const [newBomUnit, setNewBomUnit] = useState<string>("Nos");

  // Media preview modal state
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

  useEffect(() => {
    if (fgItem) {
      setBom(fgItem.bom || []);
      const existingRouting = fgItem.ppcProduct?.routing || [];
      if (existingRouting.length > 0) {
        setRouting(
          existingRouting.map((step: any, idx: number) => ({
            ...step,
            sequence: step.sequence || (idx + 1) * 10,
            processType: step.processType || (step.isOutsourced ? "Outside" : "Inside"),
            photos: step.photos || [],
            documents: step.documents || [],
            bomRequirements: step.bomRequirements || [],
            inspectionParameters: step.inspectionParameters || [],
            qcRequired: Boolean(step.qcRequired),
            qcStage: step.qcStage || "In-Process",
          }))
        );
      } else {
        setRouting([
          {
            sequence: 10,
            stepName: "",
            process: "",
            processType: "Inside",
            isOutsourced: false,
            setupTime: 0,
            cycleTime: 0,
            bomRequirements: [],
            photos: [],
            documents: [],
            qcRequired: false,
            qcStage: "In-Process",
            inspectionParameters: [],
          },
        ]);
      }
    }
  }, [fgItem]);

  // Metrics
  const totalSteps = routing.length;
  const inHouseCount = routing.filter((r) => r.processType !== "Outside" && !r.isOutsourced).length;
  const outsideCount = routing.filter((r) => r.processType === "Outside" || r.isOutsourced).length;
  const totalCycleTime = routing.reduce((acc, r) => acc + (Number(r.cycleTime) || 0), 0);
  const totalQCCount = routing.filter((r) => r.qcRequired).length;
  const totalDocCount = routing.reduce(
    (acc, r) => acc + ((r.photos?.length || 0) + (r.documents?.length || 0)),
    0
  );

  // Reorder steps
  const moveStepUp = (index: number) => {
    if (index === 0) return;
    const newRouting = [...routing];
    const temp = newRouting[index - 1];
    newRouting[index - 1] = newRouting[index];
    newRouting[index] = temp;
    newRouting.forEach((s, idx) => (s.sequence = (idx + 1) * 10));
    setRouting(newRouting);
  };

  const moveStepDown = (index: number) => {
    if (index === routing.length - 1) return;
    const newRouting = [...routing];
    const temp = newRouting[index + 1];
    newRouting[index + 1] = newRouting[index];
    newRouting[index] = temp;
    newRouting.forEach((s, idx) => (s.sequence = (idx + 1) * 10));
    setRouting(newRouting);
  };

  const addStep = () => {
    setRouting([
      ...routing,
      {
        sequence: (routing.length + 1) * 10,
        stepName: "",
        process: "",
        processType: "Inside",
        isOutsourced: false,
        setupTime: 0,
        cycleTime: 0,
        bomRequirements: [],
        photos: [],
        documents: [],
        qcRequired: false,
        qcStage: "In-Process",
        inspectionParameters: [],
      },
    ]);
  };

  const removeStep = (index: number) => {
    const updated = routing.filter((_, i) => i !== index);
    updated.forEach((s, idx) => (s.sequence = (idx + 1) * 10));
    setRouting(updated);
  };

  const updateStep = (index: number, updatedStep: any) => {
    const newRouting = [...routing];
    newRouting[index] = updatedStep;
    setRouting(newRouting);
  };

  // Add Item to Base BOM
  const handleAddBomItem = () => {
    if (!selectedAddItem) return;

    let itemObject: any = null;
    let name = "";
    let code = "";

    if (selectedAddType === "RawMaterial") {
      itemObject = rawMaterials.find((r: any) => r._id === selectedAddItem);
      name = itemObject?.name || "Raw Material";
      code = itemObject?.code || "";
    } else {
      itemObject = boughtOuts.find((b: any) => b._id === selectedAddItem);
      name = itemObject?.name || "Bought Out";
      code = itemObject?.code || "";
    }

    const newBomEntry = {
      itemType: selectedAddType,
      item: selectedAddItem,
      itemName: name,
      itemCode: code,
      quantity: Number(newBomQty) || 1,
      unit: newBomUnit || "Nos",
    };

    setBom([...bom, newBomEntry]);
    setSelectedAddItem("");
    setShowAddBomModal(false);
  };

  const removeBomItem = (index: number) => {
    setBom(bom.filter((_, i) => i !== index));
  };

  // Save full routing and BOM
  const handleSave = async () => {
    try {
      if (routing.length === 0) {
        alert("Please add at least one process step.");
        return;
      }

      const invalidStep = routing.find((r) => !r.process);
      if (invalidStep) {
        alert("Please select a process for all routing steps.");
        return;
      }

      // Format BOM
      const cleanedBom = bom.map((b) => ({
        itemType: b.itemType || "Material",
        item: typeof b.item === "object" && b.item !== null ? b.item._id : b.item,
        itemName: b.itemName || b.item?.name || "Item",
        quantity: Number(b.quantity) || 1,
        unit: b.unit || "Nos",
      }));

      // Format Routing
      const cleanedRouting = routing.map((r, idx) => ({
        sequence: Number(r.sequence) || (idx + 1) * 10,
        stepName: r.stepName || "",
        process: typeof r.process === "object" && r.process !== null ? r.process._id : r.process,
        processName: r.processName || "",
        processType: r.processType || (r.isOutsourced ? "Outside" : "Inside"),
        isOutsourced: r.processType === "Outside" || r.isOutsourced === true,
        workstation:
          typeof r.workstation === "object" && r.workstation !== null
            ? r.workstation._id
            : r.workstation || undefined,
        machine:
          typeof r.machine === "object" && r.machine !== null
            ? r.machine._id
            : r.machine || undefined,
        setupTime: Number(r.setupTime) || 0,
        cycleTime: Number(r.cycleTime) || 0,
        supplier:
          typeof r.supplier === "object" && r.supplier !== null
            ? r.supplier._id
            : r.supplier || undefined,
        supplierName: r.supplierName || "",
        leadTimeDays: Number(r.leadTimeDays) || 1,
        jobWorkRate: Number(r.jobWorkRate) || 0,
        outsideInstructions: r.outsideInstructions || "",
        photos: r.photos || [],
        documents: r.documents || [],
        qcRequired: Boolean(r.qcRequired),
        qcStage: r.qcStage || "In-Process",
        qualityMaster:
          typeof r.qualityMaster === "object" && r.qualityMaster !== null
            ? r.qualityMaster._id
            : r.qualityMaster || undefined,
        isMandatoryPass: r.isMandatoryPass !== false,
        inspectionParameters: r.inspectionParameters || [],
        bomRequirements: (r.bomRequirements || []).map((req: any) => ({
          item: typeof req.item === "object" && req.item !== null ? req.item._id : req.item,
          itemType: req.itemType || "Material",
          itemName: req.itemName || "Item",
          quantity: Number(req.quantity) || 1,
          unit: req.unit || "Nos",
          scrapPercentage: Number(req.scrapPercentage) || 0,
          notes: req.notes || "",
        })),
        description: r.description || "",
      }));

      await savePPCProduct({
        fgItemId: fgItem._id,
        routing: cleanedRouting,
        updatedBom: cleanedBom,
      }).unwrap();

      onClose();
    } catch (error: any) {
      console.error("Failed to save PPC routing:", error);
      alert(error?.data?.message || error?.message || "Failed to save process routing.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[94vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800">
        {/* 1. CLEAN COMPACT HEADER WITH INLINE METRICS */}
        <div className="px-6 py-3.5 border-b border-gray-150 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
              {fgItem.name}
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {fgItem.type || "Component"}
            </span>
            {fgItem.code && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-200/80 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                {fgItem.code}
              </span>
            )}
          </div>

          {/* Inline Summary Chips */}
          <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 shadow-2xs">
              <span className="text-indigo-600 font-bold">{totalSteps}</span> Steps
              <span className="text-gray-400 font-normal">({inHouseCount} In • {outsideCount} Out)</span>
            </span>

            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 shadow-2xs">
              <Clock size={13} className="text-blue-500" />
              <span>{totalCycleTime.toFixed(1)}m Cycle</span>
            </span>

            {totalQCCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 shadow-2xs">
                <ShieldCheck size={13} />
                <span>{totalQCCount} QC</span>
              </span>
            )}

            {totalDocCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 flex items-center gap-1 shadow-2xs">
                <Paperclip size={13} />
                <span>{totalDocCount} Files</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-150 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. MAIN BODY (BOM COLUMN + ROUTING COLUMN) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col lg:flex-row gap-5 bg-gray-50/40 dark:bg-gray-950/40">
          {/* LEFT: BASE BOM MATERIALS */}
          <div className="w-full lg:w-4/12 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Package size={16} className="text-amber-500" />
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                  Base BOM ({bom.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowAddBomModal(true)}
                className="px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Plus size={12} /> Add Item
              </button>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 shadow-2xs space-y-2">
              {bom.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  No materials in Base BOM.
                  <br />
                  Click "+ Add Item" to add parts.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[64vh] overflow-y-auto pr-1">
                  {bom.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-gray-50 dark:bg-gray-850 rounded-lg border border-gray-150 dark:border-gray-750 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                          {b.item?.name || b.itemName || "Item"}
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.2 rounded">
                          {b.itemType || "Material"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-1.5 py-0.5">
                          <input
                            type="number"
                            min="0.01"
                            step="0.1"
                            value={b.quantity}
                            onChange={(e) => {
                              const newBom = [...bom];
                              newBom[idx] = { ...newBom[idx], quantity: Number(e.target.value) };
                              setBom(newBom);
                            }}
                            className="w-11 text-xs font-bold text-center bg-transparent focus:outline-none"
                          />
                          <span className="text-[10px] text-gray-400">{b.unit || "Nos"}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBomItem(idx)}
                          className="text-gray-400 hover:text-red-500 p-0.5"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: PROCESS ROUTING SEQUENCE */}
          <div className="w-full lg:w-8/12 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <LayoutList size={16} className="text-indigo-600" />
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                  Process Steps ({routing.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={addStep}
                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1 shadow-xs transition-all"
              >
                <Plus size={13} /> Add Step
              </button>
            </div>

            {isLoadingProcesses ? (
              <div className="py-20 text-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : routing.length === 0 ? (
              <div className="py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-center text-gray-400 flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-900">
                <Factory size={40} className="text-gray-300 dark:text-gray-600 mb-2" />
                <p className="font-semibold text-xs text-gray-600 dark:text-gray-400">
                  No steps defined.
                </p>
                <button
                  type="button"
                  onClick={addStep}
                  className="mt-3 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1"
                >
                  <Plus size={13} /> Add Step
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {routing.map((step, sIdx) => (
                  <RoutingStepCard
                    key={sIdx}
                    step={step}
                    index={sIdx}
                    totalSteps={routing.length}
                    processes={processes}
                    machines={machines}
                    workstations={workstations}
                    suppliers={suppliers}
                    qualityMasters={qualityMasters}
                    baseBom={bom}
                    onUpdate={updateStep}
                    onRemove={removeStep}
                    onMoveUp={moveStepUp}
                    onMoveDown={moveStepDown}
                    onOpenMedia={(url, title, type) =>
                      setMediaPreview({ isOpen: true, url, title, type })
                    }
                  />
                ))}

                <button
                  type="button"
                  onClick={addStep}
                  className="w-full py-2.5 border border-dashed border-gray-300 dark:border-gray-700 hover:border-indigo-400 rounded-xl text-xs font-bold text-gray-500 hover:text-indigo-600 flex items-center justify-center gap-1.5 bg-white/40 dark:bg-gray-900/40 transition-all"
                >
                  <Plus size={14} /> Add Step
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. CLEAN COMPACT FOOTER */}
        <div className="px-6 py-3 border-t border-gray-150 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850/80 flex items-center justify-between gap-4">
          <span className="text-xs text-gray-500">
            {routing.length} operation steps configured
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all"
            >
              {isSaving ? <LoadingSpinner size="sm" /> : <Check size={15} />}
              <span>{isSaving ? "Saving..." : "Save Route & BOM"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* COMPACT ADD ITEM TO BOM POPUP */}
      {showAddBomModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-gray-800 p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                Add Item to BOM
              </h4>
              <button
                type="button"
                onClick={() => setShowAddBomModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedAddType("RawMaterial");
                  setSelectedAddItem("");
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  selectedAddType === "RawMaterial"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-600"
                }`}
              >
                Raw Material
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedAddType("BoughtOut");
                  setSelectedAddItem("");
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  selectedAddType === "BoughtOut"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-600"
                }`}
              >
                Bought-Out
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Item</label>
              <select
                value={selectedAddItem}
                onChange={(e) => setSelectedAddItem(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select item...</option>
                {selectedAddType === "RawMaterial"
                  ? rawMaterials.map((rm: any) => (
                      <option key={rm._id} value={rm._id}>
                        {rm.name} ({rm.code || "RM"})
                      </option>
                    ))
                  : boughtOuts.map((bo: any) => (
                      <option key={bo._id} value={bo._id}>
                        {bo.name} ({bo.code || "BO"})
                      </option>
                    ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Qty</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.1"
                  value={newBomQty}
                  onChange={(e) => setNewBomQty(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-850"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Unit</label>
                <input
                  type="text"
                  value={newBomUnit}
                  onChange={(e) => setNewBomUnit(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-850"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowAddBomModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedAddItem}
                onClick={handleAddBomItem}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEDIA PREVIEW MODAL */}
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
