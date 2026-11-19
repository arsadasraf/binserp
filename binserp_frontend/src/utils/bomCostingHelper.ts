import { ExplodedBOMNode, ConsolidatedBOMItem } from './bomHierarchyHelper';

export type BOMCostingMode = 'L2_ONLY' | 'COMPONENT_AND_BO' | 'RM_AND_BO';

export type VendorPriceStrategy = 'preferred_latest' | 'lowest' | 'highest' | 'average';

export interface AlternateVendorPrice {
  vendorName: string;
  price: number;
  pricingUnit: string;
  isPreferred: boolean;
  isExpired: boolean;
}

export const DEFAULT_BOM_CURRENCY_RATES: Record<string, number> = {
  INR: 1
};

export interface ItemPriceInfo {
  hasPrice: boolean;
  unitPrice: number; // Strictly in INR (no currency conversion)
  currency: string; // Always 'INR'
  originalUnitPrice?: number;
  originalCurrency?: string;
  exchangeRateToINR?: number;
  vendorId?: string;
  vendorName?: string;
  vendorCode?: string;
  isPreferredVendor?: boolean;
  priceSource: 'vendor-price-list' | 'sales-price-list' | 'none';
  priceListId?: string;
  pricingUnit?: string;
  isSecondaryUnit?: boolean;
  taxRate?: number;
  remarks?: string;
  extendedCost: number; // effectiveQty * unitPrice (strictly in INR, rounded to 2 decimals)
  effectiveQty?: number;
  effectiveUnit?: string;
  formulaText?: string;
  unitMismatch?: boolean;
  unitMismatchMessage?: string;
  isExpiredPrice?: boolean;
  alternatePricesCount?: number;
  alternatePrices?: AlternateVendorPrice[];
  matchedBy?: 'id' | 'code' | 'name' | 'none';
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
  unitMismatchCount: number;
  expiredPricesCount: number;
  multiVendorItemsCount: number;
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

function roundMoney(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function isPriceListEntryExpired(pl: any): boolean {
  if (!pl?.validUntil) return false;
  const end = new Date(pl.validUntil);
  if (isNaN(end.getTime())) return false;
  // Valid through the end of the validUntil calendar day
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
}

function isCompatiblePurchaseCategory(
  pl: any,
  itemType: 'RM' | 'BO'
): boolean {
  const cat = String(pl?.material?.itemCategory || pl?.itemCategory || '').toLowerCase().trim();
  if (!cat) return true; // Legacy entries without itemCategory
  if (itemType === 'RM') return cat === 'rm' || cat === 'raw_material' || cat === 'raw material';
  if (itemType === 'BO') return cat === 'bo' || cat === 'bought_out' || cat === 'bought out';
  return true;
}

function evaluateUnitMatch(
  rawPriceInfo: ItemPriceInfo,
  primaryUnit?: string,
  hasSecondaryUnit?: boolean,
  secondaryUnit?: string
): { useSecQty: boolean; unitMismatch: boolean; unitMismatchMessage?: string } {
  const priU = (primaryUnit || '').trim().toUpperCase();
  const secU = (secondaryUnit || '').trim().toUpperCase();
  const plU = (rawPriceInfo.pricingUnit || '').trim().toUpperCase();

  const useSecQty = Boolean(
    hasSecondaryUnit &&
      secU &&
      (rawPriceInfo.isSecondaryUnit || (plU && plU === secU))
  );

  const unitMismatch = Boolean(
    rawPriceInfo.hasPrice &&
      plU &&
      priU &&
      plU !== priU &&
      !(hasSecondaryUnit && secU && plU === secU)
  );

  const unitMismatchMessage = unitMismatch
    ? `BOM unit (${priU}) ≠ Price List unit (${plU})`
    : undefined;

  return { useSecQty, unitMismatch, unitMismatchMessage };
}

function buildFormulaText(
  hasPrice: boolean,
  qty: number,
  unit: string,
  unitPrice: number,
  extendedCost: number
): string {
  if (!hasPrice) return '';
  const fmtPrice = unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtExt = extendedCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${qty} ${unit || 'PCS'} × ₹${fmtPrice} = ₹${fmtExt}`;
}

/**
 * Resolves price info for a single BOM item strictly in INR with single-source isolation:
 * - FG / Assembly / SubAssembly / Component -> ONLY Sales Price List (`salesPriceLists`), strict ID-first matching.
 * - RM / BO -> ONLY Purchase Vendor Price List (`vendorPriceLists`), strict ID-first matching + expiry & vendor strategy.
 * No cross-source fallback and no foreign currency multiplication.
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
  _allFGItems: any[] = [],
  _currencyRatesOrStrategy?: Record<string, number> | VendorPriceStrategy,
  vendorPriceStrategyArg?: VendorPriceStrategy
): ItemPriceInfo {
  const vendorPriceStrategy: VendorPriceStrategy =
    typeof _currencyRatesOrStrategy === 'string'
      ? _currencyRatesOrStrategy
      : vendorPriceStrategyArg || 'preferred_latest';

  const isFGOrAssembly =
    item.itemType === 'SubAssembly' ||
    item.itemType === 'Assembly' ||
    item.itemType === 'Component';

  const rawId = (item.id || '').toString().trim();
  const rawName = (item.materialName || '').toLowerCase().trim();
  const rawCode = (item.materialCode || '').toLowerCase().trim();

  // =========================================================================
  // 1. FG / Sub-Assembly / Assembly / Component -> ONLY Sales Price List (INR)
  // =========================================================================
  if (isFGOrAssembly) {
    if (Array.isArray(salesPriceLists) && salesPriceLists.length > 0) {
      let matchedEntries: any[] = [];
      let matchedBy: 'id' | 'code' | 'name' | 'none' = 'none';

      // Tier 1: Strict exact ID match (prevents cross-item name collisions)
      if (rawId) {
        matchedEntries = salesPriceLists.filter((pl: any) => {
          const plFgId = (pl.fgItem?._id || pl.fgItem?.id || pl.fgItem)?.toString().trim();
          return Boolean(plFgId && plFgId === rawId);
        });
        if (matchedEntries.length > 0) matchedBy = 'id';
      }

      // Tier 2 (Legacy fallback only when no exact ID match exists): Exact code match
      if (matchedEntries.length === 0 && rawCode) {
        matchedEntries = salesPriceLists.filter((pl: any) => {
          const plFgCode = (pl.fgItem?.code || '').toLowerCase().trim();
          return Boolean(plFgCode && plFgCode === rawCode);
        });
        if (matchedEntries.length > 0) matchedBy = 'code';
      }

      // Tier 3 (Legacy fallback only when no ID/code match exists): Exact normalized name match
      if (matchedEntries.length === 0 && rawName) {
        matchedEntries = salesPriceLists.filter((pl: any) => {
          const plFgName = (pl.fgItem?.name || '').toLowerCase().trim();
          return Boolean(plFgName && plFgName === rawName);
        });
        if (matchedEntries.length > 0) matchedBy = 'name';
      }

      if (matchedEntries.length > 0) {
        matchedEntries.sort((a: any, b: any) => {
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        const matchedSalesPL = matchedEntries[0];
        const priceNum = Number(matchedSalesPL.price) || 0;

        if (priceNum > 0) {
          return {
            hasPrice: true,
            unitPrice: priceNum,
            currency: 'INR',
            originalUnitPrice: priceNum,
            originalCurrency: 'INR',
            exchangeRateToINR: 1,
            vendorName: 'Sales Price List',
            priceSource: 'sales-price-list',
            priceListId: matchedSalesPL._id,
            pricingUnit: matchedSalesPL.pricingUnit || item.unit,
            isSecondaryUnit: Boolean(matchedSalesPL.isSecondaryUnit),
            taxRate: matchedSalesPL.taxRate !== undefined ? Number(matchedSalesPL.taxRate) : 18,
            remarks: matchedSalesPL.remarks || '',
            extendedCost: 0,
            matchedBy,
            alternatePricesCount: matchedEntries.length,
            isSubAssemblyPriced: true,
            underPricedSubAssembly: false
          };
        }
      }
    }

    // Strict rule: FG / Components ONLY look in Sales Price List — never fall back to Purchase PL or FG Master
    return {
      hasPrice: false,
      unitPrice: 0,
      currency: 'INR',
      priceSource: 'none',
      extendedCost: 0,
      matchedBy: 'none',
      isSubAssemblyPriced: false,
      underPricedSubAssembly: false
    };
  }

  // =========================================================================
  // 2. Raw Material (RM) & Bought-Out (BO) -> ONLY Purchase Vendor Price List (INR)
  // =========================================================================
  if (Array.isArray(vendorPriceLists) && vendorPriceLists.length > 0) {
    let matchingEntries: any[] = [];
    let matchedBy: 'id' | 'code' | 'name' | 'none' = 'none';
    const purchaseType: 'RM' | 'BO' = item.itemType === 'BO' ? 'BO' : 'RM';

    // Tier 1: Strict exact ID match (prevents RM/BO cross-item name collisions)
    if (rawId) {
      matchingEntries = vendorPriceLists.filter((pl: any) => {
        const plMatId = (pl.material?._id || pl.material?.id || pl.material)?.toString().trim();
        return Boolean(plMatId && plMatId === rawId);
      });
      if (matchingEntries.length > 0) matchedBy = 'id';
    }

    // Tier 2 (Legacy fallback only when no exact ID match exists): Category-compatible code match
    if (matchingEntries.length === 0 && rawCode) {
      matchingEntries = vendorPriceLists.filter((pl: any) => {
        if (!isCompatiblePurchaseCategory(pl, purchaseType)) return false;
        const plMatCode = (pl.material?.code || '').toLowerCase().trim();
        return Boolean(plMatCode && plMatCode === rawCode);
      });
      if (matchingEntries.length > 0) matchedBy = 'code';
    }

    // Tier 3 (Legacy fallback only when no ID/code match exists): Category-compatible name match
    if (matchingEntries.length === 0 && rawName) {
      matchingEntries = vendorPriceLists.filter((pl: any) => {
        if (!isCompatiblePurchaseCategory(pl, purchaseType)) return false;
        const plMatName = (pl.material?.name || '').toLowerCase().trim();
        return Boolean(plMatName && plMatName === rawName);
      });
      if (matchingEntries.length > 0) matchedBy = 'name';
    }

    // Only keep positive-priced entries when selecting
    const positiveEntries = matchingEntries.filter((pl: any) => Number(pl.price) > 0);
    const workingEntries = positiveEntries.length > 0 ? positiveEntries : matchingEntries;

    if (workingEntries.length > 0) {
      // Build full alternate vendor list for transparency
      const alternatePrices: AlternateVendorPrice[] = workingEntries.map((pl: any) => {
        const vObj = typeof pl.vendor === 'object' && pl.vendor !== null ? pl.vendor : null;
        return {
          vendorName: vObj?.name || (pl.vendor ? 'Assigned Vendor' : 'Standard Base Price'),
          price: Number(pl.price) || 0,
          pricingUnit: pl.pricingUnit || item.unit || '',
          isPreferred: Boolean(pl.isPreferred),
          isExpired: isPriceListEntryExpired(pl)
        };
      });

      // Filter out expired entries if active entries exist
      const activeEntries = workingEntries.filter((pl: any) => !isPriceListEntryExpired(pl));
      const isUsingExpired = activeEntries.length === 0;
      const candidatePool = isUsingExpired ? [...workingEntries] : [...activeEntries];

      // Sort by selected strategy
      if (vendorPriceStrategy === 'lowest') {
        candidatePool.sort((a: any, b: any) => {
          const diff = (Number(a.price) || 0) - (Number(b.price) || 0);
          if (diff !== 0) return diff;
          if (Boolean(a.isPreferred) !== Boolean(b.isPreferred)) return a.isPreferred ? -1 : 1;
          return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
        });
      } else if (vendorPriceStrategy === 'highest') {
        candidatePool.sort((a: any, b: any) => {
          const diff = (Number(b.price) || 0) - (Number(a.price) || 0);
          if (diff !== 0) return diff;
          if (Boolean(a.isPreferred) !== Boolean(b.isPreferred)) return a.isPreferred ? -1 : 1;
          return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
        });
      } else {
        // 'preferred_latest' (default) or 'average' (uses preferred/latest for metadata)
        candidatePool.sort((a: any, b: any) => {
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
      }

      const selectedPL = candidatePool[0];
      let priceNum = Number(selectedPL.price) || 0;

      if (vendorPriceStrategy === 'average' && candidatePool.length > 1) {
        const sum = candidatePool.reduce((acc: number, e: any) => acc + (Number(e.price) || 0), 0);
        priceNum = roundMoney(sum / candidatePool.length);
      }

      const vendorObj = typeof selectedPL.vendor === 'object' && selectedPL.vendor !== null ? selectedPL.vendor : null;
      const vendorId = vendorObj
        ? String(vendorObj._id || vendorObj.id || '')
        : selectedPL.vendor
        ? String(selectedPL.vendor)
        : '';
      const vendorName =
        vendorPriceStrategy === 'average' && candidatePool.length > 1
          ? `Avg of ${candidatePool.length} Vendors`
          : vendorObj?.name || (vendorId ? 'Assigned Vendor' : 'Standard Base Price');
      const vendorCode = vendorObj?.code || vendorObj?.vendorCode || '';

      return {
        hasPrice: priceNum > 0,
        unitPrice: priceNum,
        currency: 'INR',
        originalUnitPrice: priceNum,
        originalCurrency: 'INR',
        exchangeRateToINR: 1,
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
        isExpiredPrice: isUsingExpired,
        alternatePricesCount: workingEntries.length,
        alternatePrices,
        matchedBy,
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
    matchedBy: 'none',
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
  vendorPriceStrategyOrRates?: VendorPriceStrategy | Record<string, number>
): EnrichedExplodedBOMNode[] {
  const vendorPriceStrategy: VendorPriceStrategy =
    typeof vendorPriceStrategyOrRates === 'string' ? vendorPriceStrategyOrRates : 'preferred_latest';

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
      vendorPriceStrategy
    );

    const hasChildNodes = Boolean(node.hasChildren || (Array.isArray(node.children) && node.children.length > 0));
    const { isCosted, exclusionReason } = evaluateCostingModeEligibility(
      node.itemType,
      [node.level],
      costingMode,
      hasChildNodes
    );

    const { useSecQty, unitMismatch, unitMismatchMessage } = evaluateUnitMatch(
      rawPriceInfo,
      node.unit,
      node.hasSecondaryUnit,
      node.secondaryUnit
    );

    const effectiveNodeQty = useSecQty
      ? (node.secondaryCumulativeQuantity !== undefined
          ? parseFloat(Number(node.secondaryCumulativeQuantity).toFixed(4))
          : parseFloat(((node.cumulativeQuantity || 0) * (node.conversionFactor || 1)).toFixed(4)))
      : parseFloat((node.cumulativeQuantity || 0).toFixed(4));

    const effectiveUnit = useSecQty ? (node.secondaryUnit || node.unit) : node.unit;
    const extendedCost = roundMoney((rawPriceInfo.unitPrice || 0) * effectiveNodeQty);

    const priceInfo: ItemPriceInfo = {
      ...rawPriceInfo,
      isCostedInActiveMode: isCosted,
      exclusionReason,
      underPricedSubAssembly: !isCosted,
      effectiveQty: effectiveNodeQty,
      effectiveUnit,
      unitMismatch,
      unitMismatchMessage,
      extendedCost,
      formulaText: buildFormulaText(rawPriceInfo.hasPrice, effectiveNodeQty, effectiveUnit, rawPriceInfo.unitPrice, extendedCost)
    };

    const enrichedChildren = enrichTreeWithPricing(
      node.children || [],
      vendorPriceLists,
      salesPriceLists,
      allFGItems,
      costingMode,
      vendorPriceStrategy
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
  vendorPriceStrategyOrRates?: VendorPriceStrategy | Record<string, number>
): EnrichedConsolidatedBOMItem[] {
  const vendorPriceStrategy: VendorPriceStrategy =
    typeof vendorPriceStrategyOrRates === 'string' ? vendorPriceStrategyOrRates : 'preferred_latest';

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
      vendorPriceStrategy
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

    const { useSecQty, unitMismatch, unitMismatchMessage } = evaluateUnitMatch(
      rawPriceInfo,
      item.unit,
      item.hasSecondaryUnit,
      item.secondaryUnit
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
    const effectiveUnit = useSecQty ? (item.secondaryUnit || item.unit) : item.unit;
    const extendedCost = roundMoney((rawPriceInfo.unitPrice || 0) * (effectiveQty || 0));

    const priceInfo: ItemPriceInfo = {
      ...rawPriceInfo,
      isCostedInActiveMode: isCosted,
      exclusionReason,
      underPricedSubAssembly: !isCosted,
      effectiveQty,
      effectiveUnit,
      unitMismatch,
      unitMismatchMessage,
      extendedCost,
      formulaText: buildFormulaText(rawPriceInfo.hasPrice, effectiveQty, effectiveUnit, rawPriceInfo.unitPrice, extendedCost)
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
  let unitMismatchCount = 0;
  let expiredPricesCount = 0;
  let multiVendorItemsCount = 0;

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
      if (item.priceInfo.unitMismatch) unitMismatchCount++;
      if (item.priceInfo.isExpiredPrice) expiredPricesCount++;
      if ((item.priceInfo.alternatePricesCount || 0) > 1) multiVendorItemsCount++;

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
      if (node.priceInfo.unitMismatch) unitMismatchCount++;
      if (node.priceInfo.isExpiredPrice) expiredPricesCount++;
      if ((node.priceInfo.alternatePricesCount || 0) > 1) multiVendorItemsCount++;

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
    totalEstimatedCost: roundMoney(totalEstimatedCost),
    totalPricedItems,
    totalMissingItems,
    totalItems,
    coveragePercentage,
    totalCumulativeQty: parseFloat(totalCumulativeQty.toFixed(4)),
    rmCost: roundMoney(rmCost),
    boCost: roundMoney(boCost),
    componentCost: roundMoney(componentCost),
    subAssemblyCost: roundMoney(subAssemblyCost),
    excludedChildPartsCount,
    unitMismatchCount,
    expiredPricesCount,
    multiVendorItemsCount
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
