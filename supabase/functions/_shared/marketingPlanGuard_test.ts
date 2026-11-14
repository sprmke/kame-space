import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { allowedNumbers, guardPlanBriefs, guardPlanCopy } from './marketingPlanGuard.ts';

const claims = {
  openNights: ['2026-11-13', '2026-11-14'],
  rateFrom: 3200,
  rating: { avg: 4.9, count: 38 },
};

Deno.test('guard: copy built from the claims passes', () => {
  assertEquals(
    guardPlanCopy('Two nights open in November from 3200 a night, rated 4.9 by 38 guests.', claims),
    []
  );
});

Deno.test('guard: an invented price fails', () => {
  const violations = guardPlanCopy('Book now for 2500 a night.', claims);
  assertEquals(violations.length, 1);
  assertEquals(violations[0].kind, 'number');
});

Deno.test('guard: an invented month fails', () => {
  const violations = guardPlanCopy('Perfect for a December escape.', claims);
  assertEquals(violations.length, 1);
  assertEquals(violations[0].kind, 'month');
});

Deno.test('guard: empty copy fails instead of shipping a blank hook', () => {
  assertEquals(guardPlanCopy('   ', claims)[0].kind, 'empty');
});

Deno.test('guard: year and day numbers from the claims are allowed', () => {
  assertEquals(guardPlanCopy('13 and 14 November 2026.', claims), []);
});

Deno.test('allowedNumbers: includes nights, rate and rating figures only', () => {
  const allowed = allowedNumbers(claims);
  assert(allowed.has(2));
  assert(allowed.has(3200));
  assert(allowed.has(38));
  assert(allowed.has(49));
  assertEquals(allowed.has(2500), false);
});

Deno.test('guardPlanBriefs: rejects an unknown item key and keeps good copy', () => {
  const claimsByKey = new Map([['weekend_open:2026-11-13', claims]]);
  const result = guardPlanBriefs(
    [
      {
        itemKey: 'weekend_open:2026-11-13',
        title: 'Open this weekend',
        hook: 'Two nights left',
        message: 'Two nights open in November from 3200.',
        cta: 'Book now',
      },
      {
        itemKey: 'made_up_key',
        title: 'Invented',
        hook: 'Invented',
        message: 'Invented',
        cta: 'Book',
      },
    ],
    claimsByKey
  );
  assertEquals(result.accepted.length, 1);
  assertEquals(result.rejected.length, 1);
  assertEquals(result.rejected[0].itemKey, 'made_up_key');
});

Deno.test('guardPlanBriefs: any bad field rejects the whole item', () => {
  const claimsByKey = new Map([['k1', claims]]);
  const result = guardPlanBriefs(
    [
      {
        itemKey: 'k1',
        title: 'Fine',
        hook: 'Fine',
        message: 'Only 1500 a night this weekend.',
        cta: 'Book now',
      },
    ],
    claimsByKey
  );
  assertEquals(result.accepted.length, 0);
  assertEquals(result.rejected.length, 1);
});
