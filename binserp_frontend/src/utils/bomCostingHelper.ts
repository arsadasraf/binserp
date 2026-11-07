import { ExplodedBOMNode, ConsolidatedBOMItem } from './bomHierarchyHelper';

export type BOMCostingMode = 'L2_ONLY' | 'COMPONENT_AND_BO' | 'RM_AND_BO';

export const DEFAULT_BOM_CURRENCY_RATES: Record<string, number> = {
  INR: 1,
  USD: 84,
  EUR: 91,
  GBP: 108,
  AED: 22.9,
  SGD: 63,
  JPY: 0.56,
  CNY: 11.6,
  AUD: 55,
  CAD: 61
};

export interface ItemPriceInfo {
  hasPrice: boolean;
  unitPrice: number; // Always normalized to INR for accurate BOM rollup
  currency: string;
  originalUnitPrice?: number;
  originalCurrency?: string;
  exchangeRateToINR?: number;
  vendorId?: string;
  vendorName?: string;
  vendorCode?: string;
  isPreferredVendor?: boolean;
  priceSource: 'vendor-price-list' | 'sales-price-list' | 'fg-master' | 'none';
  priceListId?: string;
  pricingUnit?: string;
  isSecondaryUnit?: boolean;
  taxRate?: number;
  remarks?: string;
  extendedCost: number; // cumulativeQuantity * unitPrice (in INR)
  isSubAssemblyPriced?: boolean;
  underPricedSubAssembly?: boolean;
  isCostedInActiveMode?: boolean;
  exclusionReason?: string;
}

export type PriceFilterMode = 'ALL' | 'PRICED_ONLY' | 'MISSING_ONLY';

export interface CostingDashboardSummary {
  costingMode: BOMCostingMode;
  totalEstimatedCost: number;
  totalPricedItems: number;
  totalMissingItems: number;
  totalItems: number;
  coveragePercentage: number;
  totalCumulativeQty: number;
  rmCost: number;
  boCost: number;
  componentCost: number;
  subAssemblyCost: number;
  excludedChildPartsCount: number;
}

/**
 * Determines whether a BOM item is included in the active costing calculation mode.
 *
 * Mode 1 ('L2_ONLY'): Price calculation based strictly on Level 2 (L2) direct items.
 * Mode 2 ('COMPONENT_AND_BO'): Price calculation based on In-House Components + Bought-Out (BO) items
 *   (plus any direct L2 Raw Material attached directly to the root FG and not inside a Component).
 * Mode 3 ('RM_AND_BO'): Price calculation based on Raw Materials (RM of In-House Components) + Bought-Out (BO) items
 *   (plus any leaf In-House Component that has no child RM BOM defined).
 */
export function evaluateCostingModeEligibility(
  itemType: 'SubAssembly' | 'Assembly' | 'Component' | 'BO' | 'RM',
  levels: number[],
  costingMode: BOMCostingMode = 'L2_ONLY',
  hasChildren?: boolean
): { isCosted: boolean; exclusionReason?: string } {
  if (costingMode === 'L2_ONLY') {
    const isL2 = levels.includes(2);
    return {
      isCosted: isL2,
      exclusionReason: isL2 ? undefined : 'Excluded (L2 Costing)'
    };
  }

  if (costingMode === 'COMPONENT_AND_BO') {
    const isCompOrBo = itemType === 'Component' || itemType === 'BO';
    if (isCompOrBo) {
      return { isCosted: true };
    }
    if (itemType === 'RM') {
      // If an RM is directly attached to the Root FG at Level 2, it is not inside any Component
      if (levels.includes(2)) {
        return { isCosted: true };
      }
      return { isCosted: false, exclusionReason: 'Covered in Component' };
    }
    return { isCosted: false, exclusionReason: 'Parent Sub-Assy (Excluded)' };
  }

  // 'RM_AND_BO'
  const isRmOrBo = itemType === 'RM' || itemType === 'BO';
  if (isRmOrBo) {
    return { isCosted: true };
  }
  if (itemType === 'Component') {
    // If a leaf Component has no child BOM (no RM items under it), include its own price so cost isn't dropped
    if (hasChildren === false) {
      return { isCosted: true };
    }
    return { isCosted: false, exclusionReason: 'Rolled into RM Cost' };
  }
  return { isCosted: false, exclusionReason: 'Parent Sub-Assy (Excluded)' };
}

function normalizeCurrencyRate(
  rawPrice: number,
  rawCurrency?: string,
  currencyRates: Record<string, number> = DEFAULT_BOM_CURRENCY_RATES
): { unitPriceINR: number; currency: string; originalUnitPrice: number; originalCurrency: string; exchangeRateToINR: number } {
  const curr = (rawCurrency || 'INR').toString().trim().toUpperCase() || 'INR';
  const rate = curr === 'INR' ? 1 : (Number(currencyRates[curr]) || DEFAULT_BOM_CURRENCY_RATES[curr] || 1);
  const unitPriceINR = curr === 'INR' ? rawPrice : parseFloat((rawPrice * rate).toFixed(4));
  return {
    unitPriceINR,
    currency: 'INR',
    originalUnitPrice: rawPrice,
    originalCurrency: curr,
    exchangeRateToINR: rate
  };
}

/**
 * Resolves price info for a single material or FG item from vendor price lists or sales price lists.
 */
export function resolveItemPriceInfo(
  item: {
    id: string;
    materialName: string;
    materialCode?: string;
    itemType: 'SubAssembly' | 'Assembly' | 'Component' | 'BO' | 'RM';
    unit?: string;
  },
  vendorPriceLists: any[] = [],
  salesPriceLists: any[] = [],
  allFGItems: any[] = [],
  currencyRates: Record<string, number> = DEFAULT_BOM_CURRENCY_RATES
): ItemPriceInfo {
  const isFGOrAssembly = item.itemType === 'SubAssembly' || item.itemType === 'Assembly' || item.itemType === 'Component';
  const rawId = (item.id || '').toString().trim();
  const rawName = (item.materialName || '').toLowerCase().trim();
  const rawCode = (item.materialCode || '').toLowerCase().trim();

  // 1. If Sub-Assembly, Assembly, or Component: Check Sales Price List and FG Item Master
  if (isFGOrAssembly) {
    let matchedSalesPL: any = null;
    if (Array.isArray(salesPriceLists)) {
      const matchingSalesEntries = salesPriceLists.filter((pl: any) => {
        const plFgId = (pl.fgItem?._id || pl.fgItem?.id || pl.fgItem)?.toString();
        if (rawId && plFgId && rawId === plFgId) return true;
        const plFgCode = (pl.fgItem?.code || '').toLowerCase().trim();
        if (rawCode && plFgCode && rawCode === plFgCode) return true;
        const plFgName = (pl.fgItem?.name || '').toLowerCase().trim();
        return Boolean(rawName && plFgName && rawName === plFgName);
      });
      if (matchingSalesEntries.length > 0) {
        matchingSalesEntries.sort((a: any, b: any) => {
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        matchedSalesPL = matchingSalesEntries[0];
      }
    }

    if (matchedSalesPL && matchedSalesPL.price !== undefined && matchedSalesPL.price !== null && Number(matchedSalesPL.price) > 0) {
      const priceNum = Number(matchedSalesPL.price);
      const norm = normalizeCurrencyRate(priceNum, matchedSalesPL.currency, currencyRates);
      return {
        hasPrice: true,
        unitPrice: norm.unitPriceINR,
        currency: norm.originalCurrency,
        originalUnitPrice: norm.originalUnitPrice,
        originalCurrency: norm.originalCurrency,
        exchangeRateToINR: norm.exchangeRateToINR,
        vendorName: 'Sales Catalog',
        priceSource: 'sales-price-list',
        priceListId: matchedSalesPL._id,
        pricingUnit: matchedSalesPL.pricingUnit || item.unit,
        isSecondaryUnit: Boolean(matchedSalesPL.isSecondaryUnit),
        taxRate: matchedSalesPL.taxRate !== undefined ? Number(matchedSalesPL.taxRate) : 18,
        remarks: matchedSalesPL.remarks || '',
        extendedCost: 0,
        isSubAssemblyPriced: true,
        underPricedSubAssembly: false
      };
    }

    // Check matched FG master sellingPrice / rate
    if (Array.isArray(allFGItems)) {
      const matchedFG = allFGItems.find((fg: any) => {
        const fgId = (fg._id || fg.id)?.toString();
        if (rawId && fgId && rawId === fgId) return true;
        const fgCode = (fg.code || '').toLowerCase().trim();
        if (rawCode && fgCode && rawCode === fgCode) return true;
        const fgName = (fg.name || '').toLowerCase().trim();
        return rawName && fgName && rawName === fgName;
      });

      const fgPriceNum = Number(matchedFG?.sellingPrice || matchedFG?.rate || 0);
      if (matchedFG && fgPriceNum > 0) {
        const norm = normalizeCurrencyRate(fgPriceNum, matchedFG.currency, currencyRates);
        return {
          hasPrice: true,
          unitPrice: norm.unitPriceINR,
          currency: norm.originalCurrency,
          originalUnitPrice: norm.originalUnitPrice,
          originalCurrency: norm.originalCurrency,
          exchangeRateToINR: norm.exchangeRateToINR,
          vendorName: 'FG Master Rate',
          priceSource: 'fg-master',
          pricingUnit: matchedFG.unit || item.unit,
          remarks: '',
          extendedCost: 0,
          isSubAssemblyPriced: true,
          underPricedSubAssembly: false
        };
      }
    }
  }

  // 2. For Raw Materials (RM), Bought-Out (BO), or Components with vendor pricing: Check Vendor Price List
  if (Array.isArray(vendorPriceLists) && vendorPriceLists.length > 0) {
    const matchingEntries: any[] = [];

    vendorPriceLists.forEach((pl: any) => {
      const plMatId = (pl.material?._id || pl.material?.id || pl.material)?.toString();
      if (rawId && plMatId && rawId === plMatId) {
        matchingEntries.push(pl);
        return;
      }
      const plMatCode = (pl.material?.code || '').toLowerCase().trim();
      if (rawCode && plMatCode && rawCode === plMatCode) {
        matchingEntries.push(pl);
        return;
      }
      const plMatName = (pl.material?.name || '').toLowerCase().trim();
      if (rawName && plMatName && rawName === plMatName) {
        matchingEntries.push(pl);
      }
    });

    if (matchingEntries.length > 0) {
      // Prioritize Preferred Vendor first, then most recently updated entry, then entry with an assigned vendor
      matchingEntries.sort((a: any, b: any) => {
        if (Boolean(a.isPreferred) !== Boolean(b.isPreferred)) {
          return a.isPreferred ? -1 : 1;
        }
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        const hasVendorA = Boolean(a.vendor?._id || a.vendor);
        const hasVendorB = Boolean(b.vendor?._id || b.vendor);
        if (hasVendorA !== hasVendorB) return hasVendorA ? -1 : 1;
        return 0;
      });
      const selectedPL = matchingEntries[0];

      const priceNum = Number(selectedPL.price) || 0;
      const norm = normalizeCurrencyRate(priceNum, selectedPL.currency, currencyRates);
      const vendorObj = typeof selectedPL.vendor === 'object' && selectedPL.vendor !== null ? selectedPL.vendor : null;
      const vendorId = vendorObj
        ? String(vendorObj._id || vendorObj.id || '')
        : selectedPL.vendor
        ? String(selectedPL.vendor)
        : '';
      const vendorName = vendorObj?.name || (vendorId ? 'Assigned Vendor' : 'Standard Base Price');
      const vendorCode = vendorObj?.code || vendorObj?.vendorCode || '';

      return {
        hasPrice: priceNum > 0,
        unitPrice: norm.unitPriceINR,
        currency: norm.originalCurrency,
        originalUnitPrice: norm.originalUnitPrice,
        originalCurrency: norm.originalCurrency,
        exchangeRateToINR: norm.exchangeRateToINR,
        vendorId,
        vendorName,
        vendorCode,
        isPreferredVendor: Boolean(selectedPL.isPreferred),
        priceSource: 'vendor-price-list',
        priceListId: selectedPL._id,
        pricingUnit: selectedPL.pricingUnit || item.unit,
        isSecondaryUnit: Boolean(selectedPL.isSecondaryUnit),
        taxRate: selectedPL.taxRate !== undefined ? Number(selectedPL.taxRate) : 18,
        remarks: selectedPL.remarks || '',
        extendedCost: 0,
        isSubAssemblyPriced: false,
        underPricedSubAssembly: false
      };
    }
  }

  // Fallback: No price list configured
  return {
    hasPrice: false,
    unitPrice: 0,
    currency: 'INR',
    priceSource: 'none',
    extendedCost: 0,
    isSubAssemblyPriced: false,
    underPricedSubAssembly: false
  };
}

export interface EnrichedExplodedBOMNode extends ExplodedBOMNode {
  priceInfo: ItemPriceInfo;
  children: EnrichedExplodedBOMNode[];
}

export interface EnrichedConsolidatedBOMItem extends ConsolidatedBOMItem {
  priceInfo: ItemPriceInfo;
}

/**
 * Enriches the recursive BOM tree with pricing info based on the selected 3-mode costing strategy.
 */
export function enrichTreeWithPricing(
  nodes: ExplodedBOMNode[],
  vendorPriceLists: any[] = [],
  salesPriceLists: any[] = [],
  allFGItems: any[] = [],
  costingMode: BOMCostingMode = 'L2_ONLY',
  currencyRates: Record<string, number> = DEFAULT_BOM_CURRENCY_RATES
): EnrichedExplodedBOMNode[] {
  return (nodes || []).map((node) => {
    const rawPriceInfo = resolveItemPriceInfo(
      {
        id: node.id,
        materialName: node.materialName,
        materialCode: node.materialCode,
        itemType: node.itemType,
        unit: node.unit
      },
      vendorPriceLists,
      salesPriceLists,
      allFGItems,
      currencyRates
    );

    const hasChildNodes = Boolean(node.hasChildren || (Array.isArray(node.children) && node.children.length > 0));
    const { isCosted, exclusionReason } = evaluateCostingModeEligibility(
      node.itemType,
      [node.level],
      costingMode,
      hasChildNodes
    );

    const useSecQty = Boolean(
      node.hasSecondaryUnit &&
        (rawPriceInfo.isSecondaryUnit ||
          (rawPriceInfo.pricingUnit &&
            node.secondaryUnit &&
            rawPriceInfo.pricingUnit.trim().toUpperCase() === node.secondaryUnit.trim().toUpperCase()))
    );
    const effectiveNodeQty = useSecQty
      ? (node.secondaryCumulativeQuantity !== undefined
          ? parseFloat(Number(node.secondaryCumulativeQuantity).toFixed(4))
          : parseFloat(((node.cumulativeQuantity || 0) * (node.conversionFactor || 1)).toFixed(4)))
      : parseFloat((node.cumulativeQuantity || 0).toFixed(4));

    const priceInfo: ItemPriceInfo = {
      ...rawPriceInfo,
      isCostedInActiveMode: isCosted,
      exclusionReason,
      underPricedSubAssembly: !isCosted,
      extendedCost: Number(((rawPriceInfo.unitPrice || 0) * effectiveNodeQty).toFixed(2))
    };

    const enrichedChildren = enrichTreeWithPricing(
      node.children || [],
      vendorPriceLists,
      salesPriceLists,
      allFGItems,
      costingMode,
      currencyRates
    );

    return {
      ...node,
      priceInfo,
      children: enrichedChildren
    };
  });
}

/**
 * Enriches consolidated BOM items with pricing information based on the selected 3-mode costing strategy.
 */
export function enrichConsolidatedItemsWithPricing(
  items: ConsolidatedBOMItem[],
  vendorPriceLists: any[] = [],
  salesPriceLists: any[] = [],
  allFGItems: any[] = [],
  costingMode: BOMCostingMode = 'L2_ONLY',
  currencyRates: Record<string, number> = DEFAULT_BOM_CURRENCY_RATES
): EnrichedConsolidatedBOMItem[] {
  return (items || []).map((item) => {
    const rawPriceInfo = resolveItemPriceInfo(
      {
        id: item.id,
        materialName: item.materialName,
        materialCode: item.materialCode,
        itemType: item.itemType,
        unit: item.unit
      },
      vendorPriceLists,
      salesPriceLists,
      allFGItems,
      currencyRates
    );

    // Check if matched FG item has child BOM (for Component leaf detection in RM_AND_BO mode)
    let hasChildBOM: boolean | undefined = undefined;
    if (item.itemType === 'Component' && Array.isArray(allFGItems) && allFGItems.length > 0) {
      const matchedFG = allFGItems.find((fg: any) => {
        const fgId = (fg._id || fg.id)?.toString();
        if (item.id && fgId && item.id === fgId) return true;
        return (fg.name || '').toLowerCase().trim() === (item.materialName || '').toLowerCase().trim();
      });
      if (matchedFG) {
        hasChildBOM = Array.isArray(matchedFG.bom) && matchedFG.bom.length > 0;
      }
    }

    const usageLevels = Array.isArray(item.usages) ? item.usages.map((u) => u.level) : [];
    const { isCosted, exclusionReason } = evaluateCostingModeEligibility(
      item.itemType,
      usageLevels,
      costingMode,
      hasChildBOM
    );

    const useSecQty = Boolean(
      item.hasSecondaryUnit &&
        (rawPriceInfo.isSecondaryUnit ||
          (rawPriceInfo.pricingUnit &&
            item.secondaryUnit &&
            rawPriceInfo.pricingUnit.trim().toUpperCase() === item.secondaryUnit.trim().toUpperCase()))
    );

    // If L2_ONLY mode (or RM in COMPONENT_AND_BO mode where only L2 direct RM is costed), compute L2-specific quantity
    const filterToL2UsagesOnly =
      isCosted &&
      (costingMode === 'L2_ONLY' || (costingMode === 'COMPONENT_AND_BO' && item.itemType === 'RM'));

    const basePrimaryQty = parseFloat(
      (filterToL2UsagesOnly
        ? item.usages
            .filter((u) => u.level === 2)
            .reduce((acc, u) => acc + (Number(u.cumulativeQuantity) || 0), 0) || item.totalCumulativeQuantity
        : item.totalCumulativeQuantity
      ).toFixed(4)
    );

    const baseSecondaryQty = parseFloat(
      (filterToL2UsagesOnly
        ? item.usages
            .filter((u) => u.level === 2)
            .reduce((acc, u) => acc + (Number(u.secondaryCumulativeQuantity) || 0), 0) ||
          item.totalSecondaryCumulativeQuantity ||
          (basePrimaryQty || 0) * (item.conversionFactor || 1)
        : (item.totalSecondaryCumulativeQuantity ?? (basePrimaryQty || 0) * (item.conversionFactor || 1))
      ).toFixed(4)
    );

    const effectiveQty = useSecQty ? baseSecondaryQty : basePrimaryQty;

    const priceInfo: ItemPriceInfo = {
      ...rawPriceInfo,
      isCostedInActiveMode: isCosted,
      exclusionReason,
      underPricedSubAssembly: !isCosted,
      extendedCost: Number(((rawPriceInfo.unitPrice || 0) * (effectiveQty || 0)).toFixed(2))
    };

    return {
      ...item,
      priceInfo
    };
  });
}

/**
 * Calculates executive costing dashboard metrics from enriched BOM tree and consolidated items
 * according to the active BOMCostingMode ('L2_ONLY' | 'COMPONENT_AND_BO' | 'RM_AND_BO').
 */
export function calculateBOMCostingSummary(
  enrichedFlatTree: EnrichedExplodedBOMNode[],
  enrichedConsolidated: EnrichedConsolidatedBOMItem[],
  costingMode: BOMCostingMode = 'L2_ONLY'
): CostingDashboardSummary {
  let totalEstimatedCost = 0;
  let rmCost = 0;
  let boCost = 0;
  let componentCost = 0;
  let subAssemblyCost = 0;
  let excludedChildPartsCount = 0;

  (enrichedFlatTree || []).forEach((node) => {
    if (!node.priceInfo.isCostedInActiveMode) {
      excludedChildPartsCount++;
    }
  });

  // Calculate item coverage counts and cost breakdown strictly from consolidated items active in the selected costing mode
  // so the Consolidated Table column sum and the Grand Total match to the exact paisa without per-node rounding drift.
  const activeModeConsolidated = (enrichedConsolidated || []).filter(
    (item) => item.priceInfo.isCostedInActiveMode
  );

  if (Array.isArray(enrichedConsolidated) && enrichedConsolidated.length > 0) {
    activeModeConsolidated.forEach((item) => {
      const price = item.priceInfo.unitPrice || 0;
      const extended = item.priceInfo.extendedCost || 0;
      if (price > 0) {
        totalEstimatedCost += extended;
        if (item.itemType === 'RM') {
          rmCost += extended;
        } else if (item.itemType === 'BO') {
          boCost += extended;
        } else if (item.itemType === 'Component') {
          componentCost += extended;
        } else if (item.itemType === 'SubAssembly' || item.itemType === 'Assembly') {
          subAssemblyCost += extended;
        }
      }
    });
  } else {
    (enrichedFlatTree || []).forEach((node) => {
      if (!node.priceInfo.isCostedInActiveMode) return;
      const price = node.priceInfo.unitPrice || 0;
      const extended = node.priceInfo.extendedCost || 0;
      if (price > 0) {
        totalEstimatedCost += extended;
        if (node.itemType === 'RM') {
          rmCost += extended;
        } else if (node.itemType === 'BO') {
          boCost += extended;
        } else if (node.itemType === 'Component') {
          componentCost += extended;
        } else if (node.itemType === 'SubAssembly' || node.itemType === 'Assembly') {
          subAssemblyCost += extended;
        }
      }
    });
  }

  const totalItems = activeModeConsolidated.length;
  let totalPricedItems = 0;
  let totalCumulativeQty = 0;

  (enrichedConsolidated || []).forEach((item) => {
    totalCumulativeQty += Number(item.totalCumulativeQuantity) || 0;
  });

  activeModeConsolidated.forEach((item) => {
    if (item.priceInfo.hasPrice) {
      totalPricedItems++;
    }
  });

  const totalMissingItems = Math.max(0, totalItems - totalPricedItems);
  const coveragePercentage = totalItems > 0 ? Math.round((totalPricedItems / totalItems) * 100) : 0;

  return {
    costingMode,
    totalEstimatedCost: Number(totalEstimatedCost.toFixed(2)),
    totalPricedItems,
    totalMissingItems,
    totalItems,
    coveragePercentage,
    totalCumulativeQty: parseFloat(totalCumulativeQty.toFixed(4)),
    rmCost: Number(rmCost.toFixed(2)),
    boCost: Number(boCost.toFixed(2)),
    componentCost: Number(componentCost.toFixed(2)),
    subAssemblyCost: Number(subAssemblyCost.toFixed(2)),
    excludedChildPartsCount
  };
}

/**
 * Filters enriched tree nodes by active price status filter.
 * When filtering by PRICED_ONLY or MISSING_ONLY, matches against items active in the selected costing mode.
 */
export function filterEnrichedTree(
  nodes: EnrichedExplodedBOMNode[],
  priceFilter: PriceFilterMode
): EnrichedExplodedBOMNode[] {
  if (priceFilter === 'ALL') return nodes;

  const result: EnrichedExplodedBOMNode[] = [];

  nodes.forEach((node) => {
    const isActiveInMode = Boolean(node.priceInfo.isCostedInActiveMode);
    const matchesPrice =
      isActiveInMode &&
      (priceFilter === 'PRICED_ONLY' ? node.priceInfo.hasPrice : !node.priceInfo.hasPrice);

    const filteredChildren = filterEnrichedTree(node.children || [], priceFilter);

    if (matchesPrice || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren,
        hasChildren: filteredChildren.length > 0
      });
    }
  });

  return result;
}

/**
 * Filters enriched consolidated items by price status filter.
 */
export function filterEnrichedConsolidated(
  items: EnrichedConsolidatedBOMItem[],
  priceFilter: PriceFilterMode
): EnrichedConsolidatedBOMItem[] {
  if (priceFilter === 'ALL') return items;
  if (priceFilter === 'PRICED_ONLY') {
    return items.filter((item) => item.priceInfo.isCostedInActiveMode && item.priceInfo.hasPrice);
  }
  return items.filter((item) => item.priceInfo.isCostedInActiveMode && !item.priceInfo.hasPrice);
}
