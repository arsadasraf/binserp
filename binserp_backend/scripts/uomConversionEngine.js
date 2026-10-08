/**
 * Production UOM & Price Reciprocal Conversion Engine
 * 
 * Invariants:
 * 1. 1 [Base Unit] = CF [Secondary Unit]
 * 2. Secondary Qty = Base Qty * CF
 * 3. Base Qty = Secondary Qty / CF (if CF > 0)
 * 4. Base Price = Secondary Price * CF
 * 5. Secondary Price = Base Price / CF (if CF > 0)
 * 6. Total Valuation Invariant: Base Qty * Base Price === Secondary Qty * Secondary Price
 */

export const CANONICAL_BASE_UOMS = {
  RM: 'KG',
  BO: 'NOS',
  CONSUMABLE: 'NOS',
  FG: 'NOS',
  INHOUSE: 'NOS'
};

// Aliases that represent 1:1 identical units (CF = 1, Price unchanged)
export const ALIAS_MAP = {
  // Count -> NOS
  'PCS': 'NOS',
  'PC': 'NOS',
  'PIECE': 'NOS',
  'PIECES': 'NOS',
  'NO': 'NOS',
  'NOS': 'NOS',
  'NUMBER': 'NOS',
  'NUMBERS': 'NOS',
  'EA': 'NOS',
  'EACH': 'NOS',
  'UNIT': 'NOS',
  'UNITS': 'NOS',
  
  // Weight -> KG
  'KG': 'KG',
  'KGS': 'KG',
  'KILOGRAM': 'KG',
  'KILOGRAMS': 'KG',
  
  // Volume -> LTR
  'LTR': 'LTR',
  'LITRE': 'LTR',
  'LITRES': 'LTR',
  'L': 'LTR',

  // Length -> METER
  'MTR': 'METER',
  'METER': 'METER',
  'METERS': 'METER',
  'METRE': 'METER'
};

// Known Standard Metric Conversions
// targetBase: the canonical base UOM
// cf: How many secondary units in 1 Base Unit (1 Base = CF Sec)
export const METRIC_FACTORS = {
  // Base KG
  'GM': { targetBase: 'KG', cf: 1000, secUnit: 'GM' },
  'GRAM': { targetBase: 'KG', cf: 1000, secUnit: 'GM' },
  'GRAMS': { targetBase: 'KG', cf: 1000, secUnit: 'GM' },
  'TON': { targetBase: 'KG', cf: 0.001, secUnit: 'TON' },
  'TONS': { targetBase: 'KG', cf: 0.001, secUnit: 'TON' },
  'MT': { targetBase: 'KG', cf: 0.001, secUnit: 'TON' },
  
  // Base METER
  'MM': { targetBase: 'METER', cf: 1000, secUnit: 'MM' },
  'CM': { targetBase: 'METER', cf: 100, secUnit: 'CM' }
};

/**
 * Determine the canonical base unit for a given item classification
 */
export function getCanonicalBaseUnit(itemClassificationOrType) {
  const norm = String(itemClassificationOrType || '').trim().toLowerCase();
  if (norm.includes('raw') || norm.includes('rm')) return CANONICAL_BASE_UOMS.RM;
  if (norm.includes('bought') || norm.includes('bo')) return CANONICAL_BASE_UOMS.BO;
  if (norm.includes('consumable')) return CANONICAL_BASE_UOMS.CONSUMABLE;
  if (norm.includes('fg') || norm.includes('finish') || norm.includes('assembly')) return CANONICAL_BASE_UOMS.FG;
  return CANONICAL_BASE_UOMS.BO; // default to NOS
}

/**
 * Converts an existing item record to the standard dual-unit system
 * 
 * @param {Object} item - Current item document (master or inventory)
 * @param {string} classification - 'RM', 'BO', 'Consumable', 'FG'
 * @param {Object} [overrideConfig] - Optional explicit CF or secondary unit override
 * @returns {Object} Calculated conversion parameters
 */
export function convertItemUom(item, classification, overrideConfig = {}) {
  const rawUnit = String(item.unit || '').trim();
  const upperUnit = rawUnit.toUpperCase();
  const currentStock = Number(item.currentStock || item.stock || 0);
  const currentPrice = Number(item.unitPrice || item.price || item.rate || item.baseRate || item.costPrice || item.sellingPrice || 0);
  const targetBaseUom = getCanonicalBaseUnit(classification);

  // If explicit override is provided in config
  if (overrideConfig && overrideConfig.targetBaseUom) {
    const cf = Number(overrideConfig.conversionFactor) || 1;
    const secUnit = overrideConfig.secondaryUnit || rawUnit;
    const hasSec = Boolean(overrideConfig.hasSecondaryUnit ?? (secUnit && secUnit !== overrideConfig.targetBaseUom));
    
    // If old stock was recorded in old unit:
    let newBaseStock = currentStock;
    let newBasePrice = currentPrice;
    if (hasSec && cf > 0) {
      if (overrideConfig.oldStockWasSecondary) {
        newBaseStock = currentStock / cf;
        newBasePrice = currentPrice * cf;
      }
    }
    const newSecStock = hasSec && cf > 0 ? (newBaseStock * cf) : 0;
    const newSecPrice = hasSec && cf > 0 ? (newBasePrice / cf) : 0;

    return {
      baseUnit: overrideConfig.targetBaseUom,
      hasSecondaryUnit: hasSec,
      secondaryUnit: hasSec ? secUnit : '',
      conversionFactor: hasSec ? cf : 1,
      newBaseStock,
      newSecondaryStock: newSecStock,
      newBasePrice,
      newSecondaryPrice: newSecPrice,
      strategy: 'EXPLICIT_OVERRIDE'
    };
  }

  // 1. If unit is already equivalent to target base unit (e.g. PCS -> NOS, KG -> KG)
  const canonicalAlias = ALIAS_MAP[upperUnit] || upperUnit;
  if (canonicalAlias === targetBaseUom) {
    const hasExistingSec = Boolean(item.hasSecondaryUnit && item.secondaryUnit && Number(item.conversionFactor) > 0);
    const cf = hasExistingSec ? Number(item.conversionFactor) : 1;
    const secUnit = hasExistingSec ? String(item.secondaryUnit).trim() : '';
    const newSecStock = hasExistingSec ? (currentStock * cf) : 0;
    const newSecPrice = hasExistingSec && cf > 0 ? (currentPrice / cf) : 0;

    return {
      baseUnit: targetBaseUom,
      hasSecondaryUnit: hasExistingSec,
      secondaryUnit: secUnit,
      conversionFactor: cf,
      newBaseStock: currentStock,
      newSecondaryStock: newSecStock,
      newBasePrice: currentPrice,
      newSecondaryPrice: newSecPrice,
      strategy: 'ALIAS_NORMALIZATION'
    };
  }

  // 2. Metric conversions (e.g. GM -> KG, TON -> KG)
  if (METRIC_FACTORS[upperUnit] && METRIC_FACTORS[upperUnit].targetBase === targetBaseUom) {
    const metric = METRIC_FACTORS[upperUnit];
    const cf = metric.cf; // 1 Base = cf Sec (e.g. 1 KG = 1000 GM)
    const newBaseStock = currentStock / cf; // e.g. 5000 GM / 1000 = 5 KG
    const newBasePrice = currentPrice * cf; // e.g. ₹0.5/GM * 1000 = ₹500/KG
    const newSecStock = currentStock;
    const newSecPrice = currentPrice;

    return {
      baseUnit: targetBaseUom,
      hasSecondaryUnit: true,
      secondaryUnit: metric.secUnit,
      conversionFactor: cf,
      newBaseStock,
      newSecondaryStock: newSecStock,
      newBasePrice,
      newSecondaryPrice: newSecPrice,
      strategy: 'METRIC_CONVERSION'
    };
  }

  // 3. Item already has an explicit secondary unit and conversion factor recorded
  if (item.hasSecondaryUnit && Number(item.conversionFactor) > 0) {
    const cf = Number(item.conversionFactor);
    const secUnit = String(item.secondaryUnit || '').trim();
    // Keep stock and price as base, maintain secondary
    const newSecStock = currentStock * cf;
    const newSecPrice = cf > 0 ? (currentPrice / cf) : 0;

    return {
      baseUnit: targetBaseUom,
      hasSecondaryUnit: true,
      secondaryUnit: secUnit,
      conversionFactor: cf,
      newBaseStock: currentStock,
      newSecondaryStock: newSecStock,
      newBasePrice: currentPrice,
      newSecondaryPrice: newSecPrice,
      strategy: 'PRESERVE_EXISTING_DUAL_UNIT'
    };
  }

  // 4. Packaging / Sheet / Custom unit without prior CF (e.g. RM with unit 'Nos' or BO with unit 'drum')
  // We make the old unit the Secondary Unit, and default CF = 1 so stock and price remain safe and identical
  // until user refines exact sheet/pack dimensions in master form.
  const oldUnitAsSecondary = rawUnit || targetBaseUom;
  const isDifferentFromBase = oldUnitAsSecondary.toUpperCase() !== targetBaseUom;

  return {
    baseUnit: targetBaseUom,
    hasSecondaryUnit: isDifferentFromBase,
    secondaryUnit: isDifferentFromBase ? oldUnitAsSecondary : '',
    conversionFactor: 1,
    newBaseStock: currentStock,
    newSecondaryStock: currentStock,
    newBasePrice: currentPrice,
    newSecondaryPrice: currentPrice,
    strategy: 'FALLBACK_PRESERVE_VALUE'
  };
}
