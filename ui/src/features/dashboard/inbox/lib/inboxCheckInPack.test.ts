import { describe, expect, it, vi } from 'vitest';

import { buildCheckInPackContent } from '@/features/dashboard/inbox/lib/inboxCheckInPack';

vi.stubGlobal('window', { location: { origin: 'https://kamespace.com' } });

describe('buildCheckInPackContent', () => {
  it('returns null without a property slug', () => {
    expect(buildCheckInPackContent({ propertySlug: '' })).toBeNull();
  });

  it('leads with the trip link when one is known', () => {
    const text =
      buildCheckInPackContent({
        propertySlug: 'monaco-2604',
        tripUrl: 'https://kamespace.com/properties/monaco-2604/trip?bookingId=b1',
      }) ?? '';
    const lines = text.split('\n');
    expect(lines[0]).toBe('Check-in details');
    expect(lines[1]).toContain('Your trip: https://kamespace.com/properties/monaco-2604/trip');
  });

  it('omits the trip line when there is no booking', () => {
    const text = buildCheckInPackContent({ propertySlug: 'monaco-2604' }) ?? '';
    expect(text).not.toContain('Your trip:');
  });

  it('never includes a door code: the trip page gates it by reveal time', () => {
    const text = buildCheckInPackContent({ propertySlug: 'monaco-2604' }) ?? '';
    // The slug here contains digits, so assert on wording rather than a digit pattern.
    expect(text.toLowerCase()).not.toContain('door code');
    expect(text.toLowerCase()).not.toContain('wifi');
    expect(text.toLowerCase()).not.toContain('wi-fi');
  });

  it('keeps the check-in and check-out window', () => {
    const text =
      buildCheckInPackContent({ propertySlug: 'monaco-2604', checkInTime: '14:00', checkOutTime: '12:00' }) ??
      '';
    expect(text).toContain('Check-in');
    expect(text).toContain('Check-out');
  });
});
