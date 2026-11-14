import { describe, expect, it } from 'vitest';

import {
  DEFAULT_POSTER_ACCENT,
  derivePosterPalette,
  normalizePosterHex,
  rgba,
} from '@/features/dashboard/marketing/lib/poster/posterColor';
import {
  contrastRatio,
  relativeLuminance,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';

describe('normalizePosterHex', () => {
  it('accepts 6-digit hex with or without the hash, in any case', () => {
    expect(normalizePosterHex('#AABBCC')).toBe('#aabbcc');
    expect(normalizePosterHex('AABBCC')).toBe('#aabbcc');
    expect(normalizePosterHex('  #0f0f0f  ')).toBe('#0f0f0f');
  });

  it('rejects short hex, named colours and non-strings', () => {
    expect(normalizePosterHex('#abc')).toBeNull();
    expect(normalizePosterHex('red')).toBeNull();
    expect(normalizePosterHex('#12345g')).toBeNull();
    expect(normalizePosterHex(null)).toBeNull();
    expect(normalizePosterHex(42)).toBeNull();
  });
});

describe('derivePosterPalette', () => {
  it('falls back to the default accent', () => {
    expect(derivePosterPalette({}).accent).toBeTruthy();
    expect(normalizePosterHex(derivePosterPalette({ accent: 'nope' }).accent)).toBe(
      derivePosterPalette({}).accent
    );
  });

  it('always produces readable combinations', () => {
    const cases = [
      {},
      { accent: '#1b5e20' },
      { accent: '#f9c74f' },
      { accent: '#111111', secondary: '#222222' },
      { accent: '#ff00ff', field: '#000000' },
    ];

    for (const input of cases) {
      const palette = derivePosterPalette(input);

      expect(relativeLuminance(palette.field)).toBeGreaterThanOrEqual(0.5);
      expect(contrastRatio(palette.accent, palette.field)).toBeGreaterThanOrEqual(2.99);
      expect(contrastRatio(palette.secondary, palette.field)).toBeGreaterThanOrEqual(2.99);
      expect(contrastRatio(palette.fieldInk, palette.field)).toBeGreaterThanOrEqual(6.99);
      expect(contrastRatio(palette.fieldMuted, palette.field)).toBeGreaterThanOrEqual(4.49);
      expect(contrastRatio(palette.glow, palette.deep)).toBeGreaterThanOrEqual(4.49);
      expect(contrastRatio(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(
        contrastRatio('#ffffff', palette.accent) - 1e-9
      );
      expect(contrastRatio(palette.onSecondary, palette.secondary)).toBeGreaterThanOrEqual(
        contrastRatio('#ffffff', palette.secondary) - 1e-9
      );
    }
  });

  it('keeps a supplied light field instead of regenerating one', () => {
    expect(derivePosterPalette({ field: '#fffaf0' }).field).toBe('#fffaf0');
  });

  it('exposes scrim colours as RGB triples of deep and field', () => {
    const palette = derivePosterPalette({ accent: '#b86a2c' });

    expect(palette.scrimDark.r).toBeGreaterThanOrEqual(0);
    expect(palette.scrimDark.r).toBeLessThanOrEqual(255);
    expect(palette.scrimLight.r).toBeGreaterThanOrEqual(200);
  });

  it('derives a distinct secondary when none is supplied', () => {
    const palette = derivePosterPalette({ accent: '#b86a2c' });
    expect(palette.secondary).not.toBe(palette.accent);
  });

  it('exposes the documented default accent', () => {
    expect(normalizePosterHex(DEFAULT_POSTER_ACCENT)).toBe(DEFAULT_POSTER_ACCENT);
  });
});

describe('rgba', () => {
  it('formats an rgb triple and clamps alpha', () => {
    expect(rgba({ r: 1, g: 2, b: 3 }, 0.5)).toBe('rgba(1,2,3,0.5)');
    expect(rgba({ r: 1, g: 2, b: 3 }, -1)).toBe('rgba(1,2,3,0)');
    expect(rgba({ r: 1, g: 2, b: 3 }, 7)).toBe('rgba(1,2,3,1)');
  });
});

describe('derivePosterPalette v2 guards', () => {
  const BRANDS = { green: '#2e7d32', teal: '#0f766e', pink: '#ec4899', navy: '#1e3a8a' };

  it.each(Object.entries(BRANDS))('%s brand: ink stays readable and near neutral', (_name, hex) => {
    const palette = derivePosterPalette({ accent: hex });
    expect(contrastRatio(palette.fieldInk, palette.field)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(palette.fieldMuted, palette.field)).toBeGreaterThanOrEqual(4.5);
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r, g, b] = rgb(palette.fieldInk);
    // A trace of hue only: channels stay within a narrow band of each other.
    expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeLessThan(60);
  });

  it('replaces a secondary that is the accent in disguise', () => {
    const same = derivePosterPalette({ accent: '#2e7d32', secondary: '#33863a' });
    const derived = derivePosterPalette({ accent: '#2e7d32' });
    expect(same.secondary).toBe(derived.secondary);
  });

  it('keeps a secondary that is clearly another hue', () => {
    const palette = derivePosterPalette({ accent: '#2e7d32', secondary: '#b3261e' });
    expect(palette.secondary).not.toBe(derivePosterPalette({ accent: '#2e7d32' }).secondary);
  });
});
