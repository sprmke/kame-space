import { describe, expect, it } from 'vitest';

import {
  POSTER_FONT_PAIRINGS,
  POSTER_FONT_PAIRING_IDS,
  isPosterFontPairingId,
  posterFontFamilies,
} from '@/features/dashboard/marketing/lib/poster/posterFonts';

const ROLES = ['display', 'script', 'eyebrow', 'body', 'chip'] as const;

describe('poster font pairings', () => {
  it('registers every declared pairing exactly once', () => {
    expect(Object.keys(POSTER_FONT_PAIRINGS)).toHaveLength(POSTER_FONT_PAIRING_IDS.length);
    expect(new Set(POSTER_FONT_PAIRING_IDS).size).toBe(POSTER_FONT_PAIRING_IDS.length);

    for (const id of POSTER_FONT_PAIRING_IDS) {
      expect(POSTER_FONT_PAIRINGS[id]).toMatchObject({ id });
    }
  });

  it('only uses weights OpenPolotno injects, so nothing is browser-synthesised', () => {
    for (const pairing of Object.values(POSTER_FONT_PAIRINGS)) {
      for (const role of ROLES) {
        expect(['400', '700']).toContain(pairing[role].weight);
      }
    }
  });

  it('gives every role a usable family, sizing and width factor', () => {
    for (const pairing of Object.values(POSTER_FONT_PAIRINGS)) {
      for (const role of ROLES) {
        const spec = pairing[role];
        expect(spec.family.trim()).not.toBe('');
        expect(spec.lineHeight).toBeGreaterThan(0);
        expect(spec.widthFactor).toBeGreaterThan(0);
        expect(spec.widthFactor).toBeLessThanOrEqual(1.5);
      }
      expect(['none', 'soft-shadow', 'outline-shadow']).toContain(pairing.displayEffect);
    }
  });

  it('narrows pairing ids', () => {
    expect(isPosterFontPairingId('cozy-cafe')).toBe(true);
    expect(isPosterFontPairingId('comic-sans')).toBe(false);
    expect(isPosterFontPairingId(null)).toBe(false);
    expect(isPosterFontPairingId(7)).toBe(false);
  });

  it('lists every family once for preloading', () => {
    const families = posterFontFamilies();
    const expected = new Set<string>();
    for (const pairing of Object.values(POSTER_FONT_PAIRINGS)) {
      for (const role of ROLES) expected.add(pairing[role].family);
    }

    expect(new Set(families).size).toBe(families.length);
    expect(families.sort()).toEqual([...expected].sort());
  });
});
