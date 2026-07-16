"use client";
import { useState, useEffect, useMemo } from "react";
import { X, Save, AlertCircle, Search } from "lucide-react";

interface VendorPriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  vendors: any[]; 
}

export default function VendorPriceListModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  vendors,
}: VendorPriceListModalProps) {
  const [formData, setFormData] = useState({
    material: "",
    vendors: [] as string[],
    price: "",
    taxRate: "",
    remarks: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vendorSearchTerm, setVendorSearchTerm] = useState("");

  const filteredVendors = useMemo(() => {
    if (!vendorSearchTerm) return vendors;
    const lower = vendorSearchTerm.toLowerCase();
    return vendors.filter(v => v.name?.toLowerCase().includes(lower) || v.code?.toLowerCase().includes(lower));
  }, [vendors, vendorSearchTerm]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          material: initialData.material?._id || initialData.material || "",
          vendors: initialData.vendor ? [initialData.vendor?._id || initialData.vendor] : [],
          price: initialData.price?.toString() || "",
          taxRate: initialData.taxRate?.toString() || "",
          remarks: initialData.remarks || "",
        });
      } else {
        setFormData({
          material: "",
          vendors: [],
          price: "",
          taxRate: "",
          remarks: "",
        });
      }
      setError("");
      setVendorSearchTerm("");
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material || formData.vendors.length === 0 || !formData.price || !formData.taxRate) {
      setError("Please fill all required fields and select at least one vendor.");
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
      setError(err.message || "Failed to save vendor price list.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {initialData && !initialData.isNewAssignment ? "Edit Vendor Price" : "Assign Vendor Price"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form id="vendorPriceListForm" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Selected Material <span className="text-red-500">*</span>
              </label>
              <div className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 font-medium">
                {initialData?.material?.name || "N/A"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Vendor(s) <span className="text-red-500">*</span>
              </label>
              {initialData && !initialData.isNewAssignment ? (
                 <div className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 font-medium">
                   {initialData?.vendor?.name || "N/A"}
                 </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input
                        type="text"
                        placeholder="Search vendors..."
                        value={vendorSearchTerm}
                        onChange={(e) => setVendorSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {filteredVendors.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        {vendorSearchTerm ? "No matching vendors found" : "No vendors available"}
                      </div>
                    ) : (
                      filteredVendors.map((v: any) => (
                        <label key={v._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.vendors.includes(v._id)}
                            onChange={(e) => {
                              const newVendors = e.target.checked
                                ? [...formData.vendors, v._id]
                                : formData.vendors.filter(id => id !== v._id);
                              setFormData({ ...formData, vendors: newVendors });
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{v.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tax Rate (%) (GST) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  required
                >
                  <option value="" disabled>Select Tax Rate</option>
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Remarks
              </label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                rows={3}
                placeholder="Optional notes about this price..."
              />
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="vendorPriceListForm"
            disabled={loading}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-200 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {loading ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
