import { describe, expect, it } from 'vitest';

import {
  parseSearchParams,
  writeSearchParams,
  buildSearchHref,
} from '@/features/guest/search/lib/searchParams';

describe('parseSearchParams', () => {
  it('parseSearchParams is exported', () => {
    expect(typeof parseSearchParams).toBe('function');
  });
});

describe('writeSearchParams', () => {
  it('writeSearchParams is exported', () => {
    expect(typeof writeSearchParams).toBe('function');
  });
});

describe('buildSearchHref', () => {
  it('buildSearchHref is exported', () => {
    expect(typeof buildSearchHref).toBe('function');
  });
});

describe('flexible dates', () => {
  it('reads flex only alongside both dates', () => {
    const withDates = parseSearchParams(
      new URLSearchParams('checkIn=2026-12-01&checkOut=2026-12-03&flex=2')
    );
    expect(withDates.flex).toBe(2);
    expect(parseSearchParams(new URLSearchParams('checkIn=2026-12-01&flex=2')).flex).toBe(0);
    expect(parseSearchParams(new URLSearchParams('flex=2')).flex).toBe(0);
  });

  it('ignores values outside the offered windows', () => {
    const query = parseSearchParams(
      new URLSearchParams('checkIn=2026-12-01&checkOut=2026-12-03&flex=5')
    );
    expect(query.flex).toBe(0);
  });

  it('round-trips through the URL and drops flex without dates', () => {
    const query = parseSearchParams(
      new URLSearchParams('checkIn=2026-12-01&checkOut=2026-12-03&flex=7')
    );
    expect(writeSearchParams(query).get('flex')).toBe('7');
    expect(writeSearchParams({ ...query, checkOut: '' }).has('flex')).toBe(false);
  });

  it('builds a shareable href with flex', () => {
    expect(
      buildSearchHref({ where: 'Makati', checkIn: '2026-12-01', checkOut: '2026-12-03', flex: 3 })
    ).toBe('/search?where=Makati&checkIn=2026-12-01&checkOut=2026-12-03&flex=3');
    expect(buildSearchHref({ where: 'Makati', flex: 3 })).toBe('/search?where=Makati');
  });
});
