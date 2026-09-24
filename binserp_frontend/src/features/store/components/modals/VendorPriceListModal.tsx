"use client";
import { useState, useEffect, useMemo } from "react";
import { X, Save, AlertCircle, Layers, Tag } from "lucide-react";
import SearchableSelect from "../SearchableSelect";
import { apiGet } from "@/src/lib/api";
import { formatItemSelectLabel, getItemDescription } from "@/src/utils/itemDisplayHelper";

interface VendorPriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  materials?: any[]; 
  rawMaterials?: any[];
  boughtOuts?: any[];
  consumables?: any[];
  vendors?: any[];
}

export default function VendorPriceListModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  materials: propMaterials,
  rawMaterials: propRawMaterials,
  boughtOuts: propBoughtOuts,
  consumables: propConsumables,
  vendors: propVendors,
}: VendorPriceListModalProps) {
  const [itemType, setItemType] = useState<'rm' | 'bo' | 'consumable'>('rm');
  const [formData, setFormData] = useState({
    material: "",
    vendor: "",
    price: "",
    taxRate: "18",
    isPreferred: false,
    pricingUnit: "",
    isSecondaryUnit: false,
    remarks: "",
  });

  const [rawMaterialsList, setRawMaterialsList] = useState<any[]>([]);
  const [boughtOutsList, setBoughtOutsList] = useState<any[]>([]);
  const [consumablesList, setConsumablesList] = useState<any[]>([]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch feeds if not passed
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

      if (propVendors && propVendors.length > 0) {
        setVendorsList(propVendors);
      } else {
        apiGet('/api/store/vendor', token)
          .then(res => setVendorsList(Array.isArray(res) ? res : (res?.vendors || res?.data || [])))
          .catch(() => setVendorsList([]));
      }
    }
  }, [isOpen, propRawMaterials, propBoughtOuts, propConsumables, propVendors]);

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
          vendor: initialData.vendor?._id || initialData.vendor || "",
          price: initialData.price?.toString() || "",
          taxRate: initialData.taxRate?.toString() || "18",
          isPreferred: Boolean(initialData.isPreferred),
          pricingUnit: initialData.pricingUnit || "",
          isSecondaryUnit: Boolean(initialData.isSecondaryUnit),
          remarks: initialData.remarks || "",
        });
      } else {
        setFormData({
          material: "",
          vendor: "",
          price: "",
          taxRate: "18",
          isPreferred: false,
          pricingUnit: "",
          isSecondaryUnit: false,
          remarks: "",
        });
      }
      setError("");
    }
  }, [isOpen, initialData]);

  // Find selected material object to inspect dual-unit settings
  const selectedMaterialObj = useMemo(() => {
    if (!formData.material) return null;
    let list: any[] = [];
    if (itemType === 'rm') list = rawMaterialsList.length > 0 ? rawMaterialsList : (propRawMaterials || propMaterials || []);
    else if (itemType === 'bo') list = boughtOutsList.length > 0 ? boughtOutsList : (propBoughtOuts || propMaterials || []);
    else list = consumablesList.length > 0 ? consumablesList : (propConsumables || propMaterials || []);

    const found = list.find((m: any) => (m._id || m.id)?.toString() === formData.material?.toString());
    if (found) return found;
    if (initialData?.material && typeof initialData.material === 'object') return initialData.material;
    return null;
  }, [formData.material, itemType, rawMaterialsList, boughtOutsList, consumablesList, propRawMaterials, propBoughtOuts, propConsumables, propMaterials, initialData]);

  const hasDualUnit = Boolean(
    selectedMaterialObj?.hasSecondaryUnit &&
    selectedMaterialObj?.secondaryUnit &&
    Number(selectedMaterialObj?.conversionFactor) > 0
  );
  const primaryUnit = selectedMaterialObj?.unit || 'PCS';
  const secondaryUnit = selectedMaterialObj?.secondaryUnit || '';
  const factor = Number(selectedMaterialObj?.conversionFactor) || 1;

  const activeMaterialOptions = useMemo(() => {
    let list: any[] = [];
    if (itemType === 'rm') {
      list = rawMaterialsList;
      if ((!list || list.length === 0) && Array.isArray(propMaterials)) {
        list = propMaterials.filter(m => {
          const t = (m.type || m.itemType || m.category?.name || '').toLowerCase();
          return !t.includes('bought') && !t.includes('bo') && !t.includes('consumable');
        });
      }
    } else if (itemType === 'bo') {
      list = boughtOutsList;
      if ((!list || list.length === 0) && Array.isArray(propMaterials)) {
        list = propMaterials.filter(m => {
          const t = (m.type || m.itemType || m.category?.name || '').toLowerCase();
          return t.includes('bought') || t.includes('bo');
        });
      }
    } else if (itemType === 'consumable') {
      list = consumablesList;
      if ((!list || list.length === 0) && Array.isArray(propMaterials)) {
        list = propMaterials.filter(m => {
          const t = (m.type || m.itemType || m.category?.name || '').toLowerCase();
          return t.includes('consumable');
        });
      }
    }

    return (Array.isArray(list) ? list : []).map(m => ({
      value: m._id,
      label: formatItemSelectLabel(m),
      description: getItemDescription(m)
    }));
  }, [itemType, rawMaterialsList, boughtOutsList, consumablesList, propMaterials]);

  const vendorOptions = useMemo(() => {
    const list = [
      { value: "", label: "-- None (Standard Base Price) --" }
    ];
    (Array.isArray(vendorsList) ? vendorsList : []).forEach(v => {
      list.push({
        value: v._id,
        label: `${v.name || 'Vendor'} ${v.code ? `(${v.code})` : ''}`
      });
    });
    return list;
  }, [vendorsList]);

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
        vendor: formData.vendor || null,
        price: Number(formData.price),
        taxRate: Number(formData.taxRate),
        isPreferred: Boolean(formData.vendor && formData.isPreferred),
        pricingUnit: hasDualUnit ? (formData.isSecondaryUnit ? secondaryUnit : primaryUnit) : primaryUnit,
        isSecondaryUnit: Boolean(hasDualUnit && formData.isSecondaryUnit),
        remarks: formData.remarks,
      });
    } catch (err: any) {
      const errorMsg =
        err?.data?.message ||
        err?.data?.error ||
        err?.message ||
        err?.error ||
        "Failed to save price list. Please check your inputs and try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border border-gray-100 dark:border-gray-800">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/75 dark:bg-gray-800/60">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {initialData ? "Edit Item Price List" : "Set Item Price List"}
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
                  <div className="font-bold">{initialData.material.name}</div>
                  {getItemDescription(initialData.material) && (
                    <div className="text-[11px] text-slate-500 italic mt-0.5">{getItemDescription(initialData.material)}</div>
                  )}
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

            {/* Dual-Unit Selection Box (shown if item has secondary unit) */}
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
                    <span>Equivalent Rate:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formData.isSecondaryUnit
                        ? `₹${(Number(formData.price) * factor).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${primaryUnit}`
                        : `₹${(Number(formData.price) / factor).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${secondaryUnit}`
                      }
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Price (₹ per {hasDualUnit ? (formData.isSecondaryUnit ? secondaryUnit : primaryUnit) : primaryUnit}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
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
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
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

            {/* Vendor / Supplier (Optional Reference) */}
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                  <span>Vendor / Supplier (Optional)</span>
                  <span className="text-[11px] font-normal text-slate-400">Leave blank for standard base rate</span>
                </label>
                <SearchableSelect
                  options={vendorOptions}
                  value={formData.vendor}
                  onChange={(val: any) => setFormData(prev => ({ ...prev, vendor: val }))}
                  placeholder="-- None (Standard Base Price) --"
                />
              </div>

              {/* Set as Preferred Supplier Checkbox (only shown if vendor selected) */}
              {formData.vendor && (
                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-xl flex items-start gap-2.5 animate-in fade-in duration-100">
                  <input
                    type="checkbox"
                    id="isPreferredVendor"
                    checked={formData.isPreferred}
                    onChange={(e) => setFormData({ ...formData, isPreferred: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300 mt-0.5 cursor-pointer"
                  />
                  <label htmlFor="isPreferredVendor" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      ⭐ Preferred Supplier for this Material
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Procurement Workbench will prioritize this vendor quote when generating Purchase Orders.
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Remarks (Optional)
              </label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
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
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Save size={15} />
            {loading ? "Saving..." : (initialData ? "Update Price List" : "Save Price List")}
          </button>
        </div>
      </div>
    </div>
  );
}
