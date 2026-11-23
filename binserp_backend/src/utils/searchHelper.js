/**
 * Backend Search Helper for space-free and separator-agnostic querying
 */

export const escapeRegex = (str) => {
  return (str || '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Builds a ReDoS-safe regex pattern that matches bidirectionally regardless of spaces, hyphens, slashes, dots, or commas.
 * E.g., query "mssheet" matches "MS Sheet", "MS-Sheet", "M.S. Sheet", and "MSSheet".
 * E.g., query "ms sheet" matches "MSSheet", "MS Sheet", and "MS-Sheet".
 */
export const buildSpaceFreeRegex = (token) => {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (!trimmed) return null;

  // Strip separators to get compact core characters
  const compact = trimmed.replace(/[\s\-_./\\,]+/g, '');
  if (!compact) {
    return new RegExp(escapeRegex(trimmed), 'i');
  }

  // For compact tokens up to 32 chars, allow optional separators between characters.
  // Because [\s\-_./\\,] is disjoint from non-separator characters, this is linear-time & ReDoS-safe.
  if (compact.length >= 2 && compact.length <= 32) {
    const flexPattern = Array.from(compact)
      .map((ch) => escapeRegex(ch))
      .join('[\\s\\-_./\\\\,]*');
    return new RegExp(flexPattern, 'i');
  }

  // Fallback for single-char or very long strings (>32 chars)
  let flexPattern = escapeRegex(trimmed).replace(/[-_./\\,\s]+/g, '[\\s\\-_./\\\\,]*');
  flexPattern = flexPattern.replace(/([a-zA-Z]+)([0-9]+)/g, '$1[\\s\\-_./\\\\,]*$2');
  flexPattern = flexPattern.replace(/([0-9]+)([a-zA-Z]+)/g, '$1[\\s\\-_./\\\\,]*$2');

  return new RegExp(flexPattern, 'i');
};

/**
 * Builds an array of regexes or $or/$and filters for multi-token search terms across specified fields
 */
export const buildMultiFieldSearchFilter = (searchTerm, fields = ['name', 'code', 'description', 'descriptions']) => {
  if (!searchTerm || typeof searchTerm !== 'string') return null;
  const trimmed = searchTerm.trim();
  if (!trimmed) return null;

  // Split tokens by whitespace
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // For each token, build flexible regex
  const tokenRegexes = tokens.map(t => buildSpaceFreeRegex(t)).filter(Boolean);

  if (tokens.length === 1) {
    const r = tokenRegexes[0];
    return {
      $or: fields.map(field => ({ [field]: r }))
    };
  }

  // Multi-token: Each token must match at least one field
  const wholeQueryRegex = buildSpaceFreeRegex(trimmed.replace(/[\s\-_/]+/g, ''));
  const andConditions = tokenRegexes.map(r => ({
    $or: fields.map(field => ({ [field]: r }))
  }));

  if (wholeQueryRegex) {
    return {
      $or: [
        { $and: andConditions },
        ...fields.map(field => ({ [field]: wholeQueryRegex }))
      ]
    };
  }

  return { $and: andConditions };
};
