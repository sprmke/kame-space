import { describe, expect, it } from 'vitest';

import {
  pricingCalendarFormGridClassName,
  pricingCalendarOutsideCellClassName,
  pricingCalendarWeekGapClassName,
} from './pricingCalendarLayout';

describe('pricingCalendarFormGridClassName', () => {
  it('uses a narrower rates column when compact chrome is on', () => {
    expect(pricingCalendarFormGridClassName(true)).toContain('minmax(12.5rem,16rem)');
    expect(pricingCalendarFormGridClassName(true)).not.toContain('340px');
  });

  it('uses the default rates column width when compact chrome is off', () => {
    expect(pricingCalendarFormGridClassName(false)).toContain('340px');
  });
});

describe('pricingCalendarWeekGapClassName', () => {
  it('tightens the gap below sm so seven day columns fit a phone', () => {
    expect(pricingCalendarWeekGapClassName(true)).toContain('gap-0.5');
  });
});

describe('pricingCalendarOutsideCellClassName', () => {
  it('does not force a square width below sm', () => {
    const className = pricingCalendarOutsideCellClassName(true);
    expect(className).toContain('sm:aspect-square');
    expect(className).not.toMatch(/(^|\s)aspect-square(\s|$)/);
  });
});
