import { describe, expect, it } from 'vitest';

import {
  isAnalyticsSection,
  resolveAnalyticsSection,
  writeAnalyticsSectionParam,
} from '@/features/dashboard/analytics/lib/analyticsSection';

describe('resolveAnalyticsSection', () => {
  it('defaults to overview when the param is missing or unknown', () => {
    expect(resolveAnalyticsSection(new URLSearchParams())).toBe('overview');
    expect(resolveAnalyticsSection(new URLSearchParams('section=reports'))).toBe('overview');
  });

  it('reads a valid tab from the URL', () => {
    expect(resolveAnalyticsSection(new URLSearchParams('section=trends'))).toBe('trends');
    expect(resolveAnalyticsSection(new URLSearchParams('section=ai-review'))).toBe('ai-review');
  });
});

describe('writeAnalyticsSectionParam', () => {
  it('keeps overview out of the URL', () => {
    const next = writeAnalyticsSectionParam(
      'overview',
      new URLSearchParams('section=guests&from=2026-11-01')
    );
    expect(next.get('section')).toBeNull();
    expect(next.get('from')).toBe('2026-11-01');
  });

  it('sets the tab and preserves the period params', () => {
    const next = writeAnalyticsSectionParam(
      'ai-review',
      new URLSearchParams('from=2026-11-01&to=2026-11-30')
    );
    expect(next.get('section')).toBe('ai-review');
    expect(next.get('from')).toBe('2026-11-01');
    expect(next.get('to')).toBe('2026-11-30');
  });
});

describe('isAnalyticsSection', () => {
  it('guards the four known tabs', () => {
    expect(isAnalyticsSection('guests')).toBe(true);
    expect(isAnalyticsSection('guests ')).toBe(false);
    expect(isAnalyticsSection(null)).toBe(false);
  });
});
