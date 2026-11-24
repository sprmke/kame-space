import { describe, expect, it } from 'vitest';

import type { OrgPropertyReviewRow } from '@/features/reviews/lib/orgReviewsApi';
import { summarizeListingRows } from '@/features/reviews/lib/reviewsOrgSummary';

function row(overrides: Partial<OrgPropertyReviewRow>): OrgPropertyReviewRow {
  return {
    propertyId: 'property-1',
    propertySlug: 'listing-1',
    propertyName: 'Listing 1',
    count: 0,
    avgOverall: null,
    responseRate: 0,
    dueCount: 0,
    ...overrides,
  };
}

describe('summarizeListingRows', () => {
  it('returns null with no listings', () => {
    expect(summarizeListingRows([])).toBeNull();
  });

  it('weights the average by published review count', () => {
    const summary = summarizeListingRows([
      row({ propertyId: 'a', count: 3, avgOverall: 5, responseRate: 1, dueCount: 1 }),
      row({ propertyId: 'b', count: 1, avgOverall: 1, responseRate: 0, dueCount: 2 }),
    ]);

    expect(summary).not.toBeNull();
    expect(summary!.count).toBe(4);
    // (5*3 + 1*1) / 4
    expect(summary!.avgOverall).toBeCloseTo(4, 5);
    expect(summary!.responseRate).toBeCloseTo(0.75, 5);
    expect(summary!.dueCount).toBe(3);
  });

  it('ignores a listing with no reviews when averaging', () => {
    const summary = summarizeListingRows([
      row({ propertyId: 'a', count: 2, avgOverall: 4, responseRate: 0.5 }),
      row({ propertyId: 'b', count: 0, avgOverall: null, responseRate: 0 }),
    ]);

    expect(summary!.count).toBe(2);
    expect(summary!.avgOverall).toBe(4);
    expect(summary!.responseRate).toBeCloseTo(0.5, 5);
  });

  it('reports a dash-worthy average when nothing is rated', () => {
    const summary = summarizeListingRows([
      row({ propertyId: 'a', count: 0, avgOverall: null }),
      row({ propertyId: 'b', count: 0, avgOverall: null }),
    ]);

    expect(summary!.count).toBe(0);
    expect(summary!.avgOverall).toBeNull();
    expect(summary!.responseRate).toBe(0);
  });
});
