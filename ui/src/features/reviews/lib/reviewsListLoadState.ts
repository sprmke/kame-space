/**
 * Reviews list loading state — keeps the skeleton aligned with the active tab
 * instead of showing the previous tab's rows or a generic table.
 */

import type { ReviewsPageTab } from '@/features/reviews/lib/propertyReviewsApi';

export type ReviewsListLoadState = 'skeleton' | 'empty-skeleton' | 'ready';

type LoadInput = {
  tab: ReviewsPageTab;
  /** Tab of the response currently held in cache (placeholder) — undefined on first load. */
  dataTab: ReviewsPageTab | undefined;
  isLoading: boolean;
  isFetching: boolean;
  hasActiveQuery: boolean;
  summary: { count: number; dueCount: number } | undefined;
  listingCount: number;
};

export function resolveReviewsListLoadState({
  tab,
  dataTab,
  isLoading,
  isFetching,
  hasActiveQuery,
  summary,
  listingCount,
}: LoadInput): ReviewsListLoadState {
  const tabMismatch = Boolean(dataTab && dataTab !== tab);
  const loading = isLoading || (tabMismatch && isFetching);
  if (!loading) return 'ready';

  if (hasActiveQuery || !summary) return 'skeleton';

  const knownEmpty =
    (tab === 'received' && summary.count === 0) ||
    (tab === 'to_write' && summary.dueCount === 0) ||
    (tab === 'properties' && listingCount === 0);

  return knownEmpty ? 'empty-skeleton' : 'skeleton';
}
