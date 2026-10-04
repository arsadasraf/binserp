/**
 * Generates a unique Order Acknowledgement (OA) number.
 * Format: OA-YYMMDD[LAST4_OF_PO] (e.g. OA-2610039814)
 * Collision handling: OA-2610039814-1, OA-2610039814-2, etc.
 */
export const generateUniqueOANumber = async ({
  poNumber = "",
  date = new Date(),
  companyId,
  IncomingPO,
  excludeId = null,
}) => {
  const d = date ? new Date(date) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const yy = String(validDate.getFullYear()).slice(-2);
  const mm = String(validDate.getMonth() + 1).padStart(2, "0");
  const dd = String(validDate.getDate()).padStart(2, "0");
  const datePart = `${yy}${mm}${dd}`; // 6 digits: YYMMDD

  // Clean alphanumeric characters from PO number
  const cleanPo = String(poNumber || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const poLast4 = cleanPo.length >= 4 
    ? cleanPo.slice(-4) 
    : cleanPo.padStart(4, "0");

  const baseOA = `OA-${datePart}${poLast4}`;

  if (!IncomingPO || !companyId) {
    return baseOA;
  }

  let candidate = baseOA;
  let counter = 1;

  while (
    await IncomingPO.exists({
      company: companyId,
      acknowledgementNumber: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
  ) {
    candidate = `${baseOA}-${counter}`;
    counter++;
  }

  return candidate;
};
