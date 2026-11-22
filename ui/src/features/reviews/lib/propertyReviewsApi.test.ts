import { describe, expect, it } from 'vitest';

import { parseReviewsTab } from '@/features/reviews/lib/propertyReviewsApi';

describe('parseReviewsTab', () => {
  it('keeps the three feed tabs', () => {
    expect(parseReviewsTab('received')).toBe('received');
    expect(parseReviewsTab('written')).toBe('written');
    expect(parseReviewsTab('to_write')).toBe('to_write');
  });

  it('maps legacy By property bookmarks to From guests', () => {
    expect(parseReviewsTab('properties')).toBe('received');
  });

  it('falls back to received for missing or unknown values', () => {
    expect(parseReviewsTab(null)).toBe('received');
    expect(parseReviewsTab('')).toBe('received');
    expect(parseReviewsTab('unknown')).toBe('received');
  });
});
