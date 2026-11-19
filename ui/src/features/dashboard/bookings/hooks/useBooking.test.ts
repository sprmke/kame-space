import { describe, expect, it } from 'vitest';

import { buildGetBookingRowQuery } from '@/features/dashboard/bookings/hooks/useBooking';

describe('buildGetBookingRowQuery', () => {
  it('scopes a property booking with format=row', () => {
    const qs = buildGetBookingRowQuery({
      bookingId: '1f344a3c-600a-4870-9dc7-d3a58e4c7625',
      propertyId: 'c9573d84-e816-4f9a-8049-efa91e01d2d5',
    });
    const params = new URLSearchParams(qs);
    expect(params.get('booking_id')).toBe('1f344a3c-600a-4870-9dc7-d3a58e4c7625');
    expect(params.get('format')).toBe('row');
    expect(params.get('property_id')).toBe('c9573d84-e816-4f9a-8049-efa91e01d2d5');
    expect(params.get('parking_id')).toBeNull();
    expect(params.get('org_id')).toBeNull();
  });

  it('prefers parking scope over org when both could apply', () => {
    const qs = buildGetBookingRowQuery({
      bookingId: 'booking-1',
      parkingId: 'parking-1',
      orgSlug: 'test-org',
    });
    const params = new URLSearchParams(qs);
    expect(params.get('parking_id')).toBe('parking-1');
    expect(params.get('org_slug')).toBeNull();
    expect(params.get('property_id')).toBeNull();
  });

  it('falls back to org scope for assistant cards without property/parking', () => {
    const qs = buildGetBookingRowQuery({
      bookingId: 'booking-1',
      orgSlug: 'test-org',
      orgId: 'org-1',
    });
    const params = new URLSearchParams(qs);
    expect(params.get('org_id')).toBe('org-1');
    expect(params.get('format')).toBe('row');
  });
});
