/**
 * Pure checks for connecting a calendar feed, so every refusal is unit-tested without a database.
 * `calendar-sync-settings` `addFeed` decrypts the stored URLs, then asks this module.
 *
 * Order matters and is part of the contract: channel, rollout, URL, cap, duplicate.
 */

import { CALENDAR_FEED_LIMIT, isCalendarProvider } from './calendarChannels.ts';
import type { CalendarFeedProvider } from './calendarChannels.ts';
import { isProviderConnectable, type CalendarRolloutEnv } from './calendarChannelRollout.ts';
import {
  assertExternalIcsUrlShape,
  ExternalFetchError,
  normalizeExternalIcsUrl,
} from './calendarSyncService.ts';

export interface ExistingFeedForAdd {
  isActive: boolean;
  /** Decrypted URL, or `null` when it could not be read. */
  url: string | null;
}

export type AddFeedCheck =
  | { ok: true; provider: CalendarFeedProvider; icsUrl: string }
  | { ok: false; error: string };

export function checkAddFeed(input: {
  provider: unknown;
  organizationId: string | null | undefined;
  rawUrl: unknown;
  existing: ExistingFeedForAdd[];
  env?: CalendarRolloutEnv;
}): AddFeedCheck {
  const providerRaw = input.provider == null || input.provider === '' ? 'airbnb' : input.provider;
  if (!isCalendarProvider(providerRaw)) {
    return { ok: false, error: 'That calendar is not available yet' };
  }
  const provider = providerRaw;
  if (!isProviderConnectable(provider, input.organizationId, input.env)) {
    return { ok: false, error: 'That calendar is not available yet' };
  }

  const rawUrl = String(input.rawUrl ?? '');
  const normalized = normalizeExternalIcsUrl(rawUrl);
  if (!normalized) return { ok: false, error: 'Paste the calendar URL' };

  let icsUrl: string;
  try {
    icsUrl = assertExternalIcsUrlShape(rawUrl, provider);
  } catch (err) {
    if (err instanceof ExternalFetchError) return { ok: false, error: err.message };
    throw err;
  }

  if (input.existing.filter((f) => f.isActive).length >= CALENDAR_FEED_LIMIT) {
    return {
      ok: false,
      error: `This listing already has ${CALENDAR_FEED_LIMIT} calendars connected.`,
    };
  }

  for (const feed of input.existing) {
    if (!feed.url) continue;
    if (normalizeExternalIcsUrl(feed.url) === normalized) {
      return { ok: false, error: 'This calendar is already connected' };
    }
  }
  return { ok: true, provider, icsUrl };
}
