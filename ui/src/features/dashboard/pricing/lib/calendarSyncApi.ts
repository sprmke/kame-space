import { validateChannelCalendarUrl } from './calendarChannelUrl';
import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import { throwIfFeatureUnavailableBody } from '@/lib/featureAvailability/featureUnavailableError';

import { supabase } from '@/lib/supabase/client';

import type { CalendarFeedProvider } from './calendarChannels';

export type { CalendarFeedProvider };

export const CALENDAR_PROVIDER_LABELS: Record<CalendarFeedProvider, string> = {
  airbnb: 'Airbnb',
  agoda: 'Agoda',
  booking_com: 'Booking.com',
};

export type CalendarSyncFeed = {
  id: string;
  provider: CalendarFeedProvider;
  label: string | null;
  isActive: boolean;
  createBookings: boolean;
  maskedUrl: string;
  hasUrl: boolean;
  health: 'ok' | 'warning' | 'error';
  lastAttemptedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  createdAt: string;
  /** Booking.com closed-dates warning (`echo_warning_at`). */
  echoWarning?: boolean;
  /** The channel has not read our export link after 24 h (`export_never_read_at`). */
  exportNeverRead?: boolean;
  lastRun?: {
    status: string;
    duration_ms: number;
    error_code: string | null;
    started_at: string;
  } | null;
};

export type CalendarSyncEvent = {
  id: number;
  feed_id: string;
  action: string;
  external_uid: string | null;
  start_date: string | null;
  end_date: string | null;
  summary: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type CalendarSyncExport = {
  enabled: boolean;
  rotatedAt: string | null;
  lastServedAt: string | null;
  /** Most recent read of our export link per channel (200 and 304), keyed by channel or `all`. */
  reads?: Record<string, { lastReadAt: string; readCount: number }>;
  urls: { all: string; airbnb: string; agoda: string; booking_com: string };
};

export type CalendarSyncSettings = {
  feeds: CalendarSyncFeed[];
  export: CalendarSyncExport;
  recentEvents: CalendarSyncEvent[];
  /** Providers this org may connect today (Airbnb always; others per rollout). */
  connectableProviders?: CalendarFeedProvider[];
};

export type FeedSyncResult = {
  feedId: string;
  status: string;
  ok: boolean;
  blocksCreated: number;
  blocksUpdated: number;
  blocksRemoved: number;
  bookingsCreated: number;
  bookingsUpdated: number;
  bookingsCancelled: number;
  bookingsLinked: number;
  conflicts: number;
  error?: string;
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function url(propertyId: string): string {
  return scopedFunctionsUrl('/calendar-sync-settings', propertyId);
}

export type CalendarSyncClientError = Error & {
  upgradeRequired?: boolean;
  feature?: PlanFeatureKey;
};

async function parse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (json?.upgradeHook) {
    const err = new Error(json?.error ?? 'Upgrade required') as CalendarSyncClientError;
    err.upgradeRequired = true;
    if (typeof json?.feature === 'string') err.feature = json.feature as PlanFeatureKey;
    throw err;
  }
  if (!res.ok || json?.success === false) {
    throwIfFeatureUnavailableBody(json);
    throw new Error(json?.error ?? json?.message ?? 'Request failed');
  }
  return (json.data ?? json) as T;
}

export async function fetchCalendarSyncSettings(propertyId: string): Promise<CalendarSyncSettings> {
  const res = await fetch(url(propertyId), { headers: await authHeaders() });
  return parse<CalendarSyncSettings>(res);
}

async function patch<T>(propertyId: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url(propertyId), {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return parse<T>(res);
}

export function addCalendarFeed(
  propertyId: string,
  input: {
    provider: CalendarFeedProvider;
    label?: string;
    icsUrl: string;
    /** Defaults from the channel registry when omitted (Airbnb on, Agoda / Booking.com off). */
    createBookings?: boolean;
  }
) {
  return patch<{ feed: unknown; initialSync?: FeedSyncResult | null }>(propertyId, {
    action: 'addFeed',
    ...input,
    icsUrl: input.icsUrl.trim(),
  });
}

export function updateCalendarFeed(
  propertyId: string,
  input: {
    feedId: string;
    label?: string;
    icsUrl?: string;
    isActive?: boolean;
    createBookings?: boolean;
  }
) {
  return patch<{ feed: unknown; sync?: FeedSyncResult | null }>(propertyId, {
    action: 'updateFeed',
    ...input,
  });
}

export function removeCalendarFeed(propertyId: string, feedId: string, deleteData: boolean) {
  return patch<{ removed: string }>(propertyId, { action: 'removeFeed', feedId, deleteData });
}

export function setExportEnabled(propertyId: string, enabled: boolean) {
  return patch<{ enabled: boolean }>(propertyId, { action: 'setExportEnabled', enabled });
}

export function syncFeedNow(propertyId: string, feedId: string) {
  return patch<{ result: FeedSyncResult }>(propertyId, { action: 'syncNow', feedId });
}

export const CALENDAR_SYNC_QUERY_KEY = 'calendar-sync';

export { validateChannelCalendarUrl } from './calendarChannelUrl';

/** Airbnb-only alias kept for callers that predate the channel registry. */
export function validateAirbnbCalendarUrl(rawUrl: string): string | null {
  return validateChannelCalendarUrl('airbnb', rawUrl);
}
