import { describe, expect, it } from 'vitest';

import {
  buildSearchValues,
  formatDateRange,
  formatGuestSummary,
  formatGuestSummaryCompact,
  normalizeStayRange,
  parseDateParam,
  parseGuestBreakdown,
  readWhereParam,
  computeDropdownLayout,
} from '@/features/guest/marketing/shared/lib/heroSearchState';

describe('heroSearchState', () => {
  it('parses dates and rejects garbage', () => {
    expect(parseDateParam('2026-08-05')?.getDate()).toBe(5);
    expect(parseDateParam('nope')).toBeUndefined();
    expect(parseDateParam(null)).toBeUndefined();
  });

  it('reads the guest breakdown with a legacy guests fallback', () => {
    expect(parseGuestBreakdown(new URLSearchParams('adults=0&children=2&pets=1'))).toEqual({
      adults: 1,
      children: 2,
      infants: 0,
      pets: 1,
    });
    expect(parseGuestBreakdown(new URLSearchParams('guests=4')).adults).toBe(4);
    expect(parseGuestBreakdown(new URLSearchParams('')).adults).toBe(2);
  });

  it('prefers where over legacy location and falls back to the default', () => {
    expect(readWhereParam(new URLSearchParams('where=Makati&location=Cebu'))).toBe('Makati');
    expect(readWhereParam(new URLSearchParams('location=Cebu'))).toBe('Cebu');
    expect(readWhereParam(new URLSearchParams('where=%20%20'), 'Tagaytay')).toBe('Tagaytay');
  });

  it('builds submit values and summaries', () => {
    const range = { from: new Date(2026, 7, 5), to: new Date(2026, 7, 7) };
    const counts = { adults: 2, children: 1, infants: 0, pets: 1 };
    expect(buildSearchValues(' Makati ', range, counts)).toEqual({
      location: 'Makati',
      checkIn: '2026-08-05',
      checkOut: '2026-08-07',
      guests: '3',
    });
    expect(formatGuestSummary(counts)).toBe('3 guests, 1 pet');
    expect(formatGuestSummaryCompact({ adults: 0, children: 0, infants: 0, pets: 2 })).toBe(
      '2 pet'
    );
    expect(formatDateRange(range)).toBe('Aug 5 – Aug 7');
    expect(formatDateRange(undefined)).toBe('');
  });

  it('turns a single-day pick into a one-night stay', () => {
    const sameDay = { from: new Date(2026, 10, 12), to: new Date(2026, 10, 12) };
    const counts = { adults: 2, children: 0, infants: 0, pets: 0 };

    expect(normalizeStayRange(sameDay)).toEqual({
      from: new Date(2026, 10, 12),
      to: new Date(2026, 10, 13),
    });
    expect(buildSearchValues('Cebu', sameDay, counts).checkOut).toBe('2026-11-13');
    // A first click (no end date yet) is left alone so the user can pick the end.
    expect(normalizeStayRange({ from: new Date(2026, 10, 12) })).toEqual({
      from: new Date(2026, 10, 12),
    });
  });
});


describe('computeDropdownLayout', () => {
  function rect(partial: Partial<DOMRect> & { top: number; left: number; width: number; height: number }): DOMRect {
    const right = partial.left + partial.width;
    const bottom = partial.top + partial.height;
    return {
      x: partial.left,
      y: partial.top,
      top: partial.top,
      left: partial.left,
      width: partial.width,
      height: partial.height,
      right,
      bottom,
      toJSON() {
        return this;
      },
    };
  }

  function el(box: DOMRect): HTMLElement {
    return { getBoundingClientRect: () => box } as HTMLElement;
  }

  it('places the panel below the bar by default', () => {
    const root = el(rect({ top: 100, left: 40, width: 800, height: 80 }));
    const bar = el(rect({ top: 100, left: 40, width: 800, height: 64 }));
    const segment = el(rect({ top: 108, left: 48, width: 220, height: 48 }));
    const layout = computeDropdownLayout('where', root, bar, segment, 1, 380);
    expect(layout.top).toBe(76); // bar bottom (164) - root top (100) + 12
    expect(layout.height).toBe(380);
  });

  it('places the panel above the bar when placement is above', () => {
    const root = el(rect({ top: 400, left: 40, width: 800, height: 80 }));
    const bar = el(rect({ top: 400, left: 40, width: 800, height: 64 }));
    const segment = el(rect({ top: 408, left: 48, width: 220, height: 48 }));
    const layout = computeDropdownLayout('where', root, bar, segment, 1, 380, 'above');
    expect(layout.top).toBe(-392); // 0 - 380 - 12
    expect(layout.height).toBe(380);
  });
});
