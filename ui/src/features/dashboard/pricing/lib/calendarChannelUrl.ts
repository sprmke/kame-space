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

/** Mirrors the edge `isPrivateIpLiteral` + localhost rejection. */
function isPrivateHost(host: string): boolean {
  if (!host || host === 'localhost') return true;
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
  if (host.startsWith('fc') || host.startsWith('fd')) return true; // IPv6 ULA
  if (host.startsWith('fe80:')) return true; // link-local v6
  if (host === '0.0.0.0') return true;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

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
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (isPrivateHost(host)) return 'That host is not allowed';
  if (!hostMatchesChannelSuffix(host, channel.hostSuffixes)) {
    return channel.hostSuffixes
      ? `Paste the ${channel.label} calendar link`
      : 'That host is not allowed';
  }
  // Airbnb export links look like /calendar/ical/<id>.ics — reject random Airbnb pages.
  // Only the Airbnb-family hosts are checked: the edge has no path rule, so this must not be
  // stricter than the server for any other allowlisted host.
  if (
    provider === 'airbnb' &&
    host.endsWith('airbnb.com') &&
    !/\/calendar\/ical\//i.test(parsed.pathname)
  ) {
    return 'Use the Export calendar link from Airbnb';
  }
  return null;
}
