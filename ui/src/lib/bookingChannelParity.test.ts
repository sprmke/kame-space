import { describe, expect, it } from 'vitest';

import {
  BOOKING_SOURCES,
  OTA_PREPAID_SOURCES,
  bookingChannelLabel,
  canonicalBookingSource,
  isOtaPrepaidSource,
} from '@/lib/bookingChannel';

import * as server from '../../../supabase/functions/_shared/bookingChannel.ts';

describe('booking channel vocabulary parity', () => {
  it('source lists match the edge copy', () => {
    expect([...BOOKING_SOURCES]).toEqual([...server.BOOKING_SOURCES]);
    expect([...OTA_PREPAID_SOURCES]).toEqual([...server.OTA_PREPAID_SOURCES]);
  });

  it('canonicalises the same inputs the same way', () => {
    const inputs = [
      null,
      '',
      '  ',
      'airbnb',
      ' AIRBNB ',
      'Agoda',
      'booking_com',
      'Booking.com',
      'facebook',
      'Vrbo',
      'Expedia',
      'Direct',
    ];
    for (const input of inputs) {
      expect(canonicalBookingSource(input)).toBe(server.canonicalBookingSource(input));
      expect(isOtaPrepaidSource(input)).toBe(server.isOtaPrepaidSource(input));
    }
  });
});

describe('canonicalBookingSource', () => {
  it('maps aliases to stored labels', () => {
    expect(canonicalBookingSource('airbnb')).toBe('Airbnb');
    expect(canonicalBookingSource('booking_com')).toBe('Booking.com');
    expect(canonicalBookingSource('bookingcom')).toBe('Booking.com');
    expect(canonicalBookingSource('fb')).toBe('Facebook');
  });

  it('keeps an unknown source instead of collapsing it to Direct', () => {
    expect(canonicalBookingSource('Expedia')).toBe('Expedia');
  });

  it('treats blank as Direct', () => {
    expect(canonicalBookingSource(null)).toBe('Direct');
    expect(canonicalBookingSource('   ')).toBe('Direct');
  });
});

describe('isOtaPrepaidSource', () => {
  it('is true for every channel that collects payment', () => {
    for (const source of OTA_PREPAID_SOURCES) {
      expect(isOtaPrepaidSource(source)).toBe(true);
    }
  });

  it('is false for direct and facebook bookings', () => {
    expect(isOtaPrepaidSource('Direct')).toBe(false);
    expect(isOtaPrepaidSource('Facebook')).toBe(false);
    expect(isOtaPrepaidSource(null)).toBe(false);
  });
});

describe('bookingChannelLabel', () => {
  it('returns the canonical label', () => {
    expect(bookingChannelLabel('booking_com')).toBe('Booking.com');
  });
});
