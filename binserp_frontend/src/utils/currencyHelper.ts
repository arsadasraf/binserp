/**
 * Currency Helper Constants and Utilities for Sales & Invoicing
 */

export type CurrencyCode =
  | 'INR'
  | 'USD'
  | 'EUR'
  | 'EURO'
  | 'GBP'
  | 'POUND'
  | 'AED'
  | 'CAD'
  | 'AUD'
  | 'SGD'
  | 'JPY'
  | 'YEN'
  | 'CNY'
  | 'YUAN';

export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
  name: string;
  subunit: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'INR', label: 'INR (₹) - Indian Rupee', symbol: '₹', name: 'Indian Rupee', subunit: 'Paise' },
  { code: 'USD', label: 'USD ($) - US Dollar', symbol: '$', name: 'US Dollar', subunit: 'Cents' },
  { code: 'EUR', label: 'EUR (€) - Euro', symbol: '€', name: 'Euro', subunit: 'Cents' },
  { code: 'GBP', label: 'GBP (£) - British Pound', symbol: '£', name: 'British Pound', subunit: 'Pence' },
  { code: 'AED', label: 'AED (د.إ) - UAE Dirham', symbol: 'AED ', name: 'UAE Dirham', subunit: 'Fils' },
  { code: 'CAD', label: 'CAD ($) - Canadian Dollar', symbol: 'CA$', name: 'Canadian Dollar', subunit: 'Cents' },
  { code: 'AUD', label: 'AUD ($) - Australian Dollar', symbol: 'A$', name: 'Australian Dollar', subunit: 'Cents' },
  { code: 'SGD', label: 'SGD ($) - Singapore Dollar', symbol: 'S$', name: 'Singapore Dollar', subunit: 'Cents' },
  { code: 'JPY', label: 'JPY (¥) - Japanese Yen', symbol: '¥', name: 'Japanese Yen', subunit: 'Sen' },
  { code: 'CNY', label: 'CNY (¥) - Chinese Yuan', symbol: '¥', name: 'Chinese Yuan', subunit: 'Fen' },
];

/**
 * Normalizes currency code to standard 3-letter ISO or recognized name
 */
export const normalizeCurrencyCode = (currency?: string): string => {
  const c = (currency || 'INR').trim().toUpperCase();
  if (c === 'POUND') return 'GBP';
  if (c === 'EURO') return 'EUR';
  if (c === 'YEN') return 'JPY';
  if (c === 'YUAN' || c === 'RMB') return 'CNY';
  return c || 'INR';
};

/**
 * Returns the corresponding currency symbol for a currency code.
 */
export const getCurrencySymbol = (currency?: string): string => {
  const c = normalizeCurrencyCode(currency);
  switch (c) {
    case 'USD':
      return '$';
    case 'GBP':
      return '£';
    case 'EUR':
      return '€';
    case 'AED':
      return 'AED ';
    case 'CAD':
      return 'CA$';
    case 'AUD':
      return 'A$';
    case 'SGD':
      return 'S$';
    case 'JPY':
      return '¥';
    case 'CNY':
      return '¥';
    case 'INR':
    default:
      return '₹';
  }
};

/**
 * Formats an amount with the appropriate currency symbol.
 */
export const formatCurrencyAmount = (
  amount: number | string | undefined | null,
  currency?: string,
  options?: { showSymbol?: boolean; minimumFractionDigits?: number; maximumFractionDigits?: number }
): string => {
  const num = Number(amount || 0);
  const minDigits = options?.minimumFractionDigits !== undefined ? options.minimumFractionDigits : 2;
  const maxDigits = options?.maximumFractionDigits !== undefined ? options.maximumFractionDigits : 2;
  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });
  if (options?.showSymbol === false) return formatted;
  const sym = getCurrencySymbol(currency);
  return `${sym}${formatted}`;
};

// Word tables for number to words conversion
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertUnderThousand(num: number): string {
  let str = '';
  if (num >= 100) {
    str += ONES[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num >= 20) {
    str += TENS[Math.floor(num / 10)] + (num % 10 ? ' ' + ONES[num % 10] : '') + ' ';
  } else if (num > 0) {
    str += ONES[num] + ' ';
  }
  return str.trim();
}

/**
 * Converts integer to Indian numbering format (Lakhs, Crores)
 */
function convertIndianNumberToWords(num: number): string {
  if (num === 0) return 'Zero';
  function inWords(n: number): string {
    let result = '';
    if (n >= 10000000) {
      result += inWords(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      result += inWords(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      result += inWords(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n > 0) {
      result += convertUnderThousand(n) + ' ';
    }
    return result.trim();
  }
  return inWords(num);
}

/**
 * Converts integer to International Western format (Thousands, Millions, Billions, Trillions)
 */
function convertWesternNumberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  let scaleIndex = 0;
  let words: string[] = [];

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      const chunkWords = convertUnderThousand(chunk);
      const scale = scales[scaleIndex];
      words.unshift(scale ? `${chunkWords} ${scale}` : chunkWords);
    }
    num = Math.floor(num / 1000);
    scaleIndex++;
  }

  return words.join(' ').trim();
}

/**
 * Currency-Aware Number to Words Converter
 * Converts amounts into formal written monetary form based on selected currency.
 * e.g.
 * - 125000.50 INR -> "Rupees One Lakh Twenty Five Thousand and Fifty Paise Only"
 * - 125000.50 USD -> "US Dollars One Hundred Twenty Five Thousand and Fifty Cents Only"
 * - 450.00 EUR   -> "Euros Four Hundred Fifty Only"
 */
export const convertAmountToWords = (
  amount: number | string | undefined | null,
  currency?: string
): string => {
  const num = Number(amount || 0);
  if (isNaN(num) || num <= 0) {
    const sym = normalizeCurrencyCode(currency);
    return sym === 'INR' ? 'Zero Rupees Only' : `${sym} Zero Only`;
  }

  const code = normalizeCurrencyCode(currency);
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  if (code === 'INR') {
    const intWords = convertIndianNumberToWords(integerPart);
    let result = `Rupees ${intWords}`;
    if (decimalPart > 0) {
      const decWords = convertIndianNumberToWords(decimalPart);
      result += ` and ${decWords} Paise`;
    }
    return `${result} Only`;
  }

  const currencyUnitNames: Record<string, { main: string; subunit: string }> = {
    USD: { main: 'US Dollars', subunit: 'Cents' },
    EUR: { main: 'Euros', subunit: 'Cents' },
    GBP: { main: 'Pounds', subunit: 'Pence' },
    AED: { main: 'UAE Dirhams', subunit: 'Fils' },
    CAD: { main: 'Canadian Dollars', subunit: 'Cents' },
    AUD: { main: 'Australian Dollars', subunit: 'Cents' },
    SGD: { main: 'Singapore Dollars', subunit: 'Cents' },
    JPY: { main: 'Japanese Yen', subunit: 'Sen' },
    CNY: { main: 'Chinese Yuan', subunit: 'Fen' },
  };

  const info = currencyUnitNames[code] || { main: code, subunit: 'Cents' };
  const intWords = convertWesternNumberToWords(integerPart);

  let result = `${info.main} ${intWords}`;
  if (decimalPart > 0) {
    const decWords = convertWesternNumberToWords(decimalPart);
    result += ` and ${decWords} ${info.subunit}`;
  }
  return `${result} Only`;
};

/**
 * Standard baseline Exchange Rates to Indian Rupees (INR ₹)
 * 1 Foreign Unit = X INR
 */
export const DEFAULT_EXCHANGE_RATES_TO_INR: Record<string, number> = {
  INR: 1.0,
  USD: 86.80,
  EUR: 92.50,
  GBP: 108.20,
  AED: 23.63,
  CAD: 61.50,
  AUD: 55.40,
  SGD: 64.20,
  JPY: 0.56,
  CNY: 11.95,
};

/**
 * Returns exchange rate of currency to INR
 */
export const getExchangeRateToINR = (currency?: string, customRate?: number): number => {
  if (customRate && customRate > 0) return customRate;
  const code = normalizeCurrencyCode(currency);
  return DEFAULT_EXCHANGE_RATES_TO_INR[code] || 1.0;
};

/**
 * Converts any amount from selected currency to INR ₹
 */
export const convertToINR = (
  amount: number | string | undefined | null,
  currency?: string,
  customRate?: number
): { rate: number; inrAmount: number; isForeign: boolean; formattedINR: string } => {
  const num = Number(amount || 0);
  const code = normalizeCurrencyCode(currency);
  const isForeign = code !== 'INR';
  const rate = isForeign ? getExchangeRateToINR(code, customRate) : 1.0;
  const inrAmount = isForeign ? num * rate : num;

  const formattedINR = `₹${inrAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return {
    rate,
    inrAmount,
    isForeign,
    formattedINR,
  };
};

