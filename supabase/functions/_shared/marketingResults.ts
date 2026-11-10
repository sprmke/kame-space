/**
 * Marketing results for Analytics: tracked visits and attributed booking requests, by channel.
 *
 * Attribution is first-touch and campaign-code based, so these numbers are directional: they
 * undercount Instagram (link in bio) and manual posts. The card says "at least".
 */

import { createServiceClient } from './orgAuth.ts';

export type MarketingChannelResult = {
  channel: string;
  visits: number;
  requests: number;
};

export type MarketingResults = {
  trackedVisits: number;
  attributedRequests: number;
  channels: MarketingChannelResult[];
};

export const EMPTY_MARKETING_RESULTS: MarketingResults = {
  trackedVisits: 0,
  attributedRequests: 0,
  channels: [],
};

export type TrackedVisitRow = { utm_source?: string | null };
export type AttributedRequestRow = { attribution?: { utmSource?: string | null } | null };

const UNKNOWN_CHANNEL = 'other';

/** Pure aggregation, so the shape is unit-tested without a database. */
export function summarizeMarketingResults(
  visits: readonly TrackedVisitRow[],
  requests: readonly AttributedRequestRow[]
): MarketingResults {
  const byChannel = new Map<string, { visits: number; requests: number }>();
  const bump = (channel: string, key: 'visits' | 'requests') => {
    const bucket = byChannel.get(channel) ?? { visits: 0, requests: 0 };
    bucket[key] += 1;
    byChannel.set(channel, bucket);
  };

  for (const visit of visits) {
    const channel = visit.utm_source?.trim() || UNKNOWN_CHANNEL;
    bump(channel, 'visits');
  }
  for (const request of requests) {
    const channel = request.attribution?.utmSource?.trim() || UNKNOWN_CHANNEL;
    bump(channel, 'requests');
  }

  const channels = [...byChannel.entries()]
    .map(([channel, counts]) => ({ channel, ...counts }))
    .sort((a, b) => b.visits + b.requests - (a.visits + a.requests))
    .slice(0, 8);

  return {
    trackedVisits: visits.length,
    attributedRequests: requests.length,
    channels,
  };
}

export function rangeBounds(from: string, to: string): { fromIso: string; toIso: string } {
  return { fromIso: `${from}T00:00:00+08:00`, toIso: `${to}T23:59:59+08:00` };
}

/**
 * Load both halves in one pass. A failing query degrades that half to zero rather than
 * breaking the Analytics response.
 */
export async function computeMarketingResults(input: {
  propertyId: string;
  from: string;
  to: string;
}): Promise<MarketingResults> {
  const { fromIso, toIso } = rangeBounds(input.from, input.to);
  const supabase = createServiceClient();

  const [viewsResult, requestsResult] = await Promise.all([
    supabase
      .from('property_page_views')
      .select('utm_source, utm_campaign')
      .eq('property_id', input.propertyId)
      .gte('viewed_at', fromIso)
      .lte('viewed_at', toIso)
      .like('utm_campaign', 'ks-%')
      .limit(5000),
    supabase
      .from('guest_submissions')
      .select('attribution')
      .eq('property_id', input.propertyId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .not('attribution', 'is', null)
      .limit(2000),
  ]);

  if (viewsResult.error) {
    console.error('[marketingResults] views:', viewsResult.error.message);
  }
  if (requestsResult.error) {
    console.error('[marketingResults] requests:', requestsResult.error.message);
  }

  return summarizeMarketingResults(
    (viewsResult.data ?? []) as TrackedVisitRow[],
    (requestsResult.data ?? []) as AttributedRequestRow[]
  );
}
