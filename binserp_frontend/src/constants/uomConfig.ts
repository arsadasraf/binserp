/**
 * Unified Unit of Measure (UOM) Configuration & Standards for Binserp
 * 
 * Standard Base Units:
 * - Raw Material (RM): "KG"
 * - Bought Out (BO): "PCS"
 * - Consumables: "NOS"
 * - Finished Goods (FG) / Sub-Assembly: "NOS"
 */

export interface UomOption {
  value: string;
  label: string;
  category?: 'Weight' | 'Count' | 'Length' | 'Volume' | 'Area' | 'Packaging' | 'Other';
  description?: string;
}

export const DEFAULT_BASE_UOMS = {
  RM: 'KG',
  BO: 'PCS',
  CONSUMABLE: 'NOS',
  FG: 'NOS',
  SUB_ASSEMBLY: 'NOS',
  INHOUSE: 'PCS'
} as const;

export const STANDARD_UOMS: UomOption[] = [
  // Primary Units of Measurement
  { value: 'KG', label: 'KG — Kilogram', category: 'Weight', description: 'Standard metric weight (1000g)' },
  { value: 'NOS', label: 'NOS — Numbers', category: 'Count', description: 'Discrete item count' },
  { value: 'PCS', label: 'PCS — Pieces', category: 'Count', description: 'Individual units / parts' },
  { value: 'Sheet', label: 'Sheet — Sheets / Plates', category: 'Count', description: 'Metal, plastic, or acrylic sheets' },
  { value: 'Meter', label: 'Meter — Linear Meters (Mtr)', category: 'Length', description: 'Linear length (pipes, rods, wiring)' },
  { value: 'Box', label: 'Box — Boxes / Cartons', category: 'Packaging', description: 'Packaged carton or box' },
  { value: 'Roll', label: 'Roll — Rolls / Coils', category: 'Packaging', description: 'Coils, tape rolls, wire rolls' },
  { value: 'Set', label: 'Set — Sets / Kits', category: 'Packaging', description: 'Paired set or kit' },
  { value: 'Pair', label: 'Pair — Pairs', category: 'Count', description: 'Two matched units' },
  { value: 'Ltr', label: 'Ltr — Liters', category: 'Volume', description: 'Liquid volume (oils, solvents)' },
  { value: 'Pkt', label: 'Pkt — Packets / Pack', category: 'Packaging', description: 'Small retail or hardware packet' },
  { value: 'Sq.Ft', label: 'Sq.Ft — Square Feet', category: 'Area', description: 'Area measurement' },
  { value: 'Sq.Mtr', label: 'Sq.Mtr — Square Meters', category: 'Area', description: 'Metric area measurement' },
  { value: 'Gram', label: 'Gram — Grams (gm)', category: 'Weight', description: 'Light weight metric unit' },
  { value: 'MM', label: 'MM — Millimeters', category: 'Length', description: 'Small precision length' },
  { value: 'Feet', label: 'Feet — Feet (ft)', category: 'Length', description: 'Imperial linear length' },
  { value: 'Ton', label: 'Ton — Metric Ton (MT)', category: 'Weight', description: 'Heavy bulk weight (1000 KG)' },
  { value: 'Bag', label: 'Bag — Bags / Sacks', category: 'Packaging', description: 'Bulk dry material bags' },
  { value: 'Can', label: 'Can — Cans / Drums', category: 'Packaging', description: 'Liquid containers / drums' },
  { value: 'Bottle', label: 'Bottle — Bottles', category: 'Packaging', description: 'Glass or plastic bottles' },
  { value: 'Dozen', label: 'Dozen — Dozens (12 Nos)', category: 'Count', description: '12-piece bundle' },
  { value: 'Length', label: 'Length — Lengths / Bars', category: 'Length', description: 'Standard raw bar/pipe length' }
];

/**
 * Returns default base UOM for a given master tab or item classification
 */
export function getDefaultBaseUom(itemClassificationOrTab: string): string {
  const norm = (itemClassificationOrTab || '').trim().toLowerCase();
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

/**
 * Filter standard units excluding a primary unit (for secondary unit dropdown)
 */
export function getSecondaryUomOptions(primaryUnit?: string): UomOption[] {
  const normPri = (primaryUnit || '').trim().toUpperCase();
  return STANDARD_UOMS.filter(u => u.value.toUpperCase() !== normPri);
}
