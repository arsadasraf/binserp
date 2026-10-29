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
  Sparkles,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { apiRequest } from "@/src/lib/api";
import { formatItemSelectLabel, getItemDescription, ItemNameAndDescription } from "@/src/utils/itemDisplayHelper";
import SearchableSelect, { SearchableOption } from "../SearchableSelect";

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
  selectedUnit?: string;
  isSecondaryActive?: boolean;
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
  const [targetUnit, setTargetUnit] = useState<string>("NOS");
  const [targetHasSecondaryUnit, setTargetHasSecondaryUnit] = useState<boolean>(false);
  const [targetSecondaryUnit, setTargetSecondaryUnit] = useState<string>("");
  const [targetConversionFactor, setTargetConversionFactor] = useState<number>(1);
  const [targetIsSecondaryActive, setTargetIsSecondaryActive] = useState<boolean>(false);
  const [isCustomTarget, setIsCustomTarget] = useState(false);

  // Consumed ingredients list
  const [consumedRows, setConsumedRows] = useState<ConsumedRow[]>([]);
  const [selectedIngredientToAdd, setSelectedIngredientToAdd] = useState<string>("");
  const [isBomPanelOpen, setIsBomPanelOpen] = useState<boolean>(false);

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
      setTargetUnit("NOS");
      setTargetHasSecondaryUnit(false);
      setTargetSecondaryUnit("");
      setTargetConversionFactor(1);
      setTargetIsSecondaryActive(false);
      setIsCustomTarget(false);
      setConsumedRows([]);
      setSelectedIngredientToAdd("");
      setIsBomPanelOpen(false);
      setMrpNumber("");
      setRemarks("");

      // Fetch catalogs and current shopfloor WIP
      fetchCatalogsAndWip();
    }
  }, [isOpen]);

  const fetchCatalogsAndWip = async () => {
    try {
      setLoading(true);
      const [fgRes, wipRmRes, wipBoRes, wipFgRes, bomRes] = await Promise.all([
        apiRequest("/api/store/fg-item").catch(() => null),
        apiRequest("/api/store/wip/inventory?type=rm").catch(() => null),
        apiRequest("/api/store/wip/inventory?type=bo").catch(() => null),
        apiRequest("/api/store/wip/inventory?type=fg").catch(() => null),
        apiRequest("/api/store/bom").catch(() => null),
      ]);

      // 1. Process Target Catalogs (FG + Components) along with attached BOMs
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
              type: item.type || item.fgType || "Component",
              hasSecondaryUnit: Boolean(item.hasSecondaryUnit),
              secondaryUnit: item.secondaryUnit || "",
              conversionFactor: Number(item.conversionFactor) || 1,
              bom: Array.isArray(item.bom) ? item.bom : []
            });
          }
        });
      }
      setExistingTargets(Array.from(targetMap.values()));

      // 2. Process Available Shopfloor WIP Items (RM, BO & FG/Components with shopfloorWipQty > 0)
      const availableItems: any[] = [];

      const processWipList = async (res: any, defaultType: "rm" | "bo" | "component") => {
        if (!res || !res.ok) return;
        const data = await res.json().catch(() => null);
        const list = data?.items || data?.wipItems || (Array.isArray(data) ? data : []);
        list.forEach((wip: any) => {
          const sfQty = Number(wip.shopfloorWipQty || 0);
          if (sfQty > 0) {
            const rawType = String(wip.itemType || defaultType).toLowerCase();
            const normalizedType: "rm" | "bo" | "component" =
              rawType.includes("bo") || rawType.includes("bought")
                ? "bo"
                : rawType.includes("fg") || rawType.includes("comp") || rawType.includes("assembly")
                ? "component"
                : "rm";
            availableItems.push({
              materialId: wip.materialId || wip._id || wip.id,
              materialName: wip.materialName || wip.name,
              materialCode: wip.materialCode || wip.code || "",
              materialDescription: wip.materialDescription || wip.description || "",
              itemType: normalizedType,
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
        processWipList(wipFgRes, "component"),
      ]);

      setAvailableWipStockList(availableItems);

      // 3. Process Legacy BOMs
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

  // Helper to strip optional type prefixes (e.g. rm_65abc -> 65abc) when comparing IDs
  const cleanMaterialId = (idVal: any): string => {
    const str = String(idVal || "").trim();
    return str.includes("_") ? str.split("_").slice(1).join("_") : str;
  };

  // Resolve attached BOM items for the currently selected target FG / Component
  const attachedBomItems = useMemo(() => {
    if (!selectedTargetId && !targetItemName) return [];

    // 1. Check direct attached BOM on the selected FG Item master
    const selectedTargetObj = existingTargets.find(
      (t) =>
        (selectedTargetId && String(t.id) === String(selectedTargetId)) ||
        (targetItemName && t.name && t.name.trim().toLowerCase() === targetItemName.trim().toLowerCase())
    );

    let rawBomArray: any[] = [];
    if (selectedTargetObj && Array.isArray(selectedTargetObj.bom) && selectedTargetObj.bom.length > 0) {
      rawBomArray = selectedTargetObj.bom;
    } else {
      // 2. Fallback to standalone BOM collection if any
      const fallbackBom = allBoms.find(
        (b) =>
          (selectedTargetId &&
            (String(b.finishedGoods) === String(selectedTargetId) || String(b.fgItem) === String(selectedTargetId))) ||
          (targetItemName && b.productName && b.productName.trim().toLowerCase() === targetItemName.trim().toLowerCase())
      );
      if (fallbackBom && Array.isArray(fallbackBom.items)) {
        rawBomArray = fallbackBom.items;
      }
    }

    if (rawBomArray.length === 0) return [];

    const rawTargetQtyNum = parseFloat(targetQuantity) || 1;
    const targetCf = Number(targetConversionFactor) || 1;
    const targetPrimaryQtyNum =
      targetIsSecondaryActive && targetCf > 0
        ? parseFloat((rawTargetQtyNum / targetCf).toFixed(4))
        : rawTargetQtyNum;

    return rawBomArray.map((bi: any, index: number) => {
      const populatedObj = typeof bi.item === "object" && bi.item !== null ? bi.item : null;
      const rawMatId = populatedObj
        ? String(populatedObj._id || populatedObj.id || "")
        : String(bi.item || bi.material || bi.materialId || bi._id || "");
      const rawMatName = (
        bi.itemName ||
        bi.materialName ||
        bi.name ||
        populatedObj?.name ||
        populatedObj?.componentName ||
        ""
      ).trim();

      const rawTypeStr = String(bi.itemType || bi.type || populatedObj?.type || "rm").toLowerCase();
      const itemType: "rm" | "bo" | "component" =
        rawTypeStr.includes("bought") || rawTypeStr === "bo"
          ? "bo"
          : rawTypeStr.includes("fg") || rawTypeStr.includes("component") || rawTypeStr.includes("assembly")
          ? "component"
          : "rm";

      const categoryLabel =
        itemType === "bo"
          ? "Bought Out"
          : itemType === "component"
          ? bi.fgType || populatedObj?.type || "Component"
          : "Raw Material";

      const biCleanId = cleanMaterialId(rawMatId);
      const match = availableWipStockList.find((av) => {
        const avCleanId = cleanMaterialId(av.materialId);
        if (biCleanId && avCleanId && avCleanId === biCleanId) return true;
        if (rawMatName && av.materialName && av.materialName.trim().toLowerCase() === rawMatName.toLowerCase()) {
          return true;
        }
        return false;
      });

      const resolvedDesc =
        getItemDescription(populatedObj) ||
        bi.itemDescription ||
        bi.description ||
        bi.descriptions ||
        match?.materialDescription ||
        "";

      const bomQtyPerUnit = Number(bi.quantity) || 1;
      const totalRequiredQty = parseFloat((bomQtyPerUnit * targetPrimaryQtyNum).toFixed(4));

      const unit = match?.unit || populatedObj?.unit || bi.unit || "PCS";
      const hasSecondaryUnit = Boolean(
        match?.hasSecondaryUnit ?? populatedObj?.hasSecondaryUnit ?? bi.hasSecondaryUnit
      );
      const secondaryUnit = match?.secondaryUnit || populatedObj?.secondaryUnit || bi.secondaryUnit || "";
      const conversionFactor =
        Number(match?.conversionFactor || populatedObj?.conversionFactor || bi.conversionFactor) || 1;

      return {
        materialId: match
          ? String(match.materialId)
          : rawMatId
          ? rawMatId
          : `bom_${index}_${rawMatName}`,
        materialName: match ? match.materialName : rawMatName || "Unnamed Material",
        materialCode: match ? match.materialCode : populatedObj?.code || bi.materialCode || "",
        materialDescription: resolvedDesc,
        itemType: match ? match.itemType : itemType,
        categoryLabel,
        unit,
        bomQtyPerUnit,
        totalRequiredQty,
        availableWipQty: match ? Number(match.shopfloorWipQty || 0) : 0,
        hasSecondaryUnit,
        secondaryUnit,
        conversionFactor,
      };
    });
  }, [
    selectedTargetId,
    targetItemName,
    existingTargets,
    allBoms,
    availableWipStockList,
    targetQuantity,
    targetConversionFactor,
    targetIsSecondaryActive,
  ]);

  // Memoized Searchable Options for Target FG / Component
  const targetOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = existingTargets.map((item) => ({
      value: String(item.id),
      label: formatItemSelectLabel(item),
      description: item.description,
      badge: item.type || "Component",
      subBadge: Array.isArray(item.bom) && item.bom.length > 0 ? `BOM: ${item.bom.length} items` : undefined,
    }));

    list.push({
      value: "__custom__",
      label: "✨ + Enter New / Custom Component Name",
      badge: "Custom",
    });

    return list;
  }, [existingTargets]);

  // Memoized Searchable Options for Shopfloor WIP Ingredients (RM, BO & Components)
  const wipIngredientOptions: SearchableOption[] = useMemo(() => {
    return availableWipStockList.map((item) => {
      const isAlreadyAdded = consumedRows.some(
        (r) => cleanMaterialId(r.materialId) === cleanMaterialId(item.materialId)
      );
      const secBalNote = item.hasSecondaryUnit && item.secondaryUnit && Number(item.conversionFactor) > 0
        ? ` (~${parseFloat((item.shopfloorWipQty * Number(item.conversionFactor)).toFixed(2))} ${item.secondaryUnit})`
        : "";
      return {
        value: String(item.materialId),
        label: formatItemSelectLabel(item),
        description: item.materialDescription,
        badge:
          item.itemType === "bo"
            ? "Bought Out"
            : item.itemType === "component"
            ? "Component"
            : "Raw Material",
        subBadge: `Floor: ${item.shopfloorWipQty} ${item.unit}${secBalNote}`,
        disabled: isAlreadyAdded,
        hint: isAlreadyAdded ? "Already added" : undefined,
      };
    });
  }, [availableWipStockList, consumedRows]);

  // Handle Target Selection Change
  const handleSelectTarget = (targetId: string) => {
    setTargetIsSecondaryActive(false);
    setIsBomPanelOpen(false); // Keep attached BOM hidden by default when selecting target
    if (targetId === "__custom__") {
      setIsCustomTarget(true);
      setSelectedTargetId("__custom__");
      setTargetItemName("");
      setTargetItemCode("");
      setTargetDescription("");
      setTargetUnit("PCS");
      setTargetType("Component");
      setTargetHasSecondaryUnit(false);
      setTargetSecondaryUnit("");
      setTargetConversionFactor(1);
      return;
    }

    setIsCustomTarget(false);
    setSelectedTargetId(targetId);
    const found = existingTargets.find(t => String(t.id) === String(targetId));
    if (found) {
      setTargetItemName(found.name);
      setTargetItemCode(found.code || "");
      setTargetDescription(found.description || "");
      setTargetUnit(found.unit || "PCS");
      setTargetType(found.type || "Component");
      setTargetHasSecondaryUnit(Boolean(found.hasSecondaryUnit));
      setTargetSecondaryUnit(found.secondaryUnit || "");
      setTargetConversionFactor(Number(found.conversionFactor) || 1);
    }
  };

  // Toggle Target Produced Unit (Primary vs Secondary)
  const handleToggleTargetUnit = (unitToSelect: string) => {
    const isSec = unitToSelect === targetSecondaryUnit;
    if (targetIsSecondaryActive === isSec) return;
    const cf = Number(targetConversionFactor) || 1;
    const currentNum = parseFloat(targetQuantity) || 0;

    let newQty = targetQuantity;
    if (currentNum > 0 && cf > 0) {
      if (isSec && !targetIsSecondaryActive) {
        newQty = parseFloat((currentNum * cf).toFixed(4)).toString();
      } else if (!isSec && targetIsSecondaryActive) {
        newQty = parseFloat((currentNum / cf).toFixed(4)).toString();
      }
    }

    setTargetIsSecondaryActive(isSec);
    setTargetQuantity(newQty);
  };

  // Add a single BOM item to Consumed Ingredients
  const handleAddBomItemToConsumed = (bi: (typeof attachedBomItems)[number]) => {
    const alreadyExists = consumedRows.some(
      (r) =>
        cleanMaterialId(r.materialId) === cleanMaterialId(bi.materialId) ||
        (r.materialName && bi.materialName && r.materialName.trim().toLowerCase() === bi.materialName.trim().toLowerCase())
    );
    if (alreadyExists) {
      onError(`"${bi.materialName}" is already added to Ingredients Consumed`);
      return;
    }

    setConsumedRows((prev) => [
      ...prev,
      {
        materialId: bi.materialId,
        materialName: bi.materialName,
        materialCode: bi.materialCode,
        materialDescription: bi.materialDescription,
        itemType: bi.itemType,
        unit: bi.unit,
        availableWipQty: bi.availableWipQty,
        quantity: bi.totalRequiredQty.toString(),
        hasSecondaryUnit: bi.hasSecondaryUnit,
        secondaryUnit: bi.secondaryUnit,
        conversionFactor: bi.conversionFactor,
        selectedUnit: bi.unit,
        isSecondaryActive: false,
      },
    ]);
  };

  // Auto-populate all ingredients from Attached BOM
  const handlePopulateFromBom = () => {
    if (attachedBomItems.length === 0) {
      onError("No Bill of Materials (BOM) items found for this target product");
      return;
    }

    setConsumedRows((prev) => {
      const updated = [...prev];
      attachedBomItems.forEach((bi) => {
        const existingIdx = updated.findIndex(
          (r) =>
            cleanMaterialId(r.materialId) === cleanMaterialId(bi.materialId) ||
            (r.materialName && bi.materialName && r.materialName.trim().toLowerCase() === bi.materialName.trim().toLowerCase())
        );
        const newRow: ConsumedRow = {
          materialId: bi.materialId,
          materialName: bi.materialName,
          materialCode: bi.materialCode,
          materialDescription: bi.materialDescription,
          itemType: bi.itemType,
          unit: bi.unit,
          availableWipQty: bi.availableWipQty,
          quantity: bi.totalRequiredQty.toString(),
          hasSecondaryUnit: bi.hasSecondaryUnit,
          secondaryUnit: bi.secondaryUnit,
          conversionFactor: bi.conversionFactor,
          selectedUnit: bi.unit,
          isSecondaryActive: false,
        };
        if (existingIdx >= 0) {
          updated[existingIdx] = newRow;
        } else {
          updated.push(newRow);
        }
      });
      return updated;
    });
  };

  // Add individual ingredient from Shopfloor WIP
  const handleAddIngredient = (idToAdd?: string) => {
    const targetId = idToAdd || selectedIngredientToAdd;
    if (!targetId) return;

    const item = availableWipStockList.find(i => String(i.materialId) === String(targetId));
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
        selectedUnit: item.unit,
        isSecondaryActive: false,
      }
    ]);
    setSelectedIngredientToAdd("");
  };

  // Toggle row unit between Primary and Secondary
  const handleToggleRowUnit = (idx: number, unitToSelect: string) => {
    setConsumedRows(prev => {
      const copy = [...prev];
      const r = copy[idx];
      const isSec = unitToSelect === r.secondaryUnit;
      if (r.isSecondaryActive === isSec && r.selectedUnit === unitToSelect) {
        return prev;
      }
      const cf = Number(r.conversionFactor) || 1;
      const currentNum = parseFloat(r.quantity) || 0;

      let newQty = r.quantity;
      if (currentNum > 0 && cf > 0) {
        if (isSec && !r.isSecondaryActive) {
          // Changed from Primary to Secondary -> multiply by CF
          newQty = parseFloat((currentNum * cf).toFixed(4)).toString();
        } else if (!isSec && r.isSecondaryActive) {
          // Changed from Secondary to Primary -> divide by CF
          newQty = parseFloat((currentNum / cf).toFixed(4)).toString();
        }
      }

      copy[idx] = {
        ...r,
        selectedUnit: unitToSelect,
        isSecondaryActive: isSec,
        quantity: newQty
      };
      return copy;
    });
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
      const cf = Number(r.conversionFactor) || 1;
      const isSec = Boolean(r.isSecondaryActive);
      const effectiveMax = isSec ? (r.availableWipQty * cf) : r.availableWipQty;
      return q <= 0 || q > effectiveMax;
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

      const targetCf = Number(targetConversionFactor) || 1;
      const finalTargetPrimaryQty = targetIsSecondaryActive && targetCf > 0
        ? parseFloat((numTargetQty / targetCf).toFixed(4))
        : numTargetQty;
      const finalTargetSecondaryQty = targetIsSecondaryActive
        ? numTargetQty
        : (targetHasSecondaryUnit && targetCf > 0 ? parseFloat((numTargetQty * targetCf).toFixed(4)) : 0);

      const payload = {
        targetItemId: selectedTargetId || undefined,
        targetItemName: targetItemName.trim(),
        targetItemCode: targetItemCode.trim(),
        targetDescription: targetDescription.trim(),
        targetType: targetType || "Component",
        targetQuantity: finalTargetPrimaryQty,
        targetUnit: targetUnit.trim() || "PCS",
        targetHasSecondaryUnit: Boolean(targetHasSecondaryUnit),
        targetSecondaryUnit: targetSecondaryUnit || "",
        targetConversionFactor: targetCf,
        targetSecondaryQuantity: finalTargetSecondaryQty,
        mrpNumber: mrpNumber.trim(),
        remarks: remarks.trim() || `In-house WIP Assembly (${consumedRows.length} items)`,
        consumedItems: consumedRows.map(r => {
          const rawQ = parseFloat(r.quantity) || 0;
          const cf = Number(r.conversionFactor) || 1;
          const isSec = Boolean(r.isSecondaryActive);
          const primaryQty = isSec && cf > 0 ? parseFloat((rawQ / cf).toFixed(4)) : rawQ;
          const secQty = isSec ? rawQ : (r.hasSecondaryUnit && cf > 0 ? parseFloat((rawQ * cf).toFixed(4)) : 0);
          return {
            materialId: r.materialId,
            materialName: r.materialName,
            materialCode: r.materialCode,
            itemType: r.itemType,
            quantity: primaryQty,
            unit: r.unit,
            hasSecondaryUnit: Boolean(r.hasSecondaryUnit),
            secondaryUnit: r.secondaryUnit || "",
            conversionFactor: cf,
            secondaryQuantity: secQty
          };
        })
      };

      const res = await apiRequest("/api/store/wip/convert-multiple-to-fg", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to convert WIP stock into FG Component");
      }

      const producedLabel = targetHasSecondaryUnit && targetSecondaryUnit
        ? `${finalTargetPrimaryQty} ${targetUnit} (~${finalTargetSecondaryQty} ${targetSecondaryUnit})`
        : `${finalTargetPrimaryQty} ${targetUnit}`;

      onSuccess(data.message || `Successfully produced ${producedLabel} of ${targetItemName} in Shopfloor WIP`);
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
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1560px] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3.5">
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-7 lg:p-8 space-y-6">
          
          {/* Section 1: Target Finished Good / Component */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/70 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                <Boxes size={18} />
                <span>1. Target In-House WIP FG / Component</span>
              </div>
              {attachedBomItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBomPanelOpen((prev) => !prev)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    {isBomPanelOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>
                      {isBomPanelOpen
                        ? `Hide Attached BOM (${attachedBomItems.length})`
                        : `View Attached BOM (${attachedBomItems.length} items)`}
                    </span>
                    {isBomPanelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={handlePopulateFromBom}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Zap size={14} />
                    <span>Add All BOM Items ({attachedBomItems.length})</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5">
              {/* Target Item Keyword Searchable Select */}
              <div className="md:col-span-6 lg:col-span-7 xl:col-span-8 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Target Product Name &amp; Description <span className="text-rose-500">*</span>
                </label>
                <SearchableSelect
                  options={targetOptions}
                  value={isCustomTarget ? "__custom__" : selectedTargetId}
                  onChange={handleSelectTarget}
                  placeholder="🔍 Search target FG / Component by keyword, name, or description..."
                  dropdownPosition="bottom"
                  className="w-full"
                />
                {isCustomTarget && (
                  <div className="mt-2.5 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                        <Sparkles size={13} /> Custom Component Name
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomTarget(false);
                          setSelectedTargetId("");
                          setTargetItemName("");
                        }}
                        className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        ← Back to Catalog Selection
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Type custom WIP FG / Component name..."
                      value={targetItemName}
                      onChange={(e) => setTargetItemName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-indigo-400 dark:border-indigo-600 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                      required
                    />
                  </div>
                )}
                {targetDescription && !isCustomTarget && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic px-1 line-clamp-2 mt-1">
                    {targetDescription}
                  </p>
                )}
              </div>

              {/* Target Produced Quantity */}
              <div className="md:col-span-3 lg:col-span-3 xl:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Produced Qty (WIP) <span className="text-rose-500">*</span>
                  </label>
                  {targetHasSecondaryUnit && targetSecondaryUnit && Number(targetConversionFactor) > 0 && (
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      Dual Unit
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500 pr-14"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-slate-400">
                    {targetIsSecondaryActive ? targetSecondaryUnit : targetUnit}
                  </span>
                </div>
                {targetHasSecondaryUnit && targetSecondaryUnit && numTargetQty > 0 && (
                  <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                    {targetIsSecondaryActive
                      ? `(~${parseFloat((numTargetQty / (targetConversionFactor || 1)).toFixed(3))} ${targetUnit})`
                      : `(~${parseFloat((numTargetQty * (targetConversionFactor || 1)).toFixed(3))} ${targetSecondaryUnit})`}
                  </p>
                )}
              </div>

              {/* Target Unit */}
              <div className="md:col-span-3 lg:col-span-2 xl:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Unit
                </label>
                {targetHasSecondaryUnit && targetSecondaryUnit && Number(targetConversionFactor) > 0 ? (
                  <div className="flex flex-col gap-1">
                    <div className="inline-flex p-1 rounded-xl bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600">
                      <button
                        type="button"
                        onClick={() => handleToggleTargetUnit(targetUnit)}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          !targetIsSecondaryActive
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        }`}
                        title={`Primary Unit: ${targetUnit}`}
                      >
                        {targetUnit}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleTargetUnit(targetSecondaryUnit)}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          targetIsSecondaryActive
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        }`}
                        title={`Secondary Unit: ${targetSecondaryUnit}`}
                      >
                        {targetSecondaryUnit}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 text-center font-medium">
                      1 {targetUnit} = {targetConversionFactor} {targetSecondaryUnit}
                    </span>
                  </div>
                ) : (
                  <>
                    <input
                      list="wip-target-uoms"
                      type="text"
                      value={targetUnit}
                      onChange={(e) => setTargetUnit(e.target.value)}
                      placeholder="NOS / PCS"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 uppercase"
                    />
                    <datalist id="wip-target-uoms">
                      <option value="NOS" />
                      <option value="PCS" />
                      <option value="KG" />
                      <option value="Sheet" />
                      <option value="Set" />
                      <option value="Meter" />
                      <option value="Box" />
                      <option value="Pair" />
                    </datalist>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Source RM & BO Consumed Items */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-700/70 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                <Layers size={18} />
                <span>2. Ingredients Consumed from Shopfloor WIP ({consumedRows.length} items)</span>
              </div>

              {/* Add Material Keyword Searchable Select & Button */}
              <div className="flex items-center gap-2.5 w-full lg:w-auto lg:min-w-[480px] xl:min-w-[580px]">
                <div className="flex-1">
                  <SearchableSelect
                    options={wipIngredientOptions}
                    value={selectedIngredientToAdd}
                    onChange={(val) => setSelectedIngredientToAdd(val)}
                    placeholder="🔍 Search RM / BO in Shopfloor WIP by keyword, name, or description..."
                    dropdownPosition="auto"
                    className="w-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAddIngredient()}
                  disabled={!selectedIngredientToAdd}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer h-[38px]"
                >
                  <Plus size={15} /> <span>Add</span>
                </button>
              </div>
            </div>

            {/* Collapsible (Hidden by Default) Attached BOM Panel for Selected FG Item */}
            {attachedBomItems.length > 0 && (
              <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-800/70 bg-indigo-50/40 dark:bg-indigo-950/25 overflow-hidden transition-all">
                {/* Compact Header Bar (Always visible when FG has attached BOM) */}
                <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBomPanelOpen((prev) => !prev)}
                    className="flex items-center gap-2 text-left cursor-pointer group"
                  >
                    <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-2xs">
                      <Layers size={13} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          Attached BOM for {targetItemName || "Selected Item"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-300">
                          {attachedBomItems.length} BOM {attachedBomItems.length === 1 ? "Item" : "Items"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300">
                          {attachedBomItems.filter((b) => b.availableWipQty > 0).length} in Shopfloor WIP
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isBomPanelOpen
                          ? "Click '+ Add' on any BOM item below to add it to Ingredients Consumed"
                          : "Attached BOM is hidden — click to view BOM items and add them to line items"}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBomPanelOpen((prev) => !prev)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      {isBomPanelOpen ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{isBomPanelOpen ? "Hide BOM" : "Show Attached BOM"}</span>
                      {isBomPanelOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={handlePopulateFromBom}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus size={13} />
                      <span>Add All BOM Items</span>
                    </button>
                  </div>
                </div>

                {/* Expanded BOM Table */}
                {isBomPanelOpen && (
                  <div className="border-t border-indigo-200/70 dark:border-indigo-800/60 bg-white dark:bg-slate-900 overflow-x-auto animate-in fade-in duration-150">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                          <th className="px-4 py-2.5">BOM Material &amp; Technical Description</th>
                          <th className="px-3 py-2.5 text-center w-28">Category</th>
                          <th className="px-3 py-2.5 text-center w-36">BOM Required Qty</th>
                          <th className="px-3 py-2.5 text-center w-36">Shopfloor WIP Stock</th>
                          <th className="px-4 py-2.5 text-right w-28">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {attachedBomItems.map((bi, bIdx) => {
                          const isAlreadyAdded = consumedRows.some(
                            (r) =>
                              cleanMaterialId(r.materialId) === cleanMaterialId(bi.materialId) ||
                              (r.materialName &&
                                bi.materialName &&
                                r.materialName.trim().toLowerCase() === bi.materialName.trim().toLowerCase())
                          );
                          const hasEnoughWip = bi.availableWipQty >= bi.totalRequiredQty && bi.availableWipQty > 0;
                          const hasPartialWip = bi.availableWipQty > 0 && bi.availableWipQty < bi.totalRequiredQty;

                          return (
                            <tr
                              key={`${bi.materialId}_${bIdx}`}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="px-4 py-2.5 min-w-[240px]">
                                <ItemNameAndDescription
                                  name={bi.materialName}
                                  description={bi.materialDescription}
                                />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    bi.itemType === "bo"
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                      : bi.itemType === "component"
                                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                      : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                                  }`}
                                >
                                  {bi.categoryLabel}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono">
                                <div className="font-bold text-indigo-700 dark:text-indigo-300">
                                  {bi.totalRequiredQty} {bi.unit}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  ({bi.bomQtyPerUnit} {bi.unit} / unit)
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono">
                                <span
                                  className={`font-bold ${
                                    hasEnoughWip
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : hasPartialWip
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-rose-500 dark:text-rose-400"
                                  }`}
                                >
                                  {bi.availableWipQty} {bi.unit}
                                </span>
                                {bi.hasSecondaryUnit && bi.secondaryUnit && bi.availableWipQty > 0 && (
                                  <div className="text-[10px] text-slate-400">
                                    (~{parseFloat((bi.availableWipQty * bi.conversionFactor).toFixed(2))} {bi.secondaryUnit})
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                {isAlreadyAdded ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 size={12} /> Added
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAddBomItemToConsumed(bi)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer"
                                  >
                                    <Plus size={12} /> Add
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Consumed Rows Table */}
            {consumedRows.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white/60 dark:bg-slate-900/40">
                <Boxes className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  No ingredients added yet
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Search &amp; pick RM / BO items from the keyword search bar above{attachedBomItems.length > 0 ? ' or expand "Show Attached BOM" to add items' : ''}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3.5">Material &amp; Technical Description</th>
                      <th className="px-4 py-3.5 text-center w-28">Category</th>
                      <th className="px-4 py-3.5 text-center w-36">Shopfloor Balance</th>
                      <th className="px-4 py-3.5 text-center w-48">Consumed Quantity</th>
                      <th className="px-4 py-3.5 text-center w-36">Unit</th>
                      <th className="px-4 py-3.5 text-center w-32">Status</th>
                      <th className="px-4 py-3.5 text-right w-16">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {consumedRows.map((row, idx) => {
                      const numQty = parseFloat(row.quantity) || 0;
                      const cf = Number(row.conversionFactor) || 1;
                      const isSec = Boolean(row.isSecondaryActive);
                      const effectiveMax = isSec ? (row.availableWipQty * cf) : row.availableWipQty;
                      const isShortage = numQty > effectiveMax;
                      const isZeroOrNegative = numQty <= 0;
                      const activeUnit = isSec ? (row.secondaryUnit || row.unit) : row.unit;

                      return (
                        <tr key={`${row.materialId}_${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3.5 min-w-[260px] lg:min-w-[340px] xl:min-w-[420px]">
                            <ItemNameAndDescription
                              name={row.materialName}
                              description={row.materialDescription}
                            />
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              row.itemType === "bo"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : row.itemType === "component"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            }`}>
                              {row.itemType === "bo" ? "Bought Out" : row.itemType === "component" ? "Component" : "Raw Material"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                            <div>{row.availableWipQty} {row.unit}</div>
                            {row.hasSecondaryUnit && row.secondaryUnit && (
                              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                                (~{parseFloat((row.availableWipQty * cf).toFixed(2))} {row.secondaryUnit})
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex flex-col items-center">
                              <div className="relative w-36">
                                <input
                                  type="number"
                                  min="0.0001"
                                  step="any"
                                  value={row.quantity}
                                  onChange={(e) => handleUpdateConsumedQty(idx, e.target.value)}
                                  className={`w-full px-2.5 py-1.5 rounded-lg border text-center font-mono font-bold text-xs focus:ring-2 ${
                                    isShortage 
                                      ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-300 focus:ring-rose-500" 
                                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-indigo-500"
                                  }`}
                                  placeholder={`Qty in ${activeUnit}`}
                                  required
                                />
                              </div>
                              {row.hasSecondaryUnit && row.secondaryUnit && numQty > 0 && (
                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                                  {isSec
                                    ? `(~${parseFloat((numQty / cf).toFixed(3))} ${row.unit})`
                                    : `(~${parseFloat((numQty * cf).toFixed(3))} ${row.secondaryUnit})`}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {row.hasSecondaryUnit && row.secondaryUnit && cf > 0 ? (
                              <div className="inline-flex p-0.5 rounded-lg bg-slate-200 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleToggleRowUnit(idx, row.unit)}
                                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                    !isSec
                                      ? "bg-indigo-600 text-white shadow-xs"
                                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                  }`}
                                  title={`Primary Unit: ${row.unit}`}
                                >
                                  {row.unit}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleRowUnit(idx, row.secondaryUnit!)}
                                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                    isSec
                                      ? "bg-indigo-600 text-white shadow-xs"
                                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                  }`}
                                  title={`Secondary Unit: ${row.secondaryUnit} (1 ${row.unit} = ${cf} ${row.secondaryUnit})`}
                                >
                                  {row.secondaryUnit}
                                </button>
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                                {row.unit}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {isShortage ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400" title={`Max available: ${effectiveMax} ${activeUnit}`}>
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
                          <td className="px-4 py-3.5 text-right">
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
                Ready to assemble <strong className="text-slate-800 dark:text-slate-200">{targetQuantity} {targetIsSecondaryActive ? targetSecondaryUnit : targetUnit}</strong> from{" "}
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
