import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { MarketingResultsCard } from '@/features/dashboard/analytics/components/MarketingResultsCard';
import type { MarketingResults } from '@/features/dashboard/analytics/lib/types';

const EMPTY: MarketingResults = {
  trackedVisits: 0,
  attributedRequests: 0,
  channels: [],
};

const WITH_DATA: MarketingResults = {
  trackedVisits: 12,
  attributedRequests: 2,
  channels: [
    { channel: 'facebook_page', visits: 8, requests: 1 },
    { channel: 'instagram', visits: 4, requests: 1 },
  ],
};

function renderCard(marketing: MarketingResults) {
  return render(
    <MemoryRouter initialEntries={['/org/acme/property/solea/analytics']}>
      <Routes>
        <Route
          path="/org/:orgSlug/property/:propertySlug/analytics"
          element={<MarketingResultsCard marketing={marketing} />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('MarketingResultsCard', () => {
  it('centers the empty state and links Open plan to the listing plan', () => {
    renderCard(EMPTY);

    expect(screen.getByText('No tracked planner visits in this period.')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Open plan' });
    expect(link.getAttribute('href')).toBe('/org/acme/property/solea/marketing?plan=1');
  });

  it('shows tracked visits and channel rows when data exists', () => {
    renderCard(WITH_DATA);

    expect(screen.getByText(/At least 12 visits and 2 booking requests/)).toBeTruthy();
    expect(screen.getByText(/8 visits/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open plan' })).toBeTruthy();
  });
});

