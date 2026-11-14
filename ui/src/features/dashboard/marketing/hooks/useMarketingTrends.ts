import { useQuery } from '@tanstack/react-query';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { fetchMarketingTrends } from '../lib/trends/trendsApi';
import type { TrendWindow } from '../lib/trends/trendTypes';

/** The list is rebuilt once a day, so the client cache can be generous. */
const STALE_TIME_MS = 30 * 60_000;
const GC_TIME_MS = 60 * 60_000;

export const MARKETING_TRENDS_QUERY_KEY = ['marketing-trends'] as const;

export const marketingTrendsKeys = {
  all: (propertyId: string | null) => [MARKETING_TRENDS_QUERY_KEY, propertyId] as const,
  window: (propertyId: string | null, window: TrendWindow) =>
    [MARKETING_TRENDS_QUERY_KEY, propertyId, window] as const,
};

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
    queryFn: () => fetchMarketingTrends(propertyId, window),
    enabled: enabled && Boolean(propertyId),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
