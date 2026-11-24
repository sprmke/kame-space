import { describe, expect, it } from 'vitest';

import {
  buildChannelRows,
  buildOriginRows,
  formatPdfPeriod,
  pdfPeso,
} from '@/features/dashboard/analytics/lib/exportPdf';
import type { AnalyticsBundle } from '@/features/dashboard/analytics/lib/types';

function bundleWith(
  channelMix: Array<{ channel: string; count: number; revenue: number }>,
  guestOrigins: Array<{ origin: string; count: number; pct: number }>
): AnalyticsBundle {
  return {
    period: { from: '2026-11-01', to: '2026-11-30' },
    distributions: { channelMix, guestOrigins },
  } as unknown as AnalyticsBundle;
}

describe('pdfPeso', () => {
  it('always names the currency, since the PDF font has no peso glyph', () => {
    expect(pdfPeso(3500)).toBe('PHP 3,500.00');
    expect(pdfPeso(0)).toBe('PHP 0.00');
    expect(pdfPeso(-120)).toBe('-PHP 120.00');
  });
});

describe('formatPdfPeriod', () => {
  it('writes readable dates, not ISO', () => {
    expect(formatPdfPeriod({ from: '2026-11-01', to: '2026-11-30' })).toBe(
      'Nov 1, 2026 to Nov 30, 2026'
    );
  });

  it('keeps the selected range label in brackets', () => {
    expect(formatPdfPeriod({ from: '2026-11-01', to: '2026-11-30' }, 'November 2026')).toBe(
      'Nov 1, 2026 to Nov 30, 2026 (November 2026)'
    );
  });
});

describe('distribution tables', () => {
  it('keeps channels and origins in separate tables (no cross-join)', () => {
    const bundle = bundleWith(
      [
        { channel: 'airbnb', count: 5, revenue: 17_500 },
        { channel: 'direct', count: 3, revenue: 10_500 },
      ],
      [
        { origin: 'Makati, Metro Manila', count: 4, pct: 50 },
        { origin: 'Cebu City, Cebu', count: 2, pct: 25 },
        { origin: 'Singapore', count: 2, pct: 25 },
      ]
    );

    expect(buildChannelRows(bundle)).toEqual([
      ['Airbnb', '5'],
      ['Direct', '3'],
    ]);
    expect(buildOriginRows(bundle)).toEqual([
      ['Makati, Metro Manila', '50%'],
      ['Cebu City, Cebu', '25%'],
      ['Singapore', '25%'],
    ]);
  });
});
