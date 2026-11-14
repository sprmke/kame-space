import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  openNightsLeftInMonth,
  validateAvailabilityClaims,
  validateClaims,
} from './marketingClaims.ts';

const blocked = (...nights: string[]) => new Set(nights);

Deno.test('validateClaims: open nights that are still open pass', () => {
  assertEquals(
    validateClaims(
      { openNights: ['2026-11-13', '2026-11-14'] },
      { blockedNights: blocked('2026-11-20'), liveRateFrom: null, liveRating: null }
    ),
    { ok: true }
  );
});

Deno.test('validateClaims: a booked promoted night fails with a plain reason', () => {
  const result = validateClaims(
    { openNights: ['2026-11-13', '2026-11-14'] },
    { blockedNights: blocked('2026-11-14'), liveRateFrom: null, liveRating: null }
  );
  assertEquals(result, { ok: false, reason: 'Nov 14 got booked' });
});

Deno.test('validateClaims: a changed rate holds the item', () => {
  const result = validateClaims(
    { rateFrom: 3200 },
    { blockedNights: blocked(), liveRateFrom: 3600, liveRating: null }
  );
  assertEquals(result.ok, false);
});

Deno.test('validateClaims: a missing live rate holds a rate claim', () => {
  const result = validateClaims(
    { rateFrom: 3200 },
    { blockedNights: blocked(), liveRateFrom: null, liveRating: null }
  );
  assertEquals(result.ok, false);
});

Deno.test('validateClaims: a rating that dropped fails', () => {
  const result = validateClaims(
    { rating: { avg: 4.9, count: 38 } },
    { blockedNights: blocked(), liveRateFrom: null, liveRating: { avg: 4.6, count: 41 } }
  );
  assertEquals(result.ok, false);
});

Deno.test('validateClaims: a rating that rose still passes', () => {
  assertEquals(
    validateClaims(
      { rating: { avg: 4.9, count: 38 } },
      { blockedNights: blocked(), liveRateFrom: null, liveRating: { avg: 4.95, count: 40 } }
    ),
    { ok: true }
  );
});

Deno.test('validateClaims: only fewer open dates than claimed fails', () => {
  const anchor = '2026-11-20';
  const live = openNightsLeftInMonth(anchor, blocked('2026-11-21'));
  assertEquals(
    validateClaims(
      { openNights: [anchor], nightsLeftInMonth: live },
      { blockedNights: blocked('2026-11-21'), liveRateFrom: null, liveRating: null }
    ),
    { ok: true }
  );
  const broken = validateClaims(
    { openNights: [anchor], nightsLeftInMonth: live + 1 },
    { blockedNights: blocked('2026-11-21'), liveRateFrom: null, liveRating: null }
  );
  assertEquals(broken.ok, false);
});

Deno.test('validateClaims: a review that can no longer be used fails', () => {
  const result = validateClaims(
    { reviewId: 'review-1' },
    {
      blockedNights: blocked(),
      liveRateFrom: null,
      liveRating: null,
      liveReviewIds: new Set<string>(),
    }
  );
  assertEquals(result.ok, false);
});

Deno.test('validateClaims: a fully booked window that reopened fails', () => {
  const result = validateClaims(
    { fullyBookedWindow: { from: '2026-11-01', to: '2026-11-30' } },
    { blockedNights: blocked('2026-11-05'), liveRateFrom: null, liveRating: null }
  );
  assertEquals(result.ok, false);
});

Deno.test('openNightsLeftInMonth: counts from the anchor day, not the 1st', () => {
  assertEquals(openNightsLeftInMonth('2026-11-29', new Set<string>()), 2);
  assertEquals(openNightsLeftInMonth('2026-11-29', blocked('2026-11-30')), 1);
});

Deno.test('validateAvailabilityClaims: ignores rate and rating claims', () => {
  assertEquals(
    validateAvailabilityClaims(
      { openNights: ['2026-11-13'], rateFrom: 3200, rating: { avg: 4.9, count: 38 } },
      blocked()
    ),
    { ok: true }
  );
});

Deno.test('validateAvailabilityClaims: a booked night fails without needing a live rate', () => {
  assertEquals(validateAvailabilityClaims({ openNights: ['2026-11-13'] }, blocked('2026-11-13')), {
    ok: false,
    reason: 'Nov 13 got booked',
  });
});
