/**
 * Unified Unit of Measure (UOM) Configuration & Standards for Binserp Backend
 * 
 * Standard Base Units:
 * - Raw Material (RM): "KG"
 * - Bought Out (BO): "NOS"
 * - Consumables: "NOS"
 * - Finished Goods (FG) / Sub-Assembly: "NOS"
 */

export const DEFAULT_BASE_UOMS = {
  RM: 'KG',
  BO: 'NOS',
  CONSUMABLE: 'NOS',
  FG: 'NOS',
  SUB_ASSEMBLY: 'NOS',
  INHOUSE: 'NOS'
};

export const STANDARD_UOMS = [
  'KG', 'NOS', 'PCS', 'Sheet', 'Meter', 'Box', 'Roll', 'Set', 'Pair',
  'Ltr', 'Pkt', 'Sq.Ft', 'Sq.Mtr', 'Gram', 'MM', 'Feet', 'Ton',
  'Bag', 'Can', 'Bottle', 'Dozen', 'Length'
];

/**
 * Returns default base UOM for a given item classification or tab
 */
export function getDefaultBaseUom(itemClassificationOrTab) {
  const norm = String(itemClassificationOrTab || '').trim().toLowerCase();
  if (norm === 'raw-material' || norm === 'rm' || norm === 'raw material') {
    return DEFAULT_BASE_UOMS.RM;
  }
  if (norm === 'bought-out' || norm === 'bo' || norm === 'bought out') {
    return DEFAULT_BASE_UOMS.BO;
  }
  if (norm === 'consumable-item' || norm === 'consumable' || norm === 'consumables') {
    return DEFAULT_BASE_UOMS.CONSUMABLE;
  }
  if (norm === 'fg-items' || norm === 'fg' || norm === 'finished goods' || norm === 'assembly' || norm === 'sub assembly') {
    return DEFAULT_BASE_UOMS.FG;
  }
  if (norm === 'inhouse-items' || norm === 'inhouse' || norm === 'component') {
    return DEFAULT_BASE_UOMS.INHOUSE;
  }
  return 'NOS';
}
