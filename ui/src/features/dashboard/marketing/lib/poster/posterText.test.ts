import { afterEach, describe, expect, it } from 'vitest';

import type { PosterTypeRole } from '@/features/dashboard/marketing/lib/poster/posterFonts';
import {
  estimateTextWidth,
  fitText,
  setPosterTextMeasurer,
  wrapBalanced,
} from '@/features/dashboard/marketing/lib/poster/posterText';

const ROLE: PosterTypeRole = {
  family: 'Poppins',
  weight: '400',
  letterSpacing: 0,
  lineHeight: 1.2,
  widthFactor: 0.6,
};

afterEach(() => {
  setPosterTextMeasurer(null);
});

describe('estimateTextWidth', () => {
  it('is zero for empty text', () => {
    expect(estimateTextWidth('', ROLE, 10)).toBe(0);
  });

  it('counts glyphs by width factor and spaces by the space factor', () => {
    expect(estimateTextWidth('abc', ROLE, 10)).toBe(18);
    expect(estimateTextWidth('a b', ROLE, 10)).toBeCloseTo(15, 5);
  });

  it('adds tracking between characters', () => {
    const tracked: PosterTypeRole = { ...ROLE, letterSpacing: 0.1 };
    expect(estimateTextWidth('abc', tracked, 10)).toBeCloseTo(18 + 0.2 * 10, 5);
  });

  it('prefers a real measurer, and falls back when it cannot measure', () => {
    setPosterTextMeasurer(() => 123);
    expect(estimateTextWidth('abc', ROLE, 10)).toBe(123);

    setPosterTextMeasurer(() => null);
    expect(estimateTextWidth('abc', ROLE, 10)).toBe(18);

    setPosterTextMeasurer(() => Number.NaN);
    expect(estimateTextWidth('abc', ROLE, 10)).toBe(18);
  });
});

describe('wrapBalanced', () => {
  it('returns nothing for blank text', () => {
    expect(wrapBalanced('   ', ROLE, 10, 100)).toEqual([]);
  });

  it('keeps text on one line when it fits', () => {
    expect(wrapBalanced('Sunset Villa', ROLE, 10, 200)).toEqual(['Sunset Villa']);
  });

  it('wraps to the fewest lines the width allows, keeping every word', () => {
    const lines = wrapBalanced('Sunset Villa By The Sea', ROLE, 10, 120);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('Sunset Villa By The Sea');
  });

  it('splits a two-word headline evenly rather than stranding the last word', () => {
    expect(wrapBalanced('Sunset Villa', ROLE, 10, 40)).toEqual(['Sunset', 'Villa']);
  });
});

describe('fitText', () => {
  it('uses the largest size that fits', () => {
    const result = fitText('Hello World', ROLE, {
      maxWidth: 200,
      maxFontSize: 40,
      minFontSize: 10,
      maxLines: 1,
    });

    expect(result.overflow).toBe(false);
    expect(result.fontSize).toBeLessThanOrEqual(40);
    expect(result.width).toBeLessThanOrEqual(200);
    expect(result.lines).toEqual(['Hello World']);
  });

  it('normalises whitespace before measuring', () => {
    const result = fitText('  Sunset   Villa  ', ROLE, {
      maxWidth: 500,
      maxFontSize: 20,
      minFontSize: 10,
      maxLines: 1,
    });

    expect(result.lines.join(' ')).toBe('Sunset Villa');
  });

  it('reports overflow at the minimum size when the box cannot hold the text', () => {
    const result = fitText('An extremely long headline that cannot fit', ROLE, {
      maxWidth: 20,
      maxFontSize: 40,
      minFontSize: 10,
      maxLines: 1,
    });

    expect(result.overflow).toBe(true);
    expect(result.fontSize).toBe(10);
  });

  it('respects a maximum height', () => {
    const result = fitText('Two lines please', ROLE, {
      maxWidth: 60,
      maxFontSize: 30,
      minFontSize: 12,
      maxLines: 3,
      maxHeight: 1,
    });

    expect(result.overflow).toBe(true);
  });

  it('never goes below the minimum size, even if the minimum exceeds the maximum', () => {
    const result = fitText('Hi', ROLE, {
      maxWidth: 1000,
      maxFontSize: 10,
      minFontSize: 40,
      maxLines: 1,
    });

    expect(result.fontSize).toBeLessThanOrEqual(40);
  });
});
