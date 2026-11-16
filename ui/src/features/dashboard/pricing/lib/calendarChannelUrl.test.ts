import { describe, expect, it } from 'vitest';

import { validateChannelCalendarUrl } from '@/features/dashboard/pricing/lib/calendarChannelUrl';

describe('validateChannelCalendarUrl', () => {
  it('accepts a real Airbnb export link, https or webcal', () => {
    expect(
      validateChannelCalendarUrl(
        'airbnb',
        'https://www.airbnb.com/calendar/ical/123456789.ics?t=abc&s=42'
      )
    ).toBeNull();
    expect(
      validateChannelCalendarUrl(
        'airbnb',
        'webcal://www.airbnb.com/calendar/ical/123456789.ics?t=abc'
      )
    ).toBeNull();
  });

  it('rejects an Airbnb page that is not an export link', () => {
    expect(
      validateChannelCalendarUrl('airbnb', 'https://www.airbnb.com/h/monaco-2604')
    ).toBe('Use the Export calendar link from Airbnb');
  });

  it('rejects the wrong host for the channel', () => {
    expect(
      validateChannelCalendarUrl('airbnb', 'https://ical.booking.com/v1/export?t=abc')
    ).toBe('Paste the Airbnb calendar link');
  });

  it('accepts the documented Booking.com and Agoda hosts', () => {
    expect(
      validateChannelCalendarUrl('booking_com', 'https://ical.booking.com/v1/export?t=abc')
    ).toBeNull();
    expect(
      validateChannelCalendarUrl('agoda', 'https://www.agoda.com/ical/abc.ics')
    ).toBeNull();
  });

  it('rejects a lookalike host', () => {
    expect(
      validateChannelCalendarUrl('booking_com', 'https://ical.booking.com.evil.io/x.ics')
    ).toBe('Paste the Booking.com calendar link');
  });

  it('rejects plain http, credentials, localhost and junk', () => {
    expect(validateChannelCalendarUrl('airbnb', '')).toBe('Required');
    expect(validateChannelCalendarUrl('airbnb', 'not a url')).toBe('Enter a valid URL');
    expect(validateChannelCalendarUrl('airbnb', 'http://www.airbnb.com/calendar/ical/x.ics')).toBe(
      'URL must start with https://'
    );
    expect(
      validateChannelCalendarUrl('airbnb', 'https://user:pass@www.airbnb.com/calendar/ical/x.ics')
    ).toBe('URL must not contain credentials');
    expect(validateChannelCalendarUrl('airbnb', 'https://localhost/x.ics')).toBe(
      'That host is not allowed'
    );
  });
});
