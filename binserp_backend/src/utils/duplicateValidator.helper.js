/**
 * Helper to validate master records for uniqueness before creating or updating.
 * - For Finished Goods (FG): Evaluates compound uniqueness of { company, name, revisionNumber }.
 *   Same name with a different revision is allowed.
 * - For all other masters: Evaluates strict uniqueness of { company, name }.
 */

const escapeRegex = (str) => {
  return (str || '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const cleanCode = code ? code.toString().trim() : null;
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
    if (keyPattern.name && keyPattern.revisionNumber) {
      return cleanRev
        ? `An FG Item with name "${cleanName || 'this name'}" and revision "${cleanRev}" already exists. Please specify a different revision number.`
        : `An FG Item with name "${cleanName || 'this name'}" already exists. Please specify a revision number to create a new version.`;
    }
    if (keyPattern.name) {
      return `A ${masterLabel} named "${cleanName || 'this name'}" already exists.`;
    }
    if (keyPattern.code) {
      return `A ${masterLabel} with this code already exists.`;
    }
    return `A duplicate entry already exists for ${masterLabel}.`;
  }
  return error.message || `Failed to save ${masterLabel}.`;
};
