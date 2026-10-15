"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  X, 
  Warehouse, 
  ArrowRight, 
  Layers, 
  MapPin, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Package,
  Search,
  ChevronDown,
  Sparkles,
  Info,
  Check,
  AlertTriangle
} from "lucide-react";
import { apiRequest } from "@/src/lib/api";

interface MoveWipToFgModalProps {
  isOpen: boolean;
  onClose: () => void;
  wipItem: any;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  token?: string | null;
}

export default function MoveWipToFgModal({
  isOpen,
  onClose,
  wipItem,
  onSuccess,
  onError,
  token,
}: MoveWipToFgModalProps) {
  const [quantity, setQuantity] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [locations, setLocations] = useState<any[]>([]);
  const [remarks, setRemarks] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // MRP Linking States
  const [linkMode, setLinkMode] = useState<"without-mrp" | "with-mrp">("without-mrp");
  const [mrpPlans, setMrpPlans] = useState<any[]>([]);
  const [loadingMrpPlans, setLoadingMrpPlans] = useState(false);
  const [selectedMrpPlanId, setSelectedMrpPlanId] = useState<string>("");
  const [mrpSearchQuery, setMrpSearchQuery] = useState<string>("");
  const [isMrpDropdownOpen, setIsMrpDropdownOpen] = useState(false);
  const mrpDropdownRef = useRef<HTMLDivElement>(null);

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
      setLinkMode("without-mrp");
      setSelectedMrpPlanId("");
      setMrpSearchQuery("");
      setIsMrpDropdownOpen(false);
    }
  }, [isOpen, wipItem]);

  // Close MRP dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mrpDropdownRef.current && !mrpDropdownRef.current.contains(event.target as Node)) {
        setIsMrpDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Load active MRP plans
  useEffect(() => {
    if (isOpen) {
      setLoadingMrpPlans(true);
      apiRequest("/api/purchase/mrp/plans")
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json().catch(() => null);
            const plans = data?.mrpPlans || (Array.isArray(data) ? data : []);
            // Exclude already completed plans
            const active = plans.filter((p: any) => p.status !== "Completed");
            setMrpPlans(active);
          }
        })
        .catch((err) => console.warn("Failed to load MRP plans for WIP transfer:", err))
        .finally(() => setLoadingMrpPlans(false));
    }
  }, [isOpen]);

  // Helper to match target FG item in a given plan's fgItems array
  const getMatchingFgInPlan = (plan: any) => {
    if (!plan || !Array.isArray(plan.fgItems)) return null;
    const targetId = wipItem?.materialId || wipItem?._id || wipItem?.id;
    const targetName = (wipItem?.materialName || wipItem?.name || "").trim().toLowerCase();
    const targetCode = (wipItem?.materialCode || wipItem?.code || "").trim().toLowerCase();

    return plan.fgItems.find((fg: any) => {
      const fgId = fg.fgItem?._id || fg.fgItem;
      const fgName = (fg.fgItemName || fg.name || "").trim().toLowerCase();
      const fgCode = (fg.fgItemCode || fg.code || "").trim().toLowerCase();

      if (targetId && fgId && String(targetId) === String(fgId)) return true;
      if (targetCode && fgCode && targetCode === fgCode) return true;
      if (targetName && fgName && targetName === fgName) return true;
      return false;
    });
  };

  // Filtered & sorted MRP plans (prioritizing plans that match this FG item)
  const filteredMrpPlans = useMemo(() => {
    const q = mrpSearchQuery.trim().toLowerCase();
    return mrpPlans
      .filter((plan) => {
        if (!q) return true;
        const num = (plan.mrpNumber || "").toLowerCase();
        const poNum = (plan.customerPoNumber || "").toLowerCase();
        const cust = (plan.customerName || "").toLowerCase();
        const hasItem = (plan.fgItems || []).some((it: any) => {
          const itName = (it.fgItemName || it.name || "").toLowerCase();
          const itCode = (it.fgItemCode || it.code || "").toLowerCase();
          return itName.includes(q) || itCode.includes(q);
        });
        return num.includes(q) || poNum.includes(q) || cust.includes(q) || hasItem;
      })
      .sort((a, b) => {
        const aMatches = Boolean(getMatchingFgInPlan(a));
        const bMatches = Boolean(getMatchingFgInPlan(b));
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [mrpPlans, mrpSearchQuery, wipItem]);

  // Selected MRP Plan details and item metrics
  const selectedMrpPlan = useMemo(() => {
    return mrpPlans.find((p) => String(p._id || p.id) === String(selectedMrpPlanId)) || null;
  }, [mrpPlans, selectedMrpPlanId]);

  const matchingFgInSelectedPlan = useMemo(() => {
    return selectedMrpPlan ? getMatchingFgInPlan(selectedMrpPlan) : null;
  }, [selectedMrpPlan, wipItem]);

  // MRP Quantity Metrics
  const plannedMRPQuantity = Number(matchingFgInSelectedPlan?.quantity) || 0;
  const alreadyReceivedMRPQuantity = Number(matchingFgInSelectedPlan?.receivedQuantity) || 0;
  const remainingPendingMRPQuantity = Math.max(0, plannedMRPQuantity - alreadyReceivedMRPQuantity);

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

  // Check if transfer exceeds remaining MRP pending quantity
  const isOverMrpPending = linkMode === "with-mrp" && Boolean(selectedMrpPlan) && primaryTransferQty > remainingPendingMRPQuantity;

  // Projected MRP Status Calculation
  const getProjectedMrpStatus = () => {
    if (!selectedMrpPlan) return null;
    if (primaryTransferQty <= 0) return selectedMrpPlan.status || "In Production";

    const totalPlanned = (selectedMrpPlan.fgItems || []).reduce(
      (acc: number, f: any) => acc + (Number(f.quantity) || 0),
      0
    );
    const otherItemsReceived = (selectedMrpPlan.fgItems || []).reduce((acc: number, f: any) => {
      if (f === matchingFgInSelectedPlan) return acc;
      return acc + (Number(f.receivedQuantity) || 0);
    }, 0);

    const projectedThisItemReceived = alreadyReceivedMRPQuantity + primaryTransferQty;
    const projectedTotalReceived = otherItemsReceived + projectedThisItemReceived;

    if (totalPlanned > 0 && projectedTotalReceived >= totalPlanned) {
      return "Completed";
    }
    if (projectedTotalReceived > 0) {
      return "Partially Received";
    }
    return selectedMrpPlan.status || "In Production";
  };

  const projectedMrpStatus = getProjectedMrpStatus();

  const handleSetMax = () => {
    // If MRP is linked, default fill to remaining pending MRP if within WIP stock
    if (linkMode === "with-mrp" && remainingPendingMRPQuantity > 0 && remainingPendingMRPQuantity <= effectiveMax) {
      setQuantity(String(remainingPendingMRPQuantity));
    } else {
      setQuantity(String(effectiveMax));
    }
  };

  const handleFillMrpPending = () => {
    if (remainingPendingMRPQuantity <= 0) return;
    const fillQty = Math.min(effectiveMax, remainingPendingMRPQuantity);
    setQuantity(String(fillQty));
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

    // Strict MRP Validation
    if (linkMode === "with-mrp") {
      if (!selectedMrpPlanId || !selectedMrpPlan) {
        onError("Please select an active MRP Plan to link, or choose 'Without MRP' for direct transfer.");
        return;
      }

      if (!matchingFgInSelectedPlan) {
        onError(`Item "${wipItem.materialName || 'Finished Good'}" does not exist in MRP Plan #${selectedMrpPlan.mrpNumber}. Please select an MRP plan that contains this item.`);
        return;
      }

      if (primaryTransferQty > remainingPendingMRPQuantity) {
        onError(`Transfer quantity (${primaryTransferQty} ${unit}) cannot exceed the remaining MRP requirement (${remainingPendingMRPQuantity} ${unit}) for MRP Plan #${selectedMrpPlan.mrpNumber}. Over-fulfillment is blocked.`);
        return;
      }
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
        mrpPlanId: linkMode === "with-mrp" ? selectedMrpPlanId || undefined : undefined,
        mrpNumber: linkMode === "with-mrp" ? selectedMrpPlan?.mrpNumber || undefined : undefined,
        remarks:
          remarks.trim() ||
          (linkMode === "with-mrp"
            ? `Moved from Shopfloor WIP to Main FG Store (MRP #${selectedMrpPlan?.mrpNumber})`
            : "Moved from Shopfloor WIP to Main FG Store"),
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
          (linkMode === "with-mrp"
            ? `Successfully transferred ${primaryTransferQty} ${unit} to FG Store & updated MRP #${selectedMrpPlan?.mrpNumber} status to '${data?.data?.mrpStatus || projectedMrpStatus}'`
            : `Successfully transferred ${primaryTransferQty} ${unit} of ${wipItem.materialName || "Finished Goods"} to Main Store Inventory`)
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
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center text-white shrink-0 bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
              <Warehouse size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">Move to Main FG Inventory</h3>
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
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Target FG Item Summary (Strict RULE[E:\Binserp\AGENTS.md] Compliance: Bold Name, Italic Description) */}
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

          {/* Desktop 2-Column Responsive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Left Column: Balances, Transfer Quantity, Location & Remarks */}
            <div className="space-y-4">
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

              {/* ==================== TRANSFER QUANTITY INPUT ==================== */}
              <div className="p-4 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/90 dark:border-slate-700/80 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Transfer Quantity <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {hasDualUnit && (
                      <div className="flex items-center gap-1 text-[11px] bg-white dark:bg-slate-800 p-0.5 rounded-md border border-slate-200 dark:border-slate-700">
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
                      className="px-2.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 text-xs font-bold rounded cursor-pointer transition-colors"
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
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border rounded-xl text-slate-900 dark:text-white font-mono font-bold text-base focus:ring-2 focus:border-emerald-500 transition-all pr-16 ${
                      isOverMrpPending
                        ? "border-rose-400 focus:ring-rose-400 bg-rose-50/20"
                        : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500"
                    }`}
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400 pointer-events-none">
                    {activeUnitLabel}
                  </span>
                </div>

                {/* Over Quantity Alert for MRP (Strict rule: alert and block over quantity) */}
                {isOverMrpPending && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-bold animate-in fade-in duration-150">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>
                      Quantity ({primaryTransferQty} {unit}) exceeds remaining MRP requirement ({remainingPendingMRPQuantity} {unit}). Over-fulfillment is not allowed.
                    </span>
                  </div>
                )}

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
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer"
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
                  className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                />
              </div>
            </div>

            {/* Right Column: MRP Plan Linking Section & Transfer Notice */}
            <div className="space-y-4">
              {/* ==================== MRP PLAN LINKING SECTION ==================== */}
              <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Package size={15} className="text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      MRP Plan Association
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">
                    Choose link mode
                  </span>
                </div>

                {/* Segmented Radio Controls */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkMode("without-mrp");
                      setSelectedMrpPlanId("");
                    }}
                    className={`py-2 px-3 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      linkMode === "without-mrp"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <span>Without MRP (Direct)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkMode("with-mrp")}
                    className={`py-2 px-3 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      linkMode === "with-mrp"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                    }`}
                  >
                    <Sparkles size={13} />
                    <span>Link MRP Plan</span>
                  </button>
                </div>

                {/* When 'Link MRP Plan' is Active */}
                {linkMode === "with-mrp" && (
                  <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                    {/* Searchable MRP Dropdown */}
                    <div className="relative" ref={mrpDropdownRef}>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Select Active MRP Plan <span className="text-rose-500">*</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setIsMrpDropdownOpen(!isMrpDropdownOpen)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl text-left text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between cursor-pointer hover:border-purple-400 transition-colors shadow-2xs"
                      >
                        {selectedMrpPlan ? (
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                              {selectedMrpPlan.mrpNumber}
                            </span>
                            {selectedMrpPlan.customerPoNumber && (
                              <span className="text-slate-400 text-[11px]">
                                • PO: {selectedMrpPlan.customerPoNumber}
                              </span>
                            )}
                            {matchingFgInSelectedPlan && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Pending: {remainingPendingMRPQuantity} {unit}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            {loadingMrpPlans ? "Loading active MRP plans..." : "Select an MRP Plan..."}
                          </span>
                        )}
                        <ChevronDown size={15} className={`text-slate-400 transition-transform ${isMrpDropdownOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isMrpDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150 max-h-72 flex flex-col">
                          {/* Keyword Search Input */}
                          <div className="relative mb-2 shrink-0">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                              type="text"
                              value={mrpSearchQuery}
                              onChange={(e) => setMrpSearchQuery(e.target.value)}
                              placeholder="Search MRP #, PO #, Customer, Item..."
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                              autoFocus
                            />
                          </div>

                          {/* Dropdown Options List */}
                          <div className="overflow-y-auto space-y-1 pr-0.5 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredMrpPlans.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-400">
                                No active MRP plans found matching "{mrpSearchQuery}".
                              </div>
                            ) : (
                              filteredMrpPlans.map((plan) => {
                                const isSelected = String(plan._id || plan.id) === String(selectedMrpPlanId);
                                const matchingFg = getMatchingFgInPlan(plan);
                                const planned = Number(matchingFg?.quantity) || 0;
                                const received = Number(matchingFg?.receivedQuantity) || 0;
                                const remaining = Math.max(0, planned - received);

                                return (
                                  <button
                                    key={plan._id || plan.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedMrpPlanId(String(plan._id || plan.id));
                                      setIsMrpDropdownOpen(false);
                                      // Auto-fill quantity if not yet entered
                                      if (!quantity && remaining > 0) {
                                        setQuantity(String(Math.min(effectiveMax, remaining)));
                                      }
                                    }}
                                    className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1 cursor-pointer ${
                                      isSelected
                                        ? "bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800"
                                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                                        <span className="font-mono text-purple-600 dark:text-purple-400 font-extrabold">
                                          {plan.mrpNumber}
                                        </span>
                                        {plan.customerPoNumber && (
                                          <span className="text-[11px] text-slate-500 font-normal">
                                            (PO: {plan.customerPoNumber})
                                          </span>
                                        )}
                                      </div>
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        plan.status === "In Production" 
                                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" 
                                          : plan.status === "Partially Received"
                                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                      }`}>
                                        {plan.status || "Active"}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                                      <span>{plan.customerName || "Customer: Direct Production"}</span>
                                      {matchingFg ? (
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                          <Check size={12} /> Matches Item (Need: {remaining} {unit})
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic text-[10px]">
                                          Item not in plan
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* If selected plan does NOT contain this item: Block alert */}
                    {selectedMrpPlan && !matchingFgInSelectedPlan && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                        <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Item Does Not Exist in this MRP Plan</p>
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                            MRP Plan <b>#{selectedMrpPlan.mrpNumber}</b> does not include "{wipItem.materialName || 'this Finished Good'}". Please choose an MRP Plan that contains this item.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Live MRP Progress & Status Projection Card */}
                    {selectedMrpPlan && matchingFgInSelectedPlan && (
                      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-purple-200/80 dark:border-purple-900/60 space-y-2.5 shadow-xs">
                        <div className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            MRP Fulfillment Progress
                          </span>
                          <button
                            type="button"
                            onClick={handleFillMrpPending}
                            disabled={remainingPendingMRPQuantity <= 0 || effectiveMax <= 0}
                            className="text-[11px] font-extrabold text-purple-600 hover:text-purple-700 dark:text-purple-400 cursor-pointer disabled:opacity-50"
                          >
                            Fill Remaining ({remainingPendingMRPQuantity} {unit})
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Planned</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {plannedMRPQuantity} {unit}
                            </span>
                          </div>
                          <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Received</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {alreadyReceivedMRPQuantity} {unit}
                            </span>
                          </div>
                          <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-lg border border-purple-200 dark:border-purple-800">
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 uppercase font-bold block">Remaining</span>
                            <span className="font-mono font-black text-purple-700 dark:text-purple-300">
                              {remainingPendingMRPQuantity} {unit}
                            </span>
                          </div>
                        </div>

                        {/* Status Projection Badge */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <span>Current Status:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {selectedMrpPlan.status || "In Production"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ArrowRight size={13} className="text-purple-500" />
                            <span className={`px-2 py-0.5 rounded-md font-extrabold text-[11px] ${
                              projectedMrpStatus === "Completed"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                            }`}>
                              {projectedMrpStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Informational Card when in 'Without MRP' mode */}
                {linkMode === "without-mrp" && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300 shadow-2xs">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
                      <Warehouse size={18} />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 dark:text-white">Direct Store Inward Mode</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Transfer finished goods directly to warehouse without linking to an MRP plan.
                      </p>
                      <div className="pt-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex flex-col gap-1">
                        <span className="flex items-center gap-1.5">
                          <Check size={12} className="text-emerald-600 shrink-0" /> Immediate Shopfloor WIP debit
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Check size={12} className="text-emerald-600 shrink-0" /> Direct FG Store inventory credit
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Check size={12} className="text-emerald-600 shrink-0" /> Generates FG GRN & Stock Log
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Transfer Summary Notice */}
              <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-300">
                    Direct 1-Step Inventory Update {linkMode === "with-mrp" && selectedMrpPlan ? "& MRP Status Sync" : ""}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Deducts {primaryTransferQty || 0} {unit} from Shopfloor WIP and immediately credits Main Store FG stock.
                    {linkMode === "with-mrp" && selectedMrpPlan && (
                      <span> Also credits {primaryTransferQty || 0} {unit} to MRP Plan <b>#{selectedMrpPlan.mrpNumber}</b> and syncs its status.</span>
                    )}
                  </p>
                </div>
              </div>
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
              disabled={
                loading || 
                !numInput || 
                numInput > effectiveMax || 
                isOverMrpPending || 
                (linkMode === "with-mrp" && (!selectedMrpPlanId || !matchingFgInSelectedPlan))
              }
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Warehouse size={14} />
              )}
              <span>
                {loading
                  ? "Transferring..."
                  : linkMode === "with-mrp" && selectedMrpPlan
                  ? "Confirm Transfer & Sync MRP Plan"
                  : "Confirm Transfer to FG Store"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
