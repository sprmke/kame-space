import { describe, expect, it } from 'vitest';

import {
  guestCalendarPath,
  guestFormPath,
  guestPropertyPath,
  guestSuccessPath,
  guestTripPath,
  guestTripWelcomePath,
} from '@/features/guest/lib/guestPublicPaths';

describe('guestPublicPaths', () => {
  it('builds property-scoped paths', () => {
    expect(guestPropertyPath('solea-mactan')).toBe('/properties/solea-mactan');
    expect(guestCalendarPath('solea-mactan')).toBe('/properties/solea-mactan/calendar');
    expect(guestFormPath('solea-mactan')).toBe('/properties/solea-mactan/form');
    expect(guestSuccessPath('solea-mactan')).toBe('/properties/solea-mactan/success');
  });

  it('returns /properties when slug empty', () => {
    expect(guestPropertyPath('')).toBe('/properties');
  });

  it('builds the trip path with the booking id', () => {
    expect(guestTripPath('solea-mactan', 'booking-1')).toBe(
      '/properties/solea-mactan/trip?bookingId=booking-1'
    );
  });

  it('marks the first trip view after a submission', () => {
    expect(guestTripWelcomePath('solea-mactan', 'booking-1')).toBe(
      '/properties/solea-mactan/trip?bookingId=booking-1&welcome=1'
    );
  });
});
