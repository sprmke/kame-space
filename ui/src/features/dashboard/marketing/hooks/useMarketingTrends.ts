import { useQuery } from '@tanstack/react-query';

import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

import type { MarketingTrendsResponse, TrendWindow } from '../lib/trends/trendTypes';

const FN = 'marketing-trends';

/** The list changes once a day, so the client cache can be generous. */
const STALE_TIME_MS = 30 * 60_000;
const GC_TIME_MS = 60 * 60_000;

export const MARKETING_TRENDS_QUERY_KEY = ['marketing-trends'] as const;

export const marketingTrendsKeys = {
  all: (propertyId: string | null) => [MARKETING_TRENDS_QUERY_KEY, propertyId] as const,
  window: (propertyId: string | null, window: TrendWindow) =>
    [MARKETING_TRENDS_QUERY_KEY, propertyId, window] as const,
};

async function fetchTrends(propertyId: string | null, window: TrendWindow) {
  const base = scopedFunctionsUrl(FN, propertyId);
  const params = new URLSearchParams({ window });
  const url = `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`;
  const jwt = await getSessionJwt();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) throw new Error('Could not load trends');
  const body = (await response.json()) as { success?: boolean; data?: MarketingTrendsResponse };
  if (!body.success || !body.data) throw new Error('Could not load trends');
  return body.data;
}

/**
 * The Marketing Trends list for one window.
 *
 * `enabled` stays false until the rail is on screen or the sheet is open, so
 * opening Marketing on another tab never fetches the list.
 */
export function useMarketingTrends(window: TrendWindow, enabled = true) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: marketingTrendsKeys.window(propertyId, window),
    queryFn: () => fetchTrends(propertyId, window),
    enabled: enabled && Boolean(propertyId),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
