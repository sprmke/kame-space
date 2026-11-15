import { describe, expect, it } from 'vitest';

import {
  flexForRange,
  flexOptionLabel,
  flexSummarySuffix,
  parseFlexDaysParam,
  SEARCH_FLEX_DAYS,
} from './searchFlexDays';

describe('parseFlexDaysParam', () => {
  it('accepts only the offered windows', () => {
    for (const days of SEARCH_FLEX_DAYS) expect(parseFlexDaysParam(String(days))).toBe(days);
    expect(parseFlexDaysParam('5')).toBe(0);
    expect(parseFlexDaysParam('-1')).toBe(0);
    expect(parseFlexDaysParam('two')).toBe(0);
    expect(parseFlexDaysParam(null)).toBe(0);
    expect(parseFlexDaysParam(undefined)).toBe(0);
  });
});

describe('flexForRange', () => {
  it('keeps flex only with both dates', () => {
    expect(flexForRange(2, '2026-12-01', '2026-12-03')).toBe(2);
    expect(flexForRange(2, '2026-12-01', '')).toBe(0);
    expect(flexForRange(2, '', '')).toBe(0);
  });

  it('drops values outside the allowlist', () => {
    expect(flexForRange(4, '2026-12-01', '2026-12-03')).toBe(0);
  });
});

describe('labels', () => {
  it('reads like the chips', () => {
    expect(flexOptionLabel(0)).toBe('Exact dates');
    expect(flexOptionLabel(1)).toBe('± 1 day');
    expect(flexOptionLabel(7)).toBe('± 7 days');
  });

  it('adds a compact suffix only when flexible', () => {
    expect(flexSummarySuffix(0)).toBe('');
    expect(flexSummarySuffix(3)).toBe(' (±3)');
    expect(flexSummarySuffix(9)).toBe('');
  });
});
