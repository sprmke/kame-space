import { describe, expect, it } from 'vitest';

import type { PolotnoChild } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import type { PhotoAnalysis } from '@/features/dashboard/marketing/lib/poster/posterPhotoAnalysis';
import {
  tunedScrimAlpha,
  tuneScrims,
} from '@/features/dashboard/marketing/lib/poster/posterScrimTuning';

const LIGHT = { r: 244, g: 238, b: 230 };
const DARK = { r: 16, g: 14, b: 12 };

function analysis(luma: number, busyness: number): PhotoAnalysis {
  return {
    luma,
    contrast: 0.2,
    sharpness: 0.03,
    clipped: 0,
    zones: Array.from({ length: 9 }, () => ({ luma, busyness })),
    dHash: '0'.repeat(16),
    focal: { x: 0.5, y: 0.5 },
  };
}

describe('tunedScrimAlpha', () => {
  it('lowers a light scrim over a calm bright zone', () => {
    const a = tunedScrimAlpha({
      scrim: LIGHT,
      originalAlpha: 0.92,
      zone: { luma: 0.85, busyness: 0.02 },
    });
    expect(a).toBeLessThan(0.92);
    expect(a).toBeGreaterThanOrEqual(0.3);
  });

  it('needs more of a light scrim over a dark zone than over a bright one', () => {
    const dark = tunedScrimAlpha({
      scrim: LIGHT,
      originalAlpha: 0.95,
      zone: { luma: 0.1, busyness: 0.05 },
    });
    const bright = tunedScrimAlpha({
      scrim: LIGHT,
      originalAlpha: 0.95,
      zone: { luma: 0.85, busyness: 0.05 },
    });
    expect(dark).toBeGreaterThan(bright);
  });

  it('keeps the original over a busy mid-tone zone', () => {
    expect(
      tunedScrimAlpha({ scrim: LIGHT, originalAlpha: 0.9, zone: { luma: 0.5, busyness: 0.8 } })
    ).toBe(0.9);
  });

  it('lowers a dark scrim over a calm dark zone', () => {
    expect(
      tunedScrimAlpha({ scrim: DARK, originalAlpha: 0.9, zone: { luma: 0.1, busyness: 0.03 } })
    ).toBeLessThan(0.9);
  });

  it('never raises an alpha and ignores alphas already at the floor', () => {
    expect(
      tunedScrimAlpha({ scrim: LIGHT, originalAlpha: 0.2, zone: { luma: 0.9, busyness: 0 } })
    ).toBe(0.2);
    for (const luma of [0, 0.25, 0.5, 0.75, 1]) {
      expect(
        tunedScrimAlpha({ scrim: LIGHT, originalAlpha: 0.6, zone: { luma, busyness: 0.1 } })
      ).toBeLessThanOrEqual(0.6);
    }
  });
});

describe('tuneScrims', () => {
  const scrim = (name: string): PolotnoChild =>
    ({
      type: 'svg',
      name,
      fill: 'linear-gradient(180deg, rgba(244,238,230,0.9) 0%, rgba(244,238,230,0.81) 60%, rgba(244,238,230,0) 100%)',
    }) as unknown as PolotnoChild;

  it('scales every alpha stop together and keeps zero stops at zero', () => {
    const children = [scrim('Scrim top')];
    tuneScrims(children, analysis(0.9, 0.02));
    const fill = String(children[0]!.fill);
    const alphas = [...fill.matchAll(/,([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(alphas[0]!).toBeLessThan(0.9);
    expect(alphas[1]!).toBeLessThan(0.81);
    expect(alphas[2]).toBe(0);
    expect(alphas[1]! / alphas[0]!).toBeCloseTo(0.9, 1);
  });

  it('leaves everything alone without analysis or on a hard photo', () => {
    const none = [scrim('Scrim top')];
    const before = String(none[0]!.fill);
    tuneScrims(none, null);
    expect(String(none[0]!.fill)).toBe(before);
    const busy = [scrim('Scrim bottom')];
    tuneScrims(busy, analysis(0.5, 0.9));
    expect(String(busy[0]!.fill)).toBe(before);
  });

  it('ignores other elements and unparseable fills', () => {
    const other = [
      { type: 'svg', name: 'Hero photo', fill: 'rgba(1,2,3,0.9)' },
      { type: 'svg', name: 'Scrim top', fill: '#fff' },
    ] as unknown as PolotnoChild[];
    tuneScrims(other, analysis(0.9, 0));
    expect(other[0]!.fill).toBe('rgba(1,2,3,0.9)');
    expect(other[1]!.fill).toBe('#fff');
  });
});
