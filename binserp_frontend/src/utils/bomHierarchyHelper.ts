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

  // Pre-index master collections for O(1) lookups
  const fgMapById = new Map<string, any>();
  const fgMapByName = new Map<string, any>();
  (allFGItems || []).forEach(fg => {
    if (fg._id) fgMapById.set(String(fg._id), fg);
    if (fg.id) fgMapById.set(String(fg.id), fg);
    if (fg.name) fgMapByName.set(fg.name.toLowerCase().trim(), fg);
  });

  const rmMapById = new Map<string, any>();
  const rmMapByName = new Map<string, any>();
  (allRMItems || []).forEach(rm => {
    if (rm._id) rmMapById.set(String(rm._id), rm);
    if (rm.id) rmMapById.set(String(rm.id), rm);
    if (rm.name) rmMapByName.set(rm.name.toLowerCase().trim(), rm);
  });

  const boMapById = new Map<string, any>();
  const boMapByName = new Map<string, any>();
  (allBOItems || []).forEach(bo => {
    if (bo._id) boMapById.set(String(bo._id), bo);
    if (bo.id) boMapById.set(String(bo.id), bo);
    if (bo.name) boMapByName.set(bo.name.toLowerCase().trim(), bo);
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

      const rawType = (bItem.itemType || '').toString();
      const rawName = (bItem.itemName || (typeof bItem.item === 'object' ? bItem.item?.name : '') || '').trim();
      const rawId = typeof bItem.item === 'object' && bItem.item !== null
        ? String(bItem.item._id || bItem.item.id || '')
        : String(bItem.item || '');

      const perParentQty = Number(bItem.quantity) || 1;
      const cumulativeQty = Number((perParentQty * parentCumulativeQty).toFixed(4));
      // 1. Resolve matched master record
      let matchedFG = (rawId ? fgMapById.get(rawId) : null) || (rawName ? fgMapByName.get(rawName.toLowerCase()) : null);
      let matchedRM = (rawId ? rmMapById.get(rawId) : null) || (rawName ? rmMapByName.get(rawName.toLowerCase()) : null);
      let matchedBO = (rawId ? boMapById.get(rawId) : null) || (rawName ? boMapByName.get(rawName.toLowerCase()) : null);

      // Determine classification
      const isFGType = rawType === 'FGItem' || rawType.toLowerCase().includes('fg') || Boolean(matchedFG);
      const isBOType = !isFGType && (rawType === 'BoughtOut' || rawType.toLowerCase().includes('bought') || rawType === 'BO' || Boolean(matchedBO));
      const isConsumable = rawType.toLowerCase().includes('consumable');

      let resolvedType: 'SubAssembly' | 'Assembly' | 'Component' | 'BO' | 'RM' = 'RM';
      let categoryLabel = 'Raw Material';

      const canonicalUnit = matchedRM?.unit || matchedBO?.unit || (isBOType || isFGType ? 'NOS' : 'KG');
      const unit = canonicalUnit;

      if (isFGType) {
        const fgClassification = bItem.fgType || bItem.itemClassification || matchedFG?.type || 'Component';
        const hasChildBOM = Array.isArray(matchedFG?.bom) && matchedFG.bom.length > 0;

        if (fgClassification === 'Sub Assembly' || hasChildBOM || rawName.toLowerCase().includes('sub')) {
          resolvedType = 'SubAssembly';
          categoryLabel = 'Sub-Assembly';
          subAssemblyCount++;
        } else if (fgClassification === 'Assembly') {
          resolvedType = 'Assembly';
          categoryLabel = 'Assembly';
          subAssemblyCount++;
        } else {
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
        matchedFG?.description ||
        matchedFG?.descriptions ||
        matchedRM?.descriptions ||
        matchedRM?.description ||
        matchedBO?.descriptions ||
        matchedBO?.description ||
        (typeof bItem.item === 'object' ? (bItem.item?.descriptions || bItem.item?.description) : '') ||
        ''
      ).toString().trim();

      // Dual unit resolution
      const hasSec = Boolean(
        bItem.hasSecondaryUnit ||
        matchedFG?.hasSecondaryUnit ||
        matchedRM?.hasSecondaryUnit ||
        matchedBO?.hasSecondaryUnit ||
        (typeof bItem.item === 'object' && bItem.item?.hasSecondaryUnit)
      );
      const secUnit = (
        bItem.secondaryUnit ||
        matchedFG?.secondaryUnit ||
        matchedRM?.secondaryUnit ||
        matchedBO?.secondaryUnit ||
        (typeof bItem.item === 'object' ? bItem.item?.secondaryUnit : '') ||
        ''
      ).toString().trim();

      const convFactor = Number(
        bItem.conversionFactor ??
        matchedFG?.conversionFactor ??
        matchedRM?.conversionFactor ??
        matchedBO?.conversionFactor ??
        (typeof bItem.item === 'object' ? bItem.item?.conversionFactor : 1)
      ) || 1;

      const secPerParent = hasSec ? Number((perParentQty * convFactor).toFixed(4)) : undefined;
      const secCumulative = hasSec ? Number((cumulativeQty * convFactor).toFixed(4)) : undefined;

      const effectiveId = rawId || `item-${level}-${index}-${rawName}`;
      const uniqueKey = `${effectiveId}-${level}-${index}`;

      // Check for child BOM in matched FG
      const childBOM = (matchedFG && Array.isArray(matchedFG.bom)) ? matchedFG.bom : [];
      const hasChildren = childBOM.length > 0 && !visitedPath.has(effectiveId);

      const node: ExplodedBOMNode = {
        id: effectiveId,
        key: uniqueKey,
        itemType: resolvedType,
        categoryLabel,
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

    // Key by ID or normalized name
    const key = (node.id && node.id !== 'undefined' ? String(node.id) : '') || node.materialName.toLowerCase().trim();
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

    // Add cumulative quantities
    existing.totalCumulativeQuantity = Number(
      (existing.totalCumulativeQuantity + (Number(node.cumulativeQuantity) || 0)).toFixed(4)
    );

    if (node.hasSecondaryUnit && node.secondaryCumulativeQuantity !== undefined) {
      existing.totalSecondaryCumulativeQuantity = Number(
        (((existing.totalSecondaryCumulativeQuantity || 0) + (Number(node.secondaryCumulativeQuantity) || 0))).toFixed(4)
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

  return Array.from(map.values()).sort((a, b) => a.materialName.localeCompare(b.materialName));
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

