import { describe, expect, it } from 'vitest';

import { starFillRatio, spokenRating } from './ratingFill';

describe('starFillRatio', () => {
  it('fills whole stars for a whole rating', () => {
    expect(starFillRatio(4, 1)).toBe(1);
    expect(starFillRatio(4, 4)).toBe(1);
    expect(starFillRatio(4, 5)).toBe(0);
  });

  it('fills the fractional star instead of rounding up', () => {
    expect(starFillRatio(3.6, 4)).toBeCloseTo(0.6, 5);
    expect(starFillRatio(4.5, 5)).toBeCloseTo(0.5, 5);
    expect(starFillRatio(0.25, 1)).toBeCloseTo(0.25, 5);
  });

  it('treats an empty or missing rating as zero', () => {
    expect(starFillRatio(0, 1)).toBe(0);
    expect(starFillRatio(Number.NaN, 1)).toBe(0);
  });

  it('clamps out of range values', () => {
    expect(starFillRatio(9, 1)).toBe(1);
    expect(starFillRatio(-2, 3)).toBe(0);
  });
});

describe('spokenRating', () => {
  it('keeps whole numbers clean', () => {
    expect(spokenRating(5)).toBe('5');
    expect(spokenRating(0)).toBe('0');
  });

  it('keeps one decimal for averages', () => {
    expect(spokenRating(3.6)).toBe('3.6');
    expect(spokenRating(4.5)).toBe('4.5');
    expect(spokenRating(3.456)).toBe('3.5');
  });
});
