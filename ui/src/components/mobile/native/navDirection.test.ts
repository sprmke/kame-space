import { describe, expect, it } from 'vitest';

import { resolveNavDirection } from '@/components/mobile/native/navDirection';

describe('resolveNavDirection', () => {
  it('detects push and pop from history index', () => {
    expect(
      resolveNavDirection({
        previous: { index: 1, key: 'a' },
        next: { index: 2, key: 'b' },
      })
    ).toBe('push');
    expect(
      resolveNavDirection({
        previous: { index: 2, key: 'b' },
        next: { index: 1, key: 'a' },
      })
    ).toBe('pop');
  });

  it('treats same-index tab family moves as tab', () => {
    expect(
      resolveNavDirection({
        previous: { index: 3, key: 'bookings' },
        next: { index: 3, key: 'inbox' },
        sameTabFamily: true,
      })
    ).toBe('tab');
  });

  it('returns none on first mount without tab family', () => {
    expect(resolveNavDirection({ previous: null, next: { index: 0, key: 'root' } })).toBe('none');
  });
});
