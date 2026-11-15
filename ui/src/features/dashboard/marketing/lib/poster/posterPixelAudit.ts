import type { Bitmap } from '@/features/dashboard/marketing/lib/poster/posterPhotoAnalysis';

/**
 * Pixel audit of a rendered poster. Pure functions over a downscaled RGBA bitmap of
 * the finished image, so they run in Node tests and cheaply in the browser. They
 * catch what the geometry audit cannot: a load-error placeholder, text that sits on
 * a background it cannot be read against, and copy crowding the edge.
 */

export type PixelBox = { name: string; x: number; y: number; width: number; height: number };
export type PixelTextBox = PixelBox & {
  /** Text colour as `#rrggbb`. */
  color: string;
  fontSize: number;
};

export type PixelAuditIssue =
  | { kind: 'error-placeholder'; detail: string }
  | { kind: 'low-contrast'; element: string; detail: string }
  | { kind: 'edge-crowding'; element: string; detail: string };

/** WCAG large-text minimum. Poster type is display size, so 3:1 is the floor. */
export const MIN_POSTER_CONTRAST = 3;
/** Share of red pixels that marks the loader's error block. */
const PLACEHOLDER_SHARE = 0.06;
/** Text closer than this fraction of the short side to the edge reads as cropped. */
const EDGE_MARGIN = 0.02;

function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function contrastRatio(a: number, b: number): number {
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function parseHexColor(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * OpenPolotno draws a failed image as a saturated red block with white text. A photo
 * never has that much pure red, so a large share of it means a placeholder shipped.
 */
export function detectErrorPlaceholder(bitmap: Bitmap): boolean {
  const total = bitmap.width * bitmap.height;
  if (total === 0) return false;
  let red = 0;
  for (let i = 0; i < total; i += 1) {
    const r = bitmap.data[i * 4]!;
    const g = bitmap.data[i * 4 + 1]!;
    const b = bitmap.data[i * 4 + 2]!;
    if (r > 190 && g < 70 && b < 70) red += 1;
  }
  return red / total > PLACEHOLDER_SHARE;
}

/**
 * Luminance of the background behind a box: the median of its pixels. Text covers a
 * minority of the box, so the median is the surface, not the glyphs.
 */
export function backgroundLuminance(bitmap: Bitmap, box: PixelBox): number | null {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(bitmap.width, Math.ceil(box.x + box.width));
  const y1 = Math.min(bitmap.height, Math.ceil(box.y + box.height));
  if (x1 <= x0 || y1 <= y0) return null;
  const values: number[] = [];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * bitmap.width + x) * 4;
      values.push(relativeLuminance(bitmap.data[i]!, bitmap.data[i + 1]!, bitmap.data[i + 2]!));
    }
  }
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)]!;
}

/** Boxes are in the bitmap's pixel space (the caller scales document units). */
export function auditRenderedPixels(
  bitmap: Bitmap,
  textBoxes: readonly PixelTextBox[]
): PixelAuditIssue[] {
  const issues: PixelAuditIssue[] = [];
  if (detectErrorPlaceholder(bitmap)) {
    issues.push({ kind: 'error-placeholder', detail: 'A photo failed to draw' });
  }
  const margin = Math.min(bitmap.width, bitmap.height) * EDGE_MARGIN;
  for (const box of textBoxes) {
    const ink = parseHexColor(box.color);
    const surface = backgroundLuminance(bitmap, box);
    if (ink && surface !== null) {
      const ratio = contrastRatio(relativeLuminance(...ink), surface);
      if (ratio < MIN_POSTER_CONTRAST) {
        issues.push({
          kind: 'low-contrast',
          element: box.name,
          detail: `${ratio.toFixed(1)}:1 against the photo`,
        });
      }
    }
    if (
      box.x < margin ||
      box.y < margin ||
      box.x + box.width > bitmap.width - margin ||
      box.y + box.height > bitmap.height - margin
    ) {
      issues.push({ kind: 'edge-crowding', element: box.name, detail: 'Text is near the edge' });
    }
  }
  return issues;
}
