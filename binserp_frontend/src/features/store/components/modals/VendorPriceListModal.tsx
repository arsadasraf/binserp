"use client";
import { useState, useEffect, useMemo } from "react";
import { X, Save, AlertCircle, Layers, Tag } from "lucide-react";
import SearchableSelect from "../SearchableSelect";
import { apiGet } from "@/src/lib/api";

interface VendorPriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  materials?: any[]; 
  rawMaterials?: any[];
  boughtOuts?: any[];
  consumables?: any[];
}

export default function VendorPriceListModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  rawMaterials: propRawMaterials,
  boughtOuts: propBoughtOuts,
  consumables: propConsumables,
}: VendorPriceListModalProps) {
  const [itemType, setItemType] = useState<'rm' | 'bo' | 'consumable'>('rm');
  const [formData, setFormData] = useState({
    material: "",
    price: "",
    taxRate: "18",
    remarks: "",
  });

  const [rawMaterialsList, setRawMaterialsList] = useState<any[]>([]);
  const [boughtOutsList, setBoughtOutsList] = useState<any[]>([]);
  const [consumablesList, setConsumablesList] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch 3 separate inventory feeds if not passed
  useEffect(() => {
    if (isOpen) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) return;

      if (propRawMaterials && propRawMaterials.length > 0) {
        setRawMaterialsList(propRawMaterials);
      } else {
        apiGet('/api/store/raw-material', token)
          .then(res => setRawMaterialsList(Array.isArray(res) ? res : (res?.rawMaterials || [])))
          .catch(() => setRawMaterialsList([]));
      }

      if (propBoughtOuts && propBoughtOuts.length > 0) {
        setBoughtOutsList(propBoughtOuts);
      } else {
        apiGet('/api/store/bought-out', token)
          .then(res => setBoughtOutsList(Array.isArray(res) ? res : (res?.boughtOuts || [])))
          .catch(() => setBoughtOutsList([]));
      }

      if (propConsumables && propConsumables.length > 0) {
        setConsumablesList(propConsumables);
      } else {
        apiGet('/api/store/consumable-item', token)
          .then(res => setConsumablesList(Array.isArray(res) ? res : (res?.consumables || res?.consumableItems || [])))
          .catch(() => setConsumablesList([]));
      }
    }
  }, [isOpen, propRawMaterials, propBoughtOuts, propConsumables]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const matId = initialData.material?._id || initialData.material || "";
        const detectedCat = initialData.itemCategory || initialData.material?.itemCategory || initialData.category;
        if (detectedCat === 'rm' || detectedCat === 'bo' || detectedCat === 'consumable') {
          setItemType(detectedCat);
        }
        setFormData({
          material: matId,
          price: initialData.price?.toString() || "",
          taxRate: initialData.taxRate?.toString() || "18",
          remarks: initialData.remarks || "",
        });
      } else {
        setFormData({
          material: "",
          price: "",
          taxRate: "18",
          remarks: "",
        });
      }
      setError("");
    }
  }, [isOpen, initialData]);

  const activeMaterialOptions = useMemo(() => {
    let list: any[] = [];
    if (itemType === 'rm') list = rawMaterialsList;
    else if (itemType === 'bo') list = boughtOutsList;
    else if (itemType === 'consumable') list = consumablesList;

    return (Array.isArray(list) ? list : []).map(m => ({
      value: m._id,
      label: `${m.name || 'Unnamed'} ${m.code ? `(${m.code})` : ''}`
    }));
  }, [itemType, rawMaterialsList, boughtOutsList, consumablesList]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material || formData.price === "" || formData.taxRate === "") {
      setError("Please select a material and provide a valid Price and Tax Rate.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onSubmit({
        material: formData.material,
        price: Number(formData.price),
        taxRate: Number(formData.taxRate),
        remarks: formData.remarks,
      });
    } catch (err: any) {
      setError(err.message || "Failed to save price list.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border border-gray-100 dark:border-gray-800">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/75 dark:bg-gray-800/60">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {initialData ? "Edit Vendor Price Sheet" : "Set Vendor Price Sheet"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-start gap-2.5 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="font-semibold">{error}</p>
            </div>
          )}

          <form id="vendorPriceListForm" onSubmit={handleSubmit} className="space-y-4">
            
            {/* Category 3-way Segmented Buttons */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Select Inventory Type
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setItemType('rm');
                    setFormData(prev => ({ ...prev, material: "" }));
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    itemType === 'rm'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  Raw Material (RM)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItemType('bo');
                    setFormData(prev => ({ ...prev, material: "" }));
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    itemType === 'bo'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  Bought Out (BO)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItemType('consumable');
                    setFormData(prev => ({ ...prev, material: "" }));
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    itemType === 'consumable'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  Consumables
                </button>
              </div>
            </div>

            {/* Material Searchable Dropdown */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {itemType === 'rm' ? 'Raw Material' : itemType === 'bo' ? 'Bought Out Item' : 'Consumable Item'} <span className="text-red-500">*</span>
              </label>
              {initialData?.material?.name ? (
                <div className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-gray-100 font-medium">
                  {initialData.material.name} {initialData.material.code ? `(${initialData.material.code})` : ''}
                </div>
              ) : (
                <SearchableSelect
                  options={activeMaterialOptions}
                  value={formData.material}
                  onChange={(val: any) => setFormData(prev => ({ ...prev, material: val }))}
                  placeholder={`Select ${itemType === 'rm' ? 'Raw Material' : itemType === 'bo' ? 'Bought Out Item' : 'Consumable'}...`}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Tax Rate (%) (GST) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  required
                >
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Remarks (Optional)
              </label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                rows={2}
                placeholder="Optional notes or supplier quote reference..."
              />
            </div>
          </form>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/50 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="vendorPriceListForm"
            disabled={loading}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Save size={15} />
            {loading ? "Saving..." : "Save Price"}
          </button>
        </div>
      </div>
    </div>
  );
}
