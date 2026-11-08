import { describe, expect, it } from 'vitest';

import type { ForwardOccupancyState } from '@/features/dashboard/analytics/lib/types';
import {
  ORG_OUTLOOK_LABEL,
  ORG_SOFT_OCCUPANCY_PCT,
  listingNeedsAttention,
} from '@/features/dashboard/analytics/lib/orgPortfolioLabels';

const STATES: ForwardOccupancyState[] = ['underbooked', 'building', 'strong', 'fully_booked'];

describe('ORG_OUTLOOK_LABEL', () => {
  it('labels every outlook state', () => {
    for (const state of STATES) {
      expect(ORG_OUTLOOK_LABEL[state].trim()).not.toBe('');
    }
  });

  it('keeps soft demand at 40% occupancy', () => {
    expect(ORG_SOFT_OCCUPANCY_PCT).toBe(40);
  });
});

describe('listingNeedsAttention', () => {
  it('never flags a locked listing', () => {
    expect(listingNeedsAttention({ locked: true, reservations: 0 })).toBe(false);
  });

  it('flags an underbooked outlook', () => {
    expect(
      listingNeedsAttention({ forwardOccupancyState30d: 'underbooked', reservations: 5 })
    ).toBe(true);
  });

  it('flags a listing with no reservations', () => {
    expect(listingNeedsAttention({ reservations: 0, occupancyRate: 90 })).toBe(true);
  });

  it('flags soft occupancy only when there are bookings', () => {
    expect(listingNeedsAttention({ reservations: 2, occupancyRate: 30 })).toBe(true);
    expect(listingNeedsAttention({ reservations: 0, occupancyRate: 30 })).toBe(true);
    expect(listingNeedsAttention({ reservations: 2, occupancyRate: 40 })).toBe(false);
  });

  it('accepts a healthy listing', () => {
    expect(
      listingNeedsAttention({
        forwardOccupancyState30d: 'strong',
        reservations: 12,
        occupancyRate: 82,
      })
    ).toBe(false);
  });

  it('does not treat an unknown occupancy rate as soft', () => {
    expect(listingNeedsAttention({ reservations: 3 })).toBe(false);
  });
});
