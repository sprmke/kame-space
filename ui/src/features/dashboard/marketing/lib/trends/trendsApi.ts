/**
 * Marketing Trends — client API.
 *
 * One read endpoint. The client sends a window and gets back the list, the
 * date it was built and whether it is stale.
 */

import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';

import type { MarketingTrendsResponse, TrendWindow } from './trendTypes';

const FN = 'marketing-trends';

/** The read endpoint. `propertyId` scopes the request to the current property. */
export function trendsUrl(propertyId: string | null, window: TrendWindow): string {
  const base = scopedFunctionsUrl(FN, propertyId);
  const params = new URLSearchParams({ window });
  return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`;
}

/** True when the payload says Trends are turned off for this property. */
export function isTrendsDisabled(payload: MarketingTrendsResponse | null | undefined): boolean {
  return payload?.disabled === true;
}
