import { describe, expect, it } from 'vitest';

import {
  humanizeAiReview,
  humanizeReviewText,
} from '@/features/dashboard/analytics/lib/aiReviewCopy';
import type { AnalyticsAiReviewRecord } from '@/features/dashboard/analytics/lib/aiReviewTypes';

const THIS_YEAR = new Date().getFullYear();

function review(overrides: Partial<AnalyticsAiReviewRecord> = {}): AnalyticsAiReviewRecord {
  return {
    id: 'review-1',
    generated_at: '2026-11-22T02:00:00.000Z',
    model: 'test',
    headline: 'Monaco 2604: ADR held at PHP 3500 while occupancy cooled.',
    score: 74,
    score_delta: 4,
    period_start: '2026-11-01',
    period_end: '2026-11-30',
    payload: {
      strengths: [
        {
          title: 'Rate is holding',
          evidence: 'Average nightly rate is PHP 3480, up 4.1%.',
        },
      ],
      improvements: [
        {
          title: 'Collect the balances',
          why: "Two stays still owe PHP 16500, putting your balance collection state at 'at_risk'.",
          action: 'Send a reminder on 2026-11-21.',
          deepLink: null,
        },
      ],
      avoid: [
        {
          title: 'Do not cut the rate',
          why: 'A smart pricing change on 2026-11-18 already moved the weekend.',
          deepLink: null,
        },
      ],
      metricsSnapshot: {},
    },
    ...overrides,
  };
}

describe('humanizeReviewText', () => {
  it('turns ISO dates into short Manila-style dates', () => {
    expect(humanizeReviewText(`change on ${THIS_YEAR}-11-21`)).toBe('change on Nov 21');
    expect(humanizeReviewText('change on 2020-01-05')).toBe('change on Jan 5, 2020');
  });

  it('replaces internal state ids with plain words', () => {
    expect(humanizeReviewText("balance collection state at 'at_risk'")).toBe(
      'balance collection state at risk'
    );
    expect(humanizeReviewText('collection_state=attention_needed')).toBe(
      'collection_state=needs attention'
    );
    expect(humanizeReviewText('state is needs attention')).toBe('state needs attention');
  });

  it('formats raw PHP amounts as pesos', () => {
    expect(humanizeReviewText('owes PHP 16500 before check-in')).toBe(
      'owes ₱16,500 before check-in'
    );
    expect(humanizeReviewText('ringgit PHP 3,500.50')).toBe('ringgit ₱3,500.50');
  });

  it('uses the page labels for internal metric names', () => {
    expect(humanizeReviewText('ADR held, RevPAR rose')).toBe(
      'average nightly rate held, revenue per night rose'
    );
  });

  it('leaves clean text untouched', () => {
    expect(humanizeReviewText('Occupancy held at 40%.')).toBe('Occupancy held at 40%.');
  });
});

describe('humanizeAiReview', () => {
  it('cleans the headline and every item field', () => {
    const cleaned = humanizeAiReview(review());
    expect(cleaned).not.toBeNull();
    expect(cleaned?.headline).toBe(
      'Monaco 2604: average nightly rate held at ₱3,500 while occupancy cooled.'
    );
    expect(cleaned?.payload.strengths[0].evidence).toBe('Average nightly rate is ₱3,480, up 4.1%.');
    expect(cleaned?.payload.improvements[0].why).toBe(
      'Two stays still owe ₱16,500, putting your balance collection state at risk.'
    );
    expect(cleaned?.payload.improvements[0].action).toBe('Send a reminder on Nov 21.');
    expect(cleaned?.payload.avoid[0].why).toBe(
      'A smart pricing change on Nov 18 already moved the weekend.'
    );
  });

  it('returns null for a missing review', () => {
    expect(humanizeAiReview(null)).toBeNull();
  });
});
