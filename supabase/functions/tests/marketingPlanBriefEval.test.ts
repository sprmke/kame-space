import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/**
 * Marketing plan brief — offline eval suite.
 *
 * Deterministic cases for the parts that must hold whatever the model says: the prompt keeps
 * the scheduler authoritative, the guard rejects invented facts, and rejected copy falls back
 * to the rules template. Live, model-scored runs use `bun run eval:ai` and need provider keys.
 */

import {
  buildMarketingPlanBriefPrompt,
  MARKETING_PLAN_BRIEF_PROMPT,
} from '../_shared/ai/prompts/marketingPlanBrief.ts';
import { guardPlanBriefs, guardPlanCopy } from '../_shared/marketingPlanGuard.ts';
import type { PlannerClaims } from '../_shared/marketingClaims.ts';

const claims: PlannerClaims = {
  openNights: ['2026-11-13', '2026-11-14'],
  rateFrom: 3200,
  rating: { avg: 4.9, count: 38 },
};

type Case = {
  id: string;
  copy: { title: string; hook: string; message: string; cta: string };
  expect: 'accept' | 'reject';
  why: string;
};

const CASES: Case[] = [
  {
    id: 'weekend-open-english',
    copy: {
      title: 'Open this weekend',
      hook: 'Two nights left this weekend',
      message: 'Nov 13 and Nov 14 are still open from 3200 a night.',
      cta: 'Book the weekend',
    },
    expect: 'accept',
    why: 'every number and month comes from the claims',
  },
  {
    id: 'weekend-open-taglish',
    copy: {
      title: 'Open this weekend',
      hook: '2 nights pa this weekend',
      message: 'Open pa ang Nov 13 at Nov 14, 3200 per night.',
      cta: 'Message us',
    },
    expect: 'accept',
    why: 'Taglish uses the same numbers and months',
  },
  {
    id: 'invented-price',
    copy: {
      title: 'Big discount',
      hook: 'Now 2500 a night',
      message: 'Book Nov 13 for 2500 a night.',
      cta: 'Book now',
    },
    expect: 'reject',
    why: 'the model invented a price',
  },
  {
    id: 'invented-month',
    copy: {
      title: 'December escape',
      hook: 'December is open',
      message: 'Stay with us in December.',
      cta: 'Book now',
    },
    expect: 'reject',
    why: 'the model invented a month',
  },
  {
    id: 'invented-night-count',
    copy: {
      title: 'Five nights left',
      hook: '5 nights left this month',
      message: 'Five nights left before the month ends.',
      cta: 'Book now',
    },
    expect: 'reject',
    why: 'the open-night count is not what the claims say',
  },
  {
    id: 'rating-mismatch',
    copy: {
      title: 'Guest favourite',
      hook: 'Rated 4.8 by guests',
      message: 'Guests rate us 4.8 out of 5.',
      cta: 'Book now',
    },
    expect: 'reject',
    why: 'the claimed rating is 4.9, not 4.8',
  },
  {
    id: 'empty-hook',
    copy: { title: 'Open', hook: '   ', message: 'Open this weekend.', cta: 'Book' },
    expect: 'reject',
    why: 'a blank first line is worse than the template',
  },
];

for (const testCase of CASES) {
  Deno.test(`plan brief eval [${testCase.id}] - ${testCase.expect}`, () => {
    const violations = [
      ...guardPlanCopy(testCase.copy.title, claims),
      ...guardPlanCopy(testCase.copy.hook, claims),
      ...guardPlanCopy(testCase.copy.message, claims),
      ...guardPlanCopy(testCase.copy.cta, claims),
    ];
    if (testCase.expect === 'accept') {
      assertEquals(violations, [], testCase.why);
    } else {
      assert(violations.length > 0, testCase.why);
    }
  });
}

Deno.test('plan brief eval: an unknown item key is rejected, never trusted', () => {
  const result = guardPlanBriefs(
    [
      {
        itemKey: 'not-a-real-key',
        title: 'Open',
        hook: 'Two nights left',
        message: 'Nov 13 and Nov 14 are open.',
        cta: 'Book',
      },
    ],
    new Map([['weekend_open:2026-11-13', claims]])
  );
  assertEquals(result.accepted.length, 0);
  assertEquals(result.rejected.length, 1);
});

Deno.test('plan brief eval: one rejected item never blocks its neighbours', () => {
  const result = guardPlanBriefs(
    [
      {
        itemKey: 'a',
        title: 'Open',
        hook: 'Two nights left',
        message: 'Nov 13 is open from 3200.',
        cta: 'Book',
      },
      { itemKey: 'b', title: 'Deal', hook: 'Only 1500', message: 'Book now.', cta: 'Book' },
    ],
    new Map([
      ['a', claims],
      ['b', claims],
    ])
  );
  assertEquals(result.accepted.map((copy) => copy.itemKey), ['a']);
  assertEquals(result.rejected.map((entry) => entry.itemKey), ['b']);
});

Deno.test('plan brief eval: the prompt keeps the scheduler authoritative', () => {
  const { system } = buildMarketingPlanBriefPrompt({
    propertyName: 'Demo Stay',
    area: 'Tagaytay',
    amenities: ['Wifi'],
    language: 'en',
    tone: 'warm',
    horizonEnd: '2026-12-09',
    items: [],
  });
  assert(system.includes('NOT yours to change'));
  assert(system.includes('never add one'));
  assert(system.includes('Never invent a date'));
  assertEquals(MARKETING_PLAN_BRIEF_PROMPT.id, 'marketing_plan_brief');
});
