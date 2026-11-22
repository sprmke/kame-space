import { describe, expect, it } from 'vitest';

import {
  guestAccountListLayoutFromCount,
  resolveGuestAccountListLoadState,
} from './guestAccountListLayout';

describe('resolveGuestAccountListLoadState', () => {
  it('returns ready when not pending', () => {
    expect(
      resolveGuestAccountListLoadState({
        isPending: false,
        itemCount: undefined,
        hint: 'list',
      })
    ).toBe('ready');
  });

  it('prefers cached count over hint', () => {
    expect(
      resolveGuestAccountListLoadState({
        isPending: true,
        itemCount: 0,
        hint: 'list',
      })
    ).toBe('empty');
    expect(
      resolveGuestAccountListLoadState({
        isPending: true,
        itemCount: 3,
        hint: 'empty',
      })
    ).toBe('list');
  });

  it('uses hint then coldDefault', () => {
    expect(
      resolveGuestAccountListLoadState({
        isPending: true,
        itemCount: undefined,
        hint: 'list',
        coldDefault: 'empty',
      })
    ).toBe('list');
    expect(
      resolveGuestAccountListLoadState({
        isPending: true,
        itemCount: undefined,
        hint: null,
        coldDefault: 'list',
      })
    ).toBe('list');
    expect(
      resolveGuestAccountListLoadState({
        isPending: true,
        itemCount: undefined,
        hint: null,
      })
    ).toBe('empty');
  });
});

describe('guestAccountListLayoutFromCount', () => {
  it('maps zero to empty and positive to list', () => {
    expect(guestAccountListLayoutFromCount(0)).toBe('empty');
    expect(guestAccountListLayoutFromCount(1)).toBe('list');
  });
});
