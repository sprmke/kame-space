import type { PolotnoChild } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import type { PhotoAnalysis } from '@/features/dashboard/marketing/lib/poster/posterPhotoAnalysis';

/**
 * Scrims in the layouts are authored for the worst photo (up to 92% paper), which
 * washes calm photos out. Given the pixels behind the text, this keeps the weakest
 * scrim that still reads: 6:1 against an adversarial version of the zone. It never
 * strengthens a scrim, so a busy photo keeps exactly what the layout asked for.
 */

/** 4.5:1 is the AA floor; the margin covers texture the 3x3 zone stats cannot see. */
const MIN_CONTRAST = 6;
/** Above this the zone is too textured to model from averages: keep the authored scrim. */
const BUSY_KEEP = 0.45;
const MIN_ALPHA = 0.3;
const STEP = 0.05;
/** Photo luminance is gamma encoded; approximate the sRGB to linear curve. */
const toLinear = (v: number) => Math.pow(Math.max(0, Math.min(1, v)), 2.2);

type Rgb = { r: number; g: number; b: number };

function lumaOf(rgb: Rgb): number {
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

function ratio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Smallest alpha in [MIN_ALPHA, original] whose result reads at 6:1; the original
 * alpha when none does. `zone` is the photo behind the text; `scrim` the tone.
 */
export function tunedScrimAlpha(input: {
  scrim: Rgb;
  originalAlpha: number;
  zone: { luma: number; busyness: number };
}): number {
  const { scrim, originalAlpha, zone } = input;
  if (!(originalAlpha > MIN_ALPHA) || zone.busyness >= BUSY_KEEP) return originalAlpha;
  const scrimLuma = lumaOf(scrim);
  // Text is dark on a light scrim and light on a dark one.
  const ink = scrimLuma > 0.5 ? 0 : 1;
  // Adversarial photo: texture pushes some pixels toward the ink's tone.
  const swing = 0.12 + zone.busyness * 0.35;
  const photoLuma = ink === 0 ? zone.luma - swing : zone.luma + swing;
  for (let alpha = MIN_ALPHA; alpha < originalAlpha; alpha += STEP) {
    const mixed = alpha * scrimLuma + (1 - alpha) * Math.max(0, Math.min(1, photoLuma));
    if (ratio(toLinear(mixed), toLinear(ink)) >= MIN_CONTRAST) return Number(alpha.toFixed(2));
  }
  return originalAlpha;
}

const RGBA = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g;

const avg = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

function zoneFor(analysis: PhotoAnalysis, row: number) {
  const cells = analysis.zones.slice(row * 3, row * 3 + 3);
  return {
    luma: cells.reduce((s, z) => s + z.luma, 0) / cells.length,
    // Mostly the average, with a pull toward the busiest cell: one detailed corner
    // should not force a full scrim across a calm wall, but it should count.
    busyness:
      avg(cells.map((z) => z.busyness)) +
      0.3 * (Math.max(...cells.map((z) => z.busyness)) - avg(cells.map((z) => z.busyness))),
  };
}

/**
 * Rewrites the alpha stops of "Scrim top" / "Scrim bottom" gradients in place.
 * A document without analysis, or with an unrecognised fill, is left untouched.
 */
export function tuneScrims(children: PolotnoChild[], analysis: PhotoAnalysis | null): void {
  if (!analysis || analysis.zones.length < 9) return;
  for (const child of children) {
    if (child.name !== 'Scrim top' && child.name !== 'Scrim bottom') continue;
    const fill = typeof child.fill === 'string' ? child.fill : '';
    const stops = [...fill.matchAll(RGBA)];
    if (stops.length === 0) continue;
    const first = stops[0]!;
    const scrim = { r: Number(first[1]), g: Number(first[2]), b: Number(first[3]) };
    const originalAlpha = Math.max(...stops.map((m) => Number(m[4])));
    const tuned = tunedScrimAlpha({
      scrim,
      originalAlpha,
      zone: zoneFor(analysis, child.name === 'Scrim top' ? 0 : 2),
    });
    if (tuned >= originalAlpha || originalAlpha <= 0) continue;
    const factor = tuned / originalAlpha;
    child.fill = fill.replace(RGBA, (_m, r, g, b, a) => {
      const alpha = Number(a);
      return `rgba(${r},${g},${b},${Number((alpha * factor).toFixed(3))})`;
    });
  }
}
