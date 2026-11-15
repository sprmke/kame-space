/**
 * Pixel analysis of a listing photo. Pure functions over a small RGBA bitmap
 * (about 64px on the long edge), so they run in Node tests and cheaply in the
 * browser. Output drives photo ranking, text placement and scrim strength.
 */

export type Bitmap = { width: number; height: number; data: ArrayLike<number> };

export type ZoneStats = {
  /** Mean relative luminance, 0 (black) to 1 (white). */
  luma: number;
  /** Mean absolute neighbour difference, 0 (flat) to 1 (noisy). */
  busyness: number;
};

export type PhotoAnalysis = {
  luma: number;
  /** Standard deviation of luminance, 0 to 0.5. */
  contrast: number;
  /** Mean gradient magnitude; very low means blurry or featureless. */
  sharpness: number;
  /** Fraction of pixels that are nearly black or nearly white. */
  clipped: number;
  /** 3 columns x 3 rows, row-major. */
  zones: ZoneStats[];
  /** Difference hash (64 bits as 16 hex chars) for near-duplicate detection. */
  dHash: string;
  /** Where the eye lands, 0 to 1 on each axis. */
  focal: { x: number; y: number };
};

export type TextZone = 'top' | 'bottom' | 'none';
export type ScrimStrength = 'none' | 'soft' | 'strong' | 'panel';

export type TextPlacement = {
  zone: TextZone;
  ink: 'light' | 'dark';
  scrim: ScrimStrength;
};

function lumaAt(bitmap: Bitmap, x: number, y: number): number {
  const i = (y * bitmap.width + x) * 4;
  const d = bitmap.data;
  // Rec. 709 on gamma-encoded values: good enough to rank, cheap to compute.
  return (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255;
}

function gradientAt(bitmap: Bitmap, x: number, y: number, luma: Float32Array): number {
  const w = bitmap.width;
  const here = luma[y * w + x]!;
  const right = x + 1 < w ? luma[y * w + x + 1]! : here;
  const below = y + 1 < bitmap.height ? luma[(y + 1) * w + x]! : here;
  return (Math.abs(here - right) + Math.abs(here - below)) / 2;
}

/** Box-resamples a luminance plane to `cols` x `rows` (for the dHash). */
function resampleLuma(luma: Float32Array, w: number, h: number, cols: number, rows: number) {
  const out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    const y0 = Math.floor((r * h) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((r + 1) * h) / rows));
    for (let c = 0; c < cols; c += 1) {
      const x0 = Math.floor((c * w) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) * w) / cols));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < h; y += 1) {
        for (let x = x0; x < x1 && x < w; x += 1) {
          sum += luma[y * w + x]!;
          n += 1;
        }
      }
      out[r * cols + c] = n > 0 ? sum / n : 0;
    }
  }
  return out;
}

export function dHashFromLuma(luma: Float32Array, w: number, h: number): string {
  const grid = resampleLuma(luma, w, h, 9, 8);
  let hex = '';
  let nibble = 0;
  let bits = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      nibble = (nibble << 1) | (grid[r * 9 + c]! > grid[r * 9 + c + 1]! ? 1 : 0);
      bits += 1;
      if (bits === 4) {
        hex += nibble.toString(16);
        nibble = 0;
        bits = 0;
      }
    }
  }
  return hex;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

/** Returns null for an empty or malformed bitmap so callers fall back to the gallery order. */
export function analyzeBitmap(bitmap: Bitmap): PhotoAnalysis | null {
  const { width: w, height: h } = bitmap;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 3 || h < 3) return null;
  if (bitmap.data.length < w * h * 4) return null;

  const luma = new Float32Array(w * h);
  let sum = 0;
  let clipped = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const v = lumaAt(bitmap, x, y);
      luma[y * w + x] = v;
      sum += v;
      if (v < 0.04 || v > 0.96) clipped += 1;
    }
  }
  const mean = sum / (w * h);
  let variance = 0;
  for (let i = 0; i < luma.length; i += 1) variance += (luma[i]! - mean) ** 2;
  const contrast = Math.sqrt(variance / luma.length);

  const zoneLuma = new Float64Array(9);
  const zoneBusy = new Float64Array(9);
  const zoneN = new Float64Array(9);
  let gradientSum = 0;
  let fx = 0;
  let fy = 0;
  let fw = 0;
  for (let y = 0; y < h; y += 1) {
    const row = Math.min(2, Math.floor((y * 3) / h));
    for (let x = 0; x < w; x += 1) {
      const col = Math.min(2, Math.floor((x * 3) / w));
      const zone = row * 3 + col;
      const g = gradientAt(bitmap, x, y, luma);
      zoneLuma[zone] = zoneLuma[zone]! + luma[y * w + x]!;
      zoneBusy[zone] = zoneBusy[zone]! + g;
      zoneN[zone] = zoneN[zone]! + 1;
      gradientSum += g;
      // Saliency: edges, weighted toward the centre where subjects usually sit.
      const centre = 1 - (0.5 * Math.hypot((x / w - 0.5) * 2, (y / h - 0.5) * 2)) / Math.SQRT2;
      const weight = g * centre;
      fx += weight * (x / (w - 1));
      fy += weight * (y / (h - 1));
      fw += weight;
    }
  }

  const zones: ZoneStats[] = Array.from({ length: 9 }, (_, i) => ({
    luma: zoneN[i]! > 0 ? zoneLuma[i]! / zoneN[i]! : 0,
    busyness: zoneN[i]! > 0 ? Math.min(1, (zoneBusy[i]! / zoneN[i]!) * 6) : 0,
  }));

  return {
    luma: mean,
    contrast,
    sharpness: gradientSum / (w * h),
    clipped: clipped / (w * h),
    zones,
    dHash: dHashFromLuma(luma, w, h),
    focal: fw > 0 ? { x: fx / fw, y: fy / fw } : { x: 0.5, y: 0.5 },
  };
}

const BUSY_PANEL = 0.55;
const BUSY_STRONG = 0.3;

function rowStats(analysis: PhotoAnalysis, row: number): ZoneStats {
  const cells = analysis.zones.slice(row * 3, row * 3 + 3);
  return {
    luma: cells.reduce((s, z) => s + z.luma, 0) / cells.length,
    busyness: Math.max(...cells.map((z) => z.busyness)),
  };
}

/**
 * Picks the calmer of the top and bottom thirds for text, the ink that contrasts with
 * it, and how much scrim it needs. `panel` means no zone is calm enough for a scrim
 * alone: the compiler should put the text on a solid paper panel instead.
 */
export function planTextPlacement(analysis: PhotoAnalysis): TextPlacement {
  const top = rowStats(analysis, 0);
  const bottom = rowStats(analysis, 2);
  const useTop = top.busyness <= bottom.busyness;
  const zone = useTop ? top : bottom;
  const ink: 'light' | 'dark' = zone.luma < 0.5 ? 'light' : 'dark';
  // Mid-tone, textured zones are the hardest to read on: push the scrim up.
  const midTone = 1 - Math.abs(zone.luma - 0.5) * 2;
  const difficulty = zone.busyness + midTone * 0.25;
  let scrim: ScrimStrength = 'none';
  if (zone.busyness >= BUSY_PANEL) scrim = 'panel';
  else if (difficulty >= BUSY_STRONG) scrim = 'strong';
  else if (difficulty >= 0.12) scrim = 'soft';
  return { zone: useTop ? 'top' : 'bottom', ink, scrim };
}
