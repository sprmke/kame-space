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
  urls: { all: '', airbnb: '', agoda: '', booking_com: '' },
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
    expect(rows[1].status).toBe('finish_setup');
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

describe('two-way status', () => {
  const NOW = Date.parse('2026-11-19T12:00:00Z');
  const hours = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
  const withRead = (lastReadAt: string | null, enabled = true) => ({
    feeds: [feed({ lastSuccessAt: hours(1) })],
    export: {
      ...exportBase,
      enabled,
      reads: (lastReadAt ? { airbnb: { lastReadAt, readCount: 2 } } : {}) as Record<
        string,
        { lastReadAt: string; readCount: number }
      >,
    },
  });

  it('is two-way only when we imported and the channel read our link', () => {
    const row = buildChannelRows(withRead(hours(3)), {}, NOW)[0];
    expect(row.status).toBe('two_way');
    expect(row.receive.state).toBe('ok');
    expect(row.send.state).toBe('ok');
  });

  it('is finish setup while the channel has not read our link', () => {
    const row = buildChannelRows(withRead(null), {}, NOW)[0];
    expect(row.status).toBe('finish_setup');
    expect(row.send.state).toBe('waiting');
  });

  it('is finish setup when sharing is off', () => {
    const row = buildChannelRows(withRead(hours(3), false), {}, NOW)[0];
    expect(row.status).toBe('finish_setup');
    expect(row.send.state).toBe('off');
  });

  it('needs attention when the channel stopped reading for 48 hours', () => {
    const row = buildChannelRows(withRead(hours(60)), {}, NOW)[0];
    expect(row.status).toBe('needs_attention');
    expect(row.send.state).toBe('stale');
    expect(row.warnings.map((w) => w.kind)).toEqual(['read_stale']);
  });

  it('is finish setup before the first import finishes', () => {
    const rows = buildChannelRows(
      { feeds: [feed({ lastSuccessAt: null })], export: exportBase },
      {},
      NOW
    );
    expect(rows[0].receive.state).toBe('waiting');
    expect(rows[0].status).toBe('finish_setup');
  });

  it('reports a failing import as the receive side', () => {
    const rows = buildChannelRows(
      { feeds: [feed({ health: 'error' })], export: exportBase },
      {},
      NOW
    );
    expect(rows[0].receive.state).toBe('error');
    expect(rows[0].status).toBe('needs_attention');
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
