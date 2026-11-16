import { describe, expect, it } from 'vitest';

import {
  CALENDAR_CHANNELS,
  calendarChannel,
  connectableCalendarProviders,
  hostMatchesChannelSuffix,
} from '@/features/dashboard/pricing/lib/calendarChannels';

import * as server from '../../../../../../supabase/functions/_shared/calendarChannels.ts';

describe('calendar channel registry parity', () => {
  it('entries match the edge registry', () => {
    expect(CALENDAR_CHANNELS).toEqual(server.CALENDAR_CHANNELS);
  });

  it('exposes the same connectable providers', () => {
    expect(connectableCalendarProviders()).toEqual(server.connectableCalendarProviders());
  });
});

describe('calendarChannel', () => {
  it('returns the entry for a provider', () => {
    expect(calendarChannel('agoda').bookingSource).toBe('Agoda');
  });

  it('only allows Airbnb to be connected until Phase 0 lands', () => {
    expect(connectableCalendarProviders()).toEqual(['airbnb']);
  });
});

describe('hostMatchesChannelSuffix', () => {
  it('accepts a subdomain of an allowed host', () => {
    expect(hostMatchesChannelSuffix('ical.booking.com', ['booking.com'])).toBe(true);
    expect(hostMatchesChannelSuffix('booking.com', ['booking.com'])).toBe(true);
  });

  it('rejects a lookalike host', () => {
    expect(hostMatchesChannelSuffix('booking.com.evil.io', ['booking.com'])).toBe(false);
    expect(hostMatchesChannelSuffix('evilbooking.com', ['booking.com'])).toBe(false);
  });

  it('every channel has a non-empty host allowlist', () => {
    for (const channel of CALENDAR_CHANNELS) {
      expect(channel.hostSuffixes.length).toBeGreaterThan(0);
    }
  });
});
