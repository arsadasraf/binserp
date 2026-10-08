/**
 * Dual Unit of Measurement (Dual UOM) Mathematical Engine - Backend Helper
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

export function syncQuantities(changedField, value, conversionFactor = 1) {
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

export function computeDualUomLinePricing(input) {
  const hasSec = Boolean(input.hasSecondaryUnit && input.secondaryUnit);
  const factor = (hasSec && Number(input.conversionFactor) > 0) ? Number(input.conversionFactor) : 1;
  const isSec = Boolean(hasSec && input.rateUnit === 'secondary');
  const baseUnit = input.unit || 'PCS';
  const secUnit = input.secondaryUnit || '';

  const enteredRate = Math.max(0, Number(input.rate) || 0);
  const baseQty = Math.max(0, Number(input.quantity) || 0);

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

import { computeProfessionalTotalWithRoundOff } from './roundingHelper.js';

export function computePOTaxAndGrandTotals(
  items = [],
  transportCharge = 0,
  packingCharge = 0,
  taxRate = 18,
  isInterState = false,
  isRoundOffEnabled = true,
  roundingMode = 'nearest'
) {
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

/**
 * Validate and resolve dual-unit quantities for Inventory, Issue, GRN, and WIP transactions.
 * Zero tolerance for division by zero or silent invalid quantity fallbacks.
 *
 * @param {Object} item - Input item data from request
 * @param {Object} doc - Master catalog or inventory item document (optional)
 * @param {string} defaultUnit - Default primary unit fallback
 * @returns {Object} { priQty, primaryUnit, hasSec, secUnit, convFactor, secQty, selectedUnit }
 */
export function validateAndResolveDualUomQuantities(item, doc = null, defaultUnit = 'PCS') {
  const primaryUnit = (item?.unit || doc?.unit || defaultUnit || 'PCS').toString().trim();
  const hasSec = Boolean(
    item?.hasSecondaryUnit ?? doc?.hasSecondaryUnit ?? (item?.secondaryUnit || doc?.secondaryUnit)
  );
  const secUnit = (item?.secondaryUnit || doc?.secondaryUnit || '').toString().trim();

  const rawFactor = Number(item?.conversionFactor ?? doc?.conversionFactor ?? 1);
  const convFactor = (!isNaN(rawFactor) && rawFactor > 0) ? rawFactor : 1;
  const selectedUnit = (item?.selectedUnit || primaryUnit).toString().trim();

  let rawPriQty = Number(item?.quantity);
  let rawSecQty = Number(item?.secondaryQuantity);

  let priQty = 0;
  let secQty = 0;

  if (hasSec && secUnit && selectedUnit.toLowerCase() === secUnit.toLowerCase()) {
    // Operating in Secondary Unit
    if (!isNaN(rawSecQty) && rawSecQty > 0) {
      secQty = parseFloat(rawSecQty.toFixed(4));
      priQty = parseFloat((secQty / convFactor).toFixed(4));
    } else if (!isNaN(rawPriQty) && rawPriQty > 0) {
      priQty = parseFloat(rawPriQty.toFixed(4));
      secQty = parseFloat((priQty * convFactor).toFixed(4));
    } else {
      throw new Error(`Valid quantity greater than 0 is required for item "${item?.materialName || item?.name || 'Material'}"`);
    }
  } else {
    // Operating in Primary Unit
    if (!isNaN(rawPriQty) && rawPriQty > 0) {
      priQty = parseFloat(rawPriQty.toFixed(4));
      // If user supplied explicit secondary quantity > 0 (e.g. catch weight), preserve it; otherwise calculate
      if (hasSec && !isNaN(rawSecQty) && rawSecQty > 0) {
        secQty = parseFloat(rawSecQty.toFixed(4));
      } else if (hasSec) {
        secQty = parseFloat((priQty * convFactor).toFixed(4));
      } else {
        secQty = 0;
      }
    } else if (hasSec && !isNaN(rawSecQty) && rawSecQty > 0) {
      secQty = parseFloat(rawSecQty.toFixed(4));
      priQty = parseFloat((secQty / convFactor).toFixed(4));
    } else {
      throw new Error(`Valid quantity greater than 0 is required for item "${item?.materialName || item?.name || 'Material'}"`);
    }
  }

  return {
    priQty,
    primaryUnit,
    hasSec,
    secUnit,
    convFactor,
    secQty,
    selectedUnit
  };
}

/**
 * Cleanly resolves the display unit, quantity, and rate based on user's selected UOM.
 * Used across PO controllers, PO aggregations, and backend PDF templates.
 */
export function resolveLineItemDisplay(item) {
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

/**
 * Cleanly resolves GRN line item received, accepted, and rejected quantities,
 * unit, rate, and amount based on user's selected transaction UOM.
 */
export function resolveGrnLineItemDisplay(item) {
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

