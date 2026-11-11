import { describe, expect, it } from 'vitest';

import { deriveInboxSyncStatus, minutesAgoLabel } from './inboxSyncStatus';

const NOW = new Date('2026-11-11T12:00:00.000Z').getTime();
const minutesAgo = (n: number) => new Date(NOW - n * 60_000).toISOString();

const base = {
  connected: true,
  importComplete: true,
  browserOnline: true,
  lastCheckedAt: minutesAgo(2),
  now: NOW,
};

describe('deriveInboxSyncStatus', () => {
  it('reports live when the connection is healthy and the last check is recent', () => {
    const status = deriveInboxSyncStatus(base);
    expect(status.state).toBe('live');
    expect(status.label).toBe('Live');
    expect(status.detail).toContain('2 min ago');
  });

  it('reports importing with the count while the first import runs', () => {
    const status = deriveInboxSyncStatus({
      ...base,
      importComplete: false,
      conversationsImported: 120,
    });
    expect(status.state).toBe('importing');
    expect(status.label).toBe('Importing 120 chats');
  });

  it('reports updating while a catch-up check runs', () => {
    expect(deriveInboxSyncStatus({ ...base, importRunning: true }).state).toBe('updating');
  });

  it('reports offline before anything else, so a Meta problem is not blamed', () => {
    const status = deriveInboxSyncStatus({
      ...base,
      browserOnline: false,
      consecutiveFailures: 3,
      lastErrorCode: 'invalid_token',
    });
    expect(status.state).toBe('offline');
    expect(status.action).toBeNull();
  });

  it('asks for a reconnect on a token error', () => {
    const status = deriveInboxSyncStatus({ ...base, lastErrorCode: 'invalid_token' });
    expect(status.state).toBe('needs-attention');
    expect(status.action).toBe('reconnect');
    expect(status.tone).toBe('danger');
  });

  it('reports delayed after repeated failures and offers the light repair', () => {
    const status = deriveInboxSyncStatus({ ...base, consecutiveFailures: 2 });
    expect(status.state).toBe('delayed');
    expect(status.action).toBe('fix-connection');
    expect(status.tone).toBe('warning');
  });

  it('reports delayed when the last check is too old', () => {
    const status = deriveInboxSyncStatus({ ...base, lastCheckedAt: minutesAgo(40) });
    expect(status.state).toBe('delayed');
    expect(status.action).toBe('fix-connection');
  });

  it('offers check now for a mildly stale connection', () => {
    const status = deriveInboxSyncStatus({ ...base, lastCheckedAt: minutesAgo(9) });
    expect(status.state).toBe('delayed');
    expect(status.action).toBe('check-now');
    expect(status.label).toBe('Delayed');
  });

  it('reports paused when a super admin turned sync off', () => {
    expect(deriveInboxSyncStatus({ ...base, syncPaused: true }).state).toBe('paused');
  });

  it('never claims live for an unconnected inbox', () => {
    const status = deriveInboxSyncStatus({ ...base, connected: false });
    expect(status.state).toBe('needs-attention');
    expect(status.label).toBe('Not connected');
  });
});

describe('minutesAgoLabel', () => {
  it('formats minutes, a single minute, and hours', () => {
    expect(minutesAgoLabel(minutesAgo(0), NOW)).toBe('just now');
    expect(minutesAgoLabel(minutesAgo(1), NOW)).toBe('1 min ago');
    expect(minutesAgoLabel(minutesAgo(12), NOW)).toBe('12 min ago');
    expect(minutesAgoLabel(minutesAgo(60), NOW)).toBe('1 hour ago');
    expect(minutesAgoLabel(minutesAgo(180), NOW)).toBe('3 hours ago');
  });
});
