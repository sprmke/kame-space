import { describe, expect, it, vi } from 'vitest';

import { buildGuestChatResourceHubItems } from '@/features/guest/chat/lib/guestChatResourceHubItems';

// The builder reads `window.location.origin`; a fixed origin keeps hrefs predictable.
vi.stubGlobal('window', { location: { origin: 'https://kamespace.com' } });

const SLUG = 'monaco-2604';
const TRIP = `/properties/${SLUG}/trip?bookingId=b1`;

describe('buildGuestChatResourceHubItems', () => {
  it('returns nothing without a property slug', () => {
    expect(buildGuestChatResourceHubItems('')).toEqual([]);
  });

  it('offers the browse-first set to a guest who has not booked', () => {
    const ids = buildGuestChatResourceHubItems(SLUG).map((item) => item.id);
    expect(ids).toEqual(['calendar', 'listing', 'form', 'showcase']);
  });

  it('never offers the booking form to a guest who has booked', () => {
    const ids = buildGuestChatResourceHubItems(SLUG, { tripPath: TRIP }).map((item) => item.id);
    expect(ids).not.toContain('form');
    expect(ids).not.toContain('calendar');
    expect(ids).toContain('trip');
  });

  it('leads with the trip and includes the stay essentials', () => {
    const items = buildGuestChatResourceHubItems(SLUG, {
      tripPath: TRIP,
      stayGuideUrl: 'https://kamespace.com/properties/monaco-2604/stay-guide?token=t',
    });
    expect(items.map((item) => item.id)).toEqual([
      'trip',
      'stay-guide',
      'house-rules',
      'check-in-steps',
    ]);
  });

  it('links house rules and check-in steps to the trip page sections', () => {
    const items = buildGuestChatResourceHubItems(SLUG, { tripPath: TRIP });
    const rules = items.find((item) => item.id === 'house-rules');
    const steps = items.find((item) => item.id === 'check-in-steps');
    expect(rules?.href).toBe(`https://kamespace.com${TRIP}#trip-arrival`);
    expect(steps?.href).toBe(`https://kamespace.com${TRIP}#trip-steps`);
  });

  it('drops the stay guide when it is not available', () => {
    const ids = buildGuestChatResourceHubItems(SLUG, { tripPath: TRIP }).map((item) => item.id);
    expect(ids).toEqual(['trip', 'house-rules', 'check-in-steps']);
  });

  it('ignores a trip path that is not an app path', () => {
    const ids = buildGuestChatResourceHubItems(SLUG, { tripPath: 'https://evil.example/x' }).map(
      (item) => item.id
    );
    expect(ids).toEqual(['calendar', 'listing', 'form', 'showcase']);
  });
});
