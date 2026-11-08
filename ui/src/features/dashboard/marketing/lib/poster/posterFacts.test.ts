import { describe, expect, it } from 'vitest';

import {
  buildPosterFacts,
  formatPosterLocation,
  formatPosterMoney,
  formatPosterTime,
} from '@/features/dashboard/marketing/lib/poster/posterFacts';

describe('formatPosterTime', () => {
  it('converts 24-hour times to 12-hour', () => {
    expect(formatPosterTime('14:00')).toBe('2:00 PM');
    expect(formatPosterTime('14:00:00')).toBe('2:00 PM');
    expect(formatPosterTime('09:05')).toBe('9:05 AM');
    expect(formatPosterTime('00:30')).toBe('12:30 AM');
    expect(formatPosterTime('12:00')).toBe('12:00 PM');
  });

  it('normalises an already-12-hour value', () => {
    expect(formatPosterTime('2:00 pm')).toBe('2:00 PM');
    expect(formatPosterTime('  9:05   am ')).toBe('9:05 AM');
  });

  it('passes through shapes it does not understand', () => {
    expect(formatPosterTime('noon')).toBe('noon');
    expect(formatPosterTime('24:00')).toBe('24:00');
  });

  it('returns null for blank input', () => {
    expect(formatPosterTime(null)).toBeNull();
    expect(formatPosterTime(undefined)).toBeNull();
    expect(formatPosterTime('   ')).toBeNull();
  });
});

describe('formatPosterMoney', () => {
  it('formats a positive amount with no decimals', () => {
    const formatted = formatPosterMoney(1000, 'PHP');
    expect(formatted).toContain('1,000');
    expect(formatted).not.toContain('.00');
  });

  it('defaults the currency when none is given', () => {
    expect(formatPosterMoney(2500, null)).toContain('2,500');
  });

  it('returns null for zero, negative or non-finite amounts', () => {
    expect(formatPosterMoney(0, 'PHP')).toBeNull();
    expect(formatPosterMoney(-5, 'PHP')).toBeNull();
    expect(formatPosterMoney(Number.NaN, 'PHP')).toBeNull();
    expect(formatPosterMoney(null, 'PHP')).toBeNull();
    expect(formatPosterMoney(undefined, 'PHP')).toBeNull();
  });
});

describe('formatPosterLocation', () => {
  it('prefers residence name plus state', () => {
    expect(
      formatPosterLocation({ residenceName: 'Azure North', city: 'San Fernando', state: 'Pampanga' })
    ).toBe('Azure North, Pampanga');
  });

  it('falls back to the city when there is no state', () => {
    expect(formatPosterLocation({ residenceName: 'Monaco', city: 'Angeles' })).toBe(
      'Monaco, Angeles'
    );
  });

  it('de-duplicates the same place twice in different case', () => {
    expect(formatPosterLocation({ residenceName: 'Monaco', city: 'monaco' })).toBe('Monaco');
  });

  it('returns null with nothing to show', () => {
    expect(formatPosterLocation(null)).toBeNull();
    expect(formatPosterLocation({})).toBeNull();
    expect(formatPosterLocation({ residenceName: '  ' })).toBeNull();
  });
});

describe('buildPosterFacts', () => {
  it('builds the fact pack from property data and trims every field', () => {
    const facts = buildPosterFacts({
      propertyName: '  Monaco 2604  ',
      brandName: '  Kame  ',
      photos: [' https://img.test/a.jpg ', '', 'https://img.test/a.jpg', 'https://img.test/b.jpg'],
      logoUrl: '  https://img.test/logo.png ',
      property: {
        residenceName: 'Azure North',
        state: 'Pampanga',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        amenities: [' Pool ', '', 'WiFi'],
        pricing: { baseRate: 4500, securityDeposit: 2000, currency: 'PHP' },
      },
    });

    expect(facts.propertyName).toBe('Monaco 2604');
    expect(facts.brandName).toBe('Kame');
    expect(facts.location).toBe('Azure North, Pampanga');
    expect(facts.checkIn).toBe('2:00 PM');
    expect(facts.checkOut).toBe('12:00 PM');
    expect(facts.nightlyRate).toContain('4,500');
    expect(facts.securityDeposit).toContain('2,000');
    expect(facts.amenities).toEqual(['Pool', 'WiFi']);
    expect(facts.logoUrl).toBe('https://img.test/logo.png');
    expect(facts.photos).toEqual(['https://img.test/a.jpg', 'https://img.test/b.jpg']);
  });

  it('accepts a booking with no property data', () => {
    const facts = buildPosterFacts({ propertyName: 'Villa', photos: [] });

    expect(facts).toMatchObject({
      propertyName: 'Villa',
      brandName: null,
      location: null,
      checkIn: null,
      checkOut: null,
      nightlyRate: null,
      securityDeposit: null,
      amenities: [],
      logoUrl: null,
      photos: [],
    });
  });
});
