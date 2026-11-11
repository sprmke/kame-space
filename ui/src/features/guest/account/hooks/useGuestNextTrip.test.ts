import { describe, expect, it } from 'vitest';

import type { GuestTripListItemDto } from '@/features/guest/account/lib/guestAccountApi';
import { pickGuestNextTrip } from '@/features/guest/account/hooks/useGuestNextTrip';

const TODAY = '2026-11-10';

function stay(overrides: Partial<GuestTripListItemDto>): GuestTripListItemDto {
  return {
    id: 'b1',
    kind: 'property',
    status: 'READY_FOR_CHECKIN',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-22',
    propertySlug: 'monaco-2604',
    propertyName: 'Monaco 2604',
    parkingSlug: null,
    parkingName: null,
    imageUrl: null,
    guestFacebookName: 'Maria Santos',
    ...overrides,
  };
}

describe('pickGuestNextTrip', () => {
  it('returns null when there are no stays', () => {
    expect(pickGuestNextTrip([], TODAY)).toBeNull();
  });

  it('ignores cancelled bookings', () => {
    expect(pickGuestNextTrip([stay({ status: 'CANCELLED' })], TODAY)).toBeNull();
  });

  it('ignores parking requests', () => {
    const parking = stay({ kind: 'parking', id: 'p1' });
    expect(pickGuestNextTrip([parking], TODAY)).toBeNull();
  });

  it('ignores stays that already ended', () => {
    const past = stay({ checkInDate: '2026-11-01', checkOutDate: '2026-11-05' });
    expect(pickGuestNextTrip([past], TODAY)).toBeNull();
  });

  it('picks the closest upcoming stay', () => {
    const trips = [
      stay({ id: 'b2', checkInDate: '2026-12-01', checkOutDate: '2026-12-03' }),
      stay({ id: 'b1', checkInDate: '2026-11-20', checkOutDate: '2026-11-22' }),
    ];
    const next = pickGuestNextTrip(trips, TODAY);
    expect(next?.bookingId).toBe('b1');
    expect(next?.daysUntil).toBe(10);
    expect(next?.isCurrent).toBe(false);
  });

  it('prefers the stay in progress', () => {
    const trips = [
      stay({ id: 'b2', checkInDate: '2026-11-25', checkOutDate: '2026-11-27' }),
      stay({ id: 'b1', checkInDate: '2026-11-08', checkOutDate: '2026-11-12' }),
    ];
    const next = pickGuestNextTrip(trips, TODAY);
    expect(next?.bookingId).toBe('b1');
    expect(next?.isCurrent).toBe(true);
    expect(next?.daysUntil).toBe(0);
  });

  it('builds the trip path for a property stay', () => {
    const next = pickGuestNextTrip([stay({})], TODAY);
    expect(next?.path).toBe('/properties/monaco-2604/trip?bookingId=b1');
  });
});
