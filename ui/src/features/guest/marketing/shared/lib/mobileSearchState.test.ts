import { describe, expect, it } from 'vitest';

import {
  categoryFromPreferType,
  formatRecentSearchMeta,
  formatStayRangeShort,
  mobilePillSummary,
  preferTypeFromCategory,
  readRecentSearches,
  RECENT_SEARCHES_KEY,
  RECENT_SEARCHES_MAX,
  saveRecentSearch,
  showsCategoryTabs,
  stepsForCategory,
  whenStepTitle,
  type RecentSearch,
} from '@/features/guest/marketing/shared/lib/mobileSearchState';

function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(RECENT_SEARCHES_KEY, initial);
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const makati: RecentSearch = {
  where: 'Makati',
  checkIn: '2099-11-20',
  checkOut: '2099-11-22',
  adults: 2,
  children: 1,
  pets: 0,
  type: 'properties',
};

describe('categories', () => {
  it('round-trips prefer type and All', () => {
    expect(categoryFromPreferType(null)).toBe('all');
    expect(categoryFromPreferType('parkings')).toBe('parkings');
    expect(preferTypeFromCategory('all')).toBeNull();
    expect(preferTypeFromCategory('developments')).toBe('developments');
  });

  it('shows category tabs everywhere except services', () => {
    for (const path of ['/', '/search', '/properties', '/parkings/in/makati', '/developments/x']) {
      expect(showsCategoryTabs(path)).toBe(true);
    }
    expect(showsCategoryTabs('/services')).toBe(false);
    expect(showsCategoryTabs('/services/cleaning')).toBe(false);
  });

  it('drops the guest step for parking only', () => {
    expect(stepsForCategory('parkings')).toEqual(['where', 'when']);
    expect(stepsForCategory('all')).toEqual(['where', 'when', 'who']);
    expect(stepsForCategory('properties')).toEqual(['where', 'when', 'who']);
  });

  it('names the date step by category', () => {
    expect(whenStepTitle('parkings')).toBe('When do you need it?');
    expect(whenStepTitle('all')).toBe("When's your trip?");
  });
});

describe('formatStayRangeShort', () => {
  const d = (iso: string) => new Date(`${iso}T12:00:00`);

  it('collapses the month inside one month', () => {
    expect(formatStayRangeShort(d('2026-11-20'), d('2026-11-22'))).toBe('Nov 20 – 22');
  });

  it('keeps both months across a month boundary', () => {
    expect(formatStayRangeShort(d('2026-11-30'), d('2026-12-02'))).toBe('Nov 30 – Dec 2');
  });

  it('adds years across a year boundary', () => {
    expect(formatStayRangeShort(d('2026-12-30'), d('2027-01-02'))).toBe(
      'Dec 30, 2026 – Jan 2, 2027'
    );
  });

  it('handles a lone start date and no date', () => {
    expect(formatStayRangeShort(d('2026-11-20'), undefined)).toBe('Nov 20');
    expect(formatStayRangeShort(undefined, undefined)).toBe('');
  });
});

describe('mobilePillSummary', () => {
  const base = { where: '', dateSummary: '', guestSummary: '2 guests', showWho: true };

  it('stays empty when only the default guest count is present', () => {
    expect(mobilePillSummary({ ...base, hasGuestParams: false })).toBeNull();
  });

  it('summarises place, dates and guests', () => {
    expect(
      mobilePillSummary({
        ...base,
        where: 'Makati',
        dateSummary: 'Nov 20 – 22',
        hasGuestParams: true,
      })
    ).toEqual({ primary: 'Makati', secondary: 'Nov 20 – 22 · 2 guests' });
  });

  it('fills gaps with Anywhere, Any week and Add guests', () => {
    expect(mobilePillSummary({ ...base, where: 'Cebu', hasGuestParams: false })).toEqual({
      primary: 'Cebu',
      secondary: 'Any week · Add guests',
    });
    expect(
      mobilePillSummary({ ...base, dateSummary: 'Nov 20 – 22', hasGuestParams: false })
    ).toEqual({ primary: 'Anywhere', secondary: 'Nov 20 – 22 · Add guests' });
  });

  it('omits guests when the surface has no guest step', () => {
    expect(
      mobilePillSummary({ ...base, where: 'BGC', showWho: false, hasGuestParams: true })
    ).toEqual({ primary: 'BGC', secondary: 'Any week' });
  });
});

describe('recent searches', () => {
  it('saves newest first, de-duplicates and caps the list', () => {
    const storage = memoryStorage();
    saveRecentSearch(makati, storage);
    saveRecentSearch({ ...makati, where: 'Cebu' }, storage);
    const list = saveRecentSearch({ ...makati, where: 'makati' }, storage);
    expect(list.map((row) => row.where)).toEqual(['makati', 'Cebu']);

    for (let i = 0; i < 10; i += 1) saveRecentSearch({ ...makati, where: `Place ${i}` }, storage);
    expect(readRecentSearches(storage, '2026-01-01')).toHaveLength(RECENT_SEARCHES_MAX);
  });

  it('ignores corrupt storage and empty entries', () => {
    expect(readRecentSearches(memoryStorage('{not json'), '2026-01-01')).toEqual([]);
    expect(readRecentSearches(memoryStorage('{"a":1}'), '2026-01-01')).toEqual([]);
    expect(
      readRecentSearches(
        memoryStorage(
          JSON.stringify([
            { where: '', checkIn: '' },
            { where: 'Iloilo', type: 'x' },
          ])
        ),
        '2026-01-01'
      )
    ).toEqual([
      {
        where: 'Iloilo',
        checkIn: '',
        checkOut: '',
        adults: 1,
        children: 0,
        pets: 0,
        type: 'all',
      },
    ]);
  });

  it('drops searches whose dates have started', () => {
    const storage = memoryStorage(JSON.stringify([{ ...makati, checkIn: '2020-01-01' }, makati]));
    expect(readRecentSearches(storage, '2026-01-01').map((row) => row.checkIn)).toEqual([
      '2099-11-20',
    ]);
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readRecentSearches(broken, '2026-01-01')).toEqual([]);
    // The write fails, but the caller still gets this session's list back.
    expect(saveRecentSearch(makati, broken)).toEqual([makati]);
    expect(readRecentSearches(null)).toEqual([]);
  });

  it('formats the meta line', () => {
    expect(formatRecentSearchMeta(makati)).toBe('Nov 20 – 22 · 3 guests');
    expect(formatRecentSearchMeta({ ...makati, checkIn: '', checkOut: '' })).toBe(
      'Any week · 3 guests'
    );
    expect(formatRecentSearchMeta({ ...makati, type: 'parkings' })).toBe('Nov 20 – 22');
  });
});

describe('recent search hardening', () => {
  it('caps tampered guest counts at the stepper limits', () => {
    const storage = memoryStorage(
      JSON.stringify([{ ...makati, adults: 100000, children: 99, pets: 40 }])
    );
    const [entry] = readRecentSearches(storage, '2026-01-01');
    expect(entry).toMatchObject({ adults: 16, children: 16, pets: 5 });
  });
});
