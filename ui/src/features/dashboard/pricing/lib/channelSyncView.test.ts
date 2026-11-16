import { describe, expect, it } from 'vitest';

import { buildChannelRows, channelWarnings, showHubChecklist } from './channelSyncView';
import type { CalendarSyncFeed } from './calendarSyncApi';

function feed(over: Partial<CalendarSyncFeed> = {}): CalendarSyncFeed {
  return {
    id: 'f1',
    provider: 'airbnb',
    label: null,
    isActive: true,
    createBookings: true,
    maskedUrl: '••••',
    hasUrl: true,
    health: 'ok',
    lastAttemptedAt: null,
    lastSuccessAt: '2026-11-17T01:00:00Z',
    lastError: null,
    consecutiveFailures: 0,
    createdAt: '2026-11-01T00:00:00Z',
    ...over,
  };
}

const exportBase = {
  enabled: true,
  rotatedAt: null,
  lastServedAt: null,
  urls: { all: '', airbnb: '', agoda: '', booking_com: '', vrbo: '' },
};

describe('buildChannelRows', () => {
  it('shows Airbnb only when nothing else is rolled out', () => {
    const rows = buildChannelRows({ feeds: [], export: exportBase });
    expect(rows.map((r) => r.provider)).toEqual(['airbnb']);
    expect(rows[0].status).toBe('not_connected');
  });

  it('shows channels the org may connect', () => {
    const rows = buildChannelRows({
      feeds: [],
      export: exportBase,
      connectableProviders: ['airbnb', 'agoda'],
    });
    expect(rows.map((r) => r.provider)).toEqual(['airbnb', 'agoda']);
  });

  it('keeps a channel visible when it has feeds even if not connectable', () => {
    const rows = buildChannelRows({
      feeds: [feed({ id: 'a', provider: 'agoda' })],
      export: exportBase,
      connectableProviders: ['airbnb'],
    });
    expect(rows.map((r) => r.provider)).toEqual(['airbnb', 'agoda']);
    expect(rows[1].connectable).toBe(false);
    expect(rows[1].status).toBe('syncing');
  });

  it('marks failing feeds as needing attention and paused wins', () => {
    const feeds = [feed({ health: 'error' })];
    expect(buildChannelRows({ feeds, export: exportBase })[0].status).toBe('needs_attention');
    expect(buildChannelRows({ feeds, export: exportBase }, { airbnb: true })[0].status).toBe(
      'paused'
    );
  });

  it('reads last export read per channel', () => {
    const rows = buildChannelRows({
      feeds: [],
      export: {
        ...exportBase,
        reads: { airbnb: { lastReadAt: '2026-11-17T02:00:00Z', readCount: 3 } },
      },
    });
    expect(rows[0].lastReadAt).toBe('2026-11-17T02:00:00Z');
  });
});

describe('channelWarnings', () => {
  it('flags never-read only while sharing is on', () => {
    const f = [feed({ provider: 'agoda', exportNeverRead: true })];
    expect(channelWarnings('agoda', f, true).map((w) => w.kind)).toEqual(['never_read']);
    expect(channelWarnings('agoda', f, false)).toEqual([]);
  });

  it('flags the Booking.com echo warning only for Booking.com', () => {
    const f = [feed({ provider: 'booking_com', echoWarning: true })];
    expect(channelWarnings('booking_com', f, true).map((w) => w.kind)).toEqual(['echo']);
    expect(channelWarnings('agoda', f, true)).toEqual([]);
  });

  it('ignores inactive feeds', () => {
    expect(channelWarnings('airbnb', [feed({ isActive: false, health: 'error' })], true)).toEqual(
      []
    );
  });
});

describe('showHubChecklist', () => {
  it('needs two connected channels', () => {
    const one = buildChannelRows({ feeds: [feed()], export: exportBase });
    expect(showHubChecklist(one)).toBe(false);
    const two = buildChannelRows({
      feeds: [feed(), feed({ id: 'b', provider: 'agoda' })],
      export: exportBase,
      connectableProviders: ['airbnb', 'agoda'],
    });
    expect(showHubChecklist(two)).toBe(true);
  });
});
