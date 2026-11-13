/**
 * Marketing Trends — client API.
 *
 * One read endpoint. The client sends a window and gets back the list, the date
 * it was built and whether it is stale. The URL lives here so the hook stays a
 * thin query wrapper, matching the other marketing API modules.
 */

import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

import type { MarketingTrendsResponse, TrendWindow } from './trendTypes';

const FN = 'marketing-trends';

/** The full URL the trends read endpoint expects. */
export function trendsUrl(propertyId: string | null, window: TrendWindow): string {
  const base = scopedFunctionsUrl(FN, propertyId);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${new URLSearchParams({ window }).toString()}`;
}

/**
 * Read one window of the list.
 *
 * Throws on a non-2xx or an envelope without `data`, so TanStack Query retries and
 * the rail falls back to the bundled seasonal ideas instead of rendering nothing.
 */
export async function fetchMarketingTrends(
  propertyId: string | null,
  window: TrendWindow
): Promise<MarketingTrendsResponse> {
  const jwt = await getSessionJwt();
  const response = await fetch(trendsUrl(propertyId, window), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) throw new Error('Could not load trends');

  const body = (await response.json()) as {
    success?: boolean;
    data?: MarketingTrendsResponse;
  };
  if (!body.success || !body.data) throw new Error('Could not load trends');
  return body.data;
}
