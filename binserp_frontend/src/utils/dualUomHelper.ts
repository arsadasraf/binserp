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
  roundingMode: RoundingMode = 'nearest'
) {
  // Pure subtotal: sum of each line's computed taxable base amount
  const subtotal = items.reduce((sum, item) => {
    const amt = typeof item.amount === 'number' && !isNaN(item.amount)
      ? item.amount
      : ((Number(item.quantity) || 0) * (Number(item.rate) || 0));
    return sum + (amt || 0);
  }, 0);

  const logistics = (Number(transportCharge) || 0) + (Number(packingCharge) || 0);
  const taxableAmount = subtotal + logistics;
  const rate = Math.max(0, Number(taxRate) || 0);
  const totalTax = parseFloat(((taxableAmount * rate) / 100).toFixed(2));

  // Compute exact and rounded grand totals with explicit round-off
  const rounding = computeProfessionalTotalWithRoundOff({
    subtotal: taxableAmount,
    totalTax,
    isRoundOffEnabled,
    roundingMode
  });

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    taxableAmount: parseFloat(taxableAmount.toFixed(2)),
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
