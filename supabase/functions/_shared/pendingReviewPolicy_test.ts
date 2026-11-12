import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  PENDING_REVIEW_CHASE_LEAD_DAYS,
  PENDING_REVIEW_EXPIRY_DAYS,
  decidePendingReviewAction,
  pendingReviewAmountPaid,
} from './pendingReviewPolicy.ts';

const NOW = new Date('2026-12-10T00:00:00.000Z');

function isoDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function decide(overrides: Partial<Parameters<typeof decidePendingReviewAction>[0]> = {}) {
  return decidePendingReviewAction({
    status: 'PENDING_REVIEW',
    createdAt: isoDaysAgo(0),
    chasedAt: null,
    amountPaidPhp: 0,
    now: NOW,
    ...overrides,
  });
}

Deno.test('pendingReview - a fresh request only waits', () => {
  assertEquals(decide({ createdAt: isoDaysAgo(0) }), 'wait');
  assertEquals(decide({ createdAt: isoDaysAgo(1) }), 'wait');
});

Deno.test('pendingReview - chases once the lead window opens', () => {
  assertEquals(decide({ createdAt: isoDaysAgo(2) }), 'wait');
  assertEquals(decide({ createdAt: isoDaysAgo(1) }), 'wait');
  // chaseAt = window - lead = 5 days
  assertEquals(decide({ createdAt: isoDaysAgo(5) }), 'chase');
  assertEquals(decide({ createdAt: isoDaysAgo(6) }), 'chase');
});

Deno.test('pendingReview - never chases twice', () => {
  assertEquals(decide({ createdAt: isoDaysAgo(6), chasedAt: isoDaysAgo(2) }), 'wait');
  assertEquals(decide({ createdAt: isoDaysAgo(6), chasedAt: isoDaysAgo(0) }), 'wait');
});

Deno.test('pendingReview - expires only after the window AND a full notice period', () => {
  // Chased two days ago, past the window: expire.
  assertEquals(decide({ createdAt: isoDaysAgo(7), chasedAt: isoDaysAgo(2) }), 'expire');
  assertEquals(decide({ createdAt: isoDaysAgo(30), chasedAt: isoDaysAgo(9) }), 'expire');

  // Past the window but the chase just went out: the host still gets the full notice.
  assertEquals(decide({ createdAt: isoDaysAgo(7), chasedAt: isoDaysAgo(0) }), 'wait');
  assertEquals(decide({ createdAt: isoDaysAgo(7), chasedAt: isoDaysAgo(1) }), 'wait');

  // Full notice but not yet at the window.
  assertEquals(decide({ createdAt: isoDaysAgo(6), chasedAt: isoDaysAgo(2) }), 'wait');
});

Deno.test('pendingReview - a booking with money on it is never auto-expired', () => {
  assertEquals(
    decide({ createdAt: isoDaysAgo(30), chasedAt: isoDaysAgo(20), amountPaidPhp: 5000 }),
    'wait'
  );
  // ...but it is still chased, so the host knows it is sitting there.
  assertEquals(decide({ createdAt: isoDaysAgo(6), amountPaidPhp: 5000 }), 'chase');
});

Deno.test('pendingReview - only PENDING_REVIEW is touched', () => {
  for (const status of ['PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'CANCELLED', 'COMPLETED', '']) {
    assertEquals(decide({ status, createdAt: isoDaysAgo(30), chasedAt: isoDaysAgo(20) }), 'wait');
  }
});

Deno.test('pendingReview - a missing or future createdAt is left alone', () => {
  assertEquals(decide({ createdAt: null }), 'wait');
  assertEquals(decide({ createdAt: '' }), 'wait');
  assertEquals(decide({ createdAt: 'not-a-date' }), 'wait');
  assertEquals(decide({ createdAt: isoDaysAgo(-3) }), 'wait');
});

Deno.test('pendingReview - the notice period is real time, not a restatement of the window', () => {
  // The invariant only holds if these two are distinct.
  assertEquals(PENDING_REVIEW_EXPIRY_DAYS > PENDING_REVIEW_CHASE_LEAD_DAYS, true);
});

Deno.test('pendingReviewAmountPaid - sums down payment and settled balance', () => {
  assertEquals(pendingReviewAmountPaid({ down_payment: 1000, guest_balance_paid_amount: 500 }), 1500);
  assertEquals(pendingReviewAmountPaid({ down_payment: 1000, guest_balance_paid_amount: null }), 1000);
  assertEquals(pendingReviewAmountPaid({ down_payment: null, guest_balance_paid_amount: null }), 0);
  assertEquals(pendingReviewAmountPaid({ down_payment: 0, guest_balance_paid_amount: 0 }), 0);
  // A refunded or corrupt negative must never read as "paid".
  assertEquals(pendingReviewAmountPaid({ down_payment: -500 }), 0);
});
