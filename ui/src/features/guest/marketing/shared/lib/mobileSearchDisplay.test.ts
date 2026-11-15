import { describe, expect, it } from 'vitest';

import {
  formatGuestCountShort,
  formatRecentSearchMeta,
  MOBILE_SEARCH_CATEGORIES,
} from '@/features/guest/marketing/shared/lib/mobileSearchDisplay';
import type { RecentSearch } from '@/features/guest/marketing/shared/lib/mobileSearchState';

const makati: RecentSearch = {
  where: 'Makati',
  checkIn: '2099-11-20',
  checkOut: '2099-11-22',
  adults: 2,
  children: 1,
  pets: 0,
  type: 'properties',
};

describe('formatRecentSearchMeta', () => {
  it('formats the meta line', () => {
    expect(formatRecentSearchMeta(makati)).toBe('Nov 20 – 22 · 3 guests');
    expect(formatRecentSearchMeta({ ...makati, checkIn: '', checkOut: '' })).toBe(
      'Any week · 3 guests'
    );
    expect(formatRecentSearchMeta({ ...makati, type: 'parkings' })).toBe('Nov 20 – 22');
  });

  it('ignores malformed stored dates', () => {
    expect(formatRecentSearchMeta({ ...makati, checkIn: 'soon', checkOut: '' })).toBe(
      'Any week · 3 guests'
    );
  });
});

describe('formatGuestCountShort', () => {
  it('pluralizes guests and pets and drops zeros', () => {
    expect(formatGuestCountShort(1, 0)).toBe('1 guest');
    expect(formatGuestCountShort(3, 2)).toBe('3 guests, 2 pets');
    expect(formatGuestCountShort(0, 1)).toBe('1 pet');
    expect(formatGuestCountShort(0, 0)).toBe('');
  });
});

describe('MOBILE_SEARCH_CATEGORIES', () => {
  it('lists All first, then the three listing families', () => {
    expect(MOBILE_SEARCH_CATEGORIES.map((c) => c.id)).toEqual([
      'all',
      'properties',
      'developments',
      'parkings',
    ]);
  });
});
