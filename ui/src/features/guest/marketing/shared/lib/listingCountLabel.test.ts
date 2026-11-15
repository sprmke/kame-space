import { describe, expect, it } from 'vitest';

import { formatListingCount } from './listingCountLabel';

describe('formatListingCount', () => {
  it('uses the singular for exactly one', () => {
    expect(formatListingCount(1, 'property', 'properties')).toBe('1 property');
  });

  it('uses the plural for zero and many, with grouping', () => {
    expect(formatListingCount(0, 'slot', 'slots')).toBe('0 slots');
    expect(formatListingCount(1240, 'property', 'properties')).toBe('1,240 properties');
  });

  it('clamps bad input to zero', () => {
    expect(formatListingCount(Number.NaN, 'home', 'homes')).toBe('0 homes');
    expect(formatListingCount(-3, 'home', 'homes')).toBe('0 homes');
  });
});
