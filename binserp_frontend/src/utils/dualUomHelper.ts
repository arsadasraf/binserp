/**
 * Dual Unit of Measurement (Dual UOM) Mathematical Engine
 *
 * Core Principle (Identical to Currency Conversion):
 * - Base UOM: The primary inventory / stocking unit (e.g., 'Sheet', 'Box', 'Meter', 'Nos')
 * - Secondary UOM: The alternate / physical / trade unit (e.g., 'KG', 'Nos', 'Sq.Ft')
 * - Conversion Factor (CF): 1 Base Unit = CF * Secondary Units
 *
 * Quantities:
 *   Secondary Quantity = Base Quantity * Conversion Factor
 *   Base Quantity = Secondary Quantity / Conversion Factor
 *
 * Rates (Price per Unit):
 *   Base Rate (Price per Base Unit) = Secondary Rate * Conversion Factor
 *   Secondary Rate (Price per Secondary Unit) = Base Rate / Conversion Factor
 *
 * Invariant Rule:
 *   Line Amount = Base Quantity * Base Rate === Secondary Quantity * Secondary Rate
 */

export interface DualUomCalculationInput {
  quantity: number;
  unit?: string;
  hasSecondaryUnit?: boolean;
  secondaryUnit?: string;
  conversionFactor?: number;
  secondaryQuantity?: number;
  rateUnit?: 'primary' | 'secondary';
  rate: number;
  primaryRate?: number;
  secondaryRate?: number;
}

export interface DualUomCalculationResult {
  quantity: number;
  secondaryQuantity?: number;
  rateUnit: 'primary' | 'secondary';
  selectedUnit: string;
  rate: number;
  primaryRate: number;
  secondaryRate: number;
  amount: number;
}

/**
 * Bidirectional Quantity Synchronization
 */
export function syncQuantities(
  changedField: 'quantity' | 'secondaryQuantity',
  value: number,
  conversionFactor: number = 1
): { quantity: number; secondaryQuantity: number } {
  const factor = Number(conversionFactor) > 0 ? Number(conversionFactor) : 1;
  const numVal = Math.max(0, Number(value) || 0);

  if (changedField === 'quantity') {
    return {
      quantity: numVal,
      secondaryQuantity: parseFloat((numVal * factor).toFixed(3)),
    };
  } else {
    return {
      quantity: parseFloat((numVal / factor).toFixed(3)),
      secondaryQuantity: numVal,
    };
  }
}

/**
 * Handle Switching Rate Unit ('primary' <-> 'secondary')
 * Preserves equivalent pricing without abrupt line amount changes
 */
export function switchRateUnit(
  targetUnit: 'primary' | 'secondary',
  currentRate: number,
  primaryRate: number | undefined,
  secondaryRate: number | undefined,
  conversionFactor: number = 1
): number {
  const factor = Number(conversionFactor) > 0 ? Number(conversionFactor) : 1;
  const rate = Math.max(0, Number(currentRate) || 0);

  if (targetUnit === 'secondary') {
    // Switching from primary (₹/Sheet) to secondary (₹/KG)
    // If 1 Sheet = 25 KG and 1 Sheet costs ₹2500, then 1 KG costs ₹2500 / 25 = ₹100
    if (secondaryRate && secondaryRate > 0) return secondaryRate;
    return parseFloat((rate / factor).toFixed(2));
  } else {
    // Switching from secondary (₹/KG) to primary (₹/Sheet)
    // If 1 KG costs ₹100 and 1 Sheet = 25 KG, then 1 Sheet costs ₹100 * 25 = ₹2500
    if (primaryRate && primaryRate > 0) return primaryRate;
    return parseFloat((rate * factor).toFixed(2));
  }
}

/**
 * Calculate complete pricing and amounts for a dual UOM line item
 */
export function computeDualUomLinePricing(input: DualUomCalculationInput): DualUomCalculationResult {
  const hasSec = Boolean(input.hasSecondaryUnit && input.secondaryUnit);
  const factor = (hasSec && Number(input.conversionFactor) > 0) ? Number(input.conversionFactor) : 1;
  const isSec = Boolean(hasSec && input.rateUnit === 'secondary');
  const baseUnit = input.unit || 'PCS';
  const secUnit = input.secondaryUnit || '';

  const enteredRate = Math.max(0, Number(input.rate) || 0);
  const baseQty = Math.max(0, Number(input.quantity) || 0);
  
  // Secondary quantity resolution:
  const secQty = hasSec
    ? (input.secondaryQuantity !== undefined && !isNaN(Number(input.secondaryQuantity)) && Number(input.secondaryQuantity) > 0
        ? Number(input.secondaryQuantity)
        : parseFloat((baseQty * factor).toFixed(3)))
    : undefined;

  let primaryRate = 0;
  let secondaryRate = 0;
  let lineAmount = 0;

  if (isSec) {
    // Supplier rates quoted in Secondary Unit (e.g. ₹/KG)
    secondaryRate = enteredRate;
    primaryRate = parseFloat((enteredRate * factor).toFixed(3)); // 1 Sheet = 25 * ₹100 = ₹2500
    const activeQty = (secQty !== undefined && secQty > 0) ? secQty : parseFloat((baseQty * factor).toFixed(3));
    lineAmount = parseFloat((activeQty * enteredRate).toFixed(2));
  } else {
    // Supplier rates quoted in Base Unit (e.g. ₹/Sheet)
    primaryRate = enteredRate;
    secondaryRate = hasSec ? parseFloat((enteredRate / factor).toFixed(3)) : enteredRate; // ₹2500 / 25 = ₹100
    lineAmount = parseFloat((baseQty * enteredRate).toFixed(2));
  }

  return {
    quantity: baseQty,
    secondaryQuantity: secQty,
    rateUnit: isSec ? 'secondary' : 'primary',
    selectedUnit: isSec ? secUnit : baseUnit,
    rate: enteredRate,
    primaryRate,
    secondaryRate,
    amount: lineAmount,
  };
}

import { computeProfessionalTotalWithRoundOff, RoundingMode } from './roundingHelper';

/**
 * Compute composite PO totals with line amounts, transport, packing, GST, and Round Off
 */
export function computePOTaxAndGrandTotals(
  items: { amount?: number; quantity?: number; rate?: number }[],
  transportCharge: number = 0,
  packingCharge: number = 0,
  taxRate: number = 18,
  isInterState: boolean = false,
  isRoundOffEnabled: boolean = true,
  roundingMode: RoundingMode = 'nearest',
  isTransportationTaxable: boolean = true,
  isPackingTaxable: boolean = true
) {
  // Pure subtotal: sum of each line's computed taxable base amount
  const subtotal = items.reduce((sum, item) => {
    const amt = typeof item.amount === 'number' && !isNaN(item.amount)
      ? item.amount
      : ((Number(item.quantity) || 0) * (Number(item.rate) || 0));
    return sum + (amt || 0);
  }, 0);

  const tCharge = Number(transportCharge) || 0;
  const pCharge = Number(packingCharge) || 0;
  const isTransTaxable = isTransportationTaxable !== false && (isTransportationTaxable as any) !== 'false';
  const isPackTaxable = isPackingTaxable !== false && (isPackingTaxable as any) !== 'false';

  const taxableTransport = isTransTaxable ? tCharge : 0;
  const taxablePacking = isPackTaxable ? pCharge : 0;
  const taxableLogistics = taxableTransport + taxablePacking;
  const nonTaxableTransport = isTransTaxable ? 0 : tCharge;
  const nonTaxablePacking = isPackTaxable ? 0 : pCharge;

  const taxableAmount = subtotal + taxableLogistics;
  const rate = Math.max(0, Number(taxRate) || 0);
  const totalTax = parseFloat(((taxableAmount * rate) / 100).toFixed(2));

  const transportationTaxAmount = isTransTaxable ? parseFloat(((tCharge * rate) / 100).toFixed(2)) : 0;
  const packingTaxAmount = isPackTaxable ? parseFloat(((pCharge * rate) / 100).toFixed(2)) : 0;

  // Compute exact and rounded grand totals with explicit round-off
  const rounding = computeProfessionalTotalWithRoundOff({
    subtotal: taxableAmount,
    totalTax,
    transportationCharges: nonTaxableTransport,
    packagingCharges: nonTaxablePacking,
    isRoundOffEnabled,
    roundingMode
  });

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    taxableAmount: parseFloat(taxableAmount.toFixed(2)),
    taxableLogistics: parseFloat(taxableLogistics.toFixed(2)),
    nonTaxableLogistics: parseFloat((nonTaxableTransport + nonTaxablePacking).toFixed(2)),
    isTransportationTaxable: isTransTaxable,
    isPackingTaxable: isPackTaxable,
    transportationTaxAmount,
    packingTaxAmount,
    taxRate: rate,
    totalTax,
    cgstAmount: isInterState ? 0 : parseFloat((totalTax / 2).toFixed(2)),
    sgstAmount: isInterState ? 0 : parseFloat((totalTax / 2).toFixed(2)),
    igstAmount: isInterState ? totalTax : 0,
    preRoundTotal: rounding.preRoundTotal,
    roundOff: rounding.roundOff,
    grandTotal: rounding.roundedGrandTotal,
    isRoundOffEnabled: rounding.isRoundOffEnabled,
    roundingMode: rounding.roundingMode
  };
}

export interface ResolvedLineItemDisplay {
  displayUnit: string;
  displayQty: number;
  displayRate: number;
  lineAmount: number;
  baseUnit: string;
  baseQty: number;
  secondaryUnit?: string;
  secondaryQty?: number;
  hasSecondaryUnit: boolean;
  conversionFactor: number;
  rateUnit: 'primary' | 'secondary';
}

/**
 * Cleanly resolves the display unit, quantity, and rate based on user's selected UOM.
 * Used across PO Modal, PO Table, PO Details Modal, and PO PDF Generators.
 */
export function resolveLineItemDisplay(item: any): ResolvedLineItemDisplay {
  const hasSec = Boolean(item?.hasSecondaryUnit && item?.secondaryUnit);
  const convFactor = (hasSec && Number(item?.conversionFactor) > 0) ? Number(item?.conversionFactor) : 1;
  const baseUnit = (item?.unit || item?.uom || 'PCS').toString().trim();
  const secUnit = hasSec ? item?.secondaryUnit.toString().trim() : '';

  // Secondary is active if rateUnit is secondary or selectedUnit explicitly equals secondaryUnit
  const isSec = Boolean(
    hasSec && (
      item?.rateUnit === 'secondary' ||
      (item?.selectedUnit && secUnit && item.selectedUnit.toLowerCase() === secUnit.toLowerCase())
    )
  );

  const baseQty = Number(item?.quantity) || 0;
  const secQty = hasSec
    ? (item?.secondaryQuantity != null && !isNaN(Number(item?.secondaryQuantity))
        ? Number(item.secondaryQuantity)
        : parseFloat((baseQty * convFactor).toFixed(3)))
    : undefined;

  const displayUnit = isSec ? secUnit : (item?.selectedUnit || baseUnit);
  const displayQty = isSec ? (secQty ?? parseFloat((baseQty * convFactor).toFixed(3))) : baseQty;
  const displayRate = Number(item?.rate) || 0;
  const lineAmount = typeof item?.amount === 'number' && !isNaN(item.amount)
    ? item.amount
    : parseFloat((displayQty * displayRate).toFixed(2));

  return {
    displayUnit,
    displayQty,
    displayRate,
    lineAmount,
    baseUnit,
    baseQty,
    secondaryUnit: secUnit,
    secondaryQty: secQty,
    hasSecondaryUnit: hasSec,
    conversionFactor: convFactor,
    rateUnit: isSec ? 'secondary' : 'primary'
  };
}

export interface ResolvedGrnLineItemDisplay {
  displayUnit: string;
  displayQty: number;
  displayAcceptedQty: number;
  displayRejectedQty: number;
  displayRate: number;
  lineAmount: number;
  baseUnit: string;
  baseQty: number;
  baseAcceptedQty: number;
  baseRejectedQty: number;
  secondaryUnit?: string;
  secondaryQty?: number;
  secondaryAcceptedQty?: number;
  secondaryRejectedQty?: number;
  hasSecondaryUnit: boolean;
  conversionFactor: number;
  isSecondary: boolean;
}

/**
 * Cleanly resolves GRN line item received, accepted, and rejected quantities,
 * unit, rate, and amount based on user's selected transaction UOM.
 */
export function resolveGrnLineItemDisplay(item: any): ResolvedGrnLineItemDisplay {
  const hasSec = Boolean(item?.hasSecondaryUnit && item?.secondaryUnit);
  const convFactor = (hasSec && Number(item?.conversionFactor) > 0) ? Number(item?.conversionFactor) : 1;
  const baseUnit = (item?.unit || item?.uom || 'PCS').toString().trim();
  const secUnit = hasSec ? item?.secondaryUnit.toString().trim() : '';

  const isSec = Boolean(
    hasSec && (
      item?.rateUnit === 'secondary' ||
      (item?.selectedUnit && secUnit && item.selectedUnit.toLowerCase() === secUnit.toLowerCase())
    )
  );

  const baseQty = Number(item?.quantity !== undefined ? item.quantity : (item?.receivedQuantity || 0)) || 0;
  const baseAcceptedQty = Number(item?.acceptedQuantity !== undefined ? item.acceptedQuantity : baseQty) || 0;
  const baseRejectedQty = Number(item?.rejectedQuantity || 0);

  const secQty = hasSec
    ? (item?.secondaryQuantity != null && !isNaN(Number(item?.secondaryQuantity))
        ? Number(item.secondaryQuantity)
        : (item?.secondaryReceivedQuantity != null && !isNaN(Number(item?.secondaryReceivedQuantity))
            ? Number(item.secondaryReceivedQuantity)
            : parseFloat((baseQty * convFactor).toFixed(3))))
    : undefined;

  const secAcceptedQty = hasSec
    ? (item?.secondaryAcceptedQuantity != null && !isNaN(Number(item?.secondaryAcceptedQuantity))
        ? Number(item.secondaryAcceptedQuantity)
        : parseFloat((baseAcceptedQty * convFactor).toFixed(3)))
    : undefined;

  const secRejectedQty = hasSec
    ? (item?.secondaryRejectedQuantity != null && !isNaN(Number(item?.secondaryRejectedQuantity))
        ? Number(item.secondaryRejectedQuantity)
        : parseFloat((baseRejectedQty * convFactor).toFixed(3)))
    : undefined;

  const displayUnit = isSec ? secUnit : (item?.selectedUnit || baseUnit);
  const displayQty = isSec ? (secQty ?? parseFloat((baseQty * convFactor).toFixed(3))) : baseQty;
  const displayAcceptedQty = isSec ? (secAcceptedQty ?? parseFloat((baseAcceptedQty * convFactor).toFixed(3))) : baseAcceptedQty;
  const displayRejectedQty = isSec ? (secRejectedQty ?? parseFloat((baseRejectedQty * convFactor).toFixed(3))) : baseRejectedQty;
  const displayRate = Number(item?.rate || item?.unitPrice || 0);
  const lineAmount = typeof item?.amount === 'number' && !isNaN(item.amount) && item.amount > 0
    ? item.amount
    : parseFloat((displayQty * displayRate).toFixed(2));

  return {
    displayUnit,
    displayQty,
    displayAcceptedQty,
    displayRejectedQty,
    displayRate,
    lineAmount,
    baseUnit,
    baseQty,
    baseAcceptedQty,
    baseRejectedQty,
    secondaryUnit: secUnit,
    secondaryQty: secQty,
    secondaryAcceptedQty: secAcceptedQty,
    secondaryRejectedQty: secRejectedQty,
    hasSecondaryUnit: hasSec,
    conversionFactor: convFactor,
    isSecondary: isSec
  };
}

export interface UomRatioResolution {
  primaryRatio: number;
  secondaryRatio: number;
  conversionFactor: number;
  formattedRatio: string;
  tooltipText: string;
}

/**
 * Cleanly resolves primaryRatio and secondaryRatio for any item,
 * with 100% backward compatibility for existing items that only have conversionFactor.
 */
export function resolveUomRatios(item: {
  conversionFactor?: number;
  primaryRatio?: number;
  secondaryRatio?: number;
  unit?: string;
  secondaryUnit?: string;
}): UomRatioResolution {
  const priUnit = (item?.unit || 'NOS').toString().trim() || 'NOS';
  const secUnit = (item?.secondaryUnit || 'KG').toString().trim() || 'KG';

  const rawPRatio = Number(item?.primaryRatio);
  const rawSRatio = Number(item?.secondaryRatio);
  const rawCf = Number(item?.conversionFactor);

  // 1. If explicit ratios exist and are valid (> 0), honor them directly
  if (!isNaN(rawPRatio) && rawPRatio > 0 && !isNaN(rawSRatio) && rawSRatio > 0) {
    const derivedCf = rawSRatio / rawPRatio;
    const cleanCf = (!isNaN(rawCf) && rawCf > 0) ? rawCf : derivedCf;
    const formatRatio = `${rawPRatio} ${priUnit} = ${rawSRatio} ${secUnit}`;
    const invCf = cleanCf > 0 ? parseFloat((1 / cleanCf).toFixed(4)) : 0;
    const tooltipText = `1 ${priUnit} = ${parseFloat(cleanCf.toFixed(4))} ${secUnit} | 1 ${secUnit} = ${invCf} ${priUnit}`;
    return {
      primaryRatio: rawPRatio,
      secondaryRatio: rawSRatio,
      conversionFactor: cleanCf,
      formattedRatio: formatRatio,
      tooltipText
    };
  }

  // 2. Backward compatibility: Auto-derive clean ratios from existing conversionFactor
  const validCf = (!isNaN(rawCf) && rawCf > 0) ? rawCf : 1;
  let pRatio = 1;
  let sRatio = 1;

  if (validCf === 1) {
    pRatio = 1;
    sRatio = 1;
  } else if (validCf < 1) {
    // Check if 1 / conversionFactor is an integer or near-integer
    // e.g. 0.1 -> 10, 0.05 -> 20, 0.25 -> 4, 0.5 -> 2, 0.00892857 -> 112
    const inv = 1 / validCf;
    if (Math.abs(inv - Math.round(inv)) < 0.005) {
      pRatio = Math.round(inv);
      sRatio = 1;
    } else {
      pRatio = 1;
      sRatio = parseFloat(validCf.toFixed(4));
    }
  } else {
    // conversionFactor >= 1 (e.g. 1 SHEET = 24.5 KG or 1 BOX = 100 PCS)
    pRatio = 1;
    sRatio = parseFloat(validCf.toFixed(4));
  }

  const formatRatio = `${pRatio} ${priUnit} = ${sRatio} ${secUnit}`;
  const invCf = validCf > 0 ? parseFloat((1 / validCf).toFixed(4)) : 0;
  const tooltipText = `1 ${priUnit} = ${parseFloat(validCf.toFixed(4))} ${secUnit} | 1 ${secUnit} = ${invCf} ${priUnit}`;

  return {
    primaryRatio: pRatio,
    secondaryRatio: sRatio,
    conversionFactor: validCf,
    formattedRatio: formatRatio,
    tooltipText
  };
}

/**
 * Format clean UOM conversion display for tables, cards, and summaries.
 * E.g. "10 NOS = 1 KG" or "1 SHEET = 24.5 KG"
 */
export function formatUomConversionDisplay(item: {
  unit?: string;
  secondaryUnit?: string;
  hasSecondaryUnit?: boolean;
  conversionFactor?: number;
  primaryRatio?: number;
  secondaryRatio?: number;
}): string {
  if (!item || !item.hasSecondaryUnit || !item.secondaryUnit) return '';
  const resolved = resolveUomRatios(item);
  return resolved.formattedRatio;
}

/**
 * Format rich tooltip text for hover states.
 */
export function formatUomConversionTooltip(item: {
  unit?: string;
  secondaryUnit?: string;
  hasSecondaryUnit?: boolean;
  conversionFactor?: number;
  primaryRatio?: number;
  secondaryRatio?: number;
}): string {
  if (!item || !item.hasSecondaryUnit || !item.secondaryUnit) return '';
  const resolved = resolveUomRatios(item);
  return `Dual Unit: ${resolved.formattedRatio} (${resolved.tooltipText})`;
}

