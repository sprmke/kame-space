import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AnalyticsOverviewSection } from '@/features/dashboard/analytics/components/AnalyticsOverviewSection';
import type { AnalyticsBundle } from '@/features/dashboard/analytics/lib/types';

const ZERO_KPI = {
  value: 0,
  changePctVsPrior: null,
  changePctVsLastYear: null,
};

function emptyBundle(overrides: Partial<AnalyticsBundle> = {}): AnalyticsBundle {
  return {
    tier: 'full',
    period: { from: '2026-11-01', to: '2026-11-30' },
    priorPeriod: { from: '2026-10-01', to: '2026-10-31' },
    lastYearPeriod: { from: '2025-11-01', to: '2025-11-30' },
    kpis: {
      occupancyRate: { value: 40, changePctVsPrior: 10, changePctVsLastYear: null },
      adr: ZERO_KPI,
      revpar: ZERO_KPI,
      grossRevenue: ZERO_KPI,
      netProfit: ZERO_KPI,
      reservations: ZERO_KPI,
      nightsBooked: ZERO_KPI,
      avgLeadTimeDays: ZERO_KPI,
      cancellationRate: ZERO_KPI,
      avgRating: ZERO_KPI,
      repeatGuestRate: ZERO_KPI,
      avgResponseMinutes: ZERO_KPI,
      responseWithin24hRate: ZERO_KPI,
    },
    trend: [],
    distributions: {
      lengthOfStay: [],
      leadTime: [],
      channelMix: [],
      guestAge: [],
      guestOrigins: [],
      partySize: [],
    },
    forward: {
      windowDays: 30,
      nightsBooked: 0,
      nightsAvailable: 30,
      occupancyOnBooks: 0,
      revenueOnBooks: 0,
      gapNights: [],
    },
    bookingPace: [],
    pickup: { last7Days: 0, last30Days: 0 },
    stateAssessment: {
      forwardOccupancyState30d: 'building',
      forwardOccupancyState60d: 'building',
      balanceCollectionState: 'clear',
      unpaidBalanceUpcomingTotal: 0,
      unpaidBalanceUpcomingCount: 0,
    },
    sufficiency: { sampleSize: 0, enough: false },
    publicPage: { pageViews: 0, uniqueVisitors: 0, topReferrers: [] },
    playbook: [],
    benchmark: {
      available: false,
      sampleSize: 0,
      medianOccupancyRate: null,
      occupancyPercentile: null,
      medianAdr: null,
      adrPercentile: null,
    },
    marketing: {
      trackedVisits: 0,
      attributedRequests: 0,
      channels: [],
    },
    ...overrides,
  };
}

function renderOverview(bundle: AnalyticsBundle) {
  return render(
    <MemoryRouter initialEntries={['/org/acme/property/solea/analytics']}>
      <Routes>
        <Route
          path="/org/:orgSlug/property/:propertySlug/analytics"
          element={<AnalyticsOverviewSection bundle={bundle} />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('AnalyticsOverviewSection', () => {
  it('shows Marketing results and not How you compare', () => {
    renderOverview(emptyBundle());

    expect(screen.getByRole('region', { name: 'Marketing results' })).toBeTruthy();
    expect(screen.queryByText('How you compare')).toBeNull();
    expect(screen.queryByText('No peer comparison yet')).toBeNull();
  });

  it('omits Marketing results when the marketing block is missing', () => {
    renderOverview(emptyBundle({ marketing: null }));

    expect(screen.queryByRole('region', { name: 'Marketing results' })).toBeNull();
  });
});

