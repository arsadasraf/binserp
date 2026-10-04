"use client";

import React, { useState, useEffect } from "react";
import { X, ArrowDownLeft, Trash2, Factory, Layers, ArrowRight } from "lucide-react";
import { apiRequest } from "@/src/lib/api";

interface WipActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  wipItem: any;
  mode: "return" | "scrap" | "convert";
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function WipActionModal({
  isOpen,
  onClose,
  wipItem,
  mode,
  onSuccess,
  onError,
}: WipActionModalProps) {
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Conversion specific fields
  const [existingComponents, setExistingComponents] = useState<any[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [targetComponentName, setTargetComponentName] = useState<string>("");
  const [targetComponentCode, setTargetComponentCode] = useState<string>("");
  const [targetDescription, setTargetDescription] = useState<string>("");
  const [targetType, setTargetType] = useState<string>("Component");
  const [targetQuantity, setTargetQuantity] = useState<string>("");
  const [targetUnit, setTargetUnit] = useState<string>("PCS");

  const unit = wipItem?.unit || "PCS";
  const hasDualUnit = Boolean(wipItem?.hasSecondaryUnit && wipItem?.secondaryUnit && Number(wipItem?.conversionFactor) > 0);
  const secondaryUnit = wipItem?.secondaryUnit || "";
  const conversionFactor = Number(wipItem?.conversionFactor) || 1;
  const [selectedUnit, setSelectedUnit] = useState<string>(unit);

  // Reset form whenever modal opens or item/mode changes
  useEffect(() => {
    if (isOpen && wipItem) {
      setQuantity("");
      setReason("");
      setSelectedUnit(wipItem.unit || "PCS");
      setSelectedComponentId("");
      setTargetComponentName("");
      setTargetComponentCode("");
      setTargetDescription("");
      setTargetQuantity("");
      setTargetUnit("PCS");
      setTargetType("Component");
    }
  }, [isOpen, wipItem, mode]);

  // Fetch FG Items and In-house components when convert mode is active
  useEffect(() => {
    if (isOpen && mode === "convert") {
      Promise.all([
        apiRequest("/api/store/fg-item").catch(() => null),
        apiRequest("/api/store/wip/inventory?type=fg").catch(() => null)
      ]).then(async ([fgRes, wipRes]) => {
        const combinedMap = new Map();

        // 1. Load from Master FG catalog
        if (fgRes && fgRes.ok) {
          const fgData = await fgRes.json().catch(() => null);
          const fgList = fgData?.fgItems || fgData?.items || (Array.isArray(fgData) ? fgData : []);
          fgList.forEach((it: any) => {
            const id = String(it._id || it.id);
            if (id) {
              combinedMap.set(id, {
                id: id,
                materialId: id,
                name: it.name,
                code: it.code || "",
                description: it.description || "",
                unit: it.unit || "Nos",
                category: it.type || "Component"
              });
            }
          });
        }

        // 2. Load from current WIP FG items (if not already in map)
        if (wipRes && wipRes.ok) {
          const wipData = await wipRes.json().catch(() => null);
          const wipList = wipData?.items || wipData?.wipItems || (Array.isArray(wipData) ? wipData : []);
          wipList.forEach((it: any) => {
            const rawId = String(it.materialId || it._id || it.id);
            const cleanId = rawId.includes('_') ? rawId.split('_').slice(1).join('_') : rawId;
            if (cleanId && !combinedMap.has(cleanId)) {
              combinedMap.set(cleanId, {
                id: cleanId,
                materialId: cleanId,
                name: it.materialName || it.name,
                code: it.materialCode || it.code || "",
                description: it.materialDescription || it.description || "",
                unit: it.unit || "Nos",
                category: it.categoryName || "Component"
              });
            }
          });
        }

        setExistingComponents(Array.from(combinedMap.values()));
      }).catch((err) => {
        console.error("Error loading FG items/components:", err);
      });
    }
  }, [isOpen, mode]);

  if (!isOpen || !wipItem) return null;

  const maxQty = Number(wipItem.shopfloorWipQty || wipItem.pendingWipQty || 0);
  const maxSecondaryQty = hasDualUnit ? parseFloat((maxQty * conversionFactor).toFixed(4)) : 0;
  const isReturn = mode === "return";
  const isScrap = mode === "scrap";
  const isConvert = mode === "convert";

  const isSecondaryActive = hasDualUnit && selectedUnit === secondaryUnit;
  const effectiveMax = isSecondaryActive ? maxSecondaryQty : maxQty;
  const activeUnitLabel = isSecondaryActive ? secondaryUnit : unit;

  const numInput = parseFloat(quantity) || 0;
  const liveConverted = isSecondaryActive
    ? (conversionFactor > 0 && numInput > 0 ? parseFloat((numInput / conversionFactor).toFixed(4)) : 0)
    : (hasDualUnit && numInput > 0 ? parseFloat((numInput * conversionFactor).toFixed(4)) : 0);

  const handleSelectComponentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      setSelectedComponentId("");
      setTargetComponentName("");
      setTargetComponentCode("");
      setTargetDescription("");
      setTargetUnit("PCS");
    } else {
      setSelectedComponentId(val);
      const found = existingComponents.find(c => String(c.id || c.materialId || c._id) === String(val));
      if (found) {
        setTargetComponentName(found.name || found.materialName || "");
        setTargetComponentCode(found.code || found.materialCode || "");
        setTargetDescription(found.description || found.materialDescription || "");
        setTargetUnit(found.unit || "PCS");
        if (found.category) setTargetType(found.category);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseFloat(quantity);

    if (isNaN(numQty) || numQty <= 0) {
      onError("Please enter a valid quantity greater than 0");
      return;
    }

    if (numQty > effectiveMax) {
      onError(`Quantity cannot exceed current shopfloor WIP balance (${effectiveMax} ${activeUnitLabel})`);
      return;
    }

    if (isConvert) {
      const numTargetQty = parseFloat(targetQuantity);
      if (isNaN(numTargetQty) || numTargetQty <= 0) {
        onError("Please enter a valid target produced quantity greater than 0");
        return;
      }
      if (!targetComponentName.trim()) {
        onError("Please enter or select a Target Component / Sub-assembly Name");
        return;
      }
    }

    const finalPrimaryQty = isSecondaryActive
      ? parseFloat((numQty / conversionFactor).toFixed(4))
      : numQty;

    const finalSecondaryQty = isSecondaryActive
      ? numQty
      : (hasDualUnit ? parseFloat((numQty * conversionFactor).toFixed(4)) : 0);

    try {
      setLoading(true);

      let endpoint = "/api/store/wip/convert-to-component";
      let payload: any = {};

      const resolvedMaterialId = wipItem.materialId || wipItem._id || wipItem.id;

      if (isReturn) {
        endpoint = "/api/store/wip/return-to-store";
        payload = {
          materialId: resolvedMaterialId,
          materialName: wipItem.materialName || wipItem.name,
          itemType: wipItem.itemType || (wipItem.categoryType?.toLowerCase().includes("bought") ? "bo" : "rm"),
          quantity: finalPrimaryQty,
          unit: unit,
          hasSecondaryUnit: hasDualUnit,
          secondaryUnit: secondaryUnit,
          secondaryQuantity: finalSecondaryQty,
          conversionFactor: conversionFactor,
          reason: reason.trim() || "Return to Main Store",
          remarks: reason.trim() || "Return to Main Store"
        };
      } else if (isScrap) {
        endpoint = "/api/store/wip/scrap";
        payload = {
          materialId: resolvedMaterialId,
          materialName: wipItem.materialName || wipItem.name,
          itemType: wipItem.itemType || (wipItem.categoryType?.toLowerCase().includes("bought") ? "bo" : "rm"),
          quantity: finalPrimaryQty,
          unit: unit,
          hasSecondaryUnit: hasDualUnit,
          secondaryUnit: secondaryUnit,
          secondaryQuantity: finalSecondaryQty,
          conversionFactor: conversionFactor,
          scrapReason: reason.trim() || "Process Scrap",
          remarks: reason.trim() || "Process Scrap"
        };
      } else if (isConvert) {
        endpoint = "/api/store/wip/convert-to-component";
        payload = {
          materialId: resolvedMaterialId,
          materialName: wipItem.materialName || wipItem.name,
          itemType: wipItem.itemType || (wipItem.categoryType?.toLowerCase().includes("bought") ? "bo" : "rm"),
          quantity: finalPrimaryQty,
          unit: unit,
          hasSecondaryUnit: hasDualUnit,
          secondaryUnit: secondaryUnit,
          secondaryQuantity: finalSecondaryQty,
          conversionFactor: conversionFactor,
          targetComponentId: selectedComponentId || undefined,
          targetComponentName: targetComponentName.trim(),
          targetComponentCode: targetComponentCode.trim(),
          targetDescription: targetDescription.trim(),
          targetType: targetType,
          targetQuantity: parseFloat(targetQuantity),
          targetUnit: targetUnit.trim() || "PCS",
          remarks: reason.trim() || "In-house WIP conversion"
        };
      }

      const res = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Failed to process WIP action`);
      }

      onSuccess(
        data.message ||
          (isConvert
            ? `Successfully converted ${finalPrimaryQty} ${unit} to ${targetQuantity} ${targetUnit} of ${targetComponentName} in Shopfloor WIP`
            : isReturn
            ? "Successfully returned material to Main Store"
            : "Successfully recorded shopfloor scrap write-off")
      );
      onClose();
    } catch (err: any) {
      console.error(`WIP ${mode} error:`, err);
      onError(err.message || `Failed to process WIP ${mode}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className={`bg-white dark:bg-slate-900 w-full ${isConvert ? 'max-w-4xl' : 'max-w-xl'} rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col`}>
        {/* Header */}
        <div className={`px-5 py-4 flex justify-between items-center text-white shrink-0 ${
          isConvert
            ? "bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800"
            : isReturn 
            ? "bg-gradient-to-r from-teal-700 to-emerald-800" 
            : "bg-gradient-to-r from-rose-700 to-red-800"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
              {isConvert ? <Factory size={22} /> : isReturn ? <ArrowDownLeft size={22} /> : <Trash2 size={22} />}
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isConvert 
                  ? "Convert WIP Material into FG Component" 
                  : isReturn 
                  ? "Return Material to Main Store" 
                  : "Report Shopfloor Scrap Write-Off"}
              </h3>
              <p className="text-xs text-white/80">
                {isConvert
                  ? "Produces in-house FG Component in Shopfloor WIP (WIP stock only)"
                  : isReturn 
                  ? "Transfers unused shopfloor WIP back to Main Store perpetual inventory" 
                  : "Writes off cutting/machining process scrap from active shopfloor WIP"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {isConvert ? (
            /* Widescreen 2-Column Grid for Convert Mode */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Source WIP Material */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                        Source WIP Material
                      </span>
                      <div className="font-bold text-base text-slate-900 dark:text-white mt-0.5">
                        {wipItem.materialName || wipItem.name || "Material Item"}
                      </div>
                      {(wipItem.materialDescription || wipItem.description || wipItem.descriptions) && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                          {wipItem.materialDescription || wipItem.description || wipItem.descriptions}
                        </div>
                      )}
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {wipItem.categoryName || wipItem.categoryType || "Material"}
                    </span>
                  </div>

                  <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Available WIP:
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {maxQty} {unit}
                      {hasDualUnit && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-normal ml-2">
                          ({maxSecondaryQty} {secondaryUnit})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  {hasDualUnit && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Operating Unit:
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => { setSelectedUnit(unit); setQuantity(""); }}
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            !isSecondaryActive
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {unit}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelectedUnit(secondaryUnit); setQuantity(""); }}
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            isSecondaryActive
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {secondaryUnit}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Quantity to Consume ({activeUnitLabel}) <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setQuantity(String(effectiveMax))}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
                      >
                        Max: {effectiveMax} {activeUnitLabel}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        max={effectiveMax}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder={`0.00`}
                        required
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                        {activeUnitLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Target In-House FG Component */}
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200 dark:border-indigo-800/80 space-y-3.5">
                <div className="flex justify-between items-center border-b border-indigo-200 dark:border-indigo-800/80 pb-2">
                  <span className="text-xs font-black uppercase tracking-wide text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <Layers size={15} /> Target In-House FG Component
                  </span>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    WIP Stock Only
                  </span>
                </div>

                {/* Dropdown of Existing FG Items */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Select FG Item / Component:
                  </label>
                  <select
                    value={selectedComponentId || ""}
                    onChange={handleSelectComponentChange}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="">-- Choose Existing Item or Type Below --</option>
                    {existingComponents.map((comp) => {
                      const cName = comp.name || comp.materialName || comp.componentName || "Component";
                      const cDesc = comp.description || comp.materialDescription || "";
                      return (
                        <option key={comp.id || comp._id} value={comp.id || comp.materialId || comp._id}>
                          {cName}{cDesc ? ` — ${cDesc}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Component Name */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Component / Part Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={targetComponentName}
                    onChange={(e) => setTargetComponentName(e.target.value)}
                    placeholder="e.g., Shaft Blank / Turned Bushing"
                    required={isConvert}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* Technical Specification */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Technical Specification / Dimensions
                  </label>
                  <input
                    type="text"
                    value={targetDescription}
                    onChange={(e) => setTargetDescription(e.target.value)}
                    placeholder="e.g., Cut length 150mm, OD 48mm pre-machined"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs italic text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* Produced Quantity and Unit */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Produced Qty in WIP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={targetQuantity}
                      onChange={(e) => setTargetQuantity(e.target.value)}
                      placeholder="0.00"
                      required={isConvert}
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Produced Unit
                    </label>
                    <input
                      type="text"
                      value={targetUnit}
                      onChange={(e) => setTargetUnit(e.target.value)}
                      placeholder="PCS / Nos"
                      required={isConvert}
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Standard Layout for Return / Scrap */
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {wipItem.materialName || wipItem.name || "Material Item"}
                </div>
                {(wipItem.materialDescription || wipItem.description || wipItem.descriptions) && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                    {wipItem.materialDescription || wipItem.description || wipItem.descriptions}
                  </div>
                )}
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  Available WIP: <span className="text-slate-900 dark:text-white font-mono font-bold">{maxQty} {unit}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isReturn ? "Return Quantity" : "Scrap Quantity"} ({activeUnitLabel}) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setQuantity(String(effectiveMax))}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    Max ({effectiveMax} {activeUnitLabel})
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  max={effectiveMax}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Live Conversion Summary Badge */}
          {isConvert && numInput > 0 && parseFloat(targetQuantity) > 0 && targetComponentName && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-xl flex items-center justify-center gap-3 text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              <span className="font-bold">{numInput} {activeUnitLabel} {wipItem.materialName || wipItem.name}</span>
              <ArrowRight size={16} className="text-indigo-600 dark:text-indigo-400" />
              <span className="font-bold text-indigo-700 dark:text-indigo-300">{targetQuantity} {targetUnit} {targetComponentName}</span>
            </div>
          )}

          {/* Remarks / Process Note */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Process Note / Remarks (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Band-saw cutting into blanks / Pre-machining"
              className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || maxQty <= 0}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                isConvert
                  ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25"
                  : isReturn
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25"
                  : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <span>Processing...</span>
              ) : isConvert ? (
                <>
                  <Factory size={15} />
                  <span>Confirm WIP Conversion</span>
                </>
              ) : isReturn ? (
                <>
                  <ArrowDownLeft size={15} />
                  <span>Confirm Return to Store</span>
                </>
              ) : (
                <>
                  <Trash2 size={15} />
                  <span>Confirm Scrap Write-off</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
