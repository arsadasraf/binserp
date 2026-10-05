"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Factory, 
  Plus, 
  Trash2, 
  Zap, 
  Boxes, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Layers,
  Sparkles
} from "lucide-react";
import { apiRequest } from "@/src/lib/api";
import { formatItemSelectLabel, getItemDescription, ItemNameAndDescription } from "@/src/utils/itemDisplayHelper";

interface ConsumedRow {
  materialId: string;
  materialName: string;
  materialCode: string;
  materialDescription?: string;
  itemType: "rm" | "bo" | "component";
  unit: string;
  availableWipQty: number;
  quantity: string;
  hasSecondaryUnit?: boolean;
  secondaryUnit?: string;
  conversionFactor?: number;
  secondaryQuantity?: number;
}

interface WipMultiItemConvertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg?: string) => void;
  onError: (msg: string) => void;
  initialWipItems?: any[];
}

export default function WipMultiItemConvertModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  initialWipItems = [],
}: WipMultiItemConvertModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingBoms, setLoadingBoms] = useState(false);

  // Catalogs
  const [existingTargets, setExistingTargets] = useState<any[]>([]);
  const [availableWipStockList, setAvailableWipStockList] = useState<any[]>([]);
  const [allBoms, setAllBoms] = useState<any[]>([]);

  // Target item state
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [targetItemName, setTargetItemName] = useState<string>("");
  const [targetItemCode, setTargetItemCode] = useState<string>("");
  const [targetDescription, setTargetDescription] = useState<string>("");
  const [targetType, setTargetType] = useState<string>("Component");
  const [targetQuantity, setTargetQuantity] = useState<string>("1");
  const [targetUnit, setTargetUnit] = useState<string>("PCS");
  const [isCustomTarget, setIsCustomTarget] = useState(false);

  // Consumed ingredients list
  const [consumedRows, setConsumedRows] = useState<ConsumedRow[]>([]);
  const [selectedIngredientToAdd, setSelectedIngredientToAdd] = useState<string>("");

  // Audit / Linkage
  const [mrpNumber, setMrpNumber] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTargetId("");
      setTargetItemName("");
      setTargetItemCode("");
      setTargetDescription("");
      setTargetType("Component");
      setTargetQuantity("1");
      setTargetUnit("PCS");
      setIsCustomTarget(false);
      setConsumedRows([]);
      setSelectedIngredientToAdd("");
      setMrpNumber("");
      setRemarks("");

      // Fetch catalogs and current shopfloor WIP
      fetchCatalogsAndWip();
    }
  }, [isOpen]);

  const fetchCatalogsAndWip = async () => {
    try {
      setLoading(true);
      const [fgRes, wipRmRes, wipBoRes, bomRes] = await Promise.all([
        apiRequest("/api/store/fg-item").catch(() => null),
        apiRequest("/api/store/wip/inventory?type=rm").catch(() => null),
        apiRequest("/api/store/wip/inventory?type=bo").catch(() => null),
        apiRequest("/api/store/bom").catch(() => null),
      ]);

      // 1. Process Target Catalogs (FG + Components)
      const targetMap = new Map();
      if (fgRes && fgRes.ok) {
        const fgData = await fgRes.json().catch(() => null);
        const list = fgData?.fgItems || fgData?.items || (Array.isArray(fgData) ? fgData : []);
        list.forEach((item: any) => {
          const id = String(item._id || item.id);
          if (id) {
            targetMap.set(id, {
              id,
              name: item.name,
              code: item.code || "",
              description: getItemDescription(item),
              unit: item.unit || "PCS",
              type: item.type || item.fgType || "Component"
            });
          }
        });
      }
      setExistingTargets(Array.from(targetMap.values()));

      // 2. Process Available Shopfloor WIP Items (RM & BO with shopfloorWipQty > 0)
      const availableItems: any[] = [];

      const processWipList = async (res: any, defaultType: "rm" | "bo") => {
        if (!res || !res.ok) return;
        const data = await res.json().catch(() => null);
        const list = data?.items || data?.wipItems || (Array.isArray(data) ? data : []);
        list.forEach((wip: any) => {
          const sfQty = Number(wip.shopfloorWipQty || 0);
          if (sfQty > 0) {
            availableItems.push({
              materialId: wip.materialId || wip._id || wip.id,
              materialName: wip.materialName || wip.name,
              materialCode: wip.materialCode || wip.code || "",
              materialDescription: wip.materialDescription || wip.description || "",
              itemType: wip.itemType || defaultType,
              unit: wip.unit || "PCS",
              shopfloorWipQty: sfQty,
              hasSecondaryUnit: Boolean(wip.hasSecondaryUnit),
              secondaryUnit: wip.secondaryUnit || "",
              conversionFactor: Number(wip.conversionFactor) || 1,
            });
          }
        });
      };

      await Promise.all([
        processWipList(wipRmRes, "rm"),
        processWipList(wipBoRes, "bo"),
      ]);

      setAvailableWipStockList(availableItems);

      // 3. Process BOMs
      if (bomRes && bomRes.ok) {
        const bomData = await bomRes.json().catch(() => null);
        const bList = bomData?.boms || bomData?.items || (Array.isArray(bomData) ? bomData : []);
        setAllBoms(bList);
      }
    } catch (err) {
      console.error("Error loading WIP Multi-Convert data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Find linked BOM for the currently selected target
  const linkedBom = useMemo(() => {
    if (!selectedTargetId && !targetItemName) return null;
    return allBoms.find(b => 
      (selectedTargetId && (String(b.finishedGoods) === String(selectedTargetId) || String(b.fgItem) === String(selectedTargetId))) ||
      (targetItemName && b.productName && b.productName.trim().toLowerCase() === targetItemName.trim().toLowerCase())
    );
  }, [selectedTargetId, targetItemName, allBoms]);

  // Handle Target Selection Change
  const handleSelectTarget = (targetId: string) => {
    if (targetId === "__custom__") {
      setIsCustomTarget(true);
      setSelectedTargetId("");
      setTargetItemName("");
      setTargetItemCode("");
      setTargetDescription("");
      setTargetUnit("PCS");
      setTargetType("Component");
      return;
    }

    setIsCustomTarget(false);
    setSelectedTargetId(targetId);
    const found = existingTargets.find(t => String(t.id) === String(targetId));
    if (found) {
      setTargetItemName(found.name);
      setTargetItemCode(found.code);
      setTargetDescription(found.description);
      setTargetUnit(found.unit || "PCS");
      setTargetType(found.type || "Component");
    }
  };

  // Auto-populate ingredients from BOM
  const handlePopulateFromBom = () => {
    if (!linkedBom || !Array.isArray(linkedBom.items) || linkedBom.items.length === 0) {
      onError("No Bill of Materials (BOM) items found for this target product");
      return;
    }

    const targetQtyNum = parseFloat(targetQuantity) || 1;
    const newRows: ConsumedRow[] = [];

    linkedBom.items.forEach((bi: any) => {
      const bomMatName = bi.materialName || bi.name || "";
      const bomMatId = bi.material || bi.materialId || bi._id;
      const ratio = Number(bi.quantity) || 1;
      const totalNeeded = parseFloat((ratio * targetQtyNum).toFixed(4));

      // Match with available Shopfloor WIP
      const match = availableWipStockList.find(av => 
        (bomMatId && String(av.materialId) === String(bomMatId)) ||
        (bomMatName && av.materialName && av.materialName.trim().toLowerCase() === bomMatName.trim().toLowerCase())
      );

      newRows.push({
        materialId: match ? match.materialId : (bomMatId ? String(bomMatId) : `gen_${Date.now()}_${Math.random()}`),
        materialName: match ? match.materialName : bomMatName,
        materialCode: match ? match.materialCode : (bi.materialCode || ""),
        materialDescription: match ? match.materialDescription : (bi.description || ""),
        itemType: (bi.itemType || bi.type || "rm").toLowerCase().includes("bought") ? "bo" : "rm",
        unit: match ? match.unit : (bi.unit || "PCS"),
        availableWipQty: match ? match.shopfloorWipQty : 0,
        quantity: totalNeeded.toString(),
        hasSecondaryUnit: match?.hasSecondaryUnit,
        secondaryUnit: match?.secondaryUnit,
        conversionFactor: match?.conversionFactor,
      });
    });

    setConsumedRows(newRows);
  };

  // Add individual ingredient from Shopfloor WIP
  const handleAddIngredient = () => {
    if (!selectedIngredientToAdd) return;
    const item = availableWipStockList.find(i => String(i.materialId) === String(selectedIngredientToAdd));
    if (!item) return;

    if (consumedRows.some(r => String(r.materialId) === String(item.materialId))) {
      onError(`"${item.materialName}" is already added to the consumption table`);
      return;
    }

    setConsumedRows(prev => [
      ...prev,
      {
        materialId: item.materialId,
        materialName: item.materialName,
        materialCode: item.materialCode,
        materialDescription: item.materialDescription,
        itemType: item.itemType,
        unit: item.unit,
        availableWipQty: item.shopfloorWipQty,
        quantity: "1",
        hasSecondaryUnit: item.hasSecondaryUnit,
        secondaryUnit: item.secondaryUnit,
        conversionFactor: item.conversionFactor,
      }
    ]);
    setSelectedIngredientToAdd("");
  };

  const handleUpdateConsumedQty = (idx: number, qtyVal: string) => {
    setConsumedRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], quantity: qtyVal };
      return copy;
    });
  };

  const handleRemoveIngredient = (idx: number) => {
    setConsumedRows(prev => prev.filter((_, i) => i !== idx));
  };

  // Validation checks
  const numTargetQty = parseFloat(targetQuantity);
  const isTargetQtyValid = !isNaN(numTargetQty) && numTargetQty > 0;
  const isTargetNameValid = Boolean(targetItemName.trim());

  const hasAnyShortage = useMemo(() => {
    return consumedRows.some(r => {
      const q = parseFloat(r.quantity) || 0;
      return q <= 0 || q > r.availableWipQty;
    });
  }, [consumedRows]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isTargetNameValid) {
      onError("Please select or enter a valid Target WIP FG / Component Name");
      return;
    }

    if (!isTargetQtyValid) {
      onError("Please enter a valid target produced quantity greater than 0");
      return;
    }

    if (consumedRows.length === 0) {
      onError("Please add at least one RM or BO item to consume from Shopfloor WIP");
      return;
    }

    if (hasAnyShortage) {
      onError("One or more consumed items exceed available Shopfloor WIP stock or have invalid quantities");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        targetItemId: selectedTargetId || undefined,
        targetItemName: targetItemName.trim(),
        targetItemCode: targetItemCode.trim(),
        targetDescription: targetDescription.trim(),
        targetType: targetType || "Component",
        targetQuantity: numTargetQty,
        targetUnit: targetUnit.trim() || "PCS",
        mrpNumber: mrpNumber.trim(),
        remarks: remarks.trim() || `In-house WIP Assembly (${consumedRows.length} items)`,
        consumedItems: consumedRows.map(r => ({
          materialId: r.materialId,
          materialName: r.materialName,
          materialCode: r.materialCode,
          itemType: r.itemType,
          quantity: parseFloat(r.quantity),
          unit: r.unit,
          hasSecondaryUnit: r.hasSecondaryUnit,
          secondaryUnit: r.secondaryUnit,
          conversionFactor: r.conversionFactor
        }))
      };

      const res = await apiRequest("/api/store/wip/convert-multiple-to-fg", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to convert WIP stock into FG Component");
      }

      onSuccess(data.message || `Successfully produced ${numTargetQty} ${targetUnit} of ${targetItemName} in Shopfloor WIP`);
      onClose();
    } catch (err: any) {
      console.error("Multi-WIP conversion error:", err);
      onError(err.message || "Failed to process Shopfloor WIP conversion");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[94vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md shadow-inner">
              <Factory size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">Assemble / Convert to WIP FG</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/40 text-indigo-100 border border-white/20">
                  Shopfloor WIP
                </span>
              </div>
              <p className="text-xs text-indigo-100/80 mt-0.5">
                Consume multiple Raw Materials &amp; Bought-Outs from Shopfloor to produce an In-house WIP FG Item
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          
          {/* Section 1: Target Finished Good / Component */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/70 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                <Boxes size={18} />
                <span>1. Target In-House WIP FG / Component</span>
              </div>
              {linkedBom && (
                <button
                  type="button"
                  onClick={handlePopulateFromBom}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer animate-pulse"
                >
                  <Zap size={14} />
                  <span>Auto-fill Ingredients from BOM ({linkedBom.items?.length || 0} items)</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Target Item Selector */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Target Product Name &amp; Description <span className="text-rose-500">*</span>
                </label>
                <select
                  value={isCustomTarget ? "__custom__" : selectedTargetId}
                  onChange={(e) => handleSelectTarget(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Existing FG / Component --</option>
                  {existingTargets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatItemSelectLabel(item)}
                    </option>
                  ))}
                  <option value="__custom__">✨ + Enter New / Custom Component Name</option>
                </select>
                {isCustomTarget && (
                  <input
                    type="text"
                    placeholder="Enter custom WIP FG / Component name..."
                    value={targetItemName}
                    onChange={(e) => setTargetItemName(e.target.value)}
                    className="w-full mt-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-indigo-400 dark:border-indigo-600 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                )}
                {targetDescription && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic px-1 line-clamp-2">
                    {targetDescription}
                  </p>
                )}
              </div>

              {/* Target Produced Quantity */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Produced Qty (WIP) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={targetQuantity}
                  onChange={(e) => setTargetQuantity(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Target Unit */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Unit
                </label>
                <input
                  type="text"
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  placeholder="PCS / Nos"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Source RM & BO Consumed Items */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-700/70 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                <Layers size={18} />
                <span>2. Ingredients Consumed from Shopfloor WIP ({consumedRows.length} items)</span>
              </div>

              {/* Add Material Select & Button */}
              <div className="flex items-center gap-2 max-w-md w-full sm:w-auto">
                <select
                  value={selectedIngredientToAdd}
                  onChange={(e) => setSelectedIngredientToAdd(e.target.value)}
                  className="flex-1 sm:w-72 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 truncate"
                >
                  <option value="">+ Add RM / BO from Shopfloor WIP...</option>
                  {availableWipStockList.map((item) => (
                    <option key={item.materialId} value={item.materialId}>
                      {formatItemSelectLabel(item)} [Floor: {item.shopfloorWipQty} {item.unit}]
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  disabled={!selectedIngredientToAdd}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* Consumed Rows Table */}
            {consumedRows.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white/60 dark:bg-slate-900/40">
                <Boxes className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  No ingredients added yet
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pick RM / BO items from the selector above or use "Auto-fill Ingredients from BOM"
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3">Material &amp; Technical Description</th>
                      <th className="px-4 py-3 text-center">Category</th>
                      <th className="px-4 py-3 text-center">Shopfloor Balance</th>
                      <th className="px-4 py-3 text-center w-40">Consumed Quantity</th>
                      <th className="px-4 py-3 text-center">Unit</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {consumedRows.map((row, idx) => {
                      const numQty = parseFloat(row.quantity) || 0;
                      const isShortage = numQty > row.availableWipQty;
                      const isZeroOrNegative = numQty <= 0;

                      return (
                        <tr key={`${row.materialId}_${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 max-w-[260px]">
                            <ItemNameAndDescription
                              name={row.materialName}
                              description={row.materialDescription}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              row.itemType === "bo"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            }`}>
                              {row.itemType === "bo" ? "Bought Out" : "Raw Material"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                            {row.availableWipQty} {row.unit}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="0.0001"
                              step="any"
                              value={row.quantity}
                              onChange={(e) => handleUpdateConsumedQty(idx, e.target.value)}
                              className={`w-32 px-2.5 py-1.5 rounded-lg border text-center font-mono font-bold text-xs focus:ring-2 ${
                                isShortage 
                                  ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-300 focus:ring-rose-500" 
                                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-indigo-500"
                              }`}
                              placeholder="Consumed Qty"
                              required
                            />
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-500">
                            {row.unit}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isShortage ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                <AlertCircle size={12} /> Exceeds Stock
                              </span>
                            ) : isZeroOrNegative ? (
                              <span className="text-[10px] font-bold text-amber-600">Enter Qty</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={12} /> Available
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredient(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Linkage & Process Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                MRP Plan Number (Optional)
              </label>
              <input
                type="text"
                value={mrpNumber}
                onChange={(e) => setMrpNumber(e.target.value)}
                placeholder="e.g. MRP-2026-0042"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Assembly Remarks / Notes
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Assembled Line #1 for pre-machining..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {consumedRows.length > 0 && (
              <span>
                Ready to assemble <strong className="text-slate-800 dark:text-slate-200">{targetQuantity} {targetUnit}</strong> from{" "}
                <strong className="text-indigo-600">{consumedRows.length} items</strong>.
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !isTargetNameValid || !isTargetQtyValid || consumedRows.length === 0 || hasAnyShortage}
              className="px-6 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Factory size={15} />
                  <span>Execute WIP Conversion</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
