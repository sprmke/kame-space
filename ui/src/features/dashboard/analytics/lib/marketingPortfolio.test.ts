import { describe, expect, it } from 'vitest';

import type { OrgPortfolioRow } from '@/features/dashboard/analytics/lib/types';
import {
  orgPropertyPlanHref,
  rankListingsForPromotion,
} from '@/features/dashboard/analytics/lib/marketingPortfolio';

function property(overrides: Partial<Extract<OrgPortfolioRow, { locked: false }>> = {}) {
  return {
    kind: 'property' as const,
    id: 'p1',
    name: 'Solea',
    slug: 'solea',
    propertyId: 'p1',
    propertyName: 'Solea',
    propertySlug: 'solea',
    locked: false as const,
    occupancyRate: 50,
    adr: 3000,
    revpar: 1500,
    grossRevenue: 1000,
    reservations: 2,
    cancellationRate: 0,
    forwardOccupancyState30d: 'building' as const,
    forwardOccupancyRate30d: 50,
    balanceCollectionState: 'clear' as const,
    occupiedNights: 10,
    periodDays: 30,
    ...overrides,
  };
}

describe('rankListingsForPromotion', () => {
  it('ranks by open nights times ADR', () => {
    const ranked = rankListingsForPromotion([
      property({ id: 'a', name: 'A', slug: 'a', adr: 2000, forwardOccupancyRate30d: 50 }),
      property({ id: 'b', name: 'B', slug: 'b', adr: 5000, forwardOccupancyRate30d: 20 }),
      property({ id: 'c', name: 'C', slug: 'c', adr: 1000, forwardOccupancyRate30d: 90 }),
    ]);
    expect(ranked.map((row) => row.id)).toEqual(['b', 'a', 'c']);
    expect(ranked[0]).toMatchObject({ openNights: 24, score: 120_000 });
  });

  it('skips sold-out listings and locked rows', () => {
    const ranked = rankListingsForPromotion([
      property({ id: 'full', forwardOccupancyRate30d: 100 }),
      { ...property({ id: 'locked' }), locked: true } as unknown as OrgPortfolioRow,
    ]);
    expect(ranked).toEqual([]);
  });

  it('skips parkings', () => {
    const ranked = rankListingsForPromotion([
      property({ id: 'parking', kind: 'parking', forwardOccupancyRate30d: 0 }),
    ]);
    expect(ranked).toEqual([]);
  });

  it('clamps a nonsense occupancy rate instead of producing a huge score', () => {
    const ranked = rankListingsForPromotion([property({ forwardOccupancyRate30d: -40 })]);
    expect(ranked[0].openNights).toBe(30);
  });

  it('respects the limit', () => {
    const rows = Array.from({ length: 5 }, (_, index) =>
      property({ id: `p${index}`, slug: `p${index}`, forwardOccupancyRate30d: 50 })
    );
    expect(rankListingsForPromotion(rows, { limit: 2 })).toHaveLength(2);
  });
});

describe('orgPropertyPlanHref', () => {
  it('points at the plan tab with the today window', () => {
    expect(orgPropertyPlanHref('sample-stays', 'solea')).toBe(
      '/org/sample-stays/property/solea/marketing?tab=plan&range=today'
    );
  });
});
