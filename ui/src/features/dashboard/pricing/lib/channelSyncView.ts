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

/**
 * One word per channel. `two_way` means both directions are proven: we imported its calendar and
 * the channel has read ours. Anything short of that while connected is `finish_setup`.
 */
export type ChannelStatus =
  'not_connected' | 'finish_setup' | 'two_way' | 'needs_attention' | 'paused';

export const CHANNEL_STATUS_LABEL: Record<ChannelStatus, string> = {
  not_connected: 'Not connected',
  finish_setup: 'Finish setup',
  two_way: 'Two-way',
  needs_attention: 'Needs attention',
  paused: 'Paused',
};

/** State of one direction of the sync. */
export type DirectionState = 'off' | 'waiting' | 'ok' | 'stale' | 'error';

export interface DirectionHealth {
  state: DirectionState;
  /** Last successful import (receive) or last time the channel read our link (send). */
  at: string | null;
}

/** A channel that has not read our link for this long is treated as disconnected on its side. */
export const SEND_STALE_MS = 48 * 60 * 60 * 1000;

export interface ChannelWarning {
  kind: 'feed_error' | 'never_read' | 'read_stale' | 'echo';
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
  /** Channel to Kame Space: dates and bookings we pull in. */
  receive: DirectionHealth;
  /** Kame Space to channel: our dates the channel reads. */
  send: DirectionHealth;
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

export function isReadStale(lastReadAt: string | null, nowMs: number): boolean {
  if (!lastReadAt) return false;
  const t = Date.parse(lastReadAt);
  return Number.isFinite(t) && nowMs - t > SEND_STALE_MS;
}

export function channelWarnings(
  provider: DialogChannel,
  feeds: CalendarSyncFeed[],
  exportEnabled: boolean,
  lastReadAt: string | null = null,
  nowMs: number = Date.now()
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
  if (
    exportEnabled &&
    feeds.some((f) => f.isActive) &&
    !feeds.some((f) => f.isActive && f.exportNeverRead) &&
    isReadStale(lastReadAt, nowMs)
  ) {
    out.push({
      kind: 'read_stale',
      message: `${label} stopped reading your link. Check it is still pasted there.`,
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

export function receiveHealth(feeds: CalendarSyncFeed[]): DirectionHealth {
  const active = feeds.filter((f) => f.isActive);
  if (active.length === 0) return { state: 'off', at: null };
  const at = latest(active.map((f) => f.lastSuccessAt));
  if (active.some((f) => f.health === 'error')) return { state: 'error', at };
  return at ? { state: 'ok', at } : { state: 'waiting', at: null };
}

export function sendHealth(
  exportEnabled: boolean,
  lastReadAt: string | null,
  nowMs: number
): DirectionHealth {
  if (!exportEnabled) return { state: 'off', at: lastReadAt };
  if (!lastReadAt) return { state: 'waiting', at: null };
  return { state: isReadStale(lastReadAt, nowMs) ? 'stale' : 'ok', at: lastReadAt };
}

export function buildChannelRows(
  settings: Pick<CalendarSyncSettings, 'feeds' | 'export' | 'connectableProviders'> | undefined,
  paused: Partial<Record<DialogChannel, boolean>> = {},
  nowMs: number = Date.now()
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

    const lastReadAt = reads[provider]?.lastReadAt ?? null;
    const warnings = channelWarnings(provider, channelFeeds, exportEnabled, lastReadAt, nowMs);
    const active = channelFeeds.filter((f) => f.isActive);
    const receive = receiveHealth(channelFeeds);
    const send = sendHealth(exportEnabled, lastReadAt, nowMs);
    let status: ChannelStatus;
    if (paused[provider]) status = 'paused';
    else if (active.length === 0) status = 'not_connected';
    else if (warnings.length > 0) status = 'needs_attention';
    else if (receive.state === 'ok' && send.state === 'ok') status = 'two_way';
    else status = 'finish_setup';

    rows.push({
      provider,
      label: CHANNEL_COPY[provider].label,
      feeds: channelFeeds,
      status,
      lastImportAt: latest(channelFeeds.map((f) => f.lastSuccessAt)),
      lastReadAt,
      receive,
      send,
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

/** Help for the one property-wide sharing switch (shown on the channel list). */
export const SHARE_HELP =
  'Sends your bookings and blocked dates to every connected channel. Turn it off and channels can be double booked.';

/** Step titles: plain verbs, one per direction. */
export const getStepTitle = (direction: 'receive' | 'send', label: string): string =>
  direction === 'receive' ? `Get dates from ${label}` : `Send dates to ${label}`;

/** One short line per direction, for the list row and the step. */
export function directionText(
  direction: 'receive' | 'send',
  label: string,
  health: DirectionHealth,
  formatRelative: (iso: string) => string,
  compact = false
): string {
  if (direction === 'receive') {
    switch (health.state) {
      case 'ok':
        return `Synced ${health.at ? formatRelative(health.at) : ''}`.trim();
      case 'error':
        return 'Needs fix';
      case 'waiting':
        return 'Waiting for first sync';
      default:
        return 'Not connected';
    }
  }
  switch (health.state) {
    case 'ok':
      return `Read ${health.at ? formatRelative(health.at) : ''}`.trim();
    case 'stale':
      return `Last read ${health.at ? formatRelative(health.at) : 'a while ago'}`;
    case 'waiting':
      return compact ? 'Not read yet' : `Waiting for ${label} to read it`;
    default:
      return 'Sending is off';
  }
}
