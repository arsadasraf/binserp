/**
 * Checks if a string conforms to the modern OA format: OA-YYMMDDXXXX (e.g. OA-2610039814)
 */
export const isModernOaNumber = (num: any): boolean => {
  if (!num || typeof num !== "string") return false;
  const trimmed = num.trim();
  // Valid modern format: starts with OA- followed by 6 digits (YYMMDD)
  return /^OA-\d{6}/i.test(trimmed);
};

/**
 * Formats or retrieves a consistent unique Order Acknowledgement (OA) number.
 * Always ensures the modern format: OA-YYMMDD[LAST4] (e.g. OA-2610039814).
 * If the existing database acknowledgementNumber is in the legacy/old format
 * (e.g. identical to Customer PO number or missing OA-YYMMDD prefix),
 * this dynamically computes and returns the modern OA format instead.
 */
export const getPoOaNumber = (po: any): string => {
  const existingOA = po?.acknowledgementNumber;
  const poNum = String(po?.poNumber || "").trim().toLowerCase();

  // If the stored acknowledgementNumber is already modern and not equal to the PO number, use it
  if (
    existingOA &&
    typeof existingOA === "string" &&
    existingOA.trim() &&
    isModernOaNumber(existingOA) &&
    existingOA.trim().toLowerCase() !== poNum
  ) {
    return existingOA.trim();
  }

  // Otherwise, dynamically compute the modern OA format: OA-YYMMDD[LAST4]
  const dateVal = po?.date || po?.poDate || po?.createdAt || new Date();
  const d = new Date(dateVal);
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const yy = String(validDate.getFullYear()).slice(-2);
  const mm = String(validDate.getMonth() + 1).padStart(2, "0");
  const dd = String(validDate.getDate()).padStart(2, "0");
  const datePart = `${yy}${mm}${dd}`;

  const cleanPo = String(po?.poNumber || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const poLast4 = cleanPo.length >= 4 ? cleanPo.slice(-4) : cleanPo.padStart(4, "0");

  return `OA-${datePart}${poLast4}`;
};

