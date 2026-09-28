"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, AlertCircle, Trash2, ArrowRight, ShieldCheck, Sparkles, Layers, ChevronDown, Boxes, RefreshCw, Unlink } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/src/lib/api';
import Swal from 'sweetalert2';

interface ConvertToPurchaseBucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: any;
  items?: any[];
  token: string;
  onSuccess: () => void;
  mrpPlanId?: string;
  mrpNumber?: string;
}

export default function ConvertToPurchaseBucketModal({
  isOpen,
  onClose,
  item,
  items,
  token,
  onSuccess,
  mrpPlanId,
  mrpNumber
}: ConvertToPurchaseBucketModalProps) {
  // Normalize items array: either from `items` prop or single `item` prop
  const itemsList = useMemo(() => {
    if (Array.isArray(items) && items.length > 0) return items;
    if (item) return [item];
    return [];
  }, [items, item]);

  const isBulk = itemsList.length > 1;
  const primaryItem = itemsList[0] || null;

  const [loadingEligible, setLoadingEligible] = useState(false);
  const [eligibleItems, setEligibleItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [mappingScope, setMappingScope] = useState<'plan' | 'global'>(mrpPlanId ? 'plan' : 'global');
  const [conversionFactorInput, setConversionFactorInput] = useState<string>('1');
  const [submitting, setSubmitting] = useState(false);

  const isBO = useMemo(() => {
    const t = (primaryItem?.itemType || '').toLowerCase();
    return t.includes('bo') || t.includes('bought');
  }, [primaryItem?.itemType]);

  const sourcePrimaryUnit = primaryItem?.unit || 'KG';
  const sourceHasSecondaryUnit = Boolean(primaryItem?.hasSecondaryUnit && primaryItem?.secondaryUnit);
  const sourceSecondaryUnit = primaryItem?.secondaryUnit || '';
  const currentMapping = (!isBulk && primaryItem?.purchaseBucket) ? primaryItem.purchaseBucket : null;
  const isDetachedForPlan = Boolean(primaryItem?.isDetachedForPlan);

  // Candidate units from the source item (either primary or secondary)
  const sourceUnits = useMemo(() => {
    return [sourcePrimaryUnit, sourceSecondaryUnit]
      .filter((u): u is string => Boolean(u && typeof u === 'string' && u.trim() && u !== 'null' && u !== 'undefined'))
      .map(u => u.trim().toLowerCase());
  }, [sourcePrimaryUnit, sourceSecondaryUnit]);

  // In bulk selection, flag any items that don't share ANY unit with the primary item
  const unitMismatches = useMemo(() => {
    if (!isBulk) return [];
    return itemsList.filter((it: any) => {
      const itUnits = [it.unit, it.secondaryUnit]
        .filter((u): u is string => Boolean(u && typeof u === 'string' && u.trim()))
        .map((u: string) => u.trim().toLowerCase());
      return !itUnits.some((u: string) => sourceUnits.includes(u));
    });
  }, [itemsList, isBulk, sourceUnits]);

  useEffect(() => {
    if (!isOpen || itemsList.length === 0) return;

    if (currentMapping?.targetPurchaseItemId) {
      setSelectedTargetId(currentMapping.targetPurchaseItemId.toString());
      setConversionFactorInput(String(currentMapping.conversionFactor || 1));
      if (currentMapping.isPlanSpecific) {
        setMappingScope('plan');
      }
    } else {
      setSelectedTargetId('');
      setConversionFactorInput('1');
      if (mrpPlanId) {
        setMappingScope('plan');
      }
    }

    const fetchEligible = async () => {
      setLoadingEligible(true);
      try {
        const queryParams = new URLSearchParams({
          primaryUnit: sourcePrimaryUnit,
          hasSecondaryUnit: String(sourceHasSecondaryUnit),
          secondaryUnit: sourceSecondaryUnit,
          itemType: isBO ? 'BO' : 'RM'
        });

        const res = await apiGet(`/api/purchase/mrp/eligible-purchase-items?${queryParams.toString()}`, token);
        if (res?.data && Array.isArray(res.data)) {
          // Filter out the source items themselves
          const sourceIdSet = new Set(itemsList.map(it => (it.materialId || it._id)?.toString()).filter(Boolean));
          const filtered = res.data.filter((it: any) => !sourceIdSet.has(it._id?.toString()));
          setEligibleItems(filtered);
        } else {
          setEligibleItems([]);
        }
      } catch (err: any) {
        console.error("Failed to fetch eligible purchase items:", err);
        setEligibleItems([]);
      } finally {
        setLoadingEligible(false);
      }
    };

    fetchEligible();
  }, [isOpen, itemsList, token, sourcePrimaryUnit, sourceHasSecondaryUnit, sourceSecondaryUnit, isBO, currentMapping, mrpPlanId]);

  if (!isOpen || itemsList.length === 0) return null;

  // Filter eligible items by keyword search in name, description, code, or category
  const filteredEligible = eligibleItems.filter((it: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (it.name && it.name.toLowerCase().includes(q)) ||
      (it.description && it.description.toLowerCase().includes(q)) ||
      (it.descriptions && it.descriptions.toLowerCase().includes(q)) ||
      (it.code && it.code.toLowerCase().includes(q)) ||
      (it.category && it.category.toLowerCase().includes(q))
    );
  });

  const selectedTargetItem = eligibleItems.find((it: any) => it._id === selectedTargetId) || 
    (currentMapping?.targetPurchaseItemId === selectedTargetId ? currentMapping : null);

  // Check if chosen target item shares at least one unit with each source item
  const targetUnits = [
    selectedTargetItem?.unit,
    selectedTargetItem?.secondaryUnit
  ].filter((u): u is string => Boolean(u && typeof u === 'string' && u.trim())).map(u => u.trim().toLowerCase());

  const targetUnitIncompatible = selectedTargetItem ? itemsList.some((it: any) => {
    const itUnits = [it.unit, it.secondaryUnit]
      .filter((u): u is string => Boolean(u && typeof u === 'string' && u.trim()))
      .map((u: string) => u.trim().toLowerCase());
    return !itUnits.some((u: string) => targetUnits.includes(u));
  }) : false;

  const parsedFactor = Math.max(0.000001, parseFloat(conversionFactorInput) || 1);
  const rawGrossRequired = Number(primaryItem?.grossRequired || primaryItem?.requiredQuantity || 0);
  const calculatedTargetDemand = Math.round(rawGrossRequired * parsedFactor * 1000) / 1000;

  const handleSelectTarget = (targetItem: any) => {
    setSelectedTargetId(targetItem._id);
    if (!currentMapping || currentMapping.targetPurchaseItemId !== targetItem._id) {
      if (targetItem.hasSecondaryUnit && Number(targetItem.conversionFactor) > 0) {
        setConversionFactorInput(String(targetItem.conversionFactor));
      } else {
        setConversionFactorInput('1');
      }
    }
  };

  const handleSaveMapping = async () => {
    if (!selectedTargetItem) {
      Swal.fire('Select Purchase Item', 'Please select a standard purchase item from the list to serve as the purchase bucket.', 'warning');
      return;
    }

    if (unitMismatches.length > 0) {
      Swal.fire({
        title: 'Unit Mismatch Detected',
        text: `All selected items must share at least one compatible unit (${sourceUnits.join(' / ').toUpperCase()}). ${unitMismatches.length} item(s) have conflicting units.`,
        icon: 'error'
      });
      return;
    }

    if (targetUnitIncompatible) {
      Swal.fire({
        title: 'Target Unit Incompatible',
        text: `The selected target purchase item (${targetUnits.join(' / ').toUpperCase()}) does not share any matching unit with one or more of your BOM items.`,
        icon: 'error'
      });
      return;
    }

    setSubmitting(true);
    try {
      const targetId = selectedTargetItem._id || selectedTargetItem.targetPurchaseItemId;
      const targetName = selectedTargetItem.name || selectedTargetItem.targetPurchaseItemName;
      const targetCode = selectedTargetItem.code || selectedTargetItem.targetPurchaseItemCode || '';
      const targetDesc = selectedTargetItem.description || selectedTargetItem.descriptions || selectedTargetItem.targetPurchaseItemDescription || '';
      const effectivePlanId = mappingScope === 'plan' && mrpPlanId ? mrpPlanId : null;
      const isDefault = mappingScope === 'global';

      if (isBulk) {
        // Bulk mapping API call
        const payload = {
          sourceItems: itemsList.map((it: any) => ({
            sourceItemId: it.materialId || it._id,
            sourceItemType: isBO ? 'BO' : 'RM',
            sourceItemName: it.materialName || it.name,
            sourceItemCode: it.materialCode || it.code || '',
            sourceItemDescription: it.description || '',
            unit: it.unit,
            hasSecondaryUnit: Boolean(it.hasSecondaryUnit && it.secondaryUnit),
            secondaryUnit: it.secondaryUnit || '',
            conversionFactor: parsedFactor
          })),
          targetPurchaseItemId: targetId,
          targetPurchaseItemType: isBO ? 'BO' : 'RM',
          targetPurchaseItemName: targetName,
          targetPurchaseItemCode: targetCode,
          targetPurchaseItemDescription: targetDesc,
          isDefault,
          mrpPlanId: effectivePlanId
        };

        await apiPost('/api/purchase/mrp/bulk-map-to-purchase-bucket', payload, token);
        Swal.fire({
          icon: 'success',
          title: 'Purchase Bucket Mapped!',
          text: `${itemsList.length} item(s) have been mapped to Purchase Bucket "${targetName}" (${effectivePlanId ? `MRP: ${mrpNumber || 'This Plan'}` : 'Global Default'}).`,
          timer: 2500,
          showConfirmButton: false
        });
        onSuccess();
        onClose();
      } else {
        // Single mapping API call
        const payload = {
          sourceItemId: primaryItem.materialId || primaryItem._id,
          sourceItemType: isBO ? 'BO' : 'RM',
          sourceItemName: primaryItem.materialName || primaryItem.name,
          sourceItemCode: primaryItem.materialCode || primaryItem.code || '',
          sourceItemDescription: primaryItem.description || '',
          targetPurchaseItemId: targetId,
          targetPurchaseItemType: isBO ? 'BO' : 'RM',
          targetPurchaseItemName: targetName,
          targetPurchaseItemCode: targetCode,
          targetPurchaseItemDescription: targetDesc,
          primaryUnit: sourcePrimaryUnit,
          hasSecondaryUnit: sourceHasSecondaryUnit,
          secondaryUnit: sourceSecondaryUnit,
          conversionFactor: parsedFactor,
          isDefault,
          mrpPlanId: effectivePlanId
        };

        const res = await apiPost('/api/purchase/mrp/map-to-purchase-bucket', payload, token);
        if (res) {
          Swal.fire({
            icon: 'success',
            title: 'Purchase Bucket Mapped!',
            text: `"${primaryItem.materialName || 'Item'}" will now be purchased under "${targetName}" (${effectivePlanId ? `MRP: ${mrpNumber || 'This Plan'}` : 'Global Default'}).`,
            timer: 2500,
            showConfirmButton: false
          });
          onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to map purchase bucket.";
      Swal.fire('Mapping Error', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnmap = async () => {
    const isPlanOnly = mappingScope === 'plan' && mrpPlanId;
    const confirmResult = await Swal.fire({
      title: isPlanOnly ? 'Remove MRP-Specific Mapping?' : 'Remove Purchase Bucket Mapping?',
      text: isPlanOnly
        ? `Remove specific mapping for "${primaryItem.materialName || 'This item'}" in ${mrpNumber || 'this MRP'}? It will fall back to the global default bucket or direct procurement.`
        : `"${primaryItem.materialName || 'This item'}" will revert to being purchased directly as an individual item across all plans.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Remove Mapping',
      cancelButtonText: 'Keep Bucket'
    });

    if (!confirmResult.isConfirmed) return;

    setSubmitting(true);
    try {
      const mapId = currentMapping?.mappingId || primaryItem.materialId || primaryItem._id;
      const url = isPlanOnly 
        ? `/api/purchase/mrp/unmap-purchase-bucket/${mapId}?mrpPlanId=${mrpPlanId}`
        : `/api/purchase/mrp/unmap-purchase-bucket/${mapId}`;
      await apiDelete(url, token);
      Swal.fire({
        icon: 'success',
        title: 'Mapping Removed',
        text: 'Purchase bucket mapping removed.',
        timer: 2000,
        showConfirmButton: false
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to remove mapping.";
      Swal.fire('Error', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetachFromPlan = async () => {
    if (!mrpPlanId) return;

    const confirmResult = await Swal.fire({
      title: 'Detach from Bucket for This MRP?',
      html: `Do you want to detach <b>${primaryItem.materialName || 'this item'}</b> specifically for <b>${mrpNumber || 'this MRP plan'}</b>?<br/><br/><div class="text-xs text-left p-2.5 bg-amber-50 rounded-lg text-amber-900 border border-amber-200">In <b>${mrpNumber || 'this MRP'}</b>, this item will be purchased directly as its native blank/cut-size without merging into any purchase bucket. Other MRP plans will continue using their mapped commercial purchase bucket.</div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Detach for this MRP',
      confirmButtonColor: '#d97706',
      cancelButtonText: 'Keep Bucket'
    });

    if (!confirmResult.isConfirmed) return;

    setSubmitting(true);
    try {
      const payload = {
        sourceItemId: primaryItem.materialId || primaryItem._id,
        mrpPlanId,
        sourceItemName: primaryItem.materialName || primaryItem.name,
        sourceItemCode: primaryItem.materialCode || primaryItem.code || '',
        sourceItemDescription: primaryItem.description || '',
        sourceItemType: isBO ? 'BO' : 'RM'
      };

      await apiPost('/api/purchase/mrp/detach-purchase-bucket', payload, token);
      Swal.fire({
        icon: 'success',
        title: 'Item Detached for this MRP!',
        text: `"${primaryItem.materialName || 'Item'}" is now detached specifically for ${mrpNumber || 'this MRP plan'} and will be procured directly.`,
        timer: 2500,
        showConfirmButton: false
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to detach item from purchase bucket.";
      Swal.fire('Detach Error', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-xl shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {isBulk 
                  ? `Send ${itemsList.length} Items to Purchase ${isBO ? 'Bought-Out' : 'Raw Material'} Bucket`
                  : `Convert to Purchase ${isBO ? 'Bought-Out' : 'Raw Material'} Bucket`}
                {mrpNumber && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {mrpNumber}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Consolidate cut sizes or custom blanks into a standard commercial purchase item for unified RFQ & PO release. Mappings can be MRP-specific or global.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content: Spacious 2-Column Responsive Layout */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            
            {/* LEFT COLUMN: Source BOM Cut-Sizes & Scope / Conversion Config */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              
              {/* Detached Notice if active */}
              {isDetachedForPlan && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 shadow-2xs">
                  <Unlink className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Currently Detached for {mrpNumber || 'this MRP'}:</span> This item is procured directly as an individual item in this plan. Selecting a target bucket below will re-bind it to a bucket.
                  </div>
                </div>
              )}

              {/* Unit Mismatch Warning (if any in bulk) */}
              {unitMismatches.length > 0 && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Unit Mismatch:</strong> Selected items must share at least one unit ({sourceUnits.join(' / ').toUpperCase()}). {unitMismatches.length} item(s) have conflicting units.
                  </div>
                </div>
              )}

              {/* Source Cut Sizes Section */}
              {isBulk ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Layers size={13} className="text-indigo-600" />
                      <span>{itemsList.length} BOM Cut Sizes Selected</span>
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {isBO ? 'Bought-Out' : 'Raw Material'}
                    </span>
                  </div>

                  <div className="max-h-56 sm:max-h-64 overflow-y-auto divide-y divide-slate-200/60 dark:divide-slate-700/60 pr-1">
                    {itemsList.map((it: any, idx: number) => (
                      <div key={idx} className="py-2 flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {it.materialName || it.name}
                          </div>
                          {it.description && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-1 mt-0.5">
                              {it.description}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Units: <strong className="font-mono text-slate-600 dark:text-slate-300">{it.unit}</strong>
                            {it.hasSecondaryUnit && it.secondaryUnit && (
                              <span> | Sec: <strong className="font-mono text-slate-600 dark:text-slate-300">{it.secondaryUnit}</strong></span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {it.grossRequired || it.requiredQuantity || 0} {it.unit}
                          </span>
                          {it.hasSecondaryUnit && it.secondaryUnit && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              ({it.secondaryGrossRequired || it.secondaryQuantity || 0} {it.secondaryUnit})
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span>Total Combined Demand:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono text-sm">
                      {itemsList.reduce((acc, it) => acc + (Number(it.grossRequired || it.requiredQuantity) || 0), 0).toLocaleString('en-IN')} {sourcePrimaryUnit}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Boxes size={13} className="text-indigo-600" />
                      <span>Source Cut-Size / Blank (In BOM)</span>
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {isBO ? 'Bought-Out' : 'Raw Material'}
                    </span>
                  </div>

                  <div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {primaryItem.materialName || primaryItem.name}
                    </div>
                    {primaryItem.description && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                        {primaryItem.description}
                      </div>
                    )}
                  </div>

                  {/* Requirement & Unit Badges */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="text-[10px] uppercase text-slate-400 font-semibold">Gross Demand</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5 font-mono">
                        {primaryItem.grossRequired || primaryItem.requiredQuantity || 0} {sourcePrimaryUnit}
                      </div>
                      {sourceHasSecondaryUnit && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          ({primaryItem.secondaryGrossRequired || primaryItem.secondaryQuantity || 0} {sourceSecondaryUnit})
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 bg-rose-50/70 dark:bg-rose-950/40 rounded-lg border border-rose-200/80 dark:border-rose-900/60 text-xs">
                      <div className="text-[10px] uppercase text-rose-500 font-semibold">Net Shortage</div>
                      <div className="font-bold text-rose-700 dark:text-rose-300 mt-0.5 font-mono">
                        {primaryItem.netShortage || 0} {sourcePrimaryUnit}
                      </div>
                      {sourceHasSecondaryUnit && (
                        <div className="text-[10px] text-rose-400 font-mono">
                          ({primaryItem.secondaryNetShortage || 0} {sourceSecondaryUnit})
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-2 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-lg border border-indigo-200/70 dark:border-indigo-800/70 text-xs flex items-center justify-between text-indigo-800 dark:text-indigo-200">
                    <span className="font-semibold text-[11px]">Configured Units:</span>
                    <span className="font-mono font-bold text-xs">
                      {sourcePrimaryUnit} {sourceHasSecondaryUnit ? `+ ${sourceSecondaryUnit}` : '(Single Unit)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Scope Selector: MRP Specific vs. Global Default */}
              {mrpPlanId ? (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Conversion Scope
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Choose application level</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMappingScope('plan')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        mappingScope === 'plan'
                          ? 'bg-indigo-50/90 border-indigo-500 text-indigo-900 dark:bg-indigo-950/80 dark:border-indigo-500 dark:text-indigo-200 font-bold shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>⚡</span>
                        <span className="truncate">{mrpNumber || 'This MRP Plan'}</span>
                      </div>
                      <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                        Applies only to this MRP plan. Detachable anytime.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMappingScope('global')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        mappingScope === 'global'
                          ? 'bg-indigo-50/90 border-indigo-500 text-indigo-900 dark:bg-indigo-950/80 dark:border-indigo-500 dark:text-indigo-200 font-bold shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>🌐</span>
                        <span>Global Default</span>
                      </div>
                      <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                        Default for all current & future MRP plans.
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span>🌐</span>
                  <span><strong>Global Default Mapping:</strong> This will apply across all MRP procurement plans.</span>
                </div>
              )}

              {/* Conversion Factor & Live Preview (When target is selected) */}
              {selectedTargetItem && (
                <div className="p-3.5 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-slate-50/80 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900/60 rounded-xl border border-indigo-200/90 dark:border-indigo-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>📐 Conversion Ratio (Multiplier)</span>
                    </label>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                      1 {sourcePrimaryUnit} = {conversionFactorInput || '1'} {selectedTargetItem.unit || sourcePrimaryUnit}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="any"
                        min="0.000001"
                        value={conversionFactorInput}
                        onChange={e => setConversionFactorInput(e.target.value)}
                        placeholder="1.0"
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                      {selectedTargetItem.unit || sourcePrimaryUnit} per {sourcePrimaryUnit}
                    </div>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">Quick:</span>
                    {[1, 0.5, 0.25, 0.2, 0.1].map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setConversionFactorInput(String(q))}
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                          conversionFactorInput === String(q)
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-indigo-50'
                        }`}
                      >
                        {q}x
                      </button>
                    ))}
                    {selectedTargetItem.hasSecondaryUnit && Number(selectedTargetItem.conversionFactor) > 0 && (
                      <button
                        type="button"
                        onClick={() => setConversionFactorInput(String(selectedTargetItem.conversionFactor))}
                        className="px-1.5 py-0.5 text-[10px] font-mono rounded border bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100 cursor-pointer"
                        title="Master Secondary Conversion Ratio"
                      >
                        Master Ratio ({selectedTargetItem.conversionFactor}x)
                      </button>
                    )}
                  </div>

                  {/* Live Conversion Math Calculation Preview */}
                  <div className="p-2 bg-white/90 dark:bg-slate-900/90 rounded-lg border border-indigo-100 dark:border-indigo-900/60 text-xs flex items-center justify-between shadow-2xs">
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">Converted Bucket Demand:</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm">
                      {rawGrossRequired} {sourcePrimaryUnit} × {conversionFactorInput || '1'} = {calculatedTargetDemand} {selectedTargetItem.unit || sourcePrimaryUnit}
                    </span>
                  </div>
                </div>
              )}

              {/* Unit Compatibility Guidance Card */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200/90 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">Flexible Unit Matching Active:</div>
                  <div className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    Commercial purchasable items that share <strong>at least one unit</strong> (Primary: <strong className="font-mono">{sourcePrimaryUnit}</strong>{sourceHasSecondaryUnit ? <> or Secondary: <strong className="font-mono">{sourceSecondaryUnit}</strong></> : ''}) are eligible.
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Target Purchase Item Selection (Search & List) */}
            <div className="lg:col-span-7 flex flex-col gap-3 min-w-0">
              
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Select Target Purchase {isBO ? 'Bought-Out' : 'Raw Material'} (Bucket)</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {filteredEligible.length} compatible items found
                </span>
              </div>

              {/* Selected Target Card Preview (if chosen) */}
              {selectedTargetItem && (
                <div className="p-3.5 bg-indigo-50/80 dark:bg-indigo-950/60 rounded-xl border-2 border-indigo-500 flex items-start justify-between gap-3 shadow-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {selectedTargetItem.name || selectedTargetItem.targetPurchaseItemName}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                        Selected Bucket
                      </span>
                    </div>
                    {(selectedTargetItem.description || selectedTargetItem.descriptions || selectedTargetItem.targetPurchaseItemDescription) && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 italic mt-0.5 ml-6 line-clamp-1">
                        {selectedTargetItem.description || selectedTargetItem.descriptions || selectedTargetItem.targetPurchaseItemDescription}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 ml-6 text-[10px] text-slate-500 dark:text-slate-400">
                      <span>Live Stock: <strong className="font-mono text-indigo-600 dark:text-indigo-300 font-bold">{selectedTargetItem.currentStock || 0} {selectedTargetItem.unit || sourcePrimaryUnit}</strong></span>
                      {selectedTargetItem.hasSecondaryUnit && (
                        <span>• Dual Ratio: <strong className="font-mono">1 {selectedTargetItem.unit} = {selectedTargetItem.conversionFactor} {selectedTargetItem.secondaryUnit}</strong></span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedTargetId('')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer shrink-0"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Keyword Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder={`Search purchase items by keyword (e.g. 1.5 x 1250 x 2500, CRCA Sheet)...`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none text-slate-900 dark:text-white font-medium shadow-2xs transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Spacious Scrollable Eligible Purchase Items List */}
              <div className="max-h-[360px] lg:max-h-[440px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                {loadingEligible ? (
                  <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                    <span>Searching compatible purchase items sharing unit ({sourceUnits.join(' / ').toUpperCase()})...</span>
                  </div>
                ) : filteredEligible.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-1.5">
                    <div className="font-bold text-slate-600 dark:text-slate-300">No compatible items found</div>
                    <p className="max-w-md mx-auto text-slate-400 text-[11px]">
                      Ensure you have standard purchasable {isBO ? 'bought-outs' : 'raw materials'} registered in Store &gt; Masters that have at least one unit matching <strong>{sourceUnits.join(' or ').toUpperCase()}</strong>.
                    </p>
                  </div>
                ) : (
                  filteredEligible.map((elItem: any) => {
                    const isSelected = selectedTargetId === elItem._id;
                    const elUnits = [elItem.unit, elItem.secondaryUnit]
                      .filter((u): u is string => Boolean(u && typeof u === 'string' && u.trim()))
                      .map(u => u.trim().toLowerCase());
                    const matchedUnitsList = elUnits.filter(u => sourceUnits.includes(u));

                    return (
                      <div
                        key={elItem._id}
                        onClick={() => handleSelectTarget(elItem)}
                        className={`p-3 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected 
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/70 border-l-4 border-indigo-600' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {elItem.name}
                          </div>
                          {(elItem.description || elItem.descriptions) && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-1 mt-0.5">
                              {elItem.description || elItem.descriptions}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                              Stock: {elItem.currentStock || 0} {elItem.unit}
                            </span>
                            {elItem.hasSecondaryUnit && (
                              <span>• 1 {elItem.unit} = {elItem.conversionFactor} {elItem.secondaryUnit}</span>
                            )}
                            {matchedUnitsList.length > 0 && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Match: {matchedUnitsList.join(', ').toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {isSelected ? (
                            <span className="p-1.5 rounded-full bg-indigo-600 text-white shadow-xs">
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectTarget(elItem);
                              }}
                              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:border-indigo-300 dark:hover:bg-indigo-950/60 dark:hover:border-indigo-800 hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                              Select
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50 flex-wrap">
          <div className="flex items-center gap-2">
            {!isBulk && mrpPlanId && (currentMapping || primaryItem?.materialPlanningStatus === 'In Purchase Bucket') && !isDetachedForPlan && (
              <button
                type="button"
                onClick={handleDetachFromPlan}
                disabled={submitting}
                className="px-3.5 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40"
                title={`Detach from purchase bucket specifically for ${mrpNumber || 'this MRP plan'}`}
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Detach (This MRP Only)</span>
              </button>
            )}

            {!isBulk && currentMapping && (
              <button
                type="button"
                onClick={handleUnmap}
                disabled={submitting}
                className="px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Bucket</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveMapping}
              disabled={submitting || !selectedTargetId || unitMismatches.length > 0 || targetUnitIncompatible}
              className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {submitting 
                ? "Saving..." 
                : (isBulk 
                    ? `Send ${itemsList.length} Items to Purchase Bucket` 
                    : (currentMapping ? "Update Purchase Bucket" : "Save to Purchase Bucket"))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
