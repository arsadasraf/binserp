/**
 * Multi-Level Engineering BOM Hierarchy Explosion Utility
 * 
 * Recursively resolves nested Sub-Assemblies, Assemblies, In-House Components,
 * Bought-Out (BO) items, and Raw Materials (RM) for a given Finished Good (FG).
 * Follows Binserp standards: Displays Item Name & Technical Descriptions, avoiding raw codes in primary labels.
 */

export interface ExplodedBOMNode {
  id: string;
  key: string;
  itemType: 'SubAssembly' | 'Assembly' | 'Component' | 'BO' | 'RM';
  categoryLabel: string;
  subCategory?: string;
  rawType: string;
  materialName: string;
  materialCode?: string;
  description?: string;
  level: number; // 2 for direct children of root FG, 3 for level-2 sub-components, etc.
  quantityPerParent: number;
  cumulativeQuantity: number;
  unit: string;
  hasSecondaryUnit?: boolean;
  secondaryUnit?: string;
  conversionFactor?: number;
  secondaryQuantityPerParent?: number;
  secondaryCumulativeQuantity?: number;
  parentName?: string;
  parentId?: string;
  children: ExplodedBOMNode[];
  hasChildren: boolean;
}

export type BOMFilterType = 'ALL' | 'RM' | 'BO' | 'COMPONENT' | 'SUBASSEMBLY';

export interface BOMUsageDetail {
  parentName: string;
  parentId?: string;
  level: number;
  quantityPerParent: number;
  cumulativeQuantity: number;
  unit: string;
  secondaryCumulativeQuantity?: number;
  secondaryUnit?: string;
}

export interface ConsolidatedBOMItem {
  id: string;
  materialName: string;
  materialCode?: string;
  description?: string;
  itemType: 'SubAssembly' | 'Assembly' | 'Component' | 'BO' | 'RM';
  categoryLabel: string;
  subCategory?: string;
  unit: string;
  hasSecondaryUnit?: boolean;
  secondaryUnit?: string;
  conversionFactor?: number;
  totalCumulativeQuantity: number;
  totalSecondaryCumulativeQuantity?: number;
  usages: BOMUsageDetail[];
}

export interface ExplodedBOMResult {
  rootItem: any;
  flatTree: ExplodedBOMNode[];
  nestedTree: ExplodedBOMNode[];
  summary: {
    totalLevels: number;
    subAssemblyCount: number;
    componentCount: number;
    rmCount: number;
    boCount: number;
    totalItemCount: number;
  };
}

/**
 * Recursively explodes the BOM tree of an FG Item.
 * 
 * @param rootFG - The root FG item document containing `bom: [...]`
 * @param allFGItems - Pool of all Finished Goods / Sub-Assemblies in master
 * @param allRMItems - Pool of Raw Materials in master
 * @param allBOItems - Pool of Bought Out items in master
 * @returns Exploded hierarchy in both flat (pre-order) and nested tree formats, plus metrics
 */
export function explodeFGBOMHierarchy(
  rootFG: any,
  allFGItems: any[] = [],
  allRMItems: any[] = [],
  allBOItems: any[] = []
): ExplodedBOMResult {
  if (!rootFG) {
    return {
      rootItem: null,
      flatTree: [],
      nestedTree: [],
      summary: {
        totalLevels: 1,
        subAssemblyCount: 0,
        componentCount: 0,
        rmCount: 0,
        boCount: 0,
        totalItemCount: 0
      }
    };
  }

  // Pre-index master collections for O(1) lookups by ID, Code/PartNumber, and Name
  const fgMapById = new Map<string, any>();
  const fgMapByCode = new Map<string, any>();
  const fgMapByName = new Map<string, any>();
  (allFGItems || []).forEach(fg => {
    if (fg._id) fgMapById.set(String(fg._id), fg);
    if (fg.id) fgMapById.set(String(fg.id), fg);
    if (fg.code) fgMapByCode.set(String(fg.code).toLowerCase().trim(), fg);
    if (fg.name) fgMapByName.set(String(fg.name).toLowerCase().trim(), fg);
  });

  const rmMapById = new Map<string, any>();
  const rmMapByCode = new Map<string, any>();
  const rmMapByName = new Map<string, any>();
  (allRMItems || []).forEach(rm => {
    if (rm._id) rmMapById.set(String(rm._id), rm);
    if (rm.id) rmMapById.set(String(rm.id), rm);
    if (rm.code) rmMapByCode.set(String(rm.code).toLowerCase().trim(), rm);
    if (rm.name) rmMapByName.set(String(rm.name).toLowerCase().trim(), rm);
  });

  const boMapById = new Map<string, any>();
  const boMapByCode = new Map<string, any>();
  const boMapByName = new Map<string, any>();
  (allBOItems || []).forEach(bo => {
    if (bo._id) boMapById.set(String(bo._id), bo);
    if (bo.id) boMapById.set(String(bo.id), bo);
    if (bo.code) boMapByCode.set(String(bo.code).toLowerCase().trim(), bo);
    if (bo.name) boMapByName.set(String(bo.name).toLowerCase().trim(), bo);
  });

  let maxLevel = 1;
  let subAssemblyCount = 0;
  let componentCount = 0;
  let rmCount = 0;
  let boCount = 0;

  const flatTree: ExplodedBOMNode[] = [];

  // Recursive traverser
  function traverseBOM(
    bomItems: any[],
    parentName: string,
    parentId: string,
    level: number,
    parentCumulativeQty: number,
    visitedPath: Set<string>
  ): ExplodedBOMNode[] {
    if (!Array.isArray(bomItems) || bomItems.length === 0) return [];
    if (level > maxLevel) maxLevel = level;

    const resultNodes: ExplodedBOMNode[] = [];

    bomItems.forEach((bItem, index) => {
      if (!bItem) return;

      const rawType = (bItem.itemType || '').toString().trim();
      const rawName = (bItem.itemName || (typeof bItem.item === 'object' ? bItem.item?.name : '') || '').trim();
      const rawCode = (bItem.materialCode || bItem.code || (typeof bItem.item === 'object' ? bItem.item?.code : '') || '').trim();
      const rawId = typeof bItem.item === 'object' && bItem.item !== null
        ? String(bItem.item._id || bItem.item.id || '')
        : String(bItem.item || '');

      const normRawType = rawType.toLowerCase();
      const isExplicitRM = normRawType === 'rawmaterial' || normRawType === 'material' || normRawType === 'rm';
      const isExplicitBO = normRawType === 'boughtout' || normRawType === 'bought_out' || normRawType === 'bo';
      const isExplicitFG = normRawType === 'fgitem' || normRawType === 'fg' || normRawType === 'component' || normRawType === 'subassembly' || normRawType === 'sub assembly' || normRawType === 'assembly';
      const isConsumable = normRawType.includes('consumable');

      const rawQtyVal = bItem.quantity !== undefined && bItem.quantity !== null && bItem.quantity !== ''
        ? Number(bItem.quantity)
        : 1;
      const perParentQty = isNaN(rawQtyVal) ? 1 : parseFloat(rawQtyVal.toFixed(4));
      const cumulativeQty = parseFloat((perParentQty * parentCumulativeQty).toFixed(4));

      // 1. Resolve matched master record strictly within declared category
      let matchedFG: any = null;
      let matchedRM: any = null;
      let matchedBO: any = null;

      if (isExplicitRM) {
        matchedRM = (rawId ? rmMapById.get(rawId) : null)
          || (rawCode ? rmMapByCode.get(rawCode.toLowerCase()) : null)
          || (rawName ? rmMapByName.get(rawName.toLowerCase()) : null);
      } else if (isExplicitBO || isConsumable) {
        matchedBO = (rawId ? boMapById.get(rawId) : null)
          || (rawCode ? boMapByCode.get(rawCode.toLowerCase()) : null)
          || (rawName ? boMapByName.get(rawName.toLowerCase()) : null);
      } else if (isExplicitFG) {
        matchedFG = (rawId ? fgMapById.get(rawId) : null)
          || (rawCode ? fgMapByCode.get(rawCode.toLowerCase()) : null)
          || (rawName ? fgMapByName.get(rawName.toLowerCase()) : null);
      } else {
        // Fallback when itemType is unspecified: match by ID first, then by code, then by name
        if (rawId) {
          matchedFG = fgMapById.get(rawId);
          matchedBO = boMapById.get(rawId);
          matchedRM = rmMapById.get(rawId);
        }
        if (!matchedFG && !matchedBO && !matchedRM && rawCode) {
          const lCode = rawCode.toLowerCase();
          matchedFG = fgMapByCode.get(lCode);
          matchedBO = boMapByCode.get(lCode);
          matchedRM = rmMapByCode.get(lCode);
        }
        if (!matchedFG && !matchedBO && !matchedRM && rawName) {
          const lName = rawName.toLowerCase();
          matchedFG = fgMapByName.get(lName);
          matchedBO = boMapByName.get(lName);
          matchedRM = rmMapByName.get(lName);
        }
      }

      // Determine classification strictly respecting user choice
      const isFGType = isExplicitFG || (!isExplicitRM && !isExplicitBO && !isConsumable && Boolean(matchedFG));
      const isBOType = isExplicitBO || (!isExplicitRM && !isFGType && !isConsumable && Boolean(matchedBO));

      let resolvedType: 'SubAssembly' | 'Assembly' | 'Component' | 'BO' | 'RM' = 'RM';
      let categoryLabel = 'Raw Material (RM)';

      const canonicalUnit = (isFGType ? matchedFG?.unit : (isBOType || isConsumable ? matchedBO?.unit : matchedRM?.unit))
        || bItem.unit
        || (isBOType || isFGType ? 'NOS' : 'KG');
      const unit = canonicalUnit;

      // Subcategory / Category resolution across matched master collection
      const matchedRecord = isFGType ? matchedFG : (isBOType || isConsumable ? matchedBO : matchedRM);
      const resolvedSubCategory = (
        matchedRecord?.categoryId?.name ||
        matchedRecord?.category?.name ||
        matchedRecord?.category ||
        (typeof bItem.item === 'object' && bItem.item !== null
          ? (bItem.item?.categoryId?.name || bItem.item?.category?.name || bItem.item?.category)
          : '') ||
        bItem.subCategory ||
        bItem.category ||
        ''
      ).toString().trim() || '-';

      if (isFGType) {
        // Priority order for classification:
        // 1. Explicit bItem.fgType or bItem.itemClassification
        // 2. Populated bItem.item.type
        // 3. Matched master record type (matchedFG.type)
        const rawExplicitType = (
          bItem.fgType ||
          bItem.itemClassification ||
          (typeof bItem.item === 'object' && bItem.item !== null ? bItem.item?.type : '') ||
          matchedFG?.type ||
          ''
        ).toString().trim();

        const normType = rawExplicitType.toLowerCase();
        const hasChildBOM = Array.isArray(matchedFG?.bom) && matchedFG.bom.length > 0;

        if (normType === 'component') {
          // Strictly Component - even if it has a child BOM for manufacturing raw materials
          resolvedType = 'Component';
          categoryLabel = 'In-House Component';
          componentCount++;
        } else if (normType === 'sub assembly' || normType === 'subassembly') {
          resolvedType = 'SubAssembly';
          categoryLabel = 'Sub-Assembly';
          subAssemblyCount++;
        } else if (normType === 'assembly') {
          resolvedType = 'Assembly';
          categoryLabel = 'Assembly';
          subAssemblyCount++;
        } else if (hasChildBOM) {
          // Unclassified fallback: if it has child BOM, assume Sub-Assembly
          resolvedType = 'SubAssembly';
          categoryLabel = 'Sub-Assembly';
          subAssemblyCount++;
        } else {
          // Unclassified fallback with no child BOM: assume Component
          resolvedType = 'Component';
          categoryLabel = 'In-House Component';
          componentCount++;
        }
      } else if (isBOType) {
        resolvedType = 'BO';
        categoryLabel = 'Bought Out (BO)';
        boCount++;
      } else if (isConsumable) {
        resolvedType = 'BO';
        categoryLabel = 'Consumable';
        boCount++;
      } else {
        resolvedType = 'RM';
        categoryLabel = 'Raw Material (RM)';
        rmCount++;
      }

      // Technical description resolution
      const technicalDescription = (
        bItem.itemDescription ||
        bItem.description ||
        matchedRecord?.description ||
        matchedRecord?.descriptions ||
        (typeof bItem.item === 'object' ? (bItem.item?.descriptions || bItem.item?.description) : '') ||
        ''
      ).toString().trim();

      // Dual unit resolution
      const hasSec = Boolean(
        bItem.hasSecondaryUnit ||
        matchedRecord?.hasSecondaryUnit ||
        (typeof bItem.item === 'object' && bItem.item?.hasSecondaryUnit)
      );
      const secUnit = (
        bItem.secondaryUnit ||
        matchedRecord?.secondaryUnit ||
        (typeof bItem.item === 'object' ? bItem.item?.secondaryUnit : '') ||
        ''
      ).toString().trim();

      const convFactor = Number(
        bItem.conversionFactor ??
        matchedRecord?.conversionFactor ??
        (typeof bItem.item === 'object' ? bItem.item?.conversionFactor : 1)
      ) || 1;

      const secPerParent = hasSec ? parseFloat((perParentQty * convFactor).toFixed(4)) : undefined;
      const secCumulative = hasSec ? parseFloat((cumulativeQty * convFactor).toFixed(4)) : undefined;

      const resolvedMasterId = String(
        (isFGType ? (matchedFG?._id || matchedFG?.id) : '') ||
        (isBOType || isConsumable ? (matchedBO?._id || matchedBO?.id) : '') ||
        (matchedRM?._id || matchedRM?.id) ||
        rawId ||
        ''
      );
      const effectiveId = resolvedMasterId || `item-${resolvedType}-${level}-${index}-${rawName}`;
      const uniqueKey = `${resolvedType}-${effectiveId}-${level}-${index}`;

      // Check for child BOM strictly in matched FG
      const childBOM = (isFGType && matchedFG && Array.isArray(matchedFG.bom)) ? matchedFG.bom : [];
      const hasChildren = childBOM.length > 0 && !visitedPath.has(effectiveId);

      const node: ExplodedBOMNode = {
        id: effectiveId,
        key: uniqueKey,
        itemType: resolvedType,
        categoryLabel,
        subCategory: resolvedSubCategory,
        rawType,
        materialName: rawName || 'Unnamed Material',
        materialCode: bItem.materialCode || bItem.code || matchedFG?.code || matchedRM?.code || matchedBO?.code || '',
        description: technicalDescription,
        level,
        quantityPerParent: perParentQty,
        cumulativeQuantity: cumulativeQty,
        unit,
        hasSecondaryUnit: hasSec,
        secondaryUnit: secUnit,
        conversionFactor: convFactor,
        secondaryQuantityPerParent: secPerParent,
        secondaryCumulativeQuantity: secCumulative,
        parentName,
        parentId,
        children: [],
        hasChildren
      };

      // Push into flat list (pre-order)
      flatTree.push(node);

      // Recurse into child BOM if sub-assembly / assembly with cycle guard
      if (hasChildren) {
        const nextVisited = new Set(visitedPath);
        nextVisited.add(effectiveId);

        node.children = traverseBOM(
          childBOM,
          node.materialName,
          node.id,
          level + 1,
          cumulativeQty,
          nextVisited
        );
      }

      resultNodes.push(node);
    });

    return resultNodes;
  }

  // Root starting traversal
  const rootId = String(rootFG._id || rootFG.id || 'root-fg');
  const initialVisited = new Set<string>([rootId]);
  const nestedTree = traverseBOM(
    rootFG.bom || [],
    rootFG.name || 'Finished Product',
    rootId,
    2, // Level 2 for direct BOM items (Level 1 is Root FG)
    1,
    initialVisited
  );

  return {
    rootItem: rootFG,
    flatTree,
    nestedTree,
    summary: {
      totalLevels: maxLevel,
      subAssemblyCount,
      componentCount,
      rmCount,
      boCount,
      totalItemCount: flatTree.length
    }
  };
}

/**
 * Checks whether an exploded node matches a selected BOM category filter.
 */
export function matchesBOMFilter(node: ExplodedBOMNode, filterType: BOMFilterType): boolean {
  if (!filterType || filterType === 'ALL') return true;
  if (filterType === 'RM') return node.itemType === 'RM';
  if (filterType === 'BO') return node.itemType === 'BO';
  if (filterType === 'COMPONENT') return node.itemType === 'Component';
  if (filterType === 'SUBASSEMBLY') return node.itemType === 'SubAssembly' || node.itemType === 'Assembly';
  return true;
}

/**
 * Aggregates all BOM occurrences into unique items with total cumulative quantity needed
 * per 1 unit of root FG, accompanied by a breakdown of parent assembly usages.
 */
export function consolidateBOMItems(
  nodes: ExplodedBOMNode[],
  filterType: BOMFilterType = 'ALL'
): ConsolidatedBOMItem[] {
  const map = new Map<string, ConsolidatedBOMItem>();

  (nodes || []).forEach((node) => {
    if (!matchesBOMFilter(node, filterType)) return;

    // Distinct compound key: separate by itemType so RM, BO, and FG with same part number/name are kept distinct
    const rawIdOrName = (node.id && node.id !== 'undefined' ? String(node.id) : '') || node.materialName.toLowerCase().trim();
    const key = `${node.itemType}:${rawIdOrName}`;
    if (!key) return;

    let existing = map.get(key);
    if (!existing) {
      existing = {
        id: node.id,
        materialName: node.materialName,
        materialCode: node.materialCode,
        description: node.description,
        itemType: node.itemType,
        categoryLabel: node.categoryLabel,
        subCategory: node.subCategory || '-',
        unit: node.unit,
        hasSecondaryUnit: node.hasSecondaryUnit,
        secondaryUnit: node.secondaryUnit,
        conversionFactor: node.conversionFactor,
        totalCumulativeQuantity: 0,
        totalSecondaryCumulativeQuantity: 0,
        usages: []
      };
      map.set(key, existing);
    }

    // Add cumulative quantities (preserve up to 4 decimal places for small engineering weights/lengths)
    existing.totalCumulativeQuantity = parseFloat(
      (existing.totalCumulativeQuantity + (Number(node.cumulativeQuantity) || 0)).toFixed(4)
    );

    if (node.hasSecondaryUnit && node.secondaryCumulativeQuantity !== undefined) {
      const conv = Number(node.conversionFactor) > 0 ? Number(node.conversionFactor) : 1;
      existing.totalSecondaryCumulativeQuantity = parseFloat(
        (existing.totalCumulativeQuantity * conv).toFixed(4)
      );
    }

    // Record usage
    existing.usages.push({
      parentName: node.parentName || 'Root Product',
      parentId: node.parentId,
      level: node.level,
      quantityPerParent: node.quantityPerParent,
      cumulativeQuantity: node.cumulativeQuantity,
      unit: node.unit,
      secondaryCumulativeQuantity: node.secondaryCumulativeQuantity,
      secondaryUnit: node.secondaryUnit
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const cmp = a.materialName.localeCompare(b.materialName);
    if (cmp !== 0) return cmp;
    return a.itemType.localeCompare(b.itemType);
  });
}

/**
 * Filters a recursive nested tree keeping matching nodes and any ancestors needed to display them.
 */
export function filterNestedBOMTree(
  nodes: ExplodedBOMNode[],
  filterType: BOMFilterType
): ExplodedBOMNode[] {
  if (!filterType || filterType === 'ALL') return nodes;

  const result: ExplodedBOMNode[] = [];

  (nodes || []).forEach((node) => {
    const isSelfMatch = matchesBOMFilter(node, filterType);
    const filteredChildren = filterNestedBOMTree(node.children || [], filterType);

    // Keep node if it matches directly OR if it contains matching descendants
    if (isSelfMatch || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren,
        hasChildren: filteredChildren.length > 0
      });
    }
  });

  return result;
}

