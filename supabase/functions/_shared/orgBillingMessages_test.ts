import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildOrgBillingMessage,
  formatPhp,
  type OrgBillingMessageKind,
} from './orgBillingMessages.ts';

const ALL_KINDS: OrgBillingMessageKind[] = [
  'change_scheduled',
  'cancel_scheduled',
  'scheduled_cleared',
  'change_applied',
  'plan_ended',
  'renewal_link',
  'renewal_due_tomorrow',
  'past_due',
  'grace_ending',
  'suspended',
  'reactivated',
  'renewed_from_credit',
  'receipt',
  'payment_credited',
  'payment_failed',
  'trial_ending',
  'price_change',
];

const params = {
  orgName: 'Maria Stays',
  fromPlan: 'Pro',
  toPlan: 'Starter',
  planName: 'Pro',
  dateLabel: 'Dec 3, 2026',
  graceEndLabel: 'Dec 8, 2026',
  cancelDateLabel: 'Jan 7, 2027',
  amountPhp: 1600,
  receiptNumber: 'KS-R-2026-000001',
  propertyCount: 2,
  daysLeft: 3,
  oldPricePhp: 1600,
  newPricePhp: 1800,
  checkoutUrl: 'https://pay.example/cs_123',
};

Deno.test(
  'every billing message has a subject, headline and body, with no em dash or "undefined"',
  () => {
    for (const kind of ALL_KINDS) {
      const message = buildOrgBillingMessage(kind, params);
      const text = [message.subject, message.headline, ...message.paragraphs].join(' ');
      assert(message.subject.length > 0 && message.headline.length > 0, kind);
      assert(message.paragraphs.length > 0, kind);
      assert(!text.includes('—'), `${kind} has an em dash`);
      assert(!text.includes('undefined') && !text.includes('NaN') && !text.includes('null'), kind);
    }
  }
);

Deno.test('payment reminders link straight to the checkout; others link to Plans', () => {
  assertEquals(buildOrgBillingMessage('renewal_link', params).ctaTarget, params.checkoutUrl);
  assertEquals(buildOrgBillingMessage('past_due', params).ctaTarget, params.checkoutUrl);
  assertEquals(
    buildOrgBillingMessage('past_due', { ...params, checkoutUrl: null }).ctaTarget,
    'plans'
  );
  assertEquals(buildOrgBillingMessage('change_scheduled', params).ctaTarget, 'plans');
});

Deno.test('scheduled changes say the current plan is kept until the date', () => {
  const message = buildOrgBillingMessage('change_scheduled', params);
  assert(message.paragraphs.join(' ').includes('keep every Pro feature until then'));
  assert(message.subject.includes('Dec 3, 2026'));
});

Deno.test('plan_ended explains why', () => {
  const nonpayment = buildOrgBillingMessage('plan_ended', { ...params, endedReason: 'nonpayment' });
  assert(nonpayment.paragraphs[0].includes('overdue'));
  const trial = buildOrgBillingMessage('plan_ended', { ...params, endedReason: 'trial_ended' });
  assert(trial.paragraphs[0].includes('trial ended'));
});

Deno.test('trial ending counts days correctly', () => {
  assert(
    buildOrgBillingMessage('trial_ending', { ...params, daysLeft: 1 }).subject.includes('tomorrow')
  );
  assert(
    buildOrgBillingMessage('trial_ending', { ...params, daysLeft: 3 }).subject.includes('in 3 days')
  );
});

Deno.test('formatPhp groups thousands', () => {
  assertEquals(formatPhp(1234.4), '₱1,234');
});
