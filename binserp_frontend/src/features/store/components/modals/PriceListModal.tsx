"use client";
import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle, Tag, DollarSign, Percent } from "lucide-react";
import SearchableSelect from "../SearchableSelect";

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
    price: "",
    taxRate: "18",
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
          price: (initialData.price ?? existingConfig?.price ?? itemObj?.sellingPrice ?? "")?.toString(),
          taxRate: (initialData.taxRate ?? existingConfig?.taxRate ?? itemObj?.taxRate ?? "18")?.toString(),
          remarks: initialData.remarks || existingConfig?.remarks || "",
        });
      } else {
        setFormData({
          fgItem: "",
          price: "",
          taxRate: "18",
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
      price: (existingConfig?.price ?? selectedFg?.sellingPrice ?? prev.price)?.toString(),
      taxRate: (existingConfig?.taxRate ?? selectedFg?.taxRate ?? prev.taxRate ?? "18")?.toString(),
      remarks: existingConfig?.remarks || prev.remarks
    }));
  };

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
        price: Number(formData.price),
        taxRate: Number(formData.taxRate),
      });
    } catch (err: any) {
      setError(err?.data?.message || err?.message || "Failed to save price list.");
    } fienerally {
      setLoading(false);
    }
  };

  const isPreSelected = !!initialData?.fgItem;
  const selectedFgObj = fgItems.find(f => f._id === formData.fgItem) || (typeof initialData?.fgItem === "object" ? initialData?.fgItem : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800">
        
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
                <div className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white flex items-center justify-between">
                  <span>{selectedFgObj.name} ({selectedFgObj.code || 'FG'})</span>
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
                      {fg.name} ({fg.code || 'FG'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Price & Tax Rate Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Selling Price (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs text-gray-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Tax Rate (%) (GST) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="0">0% (Nil / Exempt)</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST (Standard)</option>
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
