import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  ensureContrast,
  formatCssColor,
  mixHexes,
  mixTowardBlack,
  mixTowardWhite,
  normalizeThemeHex,
  oklchToRgb,
  parseCssColor,
  readableOn,
  relativeLuminance,
  rgbToOklab,
  rgbToOklch,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';

describe('parseCssColor', () => {
  it('reads 3, 6 and 8 digit hex in any case', () => {
    expect(parseCssColor('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1, notation: 'hex3' });
    expect(parseCssColor('#AABBCC')).toEqual({ r: 170, g: 187, b: 204, a: 1, notation: 'hex6' });
    expect(parseCssColor('#aabbcc80')).toEqual({
      r: 170,
      g: 187,
      b: 204,
      a: 128 / 255,
      notation: 'hex8',
    });
  });

  it('reads rgb() and rgba()', () => {
    expect(parseCssColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1, notation: 'rgb' });
    expect(parseCssColor('rgba(1,2,3,0.5)')).toEqual({
      r: 1,
      g: 2,
      b: 3,
      a: 0.5,
      notation: 'rgba',
    });
  });

  it('clamps alpha to 0..1', () => {
    expect(parseCssColor('rgba(0,0,0,5)')?.a).toBe(1);
    expect(parseCssColor('rgba(0,0,0,0)')?.a).toBe(0);
    // A negative alpha is not valid CSS, so the whole colour is rejected.
    expect(parseCssColor('rgba(0,0,0,-2)')).toBeNull();
  });

  it('rejects out-of-range channels and unknown syntax', () => {
    expect(parseCssColor('rgb(300, 2, 3)')).toBeNull();
    expect(parseCssColor('#abcd')).toBeNull();
    expect(parseCssColor('red')).toBeNull();
    expect(parseCssColor('')).toBeNull();
  });
});

describe('formatCssColor', () => {
  const color = { r: 170, g: 187, b: 204, a: 0.5 };

  it('writes hex notations', () => {
    expect(formatCssColor(color, 'hex3')).toBe('#aabbcc');
    expect(formatCssColor(color, 'hex6')).toBe('#aabbcc');
    expect(formatCssColor({ ...color, a: 1 }, 'hex8')).toBe('#aabbccff');
  });

  it('writes rgb notations', () => {
    expect(formatCssColor(color, 'rgb')).toBe('rgb(170, 187, 204)');
    expect(formatCssColor(color, 'rgba')).toBe('rgba(170, 187, 204, 0.5)');
  });

  it('round-trips through parseCssColor', () => {
    for (const notation of ['hex6', 'hex8', 'rgb', 'rgba'] as const) {
      const text = formatCssColor({ ...color, a: 0.25 }, notation);
      const parsed = parseCssColor(text);
      expect(parsed).not.toBeNull();
      expect(parsed!.r).toBe(170);
      expect(parsed!.b).toBe(204);
    }
  });
});

describe('normalizeThemeHex', () => {
  it('returns lowercase 6-digit hex', () => {
    expect(normalizeThemeHex('#AABBCC')).toBe('#aabbcc');
    expect(normalizeThemeHex('aabbcc')).toBe('#aabbcc');
    expect(normalizeThemeHex('#abc')).toBe('#aabbcc');
    expect(normalizeThemeHex('  #0F0F0F  ')).toBe('#0f0f0f');
  });

  it('rejects rgb, alpha hex and non-strings', () => {
    expect(normalizeThemeHex('rgb(1,2,3)')).toBeNull();
    expect(normalizeThemeHex('#aabbccdd')).toBeNull();
    expect(normalizeThemeHex('orange')).toBeNull();
    expect(normalizeThemeHex(null)).toBeNull();
  });
});

describe('WCAG contrast helpers', () => {
  it('knows the extremes', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('not-a-colour')).toBe(0.5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 2);
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5);
  });

  it('leaves a colour alone when it already passes', () => {
    expect(ensureContrast('#000000', '#ffffff', 4.5)).toBe('#000000');
  });

  it('picks the direction from the background, not the ink', () => {
    const onLight = ensureContrast('#dddddd', '#ffffff', 4.5);
    const onDark = ensureContrast('#222222', '#000000', 4.5);

    expect(relativeLuminance(onLight)).toBeLessThan(relativeLuminance('#dddddd'));
    expect(relativeLuminance(onDark)).toBeGreaterThan(relativeLuminance('#222222'));
    expect(contrastRatio(onLight, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(onDark, '#000000')).toBeGreaterThanOrEqual(4.5);
  });

  it('always reaches an impossible-to-miss ratio by falling back to black or white', () => {
    expect(contrastRatio(ensureContrast('#777777', '#888888', 20), '#888888')).toBeGreaterThan(1);
  });

  it('readableOn picks white on dark and dark ink on light', () => {
    expect(readableOn('#000000')).toBe('#ffffff');
    expect(readableOn('#ffffff')).toBe('#1f1a17');
  });
});

describe('mixing', () => {
  it('mixes toward white and black', () => {
    expect(mixTowardWhite('#000000', 1)).toBe('#ffffff');
    expect(mixTowardBlack('#ffffff', 1)).toBe('#000000');
    expect(mixTowardWhite('#000000', 0)).toBe('#000000');
  });

  it('mixes two hexes by weight', () => {
    expect(mixHexes('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHexes('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHexes('#000000', 'not-a-colour', 0.5)).toBe('#000000');
  });
});

describe('OKLab / OKLCh', () => {
  it('converts white and black to OKLab lightness', () => {
    expect(rgbToOklab({ r: 255, g: 255, b: 255 }).L).toBeCloseTo(1, 3);
    expect(rgbToOklab({ r: 0, g: 0, b: 0 }).L).toBeCloseTo(0, 5);
  });

  it('reports chroma and hue in range', () => {
    const oklch = rgbToOklch({ r: 232, g: 117, b: 42 });

    expect(oklch.L).toBeGreaterThan(0);
    expect(oklch.L).toBeLessThan(1);
    expect(oklch.C).toBeGreaterThan(0);
    expect(oklch.h).toBeGreaterThanOrEqual(0);
    expect(oklch.h).toBeLessThan(360);
  });

  it('round-trips greys and clamps lightness', () => {
    const white = oklchToRgb({ L: 1, C: 0, h: 0 });
    expect(white.r).toBeCloseTo(255, 4);
    expect(white.g).toBeCloseTo(255, 4);
    expect(white.b).toBeCloseTo(255, 4);

    const black = oklchToRgb({ L: 0, C: 0, h: 0 });
    expect(black.r).toBeCloseTo(0, 4);
    expect(black.g).toBeCloseTo(0, 4);
    expect(black.b).toBeCloseTo(0, 4);

    const clamped = oklchToRgb({ L: 4, C: 0, h: 0 });
    expect(clamped.r).toBeLessThanOrEqual(255);
  });

  it('brings an out-of-gamut chroma back into range while keeping lightness', () => {
    const rgb = oklchToRgb({ L: 0.5, C: 0.9, h: 40 });

    for (const channel of [rgb.r, rgb.g, rgb.b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
    expect(rgbToOklch(rgb).L).toBeCloseTo(0.5, 1);
  });
});
