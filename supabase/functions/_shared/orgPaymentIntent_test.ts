import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  legacyPaymentIntent,
  parsePaymentIntent,
  validatePaymentIntent,
  type IntentSubscription,
  type PaymentIntent,
} from './orgPaymentIntent.ts';

const END = '2027-03-10T04:00:00.000Z';

const intent = (over: Partial<PaymentIntent> = {}): PaymentIntent => ({
  v: 1,
  purpose: 'renewal',
  subscriptionId: 's1',
  planId: 'pro',
  basePeriodEnd: END,
  baseStatus: 'active',
  targetTotalPhp: 1600,
  settleDebtPhp: 0,
  consumeCreditPhp: 0,
  newCreditPhp: 0,
  propertyCount: 2,
  ...over,
});

const sub = (over: Partial<IntentSubscription> = {}): IntentSubscription => ({
  id: 's1',
  status: 'active',
  planId: 'pro',
  scheduledPlanId: null,
  currentPeriodEnd: END,
  ...over,
});

Deno.test('renewal for the same period applies anchored', () => {
  assertEquals(validatePaymentIntent(intent(), sub()), { ok: true, mode: 'anchored' });
  assertEquals(validatePaymentIntent(intent({ purpose: 'retry' }), sub({ status: 'past_due' })), {
    ok: true,
    mode: 'anchored',
  });
});

Deno.test('renewal compares instants, not strings', () => {
  assertEquals(
    validatePaymentIntent(intent({ basePeriodEnd: '2027-03-10T12:00:00+08:00' }), sub()).ok,
    true
  );
});

Deno.test('a renewal paid twice is stale the second time', () => {
  const renewed = sub({ currentPeriodEnd: '2027-04-10T04:00:00.000Z' });
  assertEquals(validatePaymentIntent(intent(), renewed), {
    ok: false,
    reason: 'period_already_renewed',
  });
});

Deno.test(
  'a renewal for a scheduled downgrade is valid only while the downgrade is scheduled',
  () => {
    const scheduled = sub({ scheduledPlanId: 'starter' });
    assertEquals(validatePaymentIntent(intent({ planId: 'starter' }), scheduled), {
      ok: true,
      mode: 'anchored',
    });
    // Host kept Pro afterwards: the cheaper link no longer matches.
    assertEquals(validatePaymentIntent(intent({ planId: 'starter' }), sub()), {
      ok: false,
      reason: 'plan_changed',
    });
  }
);

Deno.test('a renewal after the subscription ended is stale', () => {
  assertEquals(validatePaymentIntent(intent(), null), { ok: false, reason: 'subscription_ended' });
  assertEquals(validatePaymentIntent(intent(), sub({ id: 'other' })), {
    ok: false,
    reason: 'subscription_ended',
  });
  assertEquals(validatePaymentIntent(intent(), sub({ status: 'canceled' })), {
    ok: false,
    reason: 'subscription_ended',
  });
});

Deno.test('renewal on a suspended subscription starts a fresh period', () => {
  assertEquals(validatePaymentIntent(intent(), sub({ status: 'suspended' })), {
    ok: true,
    mode: 'fresh',
  });
});

Deno.test('initial purchase is stale when a plan already exists', () => {
  assertEquals(validatePaymentIntent(intent({ purpose: 'initial', subscriptionId: null }), null), {
    ok: true,
    mode: 'create',
  });
  assertEquals(validatePaymentIntent(intent({ purpose: 'initial', subscriptionId: null }), sub()), {
    ok: false,
    reason: 'subscription_exists',
  });
});

Deno.test('upgrade and reactivation apply fresh, or create if the subscription ended', () => {
  assertEquals(validatePaymentIntent(intent({ purpose: 'change' }), sub()), {
    ok: true,
    mode: 'fresh',
  });
  assertEquals(validatePaymentIntent(intent({ purpose: 'reactivation' }), null), {
    ok: true,
    mode: 'create',
  });
  assertEquals(validatePaymentIntent(intent({ purpose: 'change' }), sub({ id: 'other' })), {
    ok: false,
    reason: 'subscription_ended',
  });
});

Deno.test('parsePaymentIntent rejects junk and legacy rows', () => {
  assertEquals(parsePaymentIntent(null), null);
  assertEquals(parsePaymentIntent({ planId: 'x' }), null);
  assertEquals(parsePaymentIntent(intent())?.planId, 'pro');
});

Deno.test('legacyPaymentIntent infers purpose from the subscription', () => {
  const base = { planId: 'pro', propertyCount: 2, amountPhp: 1000 };
  assertEquals(legacyPaymentIntent({ ...base, sub: null }).purpose, 'initial');
  assertEquals(legacyPaymentIntent({ ...base, sub: sub() }).purpose, 'renewal');
  assertEquals(legacyPaymentIntent({ ...base, sub: sub({ planId: 'starter' }) }).purpose, 'change');
});
