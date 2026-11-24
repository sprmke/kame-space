import type { OrgPropertyReviewRow } from '@/features/reviews/lib/orgReviewsApi';
import type { PropertyReviewSummary } from '@/features/reviews/lib/propertyReviewsApi';

export type ListingRollup = Pick<
  PropertyReviewSummary,
  'count' | 'avgOverall' | 'responseRate' | 'dueCount'
>;

/**
 * Headline numbers for a subset of listings, weighted by published review count.
 *
 * The org endpoint returns org-wide totals plus one row per listing. When the listing filter
 * narrows the feed, the KPI cards are rebuilt from those rows so they describe what the host
 * is looking at instead of the whole portfolio. The rating is weighted only across listings
 * that actually have reviews; a listing with no reviews must not drag the average toward 0.
 */
export function summarizeListingRows(rows: OrgPropertyReviewRow[]): ListingRollup | null {
  if (rows.length === 0) return null;

  const count = rows.reduce((total, row) => total + row.count, 0);
  const rated = rows.filter((row) => row.avgOverall != null && row.count > 0);
  const ratedCount = rated.reduce((total, row) => total + row.count, 0);
  const weightedRating = rated.reduce((total, row) => total + (row.avgOverall ?? 0) * row.count, 0);
  const weightedResponse = rows.reduce((total, row) => total + row.responseRate * row.count, 0);

  return {
    count,
    avgOverall: ratedCount > 0 ? weightedRating / ratedCount : null,
    responseRate: count > 0 ? weightedResponse / count : 0,
    dueCount: rows.reduce((total, row) => total + row.dueCount, 0),
  };
}
