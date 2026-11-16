/**
 * View model for the multi-channel Channel sync dialog. Pure, so every state is unit-tested
 * without rendering. Copy follows `human-copy`: short, plain, no em dashes.
 *
 * Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §7.1
 */

import type { CalendarFeedProvider } from './calendarChannels';
import type { CalendarSyncFeed, CalendarSyncSettings } from './calendarSyncApi';

/** Every channel Kame Space supports. */
export const DIALOG_CHANNELS = ['airbnb', 'agoda', 'booking_com'] as const;
export type DialogChannel = (typeof DIALOG_CHANNELS)[number];

export function isDialogChannel(provider: string): provider is DialogChannel {
  return (DIALOG_CHANNELS as readonly string[]).includes(provider);
}

export interface ChannelCopy {
  label: string;
  /** Shown in the ? next to "From {channel}": where to find the link, and any eligibility limit. */
  importHelp: string;
  importPlaceholder: string;
  /** Shown in the ? next to "To {channel}": where to paste our link. */
  exportHelp: string;
  /** Shown in the ? next to Create bookings. */
  createBookingsHelp: string;
}

export const CHANNEL_COPY: Record<DialogChannel, ChannelCopy> = {
  airbnb: {
    label: 'Airbnb',
    importHelp:
      'In Airbnb, open Calendar, Availability, Connect calendars, then Export calendar. Copy the link.',
    importPlaceholder: 'https://www.airbnb.com/calendar/ical/…',
    exportHelp:
      'In Airbnb, open Connect calendars, then Import calendar. Paste this link and save. Airbnb refreshes every few hours.',
    createBookingsHelp:
      'Each reservation becomes a Pending review booking. Dates block either way.',
  },
  agoda: {
    label: 'Agoda',
    importHelp:
      'In Agoda, open Calendar, then Calendar connections. Copy your calendar link. Agoda only offers links for room types with exactly 1 room.',
    importPlaceholder: 'https://…agoda.com/…',
    exportHelp:
      'In Agoda Calendar connections, paste this link under Other website link and tap Import.',
    createBookingsHelp:
      'Closed dates can look like stays in Agoda. Turn this on only if you never close dates there.',
  },
  booking_com: {
    label: 'Booking.com',
    importHelp:
      'In Booking.com, open Rates & Availability, then Sync calendars. Export reserved dates only and copy the link. Links are off while a channel manager is connected.',
    importPlaceholder: 'https://ical.booking.com/…',
    exportHelp: 'In Sync calendars, tap Add calendar connection and paste this link.',
    createBookingsHelp:
      'Closed dates look like stays in Booking.com. Turn this on only if you never close dates there.',
  },
};

export type ChannelStatus = 'not_connected' | 'syncing' | 'needs_attention' | 'paused';

export const CHANNEL_STATUS_LABEL: Record<ChannelStatus, string> = {
  not_connected: 'Not connected',
  syncing: 'Connected',
  needs_attention: 'Needs attention',
  paused: 'Paused',
};

export interface ChannelWarning {
  kind: 'feed_error' | 'never_read' | 'echo';
  message: string;
}

export interface ChannelRow {
  provider: DialogChannel;
  label: string;
  feeds: CalendarSyncFeed[];
  status: ChannelStatus;
  /** Most recent successful import across this channel's feeds. */
  lastImportAt: string | null;
  /** When the channel last read our export link, if it ever did. */
  lastReadAt: string | null;
  warnings: ChannelWarning[];
  /** Host may add a feed for this channel right now. */
  connectable: boolean;
}

function latest(values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (v && (!best || v > best)) best = v;
  }
  return best;
}

export function channelWarnings(
  provider: DialogChannel,
  feeds: CalendarSyncFeed[],
  exportEnabled: boolean
): ChannelWarning[] {
  const label = CHANNEL_COPY[provider].label;
  const out: ChannelWarning[] = [];
  if (feeds.some((f) => f.isActive && f.health === 'error')) {
    out.push({
      kind: 'feed_error',
      message: `${label} link is failing. Paste a fresh one.`,
    });
  }
  if (exportEnabled && feeds.some((f) => f.isActive && f.exportNeverRead)) {
    out.push({
      kind: 'never_read',
      message: `${label} hasn't read your link yet.`,
    });
  }
  if (provider === 'booking_com' && feeds.some((f) => f.isActive && f.echoWarning)) {
    out.push({
      kind: 'echo',
      message: 'Booking.com is sending back closed dates. Export reserved dates only.',
    });
  }
  return out;
}

export function buildChannelRows(
  settings: Pick<CalendarSyncSettings, 'feeds' | 'export' | 'connectableProviders'> | undefined,
  paused: Partial<Record<DialogChannel, boolean>> = {}
): ChannelRow[] {
  const feeds = settings?.feeds ?? [];
  // Older servers omit the list: they only ever connected Airbnb.
  const connectable = new Set<CalendarFeedProvider>(settings?.connectableProviders ?? ['airbnb']);
  const reads = settings?.export?.reads ?? {};
  const exportEnabled = settings?.export?.enabled ?? false;

  const rows: ChannelRow[] = [];
  for (const provider of DIALOG_CHANNELS) {
    const channelFeeds = feeds.filter((f) => f.provider === provider);
    const canConnect = connectable.has(provider);
    // Hide a channel that is not rolled out to this org and has nothing connected.
    if (!canConnect && channelFeeds.length === 0) continue;

    const warnings = channelWarnings(provider, channelFeeds, exportEnabled);
    const active = channelFeeds.filter((f) => f.isActive);
    let status: ChannelStatus;
    if (paused[provider]) status = 'paused';
    else if (active.length === 0) status = 'not_connected';
    else if (warnings.length > 0) status = 'needs_attention';
    else status = 'syncing';

    rows.push({
      provider,
      label: CHANNEL_COPY[provider].label,
      feeds: channelFeeds,
      status,
      lastImportAt: latest(channelFeeds.map((f) => f.lastSuccessAt)),
      lastReadAt: reads[provider]?.lastReadAt ?? null,
      warnings,
      connectable: canConnect,
    });
  }
  return rows;
}

/** The hub checklist matters once two or more channels are connected. */
export function showHubChecklist(rows: ChannelRow[]): boolean {
  return rows.filter((r) => r.feeds.some((f) => f.isActive)).length >= 2;
}

/** Shown once two or more channels are connected. */
export const HUB_TIP = 'Connect each channel to Kame Space only, not to each other.';
