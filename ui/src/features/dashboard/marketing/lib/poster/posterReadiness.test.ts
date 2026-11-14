import { describe, expect, it } from 'vitest';

import { posterReadinessHints } from '@/features/dashboard/marketing/lib/poster/posterReadiness';

describe('posterReadinessHints', () => {
  it('is quiet for a complete listing', () => {
    expect(
      posterReadinessHints({
        photos: ['a', 'b', 'c'],
        amenities: ['Pool'],
        checkIn: '2 PM',
        checkOut: null,
      })
    ).toEqual([]);
  });

  it('asks for photos, amenities and times when all are missing', () => {
    expect(
      posterReadinessHints({ photos: [], amenities: [], checkIn: null, checkOut: null }).map(
        (hint) => hint.id
      )
    ).toEqual(['photos', 'amenities', 'times']);
  });

  it('nudges for more photos when there are only one or two', () => {
    const [hint] = posterReadinessHints({
      photos: ['a'],
      amenities: ['x'],
      checkIn: '2 PM',
      checkOut: '11 AM',
    });
    expect(hint?.id).toBe('photos');
    expect(hint?.text).toMatch(/more photos/);
  });
});
