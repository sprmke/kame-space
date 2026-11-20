import { describe, expect, it } from 'vitest';

import { resolveInboxAutoSelectId } from '@/features/dashboard/inbox/lib/inboxAutoSelect';

describe('resolveInboxAutoSelectId', () => {
  it('returns null when the list is empty', () => {
    expect(resolveInboxAutoSelectId([], null)).toBeNull();
    expect(resolveInboxAutoSelectId([], 'a')).toBeNull();
  });

  it('returns the first id when nothing is selected', () => {
    expect(resolveInboxAutoSelectId(['a', 'b'], null)).toBe('a');
    expect(resolveInboxAutoSelectId(['a', 'b'], undefined)).toBe('a');
  });

  it('keeps a selection that is still in the filtered list', () => {
    expect(resolveInboxAutoSelectId(['a', 'b'], 'b')).toBeNull();
  });

  it('re-selects the first id when the selection left the filtered list', () => {
    expect(resolveInboxAutoSelectId(['a', 'b'], 'gone')).toBe('a');
  });
});
