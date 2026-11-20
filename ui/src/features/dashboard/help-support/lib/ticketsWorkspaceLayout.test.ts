// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import {
  readTicketsWorkspaceLayoutHint,
  resolveTicketsWorkspaceLoadState,
  ticketsWorkspaceLayoutFromCount,
  ticketsWorkspaceLayoutStorageKey,
  writeTicketsWorkspaceLayoutHint,
} from '@/features/dashboard/help-support/lib/ticketsWorkspaceLayout';

describe('ticketsWorkspaceLayoutFromCount', () => {
  it('maps zero to empty and any count to list', () => {
    expect(ticketsWorkspaceLayoutFromCount(0)).toBe('empty');
    expect(ticketsWorkspaceLayoutFromCount(2)).toBe('list');
  });
});

describe('resolveTicketsWorkspaceLoadState', () => {
  it('returns ready when not pending', () => {
    expect(
      resolveTicketsWorkspaceLoadState({
        isPending: false,
        ticketCount: 0,
        hint: 'list',
      })
    ).toBe('ready');
  });

  it('uses cached ticket count while pending', () => {
    expect(
      resolveTicketsWorkspaceLoadState({
        isPending: true,
        ticketCount: 3,
        hint: 'empty',
      })
    ).toBe('list');
    expect(
      resolveTicketsWorkspaceLoadState({
        isPending: true,
        ticketCount: 0,
        hint: 'list',
      })
    ).toBe('empty');
  });

  it('falls back to hint, then empty, on a cold load', () => {
    expect(
      resolveTicketsWorkspaceLoadState({
        isPending: true,
        ticketCount: undefined,
        hint: 'list',
      })
    ).toBe('list');
    expect(
      resolveTicketsWorkspaceLoadState({
        isPending: true,
        ticketCount: undefined,
        hint: null,
      })
    ).toBe('empty');
  });
});

describe('ticketsWorkspaceLayoutStorageKey', () => {
  it('joins scope parts', () => {
    expect(ticketsWorkspaceLayoutStorageKey(['host', 'acme', null, 'p1'])).toBe(
      'kame-tickets-workspace-layout:host:acme::p1'
    );
  });
});

describe('ticketsWorkspaceLayoutHint storage', () => {
  const key = 'kame-tickets-workspace-layout:test';

  afterEach(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  });

  it('round-trips a valid hint', () => {
    writeTicketsWorkspaceLayoutHint(key, 'list');
    expect(readTicketsWorkspaceLayoutHint(key)).toBe('list');
  });

  it('ignores unknown values', () => {
    sessionStorage.setItem(key, 'nope');
    expect(readTicketsWorkspaceLayoutHint(key)).toBeNull();
  });
});
