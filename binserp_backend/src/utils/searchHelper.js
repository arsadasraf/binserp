/**
 * Backend Search Helper for space-free and separator-agnostic querying
 */

export const escapeRegex = (str) => {
  return (str || '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Builds a regex pattern that matches regardless of spaces, hyphens, slashes, or dots.
 * E.g., query "SS-304", "SS 304", or "SS304" matches all variations.
 * E.g., query "RM 1024" or "RM1024" matches both.
 */
export const buildSpaceFreeRegex = (token) => {
  if (!token || typeof token !== 'string') return null;
  const escaped = escapeRegex(token.trim());
  if (!escaped) return null;

  // Replace any explicit separators in query with flexible pattern
  let flexPattern = escaped.replace(/[-_./\s]+/g, '[-_./\\s]*');

  // Also handle transitions between letters and numbers (e.g. ss304 -> ss[-_./\s]*304 or 304ss -> 304[-_./\s]*ss)
  flexPattern = flexPattern.replace(/([a-zA-Z]+)([0-9]+)/g, '$1[-_./\\s]*$2');
  flexPattern = flexPattern.replace(/([0-9]+)([a-zA-Z]+)/g, '$1[-_./\\s]*$2');

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
