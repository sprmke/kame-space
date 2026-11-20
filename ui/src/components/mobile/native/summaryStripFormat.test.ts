import { describe, expect, it } from 'vitest';

import {
  formatSummarySegment,
  formatSummaryStrip,
  summaryStripNeedsWrap,
} from '@/components/mobile/native/summaryStripFormat';

describe('summaryStrip', () => {
  it('formats count + label', () => {
    expect(formatSummarySegment({ count: 3, label: 'action required' })).toBe('3 action required');
  });

  it('omits count when null', () => {
    expect(formatSummarySegment({ label: 'All clear' })).toBe('All clear');
  });

  it('joins with middle dot', () => {
    expect(
      formatSummaryStrip([
        { count: 3, label: 'action required' },
        { count: 2, label: 'pending docs' },
        { count: 26, label: 'confirmed' },
      ])
    ).toBe('3 action required · 2 pending docs · 26 confirmed');
  });

  it('flags long strips for wrap', () => {
    expect(
      summaryStripNeedsWrap([
        { count: 3, label: 'action required' },
        { count: 2, label: 'pending docs' },
        { count: 26, label: 'confirmed' },
      ])
    ).toBe(true);
    expect(summaryStripNeedsWrap([{ count: 1, label: 'due' }])).toBe(false);
  });
});
