/**
 * View model for the multi-channel Channel sync dialog. Pure, so every state is unit-tested
 * without rendering. Copy follows `human-copy`: short, plain, no em dashes.
 *
 * Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §7.1
 */

import type { CalendarFeedProvider } from './calendarChannels';
import type { CalendarSyncFeed, CalendarSyncSettings } from './calendarSyncApi';

/** Channels the dialog can show. Vrbo and "Other" stay off the UI until hosts ask. */
export const DIALOG_CHANNELS = ['airbnb', 'agoda', 'booking_com'] as const;
export type DialogChannel = (typeof DIALOG_CHANNELS)[number];

export function isDialogChannel(provider: string): provider is DialogChannel {
  return (DIALOG_CHANNELS as readonly string[]).includes(provider);
}

export interface ChannelCopy {
  label: string;
  /** Step 1: bring the channel's dates into Kame Space. */
  importStep: string;
  importPlaceholder: string;
  /** Step 2: send Kame Space dates to the channel. */
  exportStep: string;
  refreshNote: string;
  /** Eligibility facts the host should know before connecting. */
  eligibility: string | null;
}

export const CHANNEL_COPY: Record<DialogChannel, ChannelCopy> = {
  airbnb: {
    label: 'Airbnb',
    importStep:
      'In Airbnb, open your listing Calendar, then Availability, then Connect calendars, then Export calendar. Copy the link and paste it here.',
    importPlaceholder: 'https://www.airbnb.com/calendar/ical/…',
    exportStep:
      'In Airbnb, open Connect calendars, then Import calendar. Paste this link, name it, and save.',
    refreshNote: 'Airbnb refreshes every few hours.',
    eligibility: null,
  },
  agoda: {
    label: 'Agoda',
    importStep:
      'In Agoda, open Calendar, then Calendar connections. Copy your calendar link and paste it here.',
    importPlaceholder: 'https://…agoda.com/…',
    exportStep:
      'In Agoda Calendar connections, paste this link under Other website link and tap Import.',
    refreshNote: 'Agoda refreshes several times a day.',
    eligibility: 'Agoda only supports calendar links for room types with exactly 1 room.',
  },
  booking_com: {
    label: 'Booking.com',
    importStep:
      'In Booking.com, open Rates & Availability, then Sync calendars. Export reserved dates only and copy the link.',
    importPlaceholder: 'https://ical.booking.com/…',
    exportStep: 'In Sync calendars, tap Add calendar connection and paste this link.',
    refreshNote: 'Booking.com refreshes on its own schedule.',
    eligibility:
      'Booking.com turns calendar links off for properties connected to a channel manager.',
  },
};

export type ChannelStatus = 'not_connected' | 'syncing' | 'needs_attention' | 'paused';

export const CHANNEL_STATUS_LABEL: Record<ChannelStatus, string> = {
  not_connected: 'Not connected',
  syncing: 'Syncing',
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
      message: `${label} calendar link is failing. Paste a fresh link.`,
    });
  }
  if (exportEnabled && feeds.some((f) => f.isActive && f.exportNeverRead)) {
    out.push({
      kind: 'never_read',
      message: `${label} hasn't read your link yet. Check it's pasted in ${
        provider === 'agoda' ? 'Calendar connections' : 'its calendar settings'
      }.`,
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

export const HUB_CHECKLIST: readonly string[] = [
  'Connect each channel only to Kame Space.',
  'Remove calendar links between Airbnb, Agoda and Booking.com.',
  'Block dates in Kame Space, not in a channel.',
];
