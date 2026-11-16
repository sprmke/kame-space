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
};

function statusOf(rows: ReturnType<typeof guestReadinessRows>, id: string) {
  return rows.find((row) => row.id === id)?.status;
}

describe('guestReadinessRows', () => {
  it('lists only arrival rows this section owns or links', () => {
    expect(guestReadinessRows(EMPTY).map((row) => row.id)).toEqual([
      'check-in',
      'check-out',
      'essentials',
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

  it('marks missing essentials', () => {
    expect(statusOf(guestReadinessRows(EMPTY), 'essentials')).toBe('missing');
  });

  it('marks essentials ready once filled in', () => {
    expect(statusOf(guestReadinessRows({ ...EMPTY, hasEssentials: true }), 'essentials')).toBe(
      'ready'
    );
  });
});

describe('guestReadinessGaps', () => {
  it('returns only missing essentials, not default steps', () => {
    expect(guestReadinessGaps(guestReadinessRows(EMPTY)).map((row) => row.id)).toEqual([
      'essentials',
    ]);
  });

  it('returns nothing when essentials are filled in', () => {
    expect(
      guestReadinessGaps(
        guestReadinessRows({
          checkInCustomised: false,
          checkOutCustomised: false,
          hasEssentials: true,
        })
      )
    ).toEqual([]);
  });
});
