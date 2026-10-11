"use client";

import React, { useState, useEffect } from "react";
import { X, Warehouse, ArrowRight, Layers, MapPin, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/src/lib/api";

interface MoveWipToFgModalProps {
  isOpen: boolean;
  onClose: () => void;
  wipItem: any;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function MoveWipToFgModal({
  isOpen,
  onClose,
  wipItem,
  onSuccess,
  onError,
}: MoveWipToFgModalProps) {
  const [quantity, setQuantity] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [locations, setLocations] = useState<any[]>([]);
  const [remarks, setRemarks] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const unit = wipItem?.unit || "PCS";
  const hasDualUnit = Boolean(
    wipItem?.hasSecondaryUnit && wipItem?.secondaryUnit && Number(wipItem?.conversionFactor) > 0
  );
  const secondaryUnit = wipItem?.secondaryUnit || "";
  const conversionFactor = Number(wipItem?.conversionFactor) || 1;
  const [selectedUnit, setSelectedUnit] = useState<string>(unit);

  const maxWipQty = Number(wipItem?.shopfloorWipQty || wipItem?.pendingWipQty || 0);
  const maxSecondaryQty = hasDualUnit ? parseFloat((maxWipQty * conversionFactor).toFixed(4)) : 0;
  const isSecondaryActive = hasDualUnit && selectedUnit === secondaryUnit;
  const effectiveMax = isSecondaryActive ? maxSecondaryQty : maxWipQty;
  const activeUnitLabel = isSecondaryActive ? secondaryUnit : unit;

  // Reset state on open
  useEffect(() => {
    if (isOpen && wipItem) {
      setQuantity("");
      setLocationId("");
      setRemarks("");
      setSelectedUnit(wipItem.unit || "PCS");
    }
  }, [isOpen, wipItem]);

  // Load locations for store rack / bin selection
  useEffect(() => {
    if (isOpen) {
      apiRequest("/api/store/location")
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json().catch(() => null);
            const list = data?.locations || data?.items || (Array.isArray(data) ? data : []);
            setLocations(list);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen || !wipItem) return null;

  const numInput = parseFloat(quantity) || 0;
  const primaryTransferQty = isSecondaryActive
    ? conversionFactor > 0 ? parseFloat((numInput / conversionFactor).toFixed(4)) : 0
    : numInput;
  const secondaryTransferQty = isSecondaryActive
    ? numInput
    : hasDualUnit && conversionFactor > 0 ? parseFloat((numInput * conversionFactor).toFixed(4)) : 0;

  const currentStoreStock = Number(wipItem?.mainStoreStock || 0);
  const projectedStoreStock = Math.max(0, currentStoreStock + primaryTransferQty);
  const remainingWipQty = Math.max(0, maxWipQty - primaryTransferQty);

  const itemDescription = wipItem?.materialDescription || wipItem?.description || wipItem?.descriptions || "";

  const handleSetMax = () => {
    setQuantity(String(effectiveMax));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseFloat(quantity);

    if (isNaN(numQty) || numQty <= 0) {
      onError("Please enter a valid transfer quantity greater than 0");
      return;
    }

    if (numQty > effectiveMax) {
      onError(`Transfer quantity cannot exceed available Shopfloor WIP balance (${effectiveMax} ${activeUnitLabel})`);
      return;
    }

    try {
      setLoading(true);

      const resolvedMaterialId = wipItem.materialId || wipItem._id || wipItem.id;
      const selectedLocObj = locations.find((l) => String(l._id || l.id) === String(locationId));

      const payload = {
        materialId: resolvedMaterialId,
        materialName: wipItem.materialName || wipItem.name,
        quantity: primaryTransferQty,
        unit: unit,
        hasSecondaryUnit: hasDualUnit,
        secondaryUnit: secondaryUnit,
        secondaryQuantity: secondaryTransferQty,
        conversionFactor: conversionFactor,
        locationId: locationId || undefined,
        location: selectedLocObj?.name || undefined,
        remarks: remarks.trim() || "Moved from Shopfloor WIP to Main FG Store"
      };

      const res = await apiRequest("/api/store/wip/move-to-fg-inventory", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to transfer item to Main FG Inventory");
      }

      onSuccess(
        data.message ||
          `Successfully moved ${primaryTransferQty} ${unit} of ${wipItem.materialName || "Finished Goods"} to Main Store Inventory`
      );
      onClose();
    } catch (err: any) {
      console.error("Move to FG Inventory error:", err);
      onError(err.message || "Failed to transfer item to Main FG Inventory");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 flex justify-between items-center text-white shrink-0 bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
              <Warehouse size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Move to Main FG Inventory</h3>
              <p className="text-xs text-emerald-100">
                Transfer finished goods from Shopfloor WIP into Main Store Inventory
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Target FG Item Summary (Strict AGENTS.md Compliance: Bold Name, Italic Description) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-600 dark:text-emerald-400">
                  Finished Goods Item
                </span>
                <div className="font-bold text-base text-slate-900 dark:text-white mt-0.5 truncate">
                  {wipItem.materialName || wipItem.name || "Finished Goods"}
                </div>
                {itemDescription ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2" title={itemDescription}>
                    {itemDescription}
                  </div>
                ) : null}
              </div>
              <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 shrink-0 border border-emerald-200 dark:border-emerald-800">
                {wipItem.categoryName || wipItem.categoryType || "Finished Goods"}
              </span>
            </div>
          </div>

          {/* Current Balances & Live Projection Cards */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            {/* Card 1: Shopfloor WIP */}
            <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                Shopfloor WIP
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm sm:text-base mt-0.5 block">
                {maxWipQty} <span className="text-xs font-normal text-slate-500">{unit}</span>
              </span>
              {hasDualUnit && (
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono block mt-0.5">
                  {maxSecondaryQty} {secondaryUnit}
                </span>
              )}
            </div>

            {/* Card 2: Current Store Stock */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Current FG Stock
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm sm:text-base mt-0.5 block">
                {currentStoreStock} <span className="text-xs font-normal text-slate-500">{unit}</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Warehouse</span>
            </div>

            {/* Card 3: Projected Store Stock */}
            <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800/80 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                Projected Stock
              </span>
              <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 text-sm sm:text-base mt-0.5 block">
                {projectedStoreStock} <span className="text-xs font-normal text-emerald-600">{unit}</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                +{primaryTransferQty} {unit}
              </span>
            </div>
          </div>

          {/* Transfer Quantity Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Transfer Quantity <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                {hasDualUnit && (
                  <div className="flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setSelectedUnit(unit)}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                        selectedUnit === unit
                          ? "bg-emerald-600 text-white"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {unit}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedUnit(secondaryUnit)}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                        selectedUnit === secondaryUnit
                          ? "bg-emerald-600 text-white"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {secondaryUnit}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSetMax}
                  className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  Max: {effectiveMax} {activeUnitLabel}
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.0001"
                max={effectiveMax}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`Enter quantity (max ${effectiveMax})`}
                required
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-bold text-base focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all pr-16"
              />
              <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400 pointer-events-none">
                {activeUnitLabel}
              </span>
            </div>

            {hasDualUnit && numInput > 0 && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                Converted:{" "}
                <strong className="text-slate-700 dark:text-slate-300">
                  {isSecondaryActive ? primaryTransferQty : secondaryTransferQty}{" "}
                  {isSecondaryActive ? unit : secondaryUnit}
                </strong>{" "}
                (Factor: {conversionFactor})
              </div>
            )}
          </div>

          {/* Destination Store Location / Rack (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <MapPin size={13} className="text-emerald-600" />
              <span>Destination Store Location / Rack (Optional)</span>
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="">Default Main Store Warehouse</option>
              {locations.map((loc) => (
                <option key={loc._id || loc.id} value={loc._id || loc.id}>
                  {loc.name || loc.locationName} {loc.rack ? `(Rack: ${loc.rack})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText size={13} className="text-slate-400" />
              <span>Remarks / Transfer Notes</span>
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Shopfloor final assembly completed, moved to FG storage area"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
            />
          </div>

          {/* Transfer Summary Notice */}
          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-300">
                Direct 1-Step Inventory Update
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                This will deduct {primaryTransferQty || 0} {unit} from Shopfloor WIP and immediately credit Main Store FG stock. A stock audit ledger record will be generated automatically.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !numInput || numInput > effectiveMax}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Warehouse size={14} />
              )}
              <span>{loading ? "Transferring..." : "Confirm Transfer to FG Store"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
