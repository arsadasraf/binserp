"use client";

import React, { useState } from "react";
import { X, ArrowDownLeft, Trash2, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { apiRequest } from "@/src/lib/api";

interface WipActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  wipItem: any;
  mode: "return" | "scrap";
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

  const unit = wipItem?.unit || "PCS";
  const hasDualUnit = Boolean(wipItem?.hasSecondaryUnit && wipItem?.secondaryUnit && Number(wipItem?.conversionFactor) > 0);
  const secondaryUnit = wipItem?.secondaryUnit || "";
  const conversionFactor = Number(wipItem?.conversionFactor) || 1;
  const [selectedUnit, setSelectedUnit] = useState<string>(unit);

  if (!isOpen || !wipItem) return null;

  const maxQty = Number(wipItem.shopfloorWipQty || wipItem.pendingWipQty || 0);
  const maxSecondaryQty = hasDualUnit ? parseFloat((maxQty * conversionFactor).toFixed(4)) : 0;
  const isReturn = mode === "return";
  const isSecondaryActive = hasDualUnit && selectedUnit === secondaryUnit;
  const effectiveMax = isSecondaryActive ? maxSecondaryQty : maxQty;
  const activeUnitLabel = isSecondaryActive ? secondaryUnit : unit;

  const numInput = parseFloat(quantity) || 0;
  const liveConverted = isSecondaryActive
    ? (conversionFactor > 0 && numInput > 0 ? parseFloat((numInput / conversionFactor).toFixed(4)) : 0)
    : (hasDualUnit && numInput > 0 ? parseFloat((numInput * conversionFactor).toFixed(4)) : 0);

  const returnPresets = [
    "Excess Material Issued",
    "Production Batch Completed",
    "Design / BOM Specification Change",
    "Job Order Suspended / Cancelled",
    "Returned from Assembly Line"
  ];

  const scrapPresets = [
    "Cutting & Shearing Offcuts",
    "Machining Turnings / Chips",
    "Dimensional Machining Defect",
    "Setup & Trial Run Scrap",
    "Damaged in Handling"
  ];

  const presets = isReturn ? returnPresets : scrapPresets;

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

    if (!reason.trim()) {
      onError(isReturn ? "Please enter or select a return reason" : "Please enter or select a scrap reason");
      return;
    }

    const finalPrimaryQty = isSecondaryActive
      ? parseFloat((numQty / conversionFactor).toFixed(4))
      : numQty;

    const finalSecondaryQty = isSecondaryActive
      ? numQty
      : (hasDualUnit ? parseFloat((numQty * conversionFactor).toFixed(4)) : 0);

    try {
      setLoading(true);
      const endpoint = isReturn ? "/api/store/wip/return-to-store" : "/api/store/wip/scrap";
      const payload = {
        materialId: wipItem.id || wipItem._id,
        materialName: wipItem.materialName || wipItem.name,
        materialType: wipItem.categoryType || (wipItem.materialCategory?.toLowerCase()) || (wipItem.type?.toLowerCase()) || "rm",
        quantity: finalPrimaryQty,
        unit: unit,
        hasSecondaryUnit: hasDualUnit,
        secondaryUnit: secondaryUnit,
        secondaryQuantity: finalSecondaryQty,
        conversionFactor: conversionFactor,
        reason: reason.trim(),
        remarks: reason.trim(),
        scrapReason: reason.trim()
      };

      const res = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Failed to process WIP ${isReturn ? "return" : "scrap"}`);
      }

      onSuccess(data.message || `Successfully processed WIP ${isReturn ? "return to Main Store" : "scrap write-off"}`);
      onClose();
    } catch (err: any) {
      console.error(`WIP ${mode} error:`, err);
      onError(err.message || `Failed to process WIP ${mode}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className={`p-4 sm:p-5 flex justify-between items-center text-white ${
          isReturn 
            ? "bg-gradient-to-r from-teal-700 to-emerald-800" 
            : "bg-gradient-to-r from-rose-700 to-red-800"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
              {isReturn ? <ArrowDownLeft size={22} /> : <Trash2 size={22} />}
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isReturn ? "Return Material to Main Store" : "Report Shopfloor Scrap Write-Off"}
              </h3>
              <p className="text-xs text-white/80">
                {isReturn 
                  ? "Transfers unused shopfloor WIP back to Main Store perpetual inventory" 
                  : "Writes off cutting/machining process scrap from active shopfloor WIP"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Material Details Card (Strict AGENTS.md: Item Name bold, Description italic) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                  Target Material
                </span>
                <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                  {wipItem.materialName || wipItem.name || "Material Item"}
                </div>
                {(wipItem.materialDescription || wipItem.description || wipItem.descriptions) && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                    {wipItem.materialDescription || wipItem.description || wipItem.descriptions}
                  </div>
                )}
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {wipItem.categoryName || wipItem.categoryType || "RM/BO"}
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Shopfloor WIP Available:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                  {maxQty} {unit}
                </span>
                {hasDualUnit && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block font-mono">
                    ≈ {maxSecondaryQty} {secondaryUnit}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">
                  {isReturn ? "Destination Stock:" : "Impact:"}
                </span>
                <span className={`font-semibold text-xs ${isReturn ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {isReturn ? "Main Store Inventory (+)" : "Scrap Ledger Write-off (-)"}
                </span>
              </div>
            </div>
          </div>

          {/* Dual Unit Toggle if applicable */}
          {hasDualUnit && (
            <div className="flex items-center justify-between p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Operating Unit:
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUnit(unit);
                    setQuantity("");
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    !isSecondaryActive
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white"
                  }`}
                >
                  Primary ({unit})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUnit(secondaryUnit);
                    setQuantity("");
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isSecondaryActive
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white"
                  }`}
                >
                  Secondary ({secondaryUnit})
                </button>
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isReturn ? "Return Quantity" : "Scrap Quantity"} ({activeUnitLabel}) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setQuantity(String(effectiveMax))}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
              >
                Max ({effectiveMax} {activeUnitLabel})
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
                placeholder={`0.00 (${activeUnitLabel})`}
                required
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                {activeUnitLabel}
              </span>
            </div>
            {hasDualUnit && numInput > 0 && (
              <div className="text-[11px] text-amber-700 dark:text-amber-300 font-mono text-right">
                ↳ Equivalent: <strong>{liveConverted} {isSecondaryActive ? unit : secondaryUnit}</strong>
              </div>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isReturn ? "Reason for Return" : "Scrap Classification / Reason"} <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                    reason === preset
                      ? "bg-indigo-50 dark:bg-indigo-950/80 border-indigo-400 text-indigo-700 dark:text-indigo-300"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isReturn ? "Enter return reason or remarks..." : "Enter scrap details or causes..."}
              required
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
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
                isReturn
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25"
                  : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <span>Processing...</span>
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
