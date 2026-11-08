import { describe, expect, it } from 'vitest';

import type { MarketingGuestReview } from '@/features/dashboard/marketing/lib/marketingGuestReview';
import {
  setPendingMarketingReview,
  takePendingMarketingReview,
} from '@/features/dashboard/marketing/lib/marketingReviewHandoff';

const REVIEW = { id: 'review-1', quote: 'Lovely stay' } as unknown as MarketingGuestReview;

describe('marketing review handoff', () => {
  it('is consumed exactly once', () => {
    setPendingMarketingReview(REVIEW);

    expect(takePendingMarketingReview()).toBe(REVIEW);
    expect(takePendingMarketingReview()).toBeNull();
  });

  it('can be cleared before it is read', () => {
    setPendingMarketingReview(REVIEW);
    setPendingMarketingReview(null);

    expect(takePendingMarketingReview()).toBeNull();
  });
});
