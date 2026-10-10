import { getItemDescription } from "./itemDisplayHelper";

export interface StockCheckResult {
  availableStock: number;
  requestedQuantity: number;
  unit: string;
  isSufficient: boolean;
  shortage: number;
  status: 'in-stock' | 'partial' | 'out-of-stock';
  name: string;
  description: string;
}

export interface RequestStockEvaluation {
  hasShortage: boolean;
  shortages: StockCheckResult[];
  itemsEvaluation: StockCheckResult[];
}

/**
 * Resolves the live warehouse stock for an item from storeData.
 * Follows lookup order: Inventory -> FG Items -> Consumables -> Raw Materials / Bought Outs.
 */
export function getItemLiveStock(item: any, storeData: any): number {
  if (!item || !storeData) return 0;

  const {
    inventoryList = [],
    rawMaterials = [],
    boughtOuts = [],
    materials = [],
    consumables = [],
    fgItems = []
  } = storeData;

  const rawId = item.material?._id || item.material || item.consumable?._id || item.consumable || item.component?._id || item.component || item.fgItem?._id || item.fgItem || item._id;
  const targetId = rawId ? String(rawId) : '';
  const targetCode = (item.materialCode || item.code || '').trim().toLowerCase();
  const targetName = (item.materialName || item.name || '').trim().toLowerCase();

  // 1. Authoritative Warehouse Stock in inventoryList
  if (Array.isArray(inventoryList) && inventoryList.length > 0) {
    const invMatch = inventoryList.find((inv: any) => {
      if (targetId && (String(inv.materialId) === targetId || String(inv._id) === targetId)) return true;
      if (targetCode && inv.materialCode && inv.materialCode.toLowerCase() === targetCode) return true;
      if (targetName && inv.materialName && inv.materialName.toLowerCase() === targetName) return true;
      return false;
    });
    if (invMatch && invMatch.currentStock !== undefined) {
      return Math.max(0, Number(invMatch.currentStock) || 0);
    }
  }

  // 2. FG Items & Components
  if (Array.isArray(fgItems) && fgItems.length > 0) {
    const fgMatch = fgItems.find((fg: any) => {
      if (targetId && String(fg._id) === targetId) return true;
      if (targetCode && fg.code && fg.code.toLowerCase() === targetCode) return true;
      if (targetName && fg.name && fg.name.toLowerCase() === targetName) return true;
      return false;
    });
    if (fgMatch && (fgMatch.quantity !== undefined || fgMatch.currentStock !== undefined)) {
      return Math.max(0, Number(fgMatch.quantity ?? fgMatch.currentStock) || 0);
    }
  }

  // 3. Consumables
  if (Array.isArray(consumables) && consumables.length > 0) {
    const consMatch = consumables.find((c: any) => {
      if (targetId && String(c._id) === targetId) return true;
      if (targetCode && c.code && c.code.toLowerCase() === targetCode) return true;
      if (targetName && c.name && c.name.toLowerCase() === targetName) return true;
      return false;
    });
    if (consMatch && (consMatch.quantity !== undefined || consMatch.currentStock !== undefined)) {
      return Math.max(0, Number(consMatch.quantity ?? consMatch.currentStock) || 0);
    }
  }

  // 4. Raw Materials & Bought Outs
  const masterList = [
    ...(Array.isArray(rawMaterials) ? rawMaterials : []),
    ...(Array.isArray(boughtOuts) ? boughtOuts : []),
    ...(Array.isArray(materials) ? materials : [])
  ];
  if (masterList.length > 0) {
    const masterMatch = masterList.find((m: any) => {
      if (targetId && String(m._id) === targetId) return true;
      if (targetCode && m.code && m.code.toLowerCase() === targetCode) return true;
      if (targetName && m.name && m.name.toLowerCase() === targetName) return true;
      return false;
    });
    if (masterMatch && (masterMatch.quantity !== undefined || masterMatch.currentStock !== undefined)) {
      return Math.max(0, Number(masterMatch.quantity ?? masterMatch.currentStock) || 0);
    }
  }

  return 0;
}

/**
 * Evaluates whether an individual item has sufficient stock to be issued.
 */
export function evaluateItemStock(item: any, storeData: any): StockCheckResult {
  const availableStock = getItemLiveStock(item, storeData);
  const requestedQuantity = Number(item.quantity) || 0;
  const unit = item.unit || 'PCS';
  const name = item.materialName || item.name || 'Unnamed Item';
  const description = getItemDescription(item);
  const isSufficient = availableStock >= requestedQuantity;
  const shortage = Math.max(0, requestedQuantity - availableStock);

  let status: 'in-stock' | 'partial' | 'out-of-stock' = 'in-stock';
  if (availableStock <= 0) {
    status = 'out-of-stock';
  } else if (availableStock < requestedQuantity) {
    status = 'partial';
  }

  return {
    availableStock,
    requestedQuantity,
    unit,
    isSufficient,
    shortage,
    status,
    name,
    description
  };
}

/**
 * Evaluates an entire Material Request to detect any shortages before issuing.
 */
export function evaluateRequestStock(request: any, storeData: any): RequestStockEvaluation {
  const items = Array.isArray(request?.items) ? request.items : [];
  const itemsEvaluation = items.map((item: any) => evaluateItemStock(item, storeData));
  const shortages = itemsEvaluation.filter((ev: StockCheckResult) => !ev.isSufficient);

  return {
    hasShortage: shortages.length > 0,
    shortages,
    itemsEvaluation
  };
}
