/**
 * Client-side calendar URL check, mirroring the edge shape rules
 * (`calendarSyncService#assertExternalIcsUrlShape` + the channel registry host suffixes).
 * Pure module so it is unit-tested without the Supabase client.
 */

import {
  calendarChannel,
  hostMatchesChannelSuffix,
  type CalendarFeedProvider,
} from './calendarChannels';

/** Returns an error message, or `null` when the URL is valid for that channel. */
/**
 * Client-side calendar URL check for any registered channel, mirroring the edge shape rules
 * (`calendarSyncService#assertExternalIcsUrlShape` + `calendarChannels` host suffixes).
 * Returns an error message, or `null` when the URL is valid.
 */
export function validateChannelCalendarUrl(
  provider: CalendarFeedProvider,
  rawUrl: string
): string | null {
  const channel = calendarChannel(provider);
  const trimmed = rawUrl.trim();
  if (!trimmed) return 'Required';

  const normalized = /^webcal:\/\//i.test(trimmed)
    ? `https://${trimmed.slice('webcal://'.length)}`
    : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return 'Enter a valid URL';
  }

  if (parsed.protocol !== 'https:') return 'URL must start with https://';
  if (parsed.username || parsed.password) return 'URL must not contain credentials';
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '::1') {
    return 'That host is not allowed';
  }
  if (!hostMatchesChannelSuffix(host, channel.hostSuffixes)) {
    return channel.hostSuffixes
      ? `Paste the ${channel.label} calendar link`
      : 'That host is not allowed';
  }
  // Airbnb export links look like /calendar/ical/<id>.ics — reject random Airbnb pages.
  if (provider === 'airbnb' && !/\/calendar\/ical\//i.test(parsed.pathname)) {
    return 'Use the Export calendar link from Airbnb';
  }
  return null;
}
