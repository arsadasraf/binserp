"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Layers,
  Sparkles,
  PackagePlus,
  AlertCircle,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { useCreateStoreRecordMutation } from "@/src/store/services/storeService";
import Swal from "sweetalert2";

export interface QuickItemMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: "rm" | "bo" | "consumable" | "inhouse" | "fg" | string;
  initialName?: string;
  categories?: any[];
  locations?: any[];
  contextLabel?: string;
  onItemCreated: (createdItem: any) => void;
}

const COMMON_UNITS = [
  "PCS",
  "KG",
  "Nos",
  "Mtr",
  "Ltr",
  "Set",
  "Box",
  "Pkt",
  "Roll",
  "Sheet",
  "Pair",
  "Bag",
  "Sq.Ft",
  "Sq.Mtr"
];

const COMMON_SECONDARY_UNITS = [
  "KG",
  "Grams",
  "Mtr",
  "Ltr",
  "PCS",
  "Nos",
  "Box",
  "Sheet",
  "Roll"
];

export default function QuickItemMasterModal({
  isOpen,
  onClose,
  defaultType = "rm",
  initialName = "",
  categories = [],
  locations = [],
  contextLabel,
  onItemCreated,
}: QuickItemMasterModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);
  const safeLocations = useMemo(() => (Array.isArray(locations) ? locations : []), [locations]);

  // Map incoming GRN type to valid item classification
  const initialClassification = useMemo(() => {
    const t = (defaultType || "").toLowerCase();
    if (t === "inhouse" || t === "fg") return "fg";
    if (t === "consumable") return "consumable";
    if (t === "bo" || t === "bought-out") return "bo";
    return "rm";
  }, [defaultType]);

  const [itemType, setItemType] = useState<"rm" | "bo" | "consumable" | "fg">(
    initialClassification
  );

  // Form Fields
  const [name, setName] = useState(initialName);
  const [descriptions, setDescriptions] = useState("");
  const [unit, setUnit] = useState("PCS");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [minimumStock, setMinimumStock] = useState<number | "">("");
  const [hsnCode, setHsnCode] = useState("");

  // Dual Unit / Secondary Unit
  const [hasSecondaryUnit, setHasSecondaryUnit] = useState(false);
  const [secondaryUnit, setSecondaryUnit] = useState("KG");
  const [conversionFactor, setConversionFactor] = useState<number | "">(1);

  // Finished Good specific classification
  const [fgType, setFgType] = useState<"Component" | "Sub Assembly" | "Assembly">("Component");

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [createStoreRecord, { isLoading }] = useCreateStoreRecordMutation();

  // Reset/sync form when opening
  useEffect(() => {
    if (isOpen) {
      console.log("[QuickItemMasterModal] Opened with:", { defaultType, initialName });
      setItemType(initialClassification);
      setName(initialName || "");
      setDescriptions("");
      setUnit("PCS");
      setCategoryId("");
      setLocationId("");
      setMinimumStock("");
      setHsnCode("");
      setHasSecondaryUnit(false);
      setSecondaryUnit("KG");
      setConversionFactor(1);
      setFgType("Component");
      setFormErrors({});
    }
  }, [isOpen, initialClassification, initialName, defaultType]);

  if (!isOpen || !mounted) return null;

  const clearError = (key: string) => {
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleCategorySelect = (catId: string) => {
    setCategoryId(catId);
    clearError("category");
    const foundCat = safeCategories.find((c: any) => c._id === catId);
    if (foundCat && foundCat.unit) {
      setUnit(foundCat.unit);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = "Item name is required";
    }
    if (!descriptions.trim()) {
      errors.descriptions = "Technical description is required (Binserp Item Standard)";
    }
    if (!unit.trim()) {
      errors.unit = "Unit is required";
    }
    if (hasSecondaryUnit) {
      if (!secondaryUnit.trim()) {
        errors.secondaryUnit = "2nd Unit is required when Dual Unit is enabled";
      }
      if (!conversionFactor || Number(conversionFactor) <= 0) {
        errors.conversionFactor = "Conversion factor must be > 0";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      let targetTab: any = "rm-bo-item";
      let payload: any = {
        name: name.trim(),
        unit: unit.trim(),
        descriptions: descriptions.trim(),
        description: descriptions.trim(), // Both keys populated for compatibility
        hasSecondaryUnit,
        secondaryUnit: hasSecondaryUnit ? secondaryUnit.trim() : "",
        conversionFactor: hasSecondaryUnit ? Number(conversionFactor) : 1,
        hsnCode: hsnCode.trim(),
        categoryId: categoryId || undefined,
        locationId: locationId || undefined,
        minimumStock: minimumStock === "" ? 0 : Number(minimumStock),
      };

      if (itemType === "rm") {
        targetTab = "raw-material";
        payload.itemType = "Raw Material";
      } else if (itemType === "bo") {
        targetTab = "bought-out";
        payload.itemType = "Bought Out";
      } else if (itemType === "consumable") {
        targetTab = "consumable-item";
      } else if (itemType === "fg") {
        targetTab = "fg-item";
        payload.type = fgType;
        payload.description = descriptions.trim();
      }

      const res = await createStoreRecord({ tab: targetTab, body: payload }).unwrap();
      const createdItem =
        res?.rawMaterial ||
        res?.boughtOut ||
        res?.consumableItem ||
        res?.fgItem ||
        res?.data ||
        res?.item ||
        res?.rmBoItem ||
        res;

      // Ensure description fields are well populated
      const normalizedCreatedItem = {
        ...createdItem,
        _id: createdItem?._id || res?._id || res?.data?._id,
        name: name.trim(),
        descriptions: descriptions.trim(),
        description: descriptions.trim(),
        unit: unit.trim(),
        hasSecondaryUnit,
        secondaryUnit: hasSecondaryUnit ? secondaryUnit.trim() : "",
        conversionFactor: hasSecondaryUnit ? Number(conversionFactor) : 1,
        categoryId: categoryId || createdItem?.categoryId,
        locationId: locationId || createdItem?.locationId,
        itemType: itemType === "rm" ? "Raw Material" : itemType === "bo" ? "Bought Out" : itemType === "consumable" ? "Consumable" : "FG",
      };

      Swal.fire({
        icon: "success",
        title: "Master Item Registered!",
        text: `"${name.trim()}" has been saved in Item Master and selected into your ${contextLabel || "form"}.`,
        timer: 1800,
        showConfirmButton: false,
      });

      onItemCreated(normalizedCreatedItem);
      onClose();
    } catch (err: any) {
      console.error("Failed to quick create master item:", err);
      const errMsg = err?.data?.message || err?.message || "Failed to create master item";
      Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: errMsg,
      });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <PackagePlus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                <span>Add Item to Master</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-white/20 text-white">
                  Quick Register
                </span>
              </h2>
              <p className="text-[11px] text-emerald-100">
                Register a new master item directly and auto-select it in your GRN
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20 text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Master Item Type Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
              Master Item Classification <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setItemType("rm")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                  itemType === "rm"
                    ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-500 ring-2 ring-blue-400/30"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                Raw Material (RM)
              </button>

              <button
                type="button"
                onClick={() => setItemType("bo")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                  itemType === "bo"
                    ? "bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-500 ring-2 ring-amber-400/30"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                Bought Out (BO)
              </button>

              <button
                type="button"
                onClick={() => setItemType("consumable")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                  itemType === "consumable"
                    ? "bg-teal-50 border-teal-500 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-500 ring-2 ring-teal-400/30"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                Consumable
              </button>

              <button
                type="button"
                onClick={() => setItemType("fg")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                  itemType === "fg"
                    ? "bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-500 ring-2 ring-purple-400/30"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                Finished Good (FG)
              </button>
            </div>
          </div>

          {/* FG Type Selector (if FG selected) */}
          {itemType === "fg" && (
            <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                FG Classification:
              </span>
              <div className="flex items-center gap-1.5">
                {(["Component", "Sub Assembly", "Assembly"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFgType(t)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      fgType === t
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Item Name & Technical Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>
                  Item Name <span className="text-red-500">*</span>
                </span>
                {formErrors.name && (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                    {formErrors.name}
                  </span>
                )}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value) clearError("name");
                }}
                placeholder="e.g. M.S. Flange, Hex Bolt M12, Cutting Oil"
                className={`w-full h-9 px-3 bg-white dark:bg-slate-900 border rounded-xl text-xs font-semibold focus:ring-2 transition-all ${
                  formErrors.name
                    ? "border-rose-500 ring-1 ring-rose-400 focus:ring-rose-500"
                    : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>
                  Technical Description & Specification <span className="text-red-500">*</span>
                </span>
                {formErrors.descriptions && (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                    {formErrors.descriptions}
                  </span>
                )}
              </label>
              <textarea
                value={descriptions}
                rows={2}
                onChange={(e) => {
                  setDescriptions(e.target.value);
                  if (e.target.value) clearError("descriptions");
                }}
                placeholder="e.g. 50mm Dia x 12mm Thk Grade EN8, Hex Head Zinc Plated 50mm Long"
                className={`w-full p-2.5 bg-white dark:bg-slate-900 border rounded-xl text-xs font-medium focus:ring-2 transition-all ${
                  formErrors.descriptions
                    ? "border-rose-500 ring-1 ring-rose-400 focus:ring-rose-500"
                    : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500"
                }`}
              />
              <p className="text-[10px] text-slate-400 italic mt-0.5">
                Rule: Item descriptions are displayed across all tables, PDFs, and store records.
              </p>
            </div>
          </div>

          {/* Unit, Category & Storage Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Primary Unit */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>
                  Primary Unit <span className="text-red-500">*</span>
                </span>
                {formErrors.unit && (
                  <span className="text-[10px] text-rose-600 font-bold">{formErrors.unit}</span>
                )}
              </label>
              <input
                list="quick-units-list"
                type="text"
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                  if (e.target.value) clearError("unit");
                }}
                placeholder="e.g. PCS, KG"
                className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 uppercase"
              />
              <datalist id="quick-units-list">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => handleCategorySelect(e.target.value)}
                className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Category (Optional)</option>
                {safeCategories.map((c: any) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Storage Location */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Storage Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Location (Optional)</option>
                {safeLocations.map((loc: any) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dual Unit / 2nd Unit Toggle Box */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasSecondaryUnit}
                  onChange={(e) => setHasSecondaryUnit(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                <span className="ml-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  Dual Unit / Secondary Unit Applicable
                </span>
              </label>
              {hasSecondaryUnit && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 font-mono">
                  1 {unit || "Unit"} = {conversionFactor || 0} {secondaryUnit || "2nd Unit"}
                </span>
              )}
            </div>

            {hasSecondaryUnit && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    2nd Unit (Secondary) <span className="text-red-500">*</span>
                  </label>
                  <input
                    list="quick-sec-units-list"
                    type="text"
                    value={secondaryUnit}
                    onChange={(e) => {
                      setSecondaryUnit(e.target.value);
                      if (e.target.value) clearError("secondaryUnit");
                    }}
                    placeholder="e.g. KG, Grams, Mtr"
                    className="w-full h-8 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold uppercase"
                  />
                  <datalist id="quick-sec-units-list">
                    {COMMON_SECONDARY_UNITS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Conversion Factor (1 {unit || "Unit"} = ? {secondaryUnit || "KG"}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.000001"
                    value={conversionFactor}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                      setConversionFactor(val);
                      if (val && Number(val) > 0) clearError("conversionFactor");
                    }}
                    placeholder="e.g. 0.25 (1 PCS = 0.25 KG)"
                    className="w-full h-8 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Min Stock & HSN Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Minimum Reorder Stock (Optional)
              </label>
              <input
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) =>
                  setMinimumStock(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                placeholder="e.g. 100"
                className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                HSN / Tariff Code (Optional)
              </label>
              <input
                type="text"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                placeholder="e.g. 7204, 8481"
                className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium font-mono"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving to Master...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save to Master & Use in {contextLabel || "Form"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
