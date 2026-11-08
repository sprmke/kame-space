import { describe, expect, it } from 'vitest';

import { OPS_SEVERITIES, formatOpsPeriod } from '@/features/dashboard/super-admin/lib/opsReports';

describe('OPS_SEVERITIES', () => {
  it('runs from most to least urgent', () => {
    expect(OPS_SEVERITIES).toEqual(['critical', 'high', 'medium', 'low', 'info']);
  });
});

describe('formatOpsPeriod', () => {
  it('formats the range in Manila terms', () => {
    expect(formatOpsPeriod('2026-11-08T00:00:00Z', '2026-11-14T15:59:59Z')).toBe(
      'Nov 8, 2026 to Nov 14, 2026'
    );
  });

  it('keeps a range that starts late in UTC on the correct Manila day', () => {
    // 16:00 UTC is already the next day in Manila.
    expect(formatOpsPeriod('2026-11-08T16:00:00Z', '2026-11-15T16:00:00Z')).toBe(
      'Nov 9, 2026 to Nov 16, 2026'
    );
  });
});
