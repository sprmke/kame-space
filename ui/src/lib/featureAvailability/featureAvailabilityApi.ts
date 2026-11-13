import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import type { FeatureAvailabilityKey } from '@/lib/featureAvailability/featureAvailabilityCatalog';

export type FeatureAvailabilityPublicEntry = {
  key: FeatureAvailabilityKey;
  available: boolean;
  bypassed: boolean;
  reason: string | null;
  message: string;
  expectedBackAt: string | null;
  source: 'self' | 'parent' | null;
  showBanner: boolean;
  updatedAt: string | null;
};

export type FeatureAvailabilitySnapshot = {
  serverNow: string;
  entries: FeatureAvailabilityPublicEntry[];
  /** Milliseconds to add to `Date.now()` for server-aligned comparisons. */
  serverSkewMs: number;
};

export type FeatureAvailabilityPayload = {
  serverNow: string;
  entries: FeatureAvailabilityPublicEntry[];
};

/**
 * Raw payload to the snapshot the hooks read. Shared with the session bootstrap, which receives
 * the same payload inside `get-session-context` and must seed the identical shape.
 */
export function toFeatureAvailabilitySnapshot(
  data: FeatureAvailabilityPayload
): FeatureAvailabilitySnapshot {
  const serverNowMs = new Date(data.serverNow).getTime();
  const serverSkewMs = Number.isNaN(serverNowMs) ? 0 : serverNowMs - Date.now();
  return {
    serverNow: data.serverNow,
    entries: data.entries ?? [],
    serverSkewMs,
  };
}

export async function fetchFeatureAvailability(): Promise<FeatureAvailabilitySnapshot> {
  const data = await callEdgeFunction<FeatureAvailabilityPayload>('get-feature-availability');
  return toFeatureAvailabilitySnapshot(data);
}
