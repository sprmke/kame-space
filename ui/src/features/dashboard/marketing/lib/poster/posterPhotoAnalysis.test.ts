import { describe, expect, it } from 'vitest';

import {
  analyzeBitmap,
  hammingDistance,
  planTextPlacement,
  type Bitmap,
} from '@/features/dashboard/marketing/lib/poster/posterPhotoAnalysis';

function bitmap(
  w: number,
  h: number,
  pixel: (x: number, y: number) => [number, number, number]
): Bitmap {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, g, b] = pixel(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

const flat = (v: number) => bitmap(30, 30, () => [v, v, v]);
// Deterministic noise, no Math.random.
const noisy = bitmap(30, 30, (x, y) => {
  const v = ((x * 73856093) ^ (y * 19349663)) & 255;
  return [v, v, v];
});

describe('analyzeBitmap', () => {
  it('rejects empty or malformed bitmaps', () => {
    expect(analyzeBitmap({ width: 0, height: 0, data: [] })).toBeNull();
    expect(analyzeBitmap({ width: 10, height: 10, data: new Uint8ClampedArray(8) })).toBeNull();
    expect(analyzeBitmap({ width: Number.NaN, height: 4, data: [] })).toBeNull();
  });

  it('reads brightness, flatness and clipping', () => {
    const dark = analyzeBitmap(flat(10))!;
    const light = analyzeBitmap(flat(245))!;
    expect(dark.luma).toBeLessThan(0.1);
    expect(light.luma).toBeGreaterThan(0.9);
    expect(dark.sharpness).toBe(0);
    expect(dark.clipped).toBe(1);
    expect(analyzeBitmap(flat(128))!.clipped).toBe(0);
  });

  it('measures busyness and contrast higher for noise than for a flat field', () => {
    const calm = analyzeBitmap(flat(128))!;
    const busy = analyzeBitmap(noisy)!;
    expect(busy.sharpness).toBeGreaterThan(calm.sharpness);
    expect(busy.contrast).toBeGreaterThan(calm.contrast);
    expect(busy.zones[4]!.busyness).toBeGreaterThan(calm.zones[4]!.busyness);
  });

  it('puts the focal point on the detailed side', () => {
    const rightHeavy = bitmap(30, 30, (x, y) => {
      const v = x > 20 ? ((x * 73856093) ^ (y * 19349663)) & 255 : 120;
      return [v, v, v];
    });
    const { focal } = analyzeBitmap(rightHeavy)!;
    expect(focal.x).toBeGreaterThan(0.6);
  });

  it('gives identical hashes to identical images and a far hash to a different one', () => {
    const a = analyzeBitmap(noisy)!;
    const b = analyzeBitmap(noisy)!;
    const gradient = analyzeBitmap(bitmap(30, 30, (x) => [x * 8, x * 8, x * 8]))!;
    expect(a.dHash).toBe(b.dHash);
    expect(hammingDistance(a.dHash, b.dHash)).toBe(0);
    expect(hammingDistance(a.dHash, gradient.dHash)).toBeGreaterThan(8);
  });

  it('treats a brightness-shifted copy as a near duplicate', () => {
    const base = (x: number, y: number) => ((x * 7 + y * 3) % 60) + 80;
    const a = analyzeBitmap(bitmap(30, 30, (x, y) => [base(x, y), base(x, y), base(x, y)]))!;
    const b = analyzeBitmap(
      bitmap(30, 30, (x, y) => [base(x, y) + 20, base(x, y) + 20, base(x, y) + 20])
    )!;
    expect(hammingDistance(a.dHash, b.dHash)).toBeLessThanOrEqual(6);
  });

  it('returns a mismatched-length hash distance of 64', () => {
    expect(hammingDistance('ab', 'abcd')).toBe(64);
  });
});

describe('planTextPlacement', () => {
  it('uses light ink on a calm dark zone with no scrim', () => {
    const plan = planTextPlacement(analyzeBitmap(flat(20))!);
    expect(plan.ink).toBe('light');
    expect(plan.scrim).toBe('none');
  });

  it('uses dark ink on a calm bright zone', () => {
    expect(planTextPlacement(analyzeBitmap(flat(235))!).ink).toBe('dark');
  });

  it('asks for a panel when every zone is busy', () => {
    expect(planTextPlacement(analyzeBitmap(noisy)!).scrim).toBe('panel');
  });

  it('chooses the calmer of top and bottom', () => {
    const topNoisy = bitmap(30, 30, (x, y) => {
      const v = y < 10 ? ((x * 73856093) ^ (y * 19349663)) & 255 : 60;
      return [v, v, v];
    });
    expect(planTextPlacement(analyzeBitmap(topNoisy)!).zone).toBe('bottom');
  });

  it('asks for more scrim on a mid-tone zone than on a pure black one', () => {
    const order = { none: 0, soft: 1, strong: 2, panel: 3 } as const;
    const mid = planTextPlacement(
      analyzeBitmap(bitmap(30, 30, (x) => [118 + (x % 2) * 18, 118, 118]))!
    );
    const black = planTextPlacement(analyzeBitmap(flat(5))!);
    expect(order[mid.scrim]).toBeGreaterThanOrEqual(order[black.scrim]);
  });
});
