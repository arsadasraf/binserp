/**
 * Professional Total Amount Rounding Utility (Backend)
 * 
 * Complies with GST Section 170 & Standard Enterprise ERP Practices (SAP, Tally, Zoho).
 * Provides symmetrical, auditable round-off calculations preserving exact line item and tax figures.
 */

/**
 * Computes exact pre-round totals, explicit round-off variance, and payable grand totals.
 * @param {Object} input
 * @param {number} input.subtotal
 * @param {number} [input.totalTax]
 * @param {number} [input.transportationCharges]
 * @param {number} [input.freight]
 * @param {number} [input.packagingCharges]
 * @param {number} [input.packaging]
 * @param {number} [input.otherCharges]
 * @param {number} [input.discount]
 * @param {boolean} [input.isRoundOffEnabled]
 * @param {'nearest'|'floor'|'ceil'|'none'} [input.roundingMode]
 * @returns {{ preRoundTotal: number, roundOff: number, roundedGrandTotal: number, isRoundOffEnabled: boolean, roundingMode: string }}
 */
export function computeProfessionalTotalWithRoundOff(input = {}) {
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const totalTax = Math.max(0, Number(input.totalTax) || 0);
  const freight = Math.max(0, Number(input.transportationCharges ?? input.freight ?? 0) || 0);
  const packaging = Math.max(0, Number(input.packagingCharges ?? input.packaging ?? 0) || 0);
  const otherCharges = Math.max(0, Number(input.otherCharges) || 0);
  const discount = Math.max(0, Number(input.discount) || 0);

  const isEnabled = input.isRoundOffEnabled !== undefined ? Boolean(input.isRoundOffEnabled) : true;
  const mode = input.roundingMode || (isEnabled ? 'nearest' : 'none');

  // Exact net payable before any round-off
  const exact = Math.max(0, parseFloat((subtotal + totalTax + freight + packaging + otherCharges - discount).toFixed(2)));

  // If disabled or set to 'none', roundOff is zero and exact total is maintained
  if (!isEnabled || mode === 'none') {
    return {
      preRoundTotal: exact,
      roundOff: 0,
      roundedGrandTotal: exact,
      isRoundOffEnabled: false,
      roundingMode: 'none',
    };
  }

  let rounded = exact;
  if (mode === 'nearest') {
    rounded = Math.round(exact);
  } else if (mode === 'floor') {
    rounded = Math.floor(exact);
  } else if (mode === 'ceil') {
    rounded = Math.ceil(exact);
  }

  // Exact round-off adjustment = Rounded Total - PreRound Total
  const diff = parseFloat((rounded - exact).toFixed(2));

  return {
    preRoundTotal: exact,
    roundOff: diff,
    roundedGrandTotal: rounded,
    isRoundOffEnabled: true,
    roundingMode: mode,
  };
}

export function calculateRoundOff(exactTotal, isEnabled = true, mode = 'nearest') {
  return computeProfessionalTotalWithRoundOff({ subtotal: exactTotal, isRoundOffEnabled: isEnabled, roundingMode: mode });
}

export default {
  computeProfessionalTotalWithRoundOff,
  calculateRoundOff
};
