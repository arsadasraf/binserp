import { ExplodedBOMNode, ConsolidatedBOMItem, BOMFilterType } from './bomHierarchyHelper';

export interface ItemPriceInfo {
  hasPrice: boolean;
  unitPrice: number;
  currency: string;
  vendorName?: string;
  vendorCode?: string;
  isPreferredVendor?: boolean;
  priceSource: 'vendor-price-list' | 'sales-price-list' | 'fg-master' | 'none';
  priceListId?: string;
  pricingUnit?: string;
  isSecondaryUnit?: boolean;
  remarks?: string;
  extendedCost: number; // cumulativeQuantity * unitPrice
  isSubAssemblyPriced?: boolean;
  underPricedSubAssembly?: boolean; // True if child item belongs to an ancestor sub-assembly that has its own price
}

export type PriceFilterMode = 'ALL' | 'PRICED_ONLY' | 'MISSING_ONLY';

export interface CostingDashboardSummary {
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
  allFGItems: any[] = []
): ItemPriceInfo {
  const isFGOrAssembly = item.itemType === 'SubAssembly' || item.itemType === 'Assembly' || item.itemType === 'Component';
  const rawId = (item.id || '').toString().trim();
  const rawName = (item.materialName || '').toLowerCase().trim();

  // 1. If Sub-Assembly, Assembly, or Component: Check Sales Price List and FG Item Master
  if (isFGOrAssembly) {
    // Check sales price lists
    let matchedSalesPL: any = null;
    if (Array.isArray(salesPriceLists)) {
      matchedSalesPL = salesPriceLists.find((pl: any) => {
        const plFgId = (pl.fgItem?._id || pl.fgItem?.id || pl.fgItem)?.toString();
        if (rawId && plFgId && rawId === plFgId) return true;
        const plFgName = (pl.fgItem?.name || '').toLowerCase().trim();
        return rawName && plFgName && rawName === plFgName;
      });
    }

    if (matchedSalesPL && matchedSalesPL.price !== undefined && matchedSalesPL.price !== null && Number(matchedSalesPL.price) > 0) {
      const priceNum = Number(matchedSalesPL.price);
      return {
        hasPrice: true,
        unitPrice: priceNum,
        currency: matchedSalesPL.currency || 'INR',
        vendorName: 'Sales Catalog',
        priceSource: 'sales-price-list',
        priceListId: matchedSalesPL._id,
        pricingUnit: matchedSalesPL.pricingUnit || item.unit,
        isSecondaryUnit: Boolean(matchedSalesPL.isSecondaryUnit),
        remarks: matchedSalesPL.remarks || '',
        extendedCost: 0,
        isSubAssemblyPriced: true,
        underPricedSubAssembly: false
      };
    }

    // Check matched FG master sellingPrice
    if (Array.isArray(allFGItems)) {
      const matchedFG = allFGItems.find((fg: any) => {
        const fgId = (fg._id || fg.id)?.toString();
        if (rawId && fgId && rawId === fgId) return true;
        const fgName = (fg.name || '').toLowerCase().trim();
        return rawName && fgName && rawName === fgName;
      });

      if (matchedFG && matchedFG.sellingPrice && Number(matchedFG.sellingPrice) > 0) {
        const priceNum = Number(matchedFG.sellingPrice);
        return {
          hasPrice: true,
          unitPrice: priceNum,
          currency: matchedFG.currency || 'INR',
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
      const plMatName = (pl.material?.name || '').toLowerCase().trim();
      if (rawName && plMatName && rawName === plMatName) {
        matchingEntries.push(pl);
      }
    });

    if (matchingEntries.length > 0) {
      // Prioritize Preferred Vendor first, otherwise choose valid price
      const preferred = matchingEntries.find((pl) => Boolean(pl.isPreferred));
      const selectedPL = preferred || matchingEntries[0];

      const priceNum = Number(selectedPL.price) || 0;
      const vendorObj = typeof selectedPL.vendor === 'object' ? selectedPL.vendor : null;
      const vendorName = vendorObj?.name || 'Assigned Vendor';
      const vendorCode = vendorObj?.code || '';

      return {
        hasPrice: priceNum > 0,
        unitPrice: priceNum,
        currency: 'INR',
        vendorName,
        vendorCode,
        isPreferredVendor: Boolean(selectedPL.isPreferred),
        priceSource: 'vendor-price-list',
        priceListId: selectedPL._id,
        pricingUnit: selectedPL.pricingUnit || item.unit,
        isSecondaryUnit: Boolean(selectedPL.isSecondaryUnit),
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
 * Enriches the recursive BOM tree with pricing info and flags descendant parts of priced sub-assemblies
 * so their child RM/BO parts are not double counted in overall BOM costing.
 */
export function enrichTreeWithPricing(
  nodes: ExplodedBOMNode[],
  vendorPriceLists: any[] = [],
  salesPriceLists: any[] = [],
  allFGItems: any[] = [],
  ancestorPriced: boolean = false
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
      allFGItems
    );

    const isSubAssembly = node.itemType === 'SubAssembly' || node.itemType === 'Assembly';
    const isPricedSubAssembly = isSubAssembly && rawPriceInfo.hasPrice;

    const priceInfo: ItemPriceInfo = {
      ...rawPriceInfo,
      underPricedSubAssembly: ancestorPriced,
      extendedCost: Number(((rawPriceInfo.unitPrice || 0) * (node.cumulativeQuantity || 0)).toFixed(2))
    };

    // Propagate ancestor pricing to descendants
    const childAncestorPriced = ancestorPriced || isPricedSubAssembly;
    const enrichedChildren = enrichTreeWithPricing(
      node.children || [],
      vendorPriceLists,
      salesPriceLists,
      allFGItems,
      childAncestorPriced
    );

    return {
      ...node,
      priceInfo,
      children: enrichedChildren
    };
  });
}

/**
 * Enriches consolidated BOM items with pricing information.
 */
export function enrichConsolidatedItemsWithPricing(
  items: ConsolidatedBOMItem[],
  vendorPriceLists: any[] = [],
  salesPriceLists: any[] = [],
  allFGItems: any[] = []
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
      allFGItems
    );

    const priceInfo: ItemPriceInfo = {
      ...rawPriceInfo,
      extendedCost: Number(((rawPriceInfo.unitPrice || 0) * (item.totalCumulativeQuantity || 0)).toFixed(2))
    };

    return {
      ...item,
      priceInfo
    };
  });
}

/**
 * Calculates executive costing dashboard metrics from enriched BOM tree and consolidated items.
 * Adheres strictly to User Rule 1:
 * "for sub assembly inhouse child rm and bo required, and for subassembly price is assigned in sales price list,
 *  then do not count there from child parts"
 */
export function calculateBOMCostingSummary(
  enrichedFlatTree: EnrichedExplodedBOMNode[],
  enrichedConsolidated: EnrichedConsolidatedBOMItem[]
): CostingDashboardSummary {
  let totalEstimatedCost = 0;
  let rmCost = 0;
  let boCost = 0;
  let componentCost = 0;
  let subAssemblyCost = 0;
  let excludedChildPartsCount = 0;

  // We compute total cost from the hierarchical tree so we respect the parent sub-assembly pricing rule
  (enrichedFlatTree || []).forEach((node) => {
    const price = node.priceInfo.unitPrice || 0;
    const extended = node.priceInfo.extendedCost || 0;

    if (node.priceInfo.underPricedSubAssembly) {
      // Child part under an already-priced subassembly: do not count in total cost
      excludedChildPartsCount++;
      return;
    }

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

  // Calculate item coverage counts from unique consolidated items
  const totalItems = enrichedConsolidated.length;
  let totalPricedItems = 0;
  let totalCumulativeQty = 0;

  enrichedConsolidated.forEach((item) => {
    totalCumulativeQty += Number(item.totalCumulativeQuantity) || 0;
    if (item.priceInfo.hasPrice) {
      totalPricedItems++;
    }
  });

  const totalMissingItems = Math.max(0, totalItems - totalPricedItems);
  const coveragePercentage = totalItems > 0 ? Math.round((totalPricedItems / totalItems) * 100) : 0;

  return {
    totalEstimatedCost: Number(totalEstimatedCost.toFixed(2)),
    totalPricedItems,
    totalMissingItems,
    totalItems,
    coveragePercentage,
    totalCumulativeQty: Number(totalCumulativeQty.toFixed(2)),
    rmCost: Number(rmCost.toFixed(2)),
    boCost: Number(boCost.toFixed(2)),
    componentCost: Number(componentCost.toFixed(2)),
    subAssemblyCost: Number(subAssemblyCost.toFixed(2)),
    excludedChildPartsCount
  };
}

/**
 * Filters enriched tree nodes by active BOM category filter and price status filter.
 */
export function filterEnrichedTree(
  nodes: EnrichedExplodedBOMNode[],
  priceFilter: PriceFilterMode
): EnrichedExplodedBOMNode[] {
  if (priceFilter === 'ALL') return nodes;

  const result: EnrichedExplodedBOMNode[] = [];

  nodes.forEach((node) => {
    const matchesPrice = priceFilter === 'PRICED_ONLY' 
      ? node.priceInfo.hasPrice 
      : !node.priceInfo.hasPrice;

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
    return items.filter((item) => item.priceInfo.hasPrice);
  }
  return items.filter((item) => !item.priceInfo.hasPrice);
}
