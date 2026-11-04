import { describe, it, expect } from 'vitest';
import {
  normalizeForSearch,
  isSpaceFreeMatch,
  matchesAnyField,
  cleanSearchInput,
} from '@/src/utils/spaceFreeSearchHelper';

describe('Space-Free & Multi-Keyword Dynamic Search Integration (Price Lists, BOM, Masters, MRP)', () => {
  it('matches items regardless of spaces, hyphens, slashes, or casing', () => {
    const itemName = 'MS Hex Bolt M12 x 50mm';
    const description = 'High-Tensile 8.8 Grade / Zinc Plated';

    expect(isSpaceFreeMatch(itemName, 'ms hex')).toBe(true);
    expect(isSpaceFreeMatch(itemName, 'mshex')).toBe(true);
    expect(isSpaceFreeMatch(itemName, 'bolt m12')).toBe(true);
    expect(isSpaceFreeMatch(itemName, 'm12 50mm')).toBe(true);
    expect(isSpaceFreeMatch(description, '8.8 grade zinc')).toBe(true);
    expect(isSpaceFreeMatch(description, 'hightensile')).toBe(true);
    expect(isSpaceFreeMatch(itemName, 'stainless 304')).toBe(false);
  });

  it('supports multi-token out-of-order and combined field search across item name + description + vendor', () => {
    const combinedRowText = 'Hydraulic Cylinder Rod — Ø45mm Induction Hardened EN8 — Apex Hydraulics Pvt Ltd — KG';

    // Space-separated tokens across different segments of the row
    expect(isSpaceFreeMatch(combinedRowText, 'hydraulic en8 apex')).toBe(true);
    expect(isSpaceFreeMatch(combinedRowText, 'rod 45mm kg')).toBe(true);
    expect(isSpaceFreeMatch(combinedRowText, 'induction apex')).toBe(true);
    expect(isSpaceFreeMatch(combinedRowText, 'hydraulic brass')).toBe(false);
  });

  it('evaluates matchesAnyField across nested objects, arrays, and extractor functions', () => {
    const priceListEntry = {
      material: {
        name: 'SS 304 Sheet',
        descriptions: '2mm Thick Cold Rolled Matte Finish',
      },
      vendor: {
        name: 'Jindal Stainless Supplier',
      },
      unitPrice: 245.5,
      tags: ['Laser Cut', 'Sheet Metal'],
    };

    const fields = [
      (row: any) => row.material?.name,
      (row: any) => row.material?.descriptions,
      'vendor',
      'tags',
    ];

    expect(matchesAnyField(priceListEntry, fields, 'ss304')).toBe(true);
    expect(matchesAnyField(priceListEntry, fields, '2mm cold rolled')).toBe(true);
    expect(matchesAnyField(priceListEntry, fields, 'jindal supplier')).toBe(true);
    expect(matchesAnyField(priceListEntry, fields, 'lasercut')).toBe(true);
    expect(matchesAnyField(priceListEntry, fields, 'copper')).toBe(false);
  });

  it('preserves single spaces during typing while collapsing redundant spaces via cleanSearchInput', () => {
    expect(cleanSearchInput('  ms   bolt ')).toBe('ms bolt ');
    expect(normalizeForSearch('MS-Bolt_12.5/A,B')).toBe('msbolt125ab');
  });
});

