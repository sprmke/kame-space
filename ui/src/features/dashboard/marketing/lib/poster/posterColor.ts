import {
  contrastRatio,
  ensureContrast,
  readableOn,
  relativeLuminance,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';

import { hslToHex, mixHexToward, parseHexRgb, rgbToHsl, type Rgb } from '@/lib/theme/colorConvert';

export { contrastRatio, ensureContrast, readableOn, relativeLuminance };

/**
 * Poster palettes. The AI (or host) supplies at most three hexes; everything text
 * sits on is derived here with WCAG contrast guarantees, so a bad pick can make a
 * poster less pretty but never unreadable.
 */

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WARM_CREAM: Rgb = { r: 250, g: 240, b: 225 };
const NIGHT_NAVY: Rgb = { r: 12, g: 24, b: 52 };

export const DEFAULT_POSTER_ACCENT = '#b86a2c';

export type PosterPalette = {
  /** Brand accent: pills, banners, icon strokes on light fields. */
  accent: string;
  /** Text on `accent`. */
  onAccent: string;
  /** Second tone (two-tone headlines, badges). */
  secondary: string;
  onSecondary: string;
  /** Light "paper" field (info bars, cream panels). */
  field: string;
  /** Primary text on `field`. */
  fieldInk: string;
  /** Softer text on `field`. */
  fieldMuted: string;
  /** Text over dark photos / night scrims. */
  lightInk: string;
  /** Deep tone for dark scrims and night panels. */
  deep: string;
  /** Warm highlight for text over dark (night archetypes). */
  glow: string;
  scrimDark: Rgb;
  scrimLight: Rgb;
};

export function normalizePosterHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return null;
}

function secondaryFromAccent(accent: string): string {
  const rgb = parseHexRgb(accent);
  if (!rgb) return '#5a8f3c';
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // A friendly complementary-ish partner, kept mid-dark so it can carry text.
  return hslToHex((hsl.h + 110) % 360, Math.min(55, Math.max(35, hsl.s)), 38);
}

/** Keeps a trace of hue but pulls saturation down, so ink never vibrates on tinted paper. */
function nearNeutral(hex: string, keep = 0.35): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return hslToHex(hsl.h, Math.min(hsl.s, 100) * keep, hsl.l);
}

/** Smallest angle between two hues, 0 to 180. */
function hueGap(a: string, b: string): number {
  const ra = parseHexRgb(a);
  const rb = parseHexRgb(b);
  if (!ra || !rb) return 180;
  const diff = Math.abs(rgbToHsl(ra.r, ra.g, ra.b).h - rgbToHsl(rb.r, rb.g, rb.b).h) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Below this the accent and secondary read as one colour, so two-tone copy looks like a mistake. */
const MIN_TONE_HUE_GAP = 35;

export function derivePosterPalette(input: {
  accent?: string | null;
  secondary?: string | null;
  field?: string | null;
}): PosterPalette {
  const rawAccent = normalizePosterHex(input.accent) ?? DEFAULT_POSTER_ACCENT;
  const baseField =
    normalizePosterHex(input.field) ??
    mixHexToward(mixHexToward(rawAccent, WARM_CREAM, 0.86), WHITE, 0.2);
  // Fields are paper: keep them light no matter what the model returned.
  const field =
    relativeLuminance(baseField) < 0.72 ? mixHexToward(baseField, WHITE, 0.78) : baseField;
  // The accent carries pills and icon strokes on the field, so it needs 3:1 there.
  const accent = ensureContrast(rawAccent, field, 3);
  const requestedSecondary = normalizePosterHex(input.secondary);
  // A secondary that is the accent in disguise (or a grey) is replaced by the derived partner.
  const secondaryPick =
    requestedSecondary && hueGap(requestedSecondary, accent) >= MIN_TONE_HUE_GAP
      ? requestedSecondary
      : secondaryFromAccent(accent);
  const secondary = ensureContrast(secondaryPick, field, 3);
  const fieldInk = ensureContrast(nearNeutral(mixHexToward(accent, BLACK, 0.62)), field, 7);
  const fieldMuted = ensureContrast(
    nearNeutral(mixHexToward(accent, BLACK, 0.35), 0.5),
    field,
    4.5
  );
  const deep = mixHexToward(mixHexToward(accent, NIGHT_NAVY, 0.82), BLACK, 0.1);
  const glow = ensureContrast(mixHexToward(accent, { r: 240, g: 200, b: 130 }, 0.65), deep, 4.5);
  const deepRgb = parseHexRgb(deep) ?? NIGHT_NAVY;
  const fieldRgb = parseHexRgb(field) ?? WARM_CREAM;

  return {
    accent,
    onAccent: readableOn(accent, '#ffffff', fieldInk),
    secondary,
    onSecondary: readableOn(secondary, '#ffffff', fieldInk),
    field,
    fieldInk,
    fieldMuted,
    lightInk: mixHexToward(field, WHITE, 0.6),
    deep,
    glow,
    scrimDark: deepRgb,
    scrimLight: fieldRgb,
  };
}

export function rgba(rgb: Rgb, alpha: number): string {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0, Math.min(1, alpha))})`;
}
