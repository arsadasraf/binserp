/**
 * Universal Space-Free and Separator-Agnostic Search Utility
 * 
 * Allows keyword matching regardless of spaces, hyphens, slashes, or casing.
 * E.g., searching "steelbolt" matches "Steel Bolt", and "steel bolt" matches "SteelBolt".
 */

/**
 * Normalizes a string by lowercasing and stripping all whitespace, hyphens, slashes, underscores, and commas.
 */
export const normalizeForSearch = (str: any): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .toLowerCase()
    .replace(/[\s\-_./\\,]+/g, '');
};

/**
 * Evaluates whether target text matches the search query in a space-free & separator-agnostic manner.
 * Supports:
 * 1. Direct substring match.
 * 2. Space-free & separator-free match.
 * 3. Multi-token match (all words must be present in target).
 */
export const isSpaceFreeMatch = (target: any, query: string): boolean => {
  if (!query) return true;
  if (target === null || target === undefined) return false;

  const rawQuery = String(query).toLowerCase().trim();
  if (!rawQuery) return true;

  const rawTarget = String(target).toLowerCase();

  // 1. Direct substring match (fast-path)
  if (rawTarget.includes(rawQuery)) return true;

  // 2. Space-free & separator-free normalized match
  const cleanTarget = normalizeForSearch(target);
  const cleanQuery = normalizeForSearch(rawQuery);
  if (cleanQuery && cleanTarget.includes(cleanQuery)) return true;

  // 3. Multi-token match (all words in search term must match in target)
  const tokens = rawQuery.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    return tokens.every((token) => {
      if (rawTarget.includes(token)) return true;
      const cleanToken = normalizeForSearch(token);
      return cleanToken ? cleanTarget.includes(cleanToken) : false;
    });
  }

  return false;
};

/**
 * Tests an object across multiple specified fields.
 */
export const matchesAnyField = (
  item: Record<string, any>,
  fields: (string | ((item: any) => any))[],
  query: string
): boolean => {
  if (!query || !query.trim()) return true;
  if (!item) return false;

  return fields.some((field) => {
    let val: any;
    if (typeof field === 'function') {
      val = field(item);
    } else {
      val = item[field];
    }

    if (val === null || val === undefined) return false;

    if (Array.isArray(val)) {
      return val.some((subVal) => isSpaceFreeMatch(subVal, query));
    }

    if (typeof val === 'object') {
      const nested = (val as any).name || (val as any).label || (val as any).title || (val as any).code;
      if (nested) return isSpaceFreeMatch(nested, query);
      return false;
    }

    return isSpaceFreeMatch(val, query);
  });
};

/**
 * Trims leading whitespace and collapses redundant consecutive spaces from user search inputs.
 */
export const cleanSearchInput = (val: string): string => {
  if (!val) return '';
  return val.trimStart().replace(/ {2,}/g, ' ');
};
