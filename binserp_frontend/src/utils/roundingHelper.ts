/**
 * Professional Total Amount Rounding Utility
 * 
 * Complies with GST Section 170 & Standard Enterprise ERP Practices (SAP, Tally, Zoho).
 * Provides symmetrical, auditable round-off calculations preserving exact line item and tax figures.
 */

export type RoundingMode = 'nearest' | 'floor' | 'ceil' | 'none';

export interface RoundingInput {
  subtotal: number;
  totalTax?: number;
  transportationCharges?: number;
  freight?: number;
  packagingCharges?: number;
  packaging?: number;
  otherCharges?: number;
  discount?: number;
  isRoundOffEnabled?: boolean;
  roundingMode?: RoundingMode;
  currency?: string;
}

export interface RoundingResult {
  preRoundTotal: number;       // Exact sum before rounding (e.g. 12450.38)
  roundOff: number;            // Explicit adjustment value (e.g. -0.38 or +0.35)
  roundedGrandTotal: number;   // Final payable grand total (e.g. 12450.00)
  isRoundOffEnabled: boolean;
  roundingMode: RoundingMode;
}

/**
 * Computes exact pre-round totals, explicit round-off variance, and payable grand totals.
 */
export function computeProfessionalTotalWithRoundOff(input: RoundingInput): RoundingResult {
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const totalTax = Math.max(0, Number(input.totalTax) || 0);
  const freight = Math.max(0, Number(input.transportationCharges ?? input.freight ?? 0) || 0);
  const packaging = Math.max(0, Number(input.packagingCharges ?? input.packaging ?? 0) || 0);
  const otherCharges = Math.max(0, Number(input.otherCharges) || 0);
  const discount = Math.max(0, Number(input.discount) || 0);

  const isEnabled = input.isRoundOffEnabled !== undefined ? Boolean(input.isRoundOffEnabled) : true;
  const mode: RoundingMode = input.roundingMode || (isEnabled ? 'nearest' : 'none');

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

/**
 * Formats a round-off value for UI badges / breakdown displays (e.g. "+ ₹ 0.35" or "- ₹ 0.42")
 */
export function formatRoundOffValue(roundOff: number, currencySymbol: string = '₹'): string {
  const num = Number(roundOff) || 0;
  if (Math.abs(num) < 0.001) return `${currencySymbol} 0.00`;
  const sign = num > 0 ? '+' : '-';
  return `${sign} ${currencySymbol} ${Math.abs(num).toFixed(2)}`;
}

export function calculateRoundOff(exactTotal: number, isEnabled: boolean = true, mode: 'nearest' | 'floor' | 'ceil' | 'none' = 'nearest') {
  return computeProfessionalTotalWithRoundOff({ subtotal: exactTotal, isRoundOffEnabled: isEnabled, roundingMode: mode });
}
