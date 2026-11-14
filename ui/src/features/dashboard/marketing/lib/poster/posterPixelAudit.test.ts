import { describe, expect, it } from 'vitest';

import {
  auditRenderedPixels,
  backgroundLuminance,
  contrastRatio,
  detectErrorPlaceholder,
  parseHexColor,
  relativeLuminance,
} from '@/features/dashboard/marketing/lib/poster/posterPixelAudit';

function solid(width: number, height: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data.set([...rgb, 255], i * 4);
  }
  return { width, height, data };
}

describe('contrast maths', () => {
  it('matches the WCAG extremes', () => {
    const white = relativeLuminance(255, 255, 255);
    const black = relativeLuminance(0, 0, 0);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 0);
    expect(contrastRatio(white, white)).toBe(1);
  });

  it('parses hex colours and rejects junk', () => {
    expect(parseHexColor('#ff8000')).toEqual([255, 128, 0]);
    expect(parseHexColor('red')).toBeNull();
  });
});

describe('detectErrorPlaceholder', () => {
  it('flags a mostly red frame', () => {
    expect(detectErrorPlaceholder(solid(20, 20, [220, 30, 30]))).toBe(true);
  });

  it('passes a normal photo tone', () => {
    expect(detectErrorPlaceholder(solid(20, 20, [120, 140, 150]))).toBe(false);
  });

  it('ignores an empty bitmap', () => {
    expect(detectErrorPlaceholder({ width: 0, height: 0, data: [] })).toBe(false);
  });
});

describe('backgroundLuminance', () => {
  it('uses the median so glyph pixels do not skew the surface', () => {
    const bitmap = solid(10, 10, [255, 255, 255]);
    for (let i = 0; i < 10; i += 1) bitmap.data.set([0, 0, 0, 255], i * 4);
    const luma = backgroundLuminance(bitmap, { name: 't', x: 0, y: 0, width: 10, height: 10 });
    expect(luma).toBeCloseTo(1, 1);
  });

  it('returns null for a box outside the image', () => {
    expect(
      backgroundLuminance(solid(4, 4, [0, 0, 0]), { name: 't', x: 10, y: 10, width: 2, height: 2 })
    ).toBeNull();
  });
});

describe('auditRenderedPixels', () => {
  const box = { name: 'headline', x: 20, y: 20, width: 60, height: 20, fontSize: 40 };

  it('flags white text on a light background', () => {
    const issues = auditRenderedPixels(solid(100, 100, [240, 240, 240]), [
      { ...box, color: '#ffffff' },
    ]);
    expect(issues.map((issue) => issue.kind)).toContain('low-contrast');
  });

  it('passes dark text on a light background', () => {
    expect(
      auditRenderedPixels(solid(100, 100, [240, 240, 240]), [{ ...box, color: '#111111' }])
    ).toEqual([]);
  });

  it('flags text crowding the edge', () => {
    const issues = auditRenderedPixels(solid(100, 100, [20, 20, 20]), [
      { ...box, x: 0, color: '#ffffff' },
    ]);
    expect(issues.map((issue) => issue.kind)).toEqual(['edge-crowding']);
  });

  it('reports a placeholder first', () => {
    const issues = auditRenderedPixels(solid(50, 50, [220, 20, 20]), []);
    expect(issues[0]?.kind).toBe('error-placeholder');
  });
});
