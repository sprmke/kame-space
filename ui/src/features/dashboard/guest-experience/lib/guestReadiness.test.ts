import { describe, expect, it } from 'vitest';

import {
  guestReadinessGaps,
  guestReadinessRows,
  type GuestReadinessInput,
} from '@/features/dashboard/guest-experience/lib/guestReadiness';

const EMPTY: GuestReadinessInput = {
  checkInCustomised: false,
  checkOutCustomised: false,
  hasEssentials: false,
  paymentMethodCount: 0,
};

function statusOf(rows: ReturnType<typeof guestReadinessRows>, id: string) {
  return rows.find((row) => row.id === id)?.status;
}

describe('guestReadinessRows', () => {
  it('lists every guest-facing input', () => {
    expect(guestReadinessRows(EMPTY).map((row) => row.id)).toEqual([
      'check-in',
      'check-out',
      'essentials',
      'payment',
      'house-rules',
      'cancellation',
    ]);
  });

  it('treats shipped template copy as default, not missing', () => {
    const rows = guestReadinessRows(EMPTY);
    expect(statusOf(rows, 'check-in')).toBe('default');
    expect(statusOf(rows, 'check-out')).toBe('default');
  });

  it('marks a customised template as ready', () => {
    const rows = guestReadinessRows({ ...EMPTY, checkInCustomised: true });
    expect(statusOf(rows, 'check-in')).toBe('ready');
    expect(rows.find((row) => row.id === 'check-in')?.hint).toBeNull();
  });

  it('marks missing essentials and payment methods', () => {
    const rows = guestReadinessRows(EMPTY);
    expect(statusOf(rows, 'essentials')).toBe('missing');
    expect(statusOf(rows, 'payment')).toBe('missing');
  });

  it('marks them ready once filled in', () => {
    const rows = guestReadinessRows({
      ...EMPTY,
      hasEssentials: true,
      paymentMethodCount: 2,
    });
    expect(statusOf(rows, 'essentials')).toBe('ready');
    expect(statusOf(rows, 'payment')).toBe('ready');
  });

  it('never claims a status for house rules or cancellation policy', () => {
    const rows = guestReadinessRows({ ...EMPTY, hasEssentials: true, paymentMethodCount: 1 });
    expect(statusOf(rows, 'house-rules')).toBe('check');
    expect(statusOf(rows, 'cancellation')).toBe('check');
  });

  it('every non-ready row carries a hint', () => {
    for (const row of guestReadinessRows(EMPTY)) {
      if (row.status === 'missing' || row.status === 'default') {
        expect(row.hint?.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('guestReadinessGaps', () => {
  it('returns only the missing rows', () => {
    const gaps = guestReadinessGaps(guestReadinessRows(EMPTY)).map((row) => row.id);
    expect(gaps).toEqual(['essentials', 'payment']);
  });

  it('returns nothing when everything is filled in', () => {
    const gaps = guestReadinessGaps(
      guestReadinessRows({
        checkInCustomised: true,
        checkOutCustomised: true,
        hasEssentials: true,
        paymentMethodCount: 1,
      })
    );
    expect(gaps).toEqual([]);
  });
});
