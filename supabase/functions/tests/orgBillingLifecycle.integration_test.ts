/**
 * Billing lifecycle against the real local Postgres (PostgREST on :54321), PayMongo stubbed.
 * Runs the same modules the edge functions and the hourly cron run: checkout, fulfillment,
 * stale-payment credit, scheduled downgrade / cancel, past due, suspension, auto-cancel,
 * credit-covered renewal and property true-ups.
 *
 *   LOCAL_BILLING_LIVE=1 TZ=Asia/Manila deno test --config supabase/functions/deno.json \
 *     --allow-net --allow-env --allow-read --allow-import \
 *     supabase/functions/tests/orgBillingLifecycle.integration_test.ts
 *
 * Needs the local stack with the billing migrations applied. Every test seeds its own throwaway
 * user, org and properties and removes them afterwards. Skipped unless LOCAL_BILLING_LIVE=1.
 */

import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

const enabled = Deno.env.get('LOCAL_BILLING_LIVE') === '1';

const headers = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// ─── PayMongo stub ───────────────────────────────────────────────────────────────

const paid = new Set<string>();
let sessionCounter = 0;
const realFetch = globalThis.fetch;

function installPaymongoStub() {
  Deno.env.set('PAYMONGO_SECRET_KEY', 'sk_test_stub');
  globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('https://api.paymongo.com')) return realFetch(input, init);
    const json = (body: unknown, status = 200) =>
      Promise.resolve(new Response(JSON.stringify(body), { status }));
    if (url.endsWith('/checkout_sessions') && init?.method === 'POST') {
      sessionCounter += 1;
      const id = `cs_stub_${Date.now()}_${sessionCounter}`;
      return json({ data: { id, attributes: { checkout_url: `https://pay.test/${id}` } } });
    }
    if (url.endsWith('/expire')) return json({ data: {} });
    const match = url.match(/checkout_sessions\/([^/?]+)/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      return json({
        data: { id, attributes: { status: paid.has(id) ? 'paid' : 'active', payments: [] } },
      });
    }
    return json({ errors: [{ detail: 'unstubbed' }] }, 404);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

// ─── Seeding ─────────────────────────────────────────────────────────────────────

const PLAN = {
  starter: 'd61e1c61-303a-4840-bc53-03ee72aea807',
  growth: '8039cb20-0e8c-4524-9487-faa966d8372f',
  pro: 'a0562a5e-df4a-4617-bfcf-c88589bf6046',
} as const;

type Seed = { userId: string; orgId: string; propertyIds: string[] };

async function seed(propertyCount: number): Promise<Seed> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const userRes = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: `billing-it-${suffix}@example.com`,
      password: `Pw-${suffix}-xyz!`,
      email_confirm: true,
    }),
  });
  const user = await userRes.json();
  if (!user.id) throw new Error(`auth user create failed: ${JSON.stringify(user)}`);
  const [org] = await rest('organizations', {
    method: 'POST',
    body: JSON.stringify({
      name: `Billing IT ${suffix}`,
      slug: `billing-it-${suffix}`,
      owner_id: user.id,
    }),
  });
  const propertyIds: string[] = [];
  for (let i = 0; i < propertyCount; i += 1) {
    const [property] = await rest('properties', {
      method: 'POST',
      body: JSON.stringify({
        organization_id: org.id,
        name: `Unit ${i + 1} ${suffix}`,
        slug: `unit-${i + 1}-${suffix}`,
      }),
    });
    propertyIds.push(property.id);
  }
  return { userId: user.id, orgId: org.id, propertyIds };
}

async function cleanup(s: Seed) {
  await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/organizations?id=eq.${s.orgId}`, {
    method: 'DELETE',
    headers,
  });
  await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users/${s.userId}`, {
    method: 'DELETE',
    headers,
  });
}

async function withOrg(
  propertyCount: number,
  run: (s: Seed, mods: Awaited<ReturnType<typeof loadModules>>) => Promise<void>
) {
  installPaymongoStub();
  const s = await seed(propertyCount);
  try {
    await run(s, await loadModules());
  } finally {
    restoreFetch();
    await cleanup(s);
  }
}

async function loadModules() {
  const [checkout, fulfillment, orchestrator, lifecycle, entitlements, ledger, context] =
    await Promise.all([
      import('../_shared/orgSubscriptionCheckout.ts'),
      import('../_shared/orgPaymentFulfillment.ts'),
      import('../_shared/subscriptionOrchestrator.ts'),
      import('../_shared/orgBillingLifecycle.ts'),
      import('../_shared/planEntitlements.ts'),
      import('../_shared/orgBillingLedger.ts'),
      import('../_shared/orgBillingContext.ts'),
    ]);
  return { checkout, fulfillment, orchestrator, lifecycle, entitlements, ledger, context };
}

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

async function sub(orgId: string) {
  const rows = await rest(
    `org_subscriptions?organization_id=eq.${orgId}&order=created_at.desc&limit=1`
  );
  return rows[0];
}

async function subPatch(id: string, patch: Record<string, unknown>) {
  await rest(`org_subscriptions?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

async function txn(id: string) {
  const rows = await rest(`org_payment_transactions?id=eq.${id}`);
  return rows[0];
}

async function ledgerBalance(orgId: string): Promise<number> {
  const rows = await rest(`org_billing_ledger?organization_id=eq.${orgId}&select=amount_php`);
  return rows.reduce((sum: number, row: { amount_php: number }) => sum + Number(row.amount_php), 0);
}

/** Buys `planId` and settles the PayMongo checkout like the webhook would. */
async function buy(
  s: Seed,
  m: Awaited<ReturnType<typeof loadModules>>,
  planId: string
): Promise<{ transactionId: string; subscriptionId: string }> {
  const checkout = await m.checkout.createOrgSubscriptionCheckoutLink({
    organizationId: s.orgId,
    planId,
    initiatedBy: s.userId,
  });
  assert(checkout.checkoutUrl, 'expected a checkout url');
  const row = await txn(checkout.transactionId);
  paid.add(row.provider_reference);
  const result = await m.fulfillment.fulfillOrgSubscriptionPayment({
    transactionId: checkout.transactionId,
    providerReference: row.provider_reference,
    paymentMethodType: 'qrph',
    assignedByUserId: s.userId,
  });
  assertEquals(result.applied, true);
  return { transactionId: checkout.transactionId, subscriptionId: (await sub(s.orgId)).id };
}

const opts = { name: '', ignore: !enabled, sanitizeResources: false, sanitizeOps: false };

Deno.test({
  ...opts,
  name: 'first purchase: checkout, payment, receipt, enrolment, period and ledger',
  fn: () =>
    withOrg(2, async (s, m) => {
      const { transactionId, subscriptionId } = await buy(s, m, PLAN.growth);
      const t = await txn(transactionId);
      assertEquals(t.status, 'paid');
      assertEquals(t.applied, true);
      assertEquals(t.purpose, 'initial');
      assert(/^KS-R-\d{4}-\d{6}$/.test(t.receipt_number), t.receipt_number);

      const row = await sub(s.orgId);
      assertEquals(row.id, subscriptionId);
      assertEquals(row.status, 'active');
      assertEquals(row.plan_id, PLAN.growth);
      assertEquals(Number(row.period_paid_php), Number(t.amount));
      assertEquals(Number(row.price_php_snapshot), Number(t.amount));
      assert(row.current_period_end > row.current_period_start);
      assert(row.billing_anchor_day >= 1);
      assert(row.pricing_snapshot?.pricePhp > 0, 'pricing is locked on the subscription');

      const slots = await rest(`org_subscription_properties?org_subscription_id=eq.${row.id}`);
      assertEquals(slots.length, 2);

      // The same payment arriving twice (webhook + reconcile) changes nothing.
      const again = await m.fulfillment.fulfillOrgSubscriptionPayment({ transactionId });
      assertEquals(again.applied, true);
      assertEquals(
        (await rest(`org_subscription_properties?org_subscription_id=eq.${row.id}`)).length,
        2
      );
      assertEquals(await ledgerBalance(s.orgId), 0);
    }),
});

Deno.test({
  ...opts,
  name: 'one open checkout per org: a new one closes the old one; reuse when unchanged',
  fn: () =>
    withOrg(1, async (s, m) => {
      const first = await m.checkout.createOrgSubscriptionCheckoutLink({
        organizationId: s.orgId,
        planId: PLAN.starter,
        initiatedBy: s.userId,
      });
      const reused = await m.checkout.createOrgSubscriptionCheckoutLink({
        organizationId: s.orgId,
        planId: PLAN.starter,
        initiatedBy: s.userId,
      });
      assertEquals(reused.reused, true);
      assertEquals(reused.transactionId, first.transactionId);

      const second = await m.checkout.createOrgSubscriptionCheckoutLink({
        organizationId: s.orgId,
        planId: PLAN.growth,
        initiatedBy: s.userId,
      });
      assert(second.transactionId !== first.transactionId);
      assertEquals((await txn(first.transactionId)).status, 'expired');
      const pending = await rest(
        `org_payment_transactions?organization_id=eq.${s.orgId}&status=eq.pending`
      );
      assertEquals(pending.length, 1);
    }),
});

Deno.test({
  ...opts,
  name: 'idempotency key returns the same checkout',
  fn: () =>
    withOrg(1, async (s, m) => {
      const key = `idem-${crypto.randomUUID()}`;
      const a = await m.checkout.createOrgSubscriptionCheckoutLink({
        organizationId: s.orgId,
        planId: PLAN.starter,
        idempotencyKey: key,
      });
      const b = await m.checkout.createOrgSubscriptionCheckoutLink({
        organizationId: s.orgId,
        planId: PLAN.starter,
        idempotencyKey: key,
      });
      assertEquals(a.transactionId, b.transactionId);
    }),
});

Deno.test({
  ...opts,
  name: 'price check: a higher fresh amount than the reviewed one is refused with the new price',
  fn: () =>
    withOrg(1, async (s, m) => {
      const err = await assertRejects(() =>
        m.checkout.createOrgSubscriptionCheckoutLink({
          organizationId: s.orgId,
          planId: PLAN.growth,
          expectedChargePhp: 100,
        })
      );
      assertEquals((err as { code?: string }).code, 'price_changed');
      assertEquals(
        (await rest(`org_payment_transactions?organization_id=eq.${s.orgId}`)).length,
        0
      );
    }),
});

Deno.test({
  ...opts,
  name: 'a payment on a closed, superseded checkout becomes account credit, never lost',
  fn: () =>
    withOrg(1, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.starter);
      // A second "initial" checkout that was created before the first one was paid.
      const [stale] = await rest('org_payment_transactions', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: s.orgId,
          plan_id: PLAN.growth,
          property_ids: s.propertyIds,
          amount: 999,
          status: 'expired',
          provider_reference: 'cs_stub_late',
          intent: {
            v: 1,
            purpose: 'initial',
            subscriptionId: null,
            planId: PLAN.growth,
            basePeriodEnd: null,
            baseStatus: null,
            targetTotalPhp: 999,
            settleDebtPhp: 0,
            consumeCreditPhp: 0,
            newCreditPhp: 0,
            propertyCount: 1,
          },
        }),
      });
      const result = await m.fulfillment.fulfillOrgSubscriptionPayment({
        transactionId: stale.id,
        providerReference: 'cs_stub_late',
        allowReopen: true,
      });
      assertEquals(result.applied, false);
      const row = await txn(stale.id);
      assertEquals(row.status, 'paid');
      assertEquals(row.applied, false);
      assert(String(row.review_reason).startsWith('stale:'));
      assertEquals(await ledgerBalance(s.orgId), -999);
      // The subscription is untouched.
      assertEquals((await sub(s.orgId)).id, subscriptionId);
      assertEquals((await sub(s.orgId)).plan_id, PLAN.starter);
    }),
});

Deno.test({
  ...opts,
  name: 'downgrade waits for the period end, prepaid renewal switches the plan on the old end date',
  fn: () =>
    withOrg(2, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.growth);

      const scheduled = await m.lifecycle.scheduleOrgDowngrade({
        organizationId: s.orgId,
        targetPlanId: PLAN.starter,
        scheduledBy: s.userId,
      });
      assertEquals(scheduled.toPlanName.length > 0, true);
      let row = await sub(s.orgId);
      // Nothing changed yet: same plan, same price, features untouched.
      assertEquals(row.plan_id, PLAN.growth);
      assertEquals(row.scheduled_plan_id, PLAN.starter);
      assertEquals(row.scheduled_change_at, row.current_period_end);

      // Undo, then schedule again.
      await m.lifecycle.clearOrgScheduledChange({ organizationId: s.orgId, clearedBy: s.userId });
      row = await sub(s.orgId);
      assertEquals(row.scheduled_plan_id, null);
      await m.lifecycle.scheduleOrgDowngrade({
        organizationId: s.orgId,
        targetPlanId: PLAN.starter,
        scheduledBy: s.userId,
      });

      // Three days before the end: the renewal link is for the cheaper plan.
      const oldEnd = iso(3);
      await subPatch(subscriptionId, {
        current_period_start: iso(-27),
        current_period_end: oldEnd,
        scheduled_change_at: oldEnd,
        // The anchor day is the day of the period end in Manila.
        billing_anchor_day: new Date(new Date(oldEnd).getTime() + 8 * 60 * 60 * 1000).getUTCDate(),
      });
      const counters = await m.orchestrator.runPlatformBillingCycle({ organizationIds: [s.orgId] });
      assert(Number(counters.renewalLinks) >= 1, JSON.stringify(counters));
      const pending = await rest(
        `org_payment_transactions?organization_id=eq.${s.orgId}&status=eq.pending`
      );
      assertEquals(pending.length, 1);
      assertEquals(pending[0].plan_id, PLAN.starter);
      assertEquals(pending[0].purpose, 'renewal');

      // Paid early: the period extends from the old end, the plan stays until then.
      paid.add(pending[0].provider_reference);
      await m.fulfillment.fulfillOrgSubscriptionPayment({
        transactionId: pending[0].id,
        providerReference: pending[0].provider_reference,
      });
      row = await sub(s.orgId);
      assertEquals(row.plan_id, PLAN.growth, 'still on the paid plan until the old period ends');
      assertEquals(row.scheduled_plan_id, PLAN.starter);
      assertEquals(new Date(row.current_period_start).getTime(), new Date(oldEnd).getTime());
      assert(new Date(row.current_period_end).getTime() > new Date(oldEnd).getTime() + 27 * DAY);

      // The old period ends: the cron applies the scheduled plan.
      await subPatch(subscriptionId, { scheduled_change_at: iso(-0.01) });
      const after = await m.orchestrator.runPlatformBillingCycle({ organizationIds: [s.orgId] });
      assert(Number(after.scheduledApplied) >= 1, JSON.stringify(after));
      row = await sub(s.orgId);
      assertEquals(row.plan_id, PLAN.starter);
      assertEquals(row.scheduled_plan_id, null);
      assertEquals(row.status, 'active');
    }),
});

Deno.test({
  ...opts,
  name: 'cancel at period end keeps access, then moves to Free and unenrols properties',
  fn: () =>
    withOrg(2, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.growth);
      await m.lifecycle.scheduleOrgCancel({
        organizationId: s.orgId,
        reason: 'temporary',
        scheduledBy: s.userId,
      });
      let row = await sub(s.orgId);
      assertEquals(row.cancel_at_period_end, true);
      assertEquals(row.status, 'active');

      // Still entitled to the paid plan mid-period.
      const live = await m.entitlements.resolveOrgEntitlements(s.orgId);
      assertEquals(live.planCode, 'growth');
      assertEquals(live.smartPricing, true);

      // Resume works until the end.
      await m.lifecycle.clearOrgScheduledChange({ organizationId: s.orgId, clearedBy: s.userId });
      row = await sub(s.orgId);
      assertEquals(row.cancel_at_period_end, false);
      await m.lifecycle.scheduleOrgCancel({ organizationId: s.orgId, scheduledBy: s.userId });

      await subPatch(subscriptionId, { current_period_end: iso(-0.01) });
      await m.orchestrator.runPlatformBillingCycle({ organizationIds: [s.orgId] });
      row = await sub(s.orgId);
      assertEquals(row.status, 'canceled');
      assertEquals(row.ended_reason, 'host_canceled');
      assertEquals(
        (await rest(`org_subscription_properties?org_subscription_id=eq.${subscriptionId}`)).length,
        0
      );
      const free = await m.entitlements.resolveOrgEntitlements(s.orgId);
      assertEquals(free.planCode, 'free');
    }),
});

Deno.test({
  ...opts,
  name: 'unpaid renewal: past due with grace from the period end, then suspended like Free, then ended',
  fn: () =>
    withOrg(1, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.growth);
      const end = new Date(Date.now() - 1 * DAY);
      await subPatch(subscriptionId, { current_period_end: end.toISOString() });

      await m.orchestrator.runPlatformBillingCycle({ organizationIds: [s.orgId] });
      let row = await sub(s.orgId);
      assertEquals(row.status, 'past_due');
      // Grace counts from the period end (default 5 days), not from when the cron ran.
      assertEquals(
        Math.round((new Date(row.grace_period_ends_at).getTime() - end.getTime()) / DAY),
        5
      );
      // Past due keeps every paid feature.
      assertEquals((await m.entitlements.resolveOrgEntitlements(s.orgId)).smartPricing, true);

      // A second run does not duplicate anything.
      await m.orchestrator.runPlatformBillingCycle({ organizationIds: [s.orgId] });
      const notices = await rest(
        `org_billing_notifications?organization_id=eq.${s.orgId}&kind=eq.past_due`
      );
      assertEquals(notices.length, 1);

      await subPatch(subscriptionId, { grace_period_ends_at: iso(-0.01) });
      await m.orchestrator.runPlatformBillingCycle({ organizationIds: [s.orgId] });
      row = await sub(s.orgId);
      assertEquals(row.status, 'suspended');
      assert(row.suspended_at);

      // Suspended works like Free on every read path.
      const ent = await m.entitlements.resolveOrgEntitlements(s.orgId);
      assertEquals(ent.status, 'suspended');
      assertEquals(ent.smartPricing, false);

      // Paying the overdue link restores it with a fresh period.
      const pending = await rest(
        `org_payment_transactions?organization_id=eq.${s.orgId}&status=eq.pending`
      );
      assert(pending.length <= 1);
      const checkout = await m.checkout.createOrgSubscriptionCheckoutLink({
        organizationId: s.orgId,
        planId: null,
        initiatedBy: s.userId,
      });
      assertEquals(checkout.purpose, 'reactivation');
      const t = await txn(checkout.transactionId);
      paid.add(t.provider_reference);
      await m.fulfillment.fulfillOrgSubscriptionPayment({
        transactionId: checkout.transactionId,
        providerReference: t.provider_reference,
      });
      row = await sub(s.orgId);
      assertEquals(row.status, 'active');
      assertEquals(row.suspended_at, null);
      assertEquals((await m.entitlements.resolveOrgEntitlements(s.orgId)).smartPricing, true);
    }),
});

Deno.test({
  ...opts,
  name: 'a suspended subscription ends after the suspension window',
  fn: () =>
    withOrg(1, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.growth);
      await subPatch(subscriptionId, {
        status: 'suspended',
        current_period_end: iso(-40),
        grace_period_ends_at: iso(-35),
        suspended_at: iso(-31),
      });
      await m.orchestrator.runPlatformBillingCycle({ organizationIds: [s.orgId] });
      const row = await sub(s.orgId);
      assertEquals(row.status, 'canceled');
      assertEquals(row.ended_reason, 'nonpayment');
    }),
});

Deno.test({
  ...opts,
  name: 'account credit that covers a renewal renews without a checkout and is consumed',
  fn: () =>
    withOrg(1, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.starter);
      const before = await sub(s.orgId);
      await m.orchestrator.adminAdjustOrgCredit({
        organizationId: s.orgId,
        creditPhp: 10_000,
        note: 'goodwill',
        adminUserId: s.userId,
      });
      assertEquals(await ledgerBalance(s.orgId), -10_000);

      await subPatch(subscriptionId, { current_period_end: iso(-0.01) });
      const counters = await m.orchestrator.runPlatformBillingCycle({ organizationIds: [s.orgId] });
      assert(Number(counters.renewedFromCredit) >= 1, JSON.stringify(counters));

      const row = await sub(s.orgId);
      assertEquals(row.status, 'active');
      assert(new Date(row.current_period_end).getTime() > Date.now() + 20 * DAY);
      assertEquals(row.id, before.id);
      const balance = await ledgerBalance(s.orgId);
      assertEquals(balance, -(10_000 - Number(before.price_php_snapshot)));
      const rows = await rest(
        `org_payment_transactions?organization_id=eq.${s.orgId}&purpose=eq.renewal&status=eq.paid`
      );
      assertEquals(rows.length, 1);
      assertEquals(Number(rows[0].amount), 0);
      assert(rows[0].receipt_number);
    }),
});

Deno.test({
  ...opts,
  name: 'upgrade mid-period credits the unused time, a quote never charges below zero',
  fn: () =>
    withOrg(1, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.starter);
      // Half way through a 30 day period.
      await subPatch(subscriptionId, {
        current_period_start: iso(-15),
        current_period_end: iso(15),
      });
      const quote = await m.context.buildOrgPaymentQuote({
        organizationId: s.orgId,
        targetPlanId: PLAN.pro,
      });
      assertEquals(quote.purpose, 'change');
      assert(quote.quote.unusedCreditPhp > 0);
      assertEquals(
        quote.quote.chargePhp,
        Math.max(20, quote.quote.targetTotalPhp - quote.quote.unusedCreditPhp)
      );
      // A lower plan is never a payment: it is a scheduled downgrade.
      await assertRejects(() =>
        m.context.buildOrgPaymentQuote({ organizationId: s.orgId, targetPlanId: PLAN.starter })
      );
    }),
});

Deno.test({
  ...opts,
  name: 'archived properties are not billed and never re-enrolled by a payment',
  fn: () =>
    withOrg(3, async (s, m) => {
      await rest(`properties?id=eq.${s.propertyIds[2]}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'INACTIVE', inactive_reason: 'archived' }),
      });
      const quote = await m.context.buildOrgPaymentQuote({
        organizationId: s.orgId,
        targetPlanId: PLAN.growth,
      });
      assertEquals(quote.billablePropertyIds.length, 2);
      await buy(s, m, PLAN.growth);
      const row = await sub(s.orgId);
      const slots = await rest(`org_subscription_properties?org_subscription_id=eq.${row.id}`);
      assertEquals(slots.length, 2);
      assert(!slots.some((slot: { property_id: string }) => slot.property_id === s.propertyIds[2]));
    }),
});

Deno.test({
  ...opts,
  name: 'a property added mid-period is covered at once and the share joins the next payment',
  fn: () =>
    withOrg(1, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.growth);
      await subPatch(subscriptionId, {
        current_period_start: iso(-15),
        current_period_end: iso(15),
      });
      const [property] = await rest('properties', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: s.orgId,
          name: `Late unit ${crypto.randomUUID().slice(0, 6)}`,
          slug: `late-${crypto.randomUUID().slice(0, 8)}`,
        }),
      });
      const result = await m.entitlements.autoEnrollPropertyInOrgSubscription(
        s.orgId,
        property.id,
        s.userId
      );
      assert(result.covered);
      if (result.covered) {
        assert(result.trueUpPhp > 0, 'half a period of the added cost is owed');
      }
      const balance = await ledgerBalance(s.orgId);
      assert(balance > 0);

      // The next renewal carries the true-up and settles it.
      await subPatch(subscriptionId, { current_period_end: iso(2) });
      const quote = await m.context.buildOrgPaymentQuote({
        organizationId: s.orgId,
        targetPlanId: null,
        ignoreRenewalWindow: true,
      });
      assertEquals(quote.quote.ledgerDebtPhp, balance);
      assertEquals(quote.quote.chargePhp, quote.quote.targetTotalPhp + balance);

      // Adding the same property again never charges twice.
      const again = await m.entitlements.autoEnrollPropertyInOrgSubscription(
        s.orgId,
        property.id,
        s.userId
      );
      assert(again.covered && again.alreadyCovered);
      assertEquals(await ledgerBalance(s.orgId), balance);
    }),
});

Deno.test({
  ...opts,
  name: 'a property added while the payment is overdue stays on Free until the host pays',
  fn: () =>
    withOrg(1, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.growth);
      await subPatch(subscriptionId, { status: 'past_due', current_period_end: iso(-1) });
      const [property] = await rest('properties', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: s.orgId,
          name: 'Overdue unit',
          slug: `overdue-${crypto.randomUUID().slice(0, 8)}`,
        }),
      });
      const result = await m.entitlements.autoEnrollPropertyInOrgSubscription(
        s.orgId,
        property.id,
        s.userId
      );
      assertEquals(result.covered, false);
      assertEquals(
        (await rest(`org_subscription_properties?property_id=eq.${property.id}`)).length,
        0
      );
    }),
});

Deno.test({
  ...opts,
  name: 'a plan retired from the catalog still renews and still takes property changes',
  fn: () =>
    withOrg(1, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.starter);
      await rest(`pricing_plans?id=eq.${PLAN.starter}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      });
      try {
        await subPatch(subscriptionId, { current_period_end: iso(2) });
        const quote = await m.context.buildOrgPaymentQuote({
          organizationId: s.orgId,
          targetPlanId: null,
          ignoreRenewalWindow: true,
        });
        assertEquals(quote.plan.id, PLAN.starter);
        assertEquals(quote.purpose, 'renewal');

        const [property] = await rest('properties', {
          method: 'POST',
          body: JSON.stringify({
            organization_id: s.orgId,
            name: 'On a retired plan',
            slug: `retired-${crypto.randomUUID().slice(0, 8)}`,
          }),
        });
        await m.entitlements.autoEnrollPropertyInOrgSubscription(s.orgId, property.id, s.userId);
        await m.entitlements.removePropertyFromOrgSubscription(property.id, s.userId);
      } finally {
        await rest(`pricing_plans?id=eq.${PLAN.starter}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: true }),
        });
      }
    }),
});

Deno.test({
  ...opts,
  name: 'an admin price override survives property changes',
  fn: () =>
    withOrg(1, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.growth);
      await subPatch(subscriptionId, { price_override_php: 4321, price_php_snapshot: 4321 });
      const [property] = await rest('properties', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: s.orgId,
          name: 'Override unit',
          slug: `override-${crypto.randomUUID().slice(0, 8)}`,
        }),
      });
      await m.entitlements.autoEnrollPropertyInOrgSubscription(s.orgId, property.id, s.userId);
      assertEquals(Number((await sub(s.orgId)).price_php_snapshot), 4321);
      await m.entitlements.removePropertyFromOrgSubscription(property.id, s.userId);
      assertEquals(Number((await sub(s.orgId)).price_php_snapshot), 4321);
    }),
});

Deno.test({
  ...opts,
  name: 'grandfathered pricing: a catalog price change does not touch a renewal until migrated',
  fn: () =>
    withOrg(1, async (s, m) => {
      const { subscriptionId } = await buy(s, m, PLAN.starter);
      const before = await sub(s.orgId);
      const original = (await rest(`pricing_plans?id=eq.${PLAN.starter}&select=price_php`))[0]
        .price_php;
      await rest(`pricing_plans?id=eq.${PLAN.starter}`, {
        method: 'PATCH',
        body: JSON.stringify({ price_php: Number(original) + 500 }),
      });
      try {
        await subPatch(subscriptionId, { current_period_end: iso(2) });
        const renewal = await m.context.buildOrgPaymentQuote({
          organizationId: s.orgId,
          targetPlanId: null,
          ignoreRenewalWindow: true,
        });
        assertEquals(renewal.quote.targetTotalPhp, Number(before.price_php_snapshot));

        // A new purchase of the same plan sees the new price.
        const fresh = await m.context.buildOrgPaymentQuote({
          organizationId: s.orgId,
          targetPlanId: PLAN.growth,
        });
        assert(fresh.quote.targetTotalPhp > 0);

        // A migration whose date has come moves the renewal to the new price.
        await rest('plan_price_migrations', {
          method: 'POST',
          body: JSON.stringify({
            plan_id: PLAN.starter,
            effective_on: iso(-1),
            new_pricing: {},
          }),
        });
        const migrated = await m.context.buildOrgPaymentQuote({
          organizationId: s.orgId,
          targetPlanId: null,
          ignoreRenewalWindow: true,
        });
        assert(migrated.quote.targetTotalPhp > renewal.quote.targetTotalPhp);
      } finally {
        await rest(`plan_price_migrations?plan_id=eq.${PLAN.starter}`, { method: 'DELETE' });
        await rest(`pricing_plans?id=eq.${PLAN.starter}`, {
          method: 'PATCH',
          body: JSON.stringify({ price_php: original }),
        });
      }
    }),
});

Deno.test({
  ...opts,
  name: 'a refund event finds its payment by id and marks it refunded without ending the plan',
  fn: () =>
    withOrg(1, async (s, m) => {
      const { transactionId } = await buy(s, m, PLAN.growth);
      const paymentId = `pay_stub_${Date.now()}`;
      // The paid webhook is what records the payment id; the stubbed buy() has no payload.
      await rest(`org_payment_transactions?id=eq.${transactionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ provider_payment_id: paymentId }),
      });

      const result = await m.orchestrator.handlePaymongoWebhookEvent('payment.refunded', {
        data: {
          attributes: {
            type: 'payment.refunded',
            data: { id: 'ref_stub', type: 'refund', attributes: { payment_id: paymentId } },
          },
        },
      });
      assertEquals(result.handled, true);
      assertEquals((await txn(transactionId)).status, 'refunded');
      // The period stands until a super-admin decides otherwise.
      assertEquals((await sub(s.orgId)).status, 'active');

      // A second delivery is a no-op.
      const again = await m.orchestrator.handlePaymongoWebhookEvent('payment.refunded', {
        data: {
          attributes: {
            type: 'payment.refunded',
            data: { id: 'ref_stub', type: 'refund', attributes: { payment_id: paymentId } },
          },
        },
      });
      assertEquals(again.handled, false);
    }),
});
