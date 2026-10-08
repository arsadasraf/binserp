/**
 * Helper to validate master records for uniqueness before creating or updating.
 * - For Finished Goods (FG): Evaluates compound uniqueness of { company, name, revisionNumber }.
 *   Same name with a different revision is allowed.
 * - For all other masters: Evaluates strict uniqueness of { company, name }.
 */

const escapeRegex = (str) => {
  return (str || '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Checks if a code string is a placeholder (e.g. "-", "N/A", "none") rather than an actual unique identifier.
 */
export const isPlaceholderCode = (code) => {
  if (!code) return true;
  const s = String(code).trim().toLowerCase();
  return (
    s === "" ||
    s === "-" ||
    s === "--" ||
    s === "---" ||
    s === "n/a" ||
    s === "na" ||
    s === "none" ||
    s === "null" ||
    s === "undefined"
  );
};

export const validateMasterUniqueness = async ({
  Model,
  companyId,
  excludeId = null,
  name,
  code = null,
  revisionNumber = undefined,
  masterLabel = 'Item'
}) => {
  if (!Model || !companyId) {
    return { isDuplicate: false };
  }

  const cleanName = (name || '').toString().trim();
  const rawCode = code ? code.toString().trim() : null;
  const cleanCode = isPlaceholderCode(rawCode) ? null : rawCode;
  const cleanRev = revisionNumber !== undefined ? (revisionNumber || '').toString().trim() : undefined;

  // 1. Check Name Uniqueness
  if (cleanName) {
    const nameQuery = {
      company: companyId,
      name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') }
    };

    if (excludeId) {
      nameQuery._id = { $ne: excludeId };
    }

    // Special compound uniqueness for FG Items with revision numbers
    if (cleanRev !== undefined) {
      if (cleanRev) {
        nameQuery.revisionNumber = { $regex: new RegExp(`^${escapeRegex(cleanRev)}$`, 'i') };
      } else {
        nameQuery.$or = [
          { revisionNumber: { $exists: false } },
          { revisionNumber: null },
          { revisionNumber: "" }
        ];
      }
    }

    const existingName = await Model.findOne(nameQuery).lean();
    if (existingName) {
      if (cleanRev !== undefined) {
        return {
          isDuplicate: true,
          field: 'name',
          message: cleanRev
            ? `An FG Item with name "${cleanName}" and revision "${cleanRev}" already exists. Please specify a different revision number to create a new version.`
            : `An FG Item with name "${cleanName}" (without revision) already exists. Please specify a revision number (e.g. Rev 2.0) to create a new version.`
        };
      }
      return {
        isDuplicate: true,
        field: 'name',
        message: `A ${masterLabel} named "${cleanName}" already exists.`
      };
    }
  }

  // 2. Check Code Uniqueness (if user manually provided a code)
  if (cleanCode) {
    const codeQuery = {
      company: companyId,
      code: { $regex: new RegExp(`^${escapeRegex(cleanCode)}$`, 'i') }
    };
    if (excludeId) {
      codeQuery._id = { $ne: excludeId };
    }

    const existingCode = await Model.findOne(codeQuery).lean();
    if (existingCode) {
      return {
        isDuplicate: true,
        field: 'code',
        message: `Code "${cleanCode}" is already in use by another ${masterLabel}.`
      };
    }
  }

  return { isDuplicate: false };
};

/**
 * Parses MongoDB error 11000 and formats a friendly duplicate message.
 */
export const formatDuplicateKeyError = (error, { masterLabel = 'Item', cleanName = '', cleanRev = '' } = {}) => {
  if (error && error.code === 11000) {
    const keyPattern = error.keyPattern || {};
    const keyValue = error.keyValue || {};
    if ((keyPattern.name || keyValue.name) && (keyPattern.revisionNumber || keyValue.revisionNumber)) {
      return cleanRev
        ? `An FG Item with name "${cleanName || keyValue.name || 'this name'}" and revision "${cleanRev || keyValue.revisionNumber}" already exists. Please specify a different revision number.`
        : `An FG Item with name "${cleanName || keyValue.name || 'this name'}" already exists. Please specify a revision number to create a new version.`;
    }
    if (keyPattern.name || keyValue.name) {
      return `A ${masterLabel} named "${cleanName || keyValue.name || 'this name'}" already exists.`;
    }
    if (keyPattern.code || keyValue.code) {
      return `A ${masterLabel} with code "${keyValue.code || 'this code'}" already exists.`;
    }
    return `A duplicate entry already exists for ${masterLabel}.`;
  }
  return error.message || `Failed to save ${masterLabel}.`;
};

/**
 * Safely generates a unique sequential master code (e.g. VEN-001, CUS-001, JWS-001).
 * - Correctly parses numerical suffixes (avoiding MongoDB string sort order bugs).
 * - Uses exact prefix delimiter pattern to avoid matching prefixes like VEND-001 when searching for VEN.
 * - Actively checks against collisions in a loop to ensure 100% uniqueness.
 */
export const generateUniqueMasterCode = async ({
  Model,
  companyId,
  prefix = "VEN",
  padLength = 3
}) => {
  if (!Model) return `${prefix}-001`;

  const cleanPrefix = (prefix || "").toString().trim().replace(/-+$/, "") || "ITEM";
  const escapedPrefix = escapeRegex(cleanPrefix);

  const query = {
    code: { $regex: new RegExp(`^${escapedPrefix}-\\d+$`, 'i') }
  };
  if (companyId) {
    query.company = companyId;
  }

  const existingDocs = await Model.find(query, { code: 1 }).lean();

  let maxNumber = 0;
  for (const doc of existingDocs) {
    if (!doc.code) continue;
    const match = doc.code.toString().trim().match(new RegExp(`^${escapedPrefix}-(\\d+)$`, 'i'));
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  let nextNumber = maxNumber + 1;
  let candidateCode = `${cleanPrefix}-${nextNumber.toString().padStart(padLength, '0')}`;

  const buildCheckQuery = (cand) => {
    const q = {
      code: { $regex: new RegExp(`^${escapeRegex(cand)}$`, 'i') }
    };
    if (companyId) {
      q.company = companyId;
    }
    return q;
  };

  while (await Model.exists(buildCheckQuery(candidateCode))) {
    nextNumber++;
    candidateCode = `${cleanPrefix}-${nextNumber.toString().padStart(padLength, '0')}`;
  }

  return candidateCode;
};
