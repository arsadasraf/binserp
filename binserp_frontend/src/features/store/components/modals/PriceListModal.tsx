"use client";
import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle, Tag, Globe } from "lucide-react";
import { formatItemSelectLabel, getItemDescription } from "@/src/utils/itemDisplayHelper";
import { CURRENCY_OPTIONS, getCurrencySymbol, normalizeCurrencyCode } from "@/src/utils/currencyHelper";

interface PriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  fgItems: any[];
  priceLists?: any[];
}

export default function PriceListModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  fgItems = [],
  priceLists = [],
}: PriceListModalProps) {
  const [formData, setFormData] = useState({
    fgItem: "",
    currency: "INR",
    price: "",
    taxRate: "18",
    pricingUnit: "",
    isSecondaryUnit: false,
    remarks: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (initialData?.fgItem) {
        const itemObj = typeof initialData.fgItem === "object" ? initialData.fgItem : fgItems.find(f => f._id === initialData.fgItem);
        const existingConfig = priceLists.find(p => (p.fgItem?._id || p.fgItem) === itemObj?._id);

        setFormData({
          fgItem: itemObj?._id || initialData.fgItem || "",
          currency: normalizeCurrencyCode(initialData.currency ?? existingConfig?.currency ?? itemObj?.currency ?? "INR"),
          price: (initialData.price ?? existingConfig?.price ?? itemObj?.sellingPrice ?? "")?.toString(),
          taxRate: (initialData.taxRate ?? existingConfig?.taxRate ?? itemObj?.taxRate ?? "18")?.toString(),
          pricingUnit: initialData.pricingUnit ?? existingConfig?.pricingUnit ?? "",
          isSecondaryUnit: Boolean(initialData.isSecondaryUnit ?? existingConfig?.isSecondaryUnit),
          remarks: initialData.remarks || existingConfig?.remarks || "",
        });
      } else {
        setFormData({
          fgItem: "",
          currency: "INR",
          price: "",
          taxRate: "18",
          pricingUnit: "",
          isSecondaryUnit: false,
          remarks: "",
        });
      }
      setError("");
    }
  }, [isOpen, initialData, fgItems, priceLists]);

  if (!isOpen) return null;

  const handleFgItemSelect = (selectedId: string) => {
    const selectedFg = fgItems.find(f => f._id === selectedId);
    const existingConfig = priceLists.find(p => (p.fgItem?._id || p.fgItem) === selectedId);

    setFormData(prev => ({
      ...prev,
      fgItem: selectedId,
      currency: normalizeCurrencyCode(existingConfig?.currency ?? selectedFg?.currency ?? prev.currency ?? "INR"),
      price: (existingConfig?.price ?? selectedFg?.sellingPrice ?? prev.price)?.toString(),
      taxRate: (existingConfig?.taxRate ?? selectedFg?.taxRate ?? prev.taxRate ?? "18")?.toString(),
      pricingUnit: existingConfig?.pricingUnit ?? (selectedFg?.hasSecondaryUnit ? selectedFg.unit : ""),
      isSecondaryUnit: Boolean(existingConfig?.isSecondaryUnit),
      remarks: existingConfig?.remarks || prev.remarks,
    }));
  };

  const selectedFgObj = fgItems.find(f => f._id === formData.fgItem) || (typeof initialData?.fgItem === "object" ? initialData?.fgItem : null);
  const isPreSelected = !!initialData?.fgItem;
  const resolvedHsnCode = selectedFgObj?.hsnCode || initialData?.hsnCode || "";

  const hasDualUnit = Boolean(
    selectedFgObj?.hasSecondaryUnit &&
    selectedFgObj?.secondaryUnit &&
    Number(selectedFgObj?.conversionFactor) > 0
  );
  const primaryUnit = selectedFgObj?.unit || 'Nos';
  const secondaryUnit = selectedFgObj?.secondaryUnit || '';
  const factor = Number(selectedFgObj?.conversionFactor) || 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fgItem) {
      setError("Please select a Finished Good.");
      return;
    }
    if (formData.price === "" || Number(formData.price) < 0) {
      setError("Please enter a valid selling price.");
      return;
    }
    if (formData.taxRate === "" || Number(formData.taxRate) < 0) {
      setError("Please select a valid tax rate.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onSubmit({
        ...formData,
        currency: normalizeCurrencyCode(formData.currency),
        price: Number(formData.price),
        taxRate: Number(formData.taxRate),
        hsnCode: resolvedHsnCode,
        pricingUnit: hasDualUnit ? (formData.isSecondaryUnit ? secondaryUnit : primaryUnit) : primaryUnit,
        isSecondaryUnit: Boolean(hasDualUnit && formData.isSecondaryUnit),
      });
    } catch (err: any) {
      setError(err?.data?.message || err?.message || "Failed to save price list.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col my-auto max-h-[92vh] border border-gray-100 dark:border-gray-800">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Tag size={18} />
            </div>
            {isPreSelected ? "Edit Price & Tax Rate" : "Set FG Price & Tax Rate"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-start gap-2.5 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form id="priceListForm" onSubmit={handleSubmit} className="space-y-4">
            
            {/* FG Item Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Finished Good (FG Item) <span className="text-red-500">*</span>
              </label>

              {isPreSelected && selectedFgObj ? (
                <div className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">{selectedFgObj.name || "N/A"}</div>
                    {getItemDescription(selectedFgObj) && (
                      <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">{getItemDescription(selectedFgObj)}</div>
                    )}
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">Locked</span>
                </div>
              ) : (
                <select
                  required
                  value={formData.fgItem}
                  onChange={(e) => handleFgItemSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Finished Good...</option>
                  {fgItems.map(fg => (
                    <option key={fg._id} value={fg._id}>
                      {formatItemSelectLabel(fg)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Dual-Unit Selection Box (shown if FG has secondary unit) */}
            {hasDualUnit && (
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/40 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <span>Pricing Unit</span>
                    <span className="text-[10px] font-normal text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded">
                      Dual Unit Item
                    </span>
                  </label>
                  <span className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300">
                    1 {primaryUnit} = {factor} {secondaryUnit}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isSecondaryUnit: false, pricingUnit: primaryUnit }))}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                      !formData.isSecondaryUnit
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>Per {primaryUnit}</span>
                    <span className={`text-[10px] font-normal ${!formData.isSecondaryUnit ? "text-indigo-100" : "text-slate-400"}`}>
                      Primary Unit
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isSecondaryUnit: true, pricingUnit: secondaryUnit }))}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                      formData.isSecondaryUnit
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>Per {secondaryUnit}</span>
                    <span className={`text-[10px] font-normal ${formData.isSecondaryUnit ? "text-indigo-100" : "text-slate-400"}`}>
                      Secondary Unit
                    </span>
                  </button>
                </div>

                {/* Live Equivalent Calculation */}
                {formData.price && !isNaN(Number(formData.price)) && Number(formData.price) > 0 && (
                  <div className="text-[11px] font-medium text-indigo-800 dark:text-indigo-200 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/40 flex items-center justify-between font-mono">
                    <span>Equivalent Rate ({formData.currency}):</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formData.isSecondaryUnit
                        ? `${getCurrencySymbol(formData.currency)}${(Number(formData.price) * factor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${primaryUnit}`
                        : `${getCurrencySymbol(formData.currency)}${(Number(formData.price) / factor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${secondaryUnit}`
                      }
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Currency, Selling Price & Tax Rate Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              {/* Currency Selector Dropdown */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                  <Globe size={13} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Currency</span> <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  required
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol.trim()}) — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selling Price */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 truncate">
                  Price ({getCurrencySymbol(formData.currency)} / {hasDualUnit ? (formData.isSecondaryUnit ? secondaryUnit : primaryUnit) : primaryUnit}) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs text-indigo-600 dark:text-indigo-400 font-bold font-mono">
                    {getCurrencySymbol(formData.currency)}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* Tax Rate */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Tax Rate (%) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  required
                >
                  <option value="0">0% (Nil)</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST (Std)</option>
                  <option value="28">28% GST</option>
                </select>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Remarks / Notes
              </label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 resize-none"
                rows={2}
                placeholder="Optional notes or validity..."
              />
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="priceListForm"
            disabled={loading}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save size={16} />
            {loading ? "Saving..." : "Save FG Price"}
          </button>
        </div>
      </div>
    </div>
  );
}
