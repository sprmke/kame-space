import { describe, expect, it } from 'vitest';

import { resolveReviewsListLoadState } from '@/features/reviews/lib/reviewsListLoadState';

const base = {
  tab: 'received' as const,
  dataTab: undefined,
  isLoading: false,
  isFetching: false,
  hasActiveQuery: false,
  summary: { count: 10, dueCount: 2 },
  listingCount: 1,
};

function state(overrides: Partial<Parameters<typeof resolveReviewsListLoadState>[0]>) {
  return resolveReviewsListLoadState({ ...base, ...overrides });
}

describe('resolveReviewsListLoadState', () => {
  it('shows the list skeleton on first load', () => {
    expect(state({ isLoading: true })).toBe('skeleton');
  });

  it('keeps cached rows during a same-tab refetch', () => {
    expect(state({ dataTab: 'received', isFetching: true })).toBe('ready');
  });

  it('shows the destination tab skeleton while the previous tab is still cached', () => {
    expect(state({ tab: 'written', dataTab: 'received', isFetching: true })).toBe('skeleton');
  });

  it('uses the quiet empty skeleton when To write is known to be zero', () => {
    expect(
      state({
        tab: 'to_write',
        dataTab: 'received',
        isFetching: true,
        summary: { count: 10, dueCount: 0 },
      })
    ).toBe('empty-skeleton');
  });

  it('uses the quiet empty skeleton for a received tab with no published reviews', () => {
    expect(
      state({
        tab: 'received',
        dataTab: 'to_write',
        isFetching: true,
        summary: { count: 0, dueCount: 0 },
      })
    ).toBe('empty-skeleton');
  });

  it('uses the quiet empty skeleton when an org has no listings', () => {
    expect(
      state({ tab: 'properties', dataTab: 'received', isFetching: true, listingCount: 0 })
    ).toBe('empty-skeleton');
  });

  it('keeps row skeletons while a filter could still return rows', () => {
    expect(
      state({
        tab: 'to_write',
        dataTab: 'received',
        isFetching: true,
        hasActiveQuery: true,
        summary: { count: 10, dueCount: 0 },
      })
    ).toBe('skeleton');
  });

  it('falls back to rows when the written count is unknown', () => {
    expect(state({ tab: 'written', dataTab: 'received', isFetching: true })).toBe('skeleton');
  });
});
