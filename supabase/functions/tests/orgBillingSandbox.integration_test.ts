/**
 * Plans & Billing against the real PayMongo SANDBOX (plan task 9.1 / PR-033).
 *
 * The handlers run in-process against the local Postgres and GoTrue; PayMongo is the real test
 * API, and every payment is made through the real hosted checkout with the test card
 * (scripts/dev/paymongo-sandbox-pay.mjs, headless Playwright). Nothing is stubbed.
 *
 *   PAYMONGO_SANDBOX=1 PAYMONGO_SECRET_KEY=sk_test_... TZ=Asia/Manila deno test \
 *     --config supabase/functions/deno.json --allow-net --allow-env --allow-read --allow-run \
 *     --allow-import supabase/functions/tests/orgBillingSandbox.integration_test.ts
 *
 * Refuses any key that is not `sk_test_`. Seeds throwaway users and orgs and removes them.
 * Webhooks are not delivered to this process, so every payment is recovered by reconciliation
 * (the "webhook delayed" path); webhook events are replayed from the real PayMongo resources.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

const secretKey = Deno.env.get('PAYMONGO_SECRET_KEY') ?? '';
const enabled = Deno.env.get('PAYMONGO_SANDBOX') === '1' && secretKey.startsWith('sk_test_');
if (Deno.env.get('PAYMONGO_SANDBOX') === '1' && !secretKey.startsWith('sk_test_')) {
  throw new Error('Refusing to run: PAYMONGO_SECRET_KEY must be a sandbox key (sk_test_...).');
}

const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

if (enabled) {
  Deno.env.set('EDGE_HANDLER_TEST', '1');
  Deno.env.set('SUPABASE_URL', LOCAL_SUPABASE_URL);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', LOCAL_SUPABASE_SERVICE_ROLE_KEY);
  Deno.env.set('SUPABASE_ANON_KEY', LOCAL_ANON_KEY);
  Deno.env.set('PUBLIC_GUEST_APP_ORIGIN', 'http://localhost:5173');
}

const svc = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...svc, Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const PLAN = {
  starter: 'd61e1c61-303a-4840-bc53-03ee72aea807',
  growth: '8039cb20-0e8c-4524-9487-faa966d8372f',
  pro: 'a0562a5e-df4a-4617-bfcf-c88589bf6046',
} as const;

// ─── PayMongo sandbox helpers ────────────────────────────────────────────────────

const auth = () => `Basic ${btoa(`${secretKey}:`)}`;

async function paymongo(method: string, path: string, body?: unknown) {
  const res = await fetch(`https://api.paymongo.com${path}`, {
    method,
    headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function session(id: string): Promise<Record<string, any>> {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  const { json } = await paymongo('GET', `/v1/checkout_sessions/${id}`);
  return json.data.attributes;
}

/** Pays a hosted sandbox checkout with the test card, in a real headless browser. */
async function payInBrowser(checkoutUrl: string): Promise<{ outcome: string; detail: string }> {
  const out = await new Deno.Command('node', {
    args: ['scripts/dev/paymongo-sandbox-pay.mjs', checkoutUrl],
    env: { PAYMONGO_DEBUG_SHOT: Deno.env.get('PAYMONGO_DEBUG_SHOT') ?? '' },
    stdout: 'piped',
    stderr: 'piped',
  }).output();
  const line = new TextDecoder().decode(out.stdout).trim().split('\n').pop() ?? '';
  const [outcome, ...rest] = line.split(' ');
  return { outcome, detail: rest.join(' ') };
}

// ─── Users, orgs, handlers ───────────────────────────────────────────────────────

type Actor = { id: string; token: string };

async function createOwner(): Promise<Actor> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `sbx-${suffix}@example.com`;
  const password = `Pw-${suffix}-xyz!`;
  const created = await (
    await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: svc,
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json();
  const sess = await (
    await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: LOCAL_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  ).json();
  return { id: created.id, token: sess.access_token };
}

async function createOrg(owner: Actor, properties: number) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [org] = await rest('organizations', {
    method: 'POST',
    body: JSON.stringify({
      name: `Sandbox QA ${suffix}`,
      slug: `sandbox-qa-${suffix}`,
      owner_id: owner.id,
    }),
  });
  for (let i = 0; i < properties; i += 1) {
    await rest('properties', {
      method: 'POST',
      body: JSON.stringify({
        organization_id: org.id,
        name: `QA Unit ${i + 1} ${suffix}`,
        slug: `qa-unit-${i + 1}-${suffix}`,
      }),
    });
  }
  return org.id as string;
}

type Handler = (req: Request) => Promise<Response>;
const mounted = new Map<string, Handler>();

async function call(
  name: string,
  actor: Actor,
  init: { method?: string; query?: Record<string, string>; body?: unknown } = {}
) {
  let handler = mounted.get(name);
  if (!handler) {
    const { getMountedEdgeHandler } = await import('../_shared/serveEdge.ts');
    await import(`../${name}/index.ts`);
    handler = getMountedEdgeHandler(name)!;
    mounted.set(name, handler);
  }
  const url = new URL(`${LOCAL_SUPABASE_URL}/functions/v1/${name}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const res = await handler(
    new Request(url, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${actor.token}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  );
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, data: body.data ?? {} };
}

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const liveSub = async (orgId: string) =>
  (
    await rest(
      `org_subscriptions?organization_id=eq.${orgId}&status=in.(active,trialing,past_due,suspended)`
    )
  )[0];
const txn = async (id: string) => (await rest(`org_payment_transactions?id=eq.${id}`))[0];

const log = (...parts: unknown[]) => console.log('  ›', ...parts);

Deno.test({
  ignore: !enabled,
  sanitizeResources: false,
  sanitizeOps: false,
  name: 'PayMongo sandbox: subscribe, supersede, upgrade, replay, refund, grace and suspension renewals',
  fn: async (t) => {
    const owner = await createOwner();
    const orgId = await createOrg(owner, 2);
    const orchestrator = await import('../_shared/subscriptionOrchestrator.ts');
    const reconcile = await import('../_shared/orgPaymentReconcile.ts');
    let firstTxn = '';
    let firstPaymentId = '';

    const pay = async (transactionId: string) => {
      const row = await txn(transactionId);
      assert(String(row.provider_reference).startsWith('cs_'), 'a hosted checkout session');
      const paid = await payInBrowser((await session(row.provider_reference)).checkout_url);
      assertEquals(paid.outcome, 'paid', paid.detail);
      return row.provider_reference as string;
    };
    const checkout = async (planId: string | null, key: string) => {
      const preview = await call('preview-org-plan-change', owner, {
        method: 'POST',
        body: { organizationId: orgId, kind: 'pay', planId },
      });
      assertEquals(preview.status, 200, JSON.stringify(preview.body));
      const res = await call('create-org-subscription-checkout', owner, {
        method: 'POST',
        body: {
          organizationId: orgId,
          ...(planId ? { planId } : {}),
          expectedChargePhp: preview.data.chargePhp,
          idempotencyKey: key,
        },
      });
      assertEquals(res.status, 200, JSON.stringify(res.body));
      return { ...res.data, preview: preview.data };
    };

    try {
      await t.step(
        'subscribe: real session, paid by e-wallet, recovered without a webhook',
        async () => {
          const c = await checkout(PLAN.growth, 'sbx-1');
          firstTxn = c.transactionId;
          const row = await txn(firstTxn);
          const s = await session(row.provider_reference);
          assertEquals(s.livemode, false);
          assertEquals(s.line_items.length >= 1, true);
          assertEquals(
            Number(s.line_items.reduce((sum: number, l: any) => sum + l.amount * l.quantity, 0)),
            Math.round(Number(row.amount) * 100)
          ); // eslint-disable-line @typescript-eslint/no-explicit-any
          const ref = await pay(firstTxn);
          const after = await session(ref);
          log(
            'session status after payment:',
            after.status,
            '| payments:',
            after.payments.map((p: any) => p.attributes.status)
          ); // eslint-disable-line @typescript-eslint/no-explicit-any

          // Webhook never arrives here; the plan page's reconcile finds the payment.
          assertEquals(
            await reconcile.reconcilePendingOrgPaymentTransaction(firstTxn, { force: true }),
            'fulfilled'
          );
          const paid = await txn(firstTxn);
          assertEquals(paid.status, 'paid');
          assertEquals(paid.applied, true);
          assert(
            ['gcash', 'paymaya'].includes(paid.payment_method_type),
            String(paid.payment_method_type)
          );
          assert(/^pay_/.test(paid.provider_payment_id), 'the payment id is stored for refunds');
          firstPaymentId = paid.provider_payment_id;
          assert(/^KS-R-\d{4}-\d{6}$/.test(paid.receipt_number));
          const sub = await liveSub(orgId);
          assertEquals(sub.status, 'active');
          assertEquals(sub.plan_id, PLAN.growth);
          assertEquals(
            (await rest(`org_subscription_properties?org_subscription_id=eq.${sub.id}`)).length,
            2
          );
          // PayMongo's own paid time, not the time we noticed.
          const payMongoPaidAt = new Date(after.payments[0].attributes.paid_at * 1000).getTime();
          assert(
            Math.abs(new Date(paid.paid_at).getTime() - payMongoPaidAt) < 2000,
            "paid_at is PayMongo's"
          );
        }
      );

      await t.step('a superseded link is closed at PayMongo and cannot be paid', async () => {
        const upgrade = await checkout(PLAN.pro, 'sbx-2');
        const row = await txn(upgrade.transactionId);
        const sched = await call('org-subscription-change', owner, {
          method: 'POST',
          body: { organizationId: orgId, action: 'schedule_downgrade', planId: PLAN.starter },
        });
        assertEquals(sched.status, 200, JSON.stringify(sched.body));
        // Scheduling expires the open checkout locally and at PayMongo.
        assertEquals((await txn(upgrade.transactionId)).status, 'expired');
        assertEquals((await session(row.provider_reference)).status, 'expired');
        const attempt = await payInBrowser((await session(row.provider_reference)).checkout_url);
        log('paying the closed link:', attempt.outcome, attempt.detail.slice(0, 80));
        assert(attempt.outcome !== 'paid', 'a closed session must not take a payment');
        assertEquals(
          (
            await call('org-subscription-change', owner, {
              method: 'POST',
              body: { organizationId: orgId, action: 'clear_intent' },
            })
          ).status,
          200
        );
      });

      await t.step('upgrade mid-period credits the unused time and clears intent', async () => {
        const c = await checkout(PLAN.pro, 'sbx-3');
        assert(c.preview.unusedCreditPhp > 0, 'unused time is credited');
        assert(
          c.preview.chargePhp < c.preview.targetTotalPhp,
          'the charge is below the full price'
        );
        await pay(c.transactionId);
        assertEquals(
          await reconcile.reconcilePendingOrgPaymentTransaction(c.transactionId, { force: true }),
          'fulfilled'
        );
        const sub = await liveSub(orgId);
        assertEquals(sub.plan_id, PLAN.pro);
        assertEquals(sub.scheduled_plan_id, null);
        assertEquals(sub.status, 'active');
        firstTxn = c.transactionId;
        firstPaymentId = (await txn(c.transactionId)).provider_payment_id;
        assert(/^pay_/.test(firstPaymentId));
      });

      await t.step('a replayed paid event changes nothing', async () => {
        const row = await txn(firstTxn);
        const attrs = await session(row.provider_reference);
        const event = {
          data: {
            id: 'evt_replay',
            type: 'event',
            attributes: {
              type: 'checkout_session.payment.paid',
              livemode: false,
              data: { id: row.provider_reference, type: 'checkout_session', attributes: attrs },
            },
          },
        };
        const subBefore = await liveSub(orgId);
        const eventsBefore = (
          await rest(`org_subscription_events?org_subscription_id=eq.${subBefore.id}&select=id`)
        ).length;
        const ledgerBefore = (
          await rest(`org_billing_ledger?organization_id=eq.${orgId}&select=id`)
        ).length;
        for (let i = 0; i < 2; i += 1) {
          const res = await orchestrator.handlePaymongoWebhookEvent(
            'checkout_session.payment.paid',
            event
          );
          assertEquals(res.handled, false);
        }
        assertEquals((await liveSub(orgId)).current_period_end, subBefore.current_period_end);
        assertEquals(
          (await rest(`org_subscription_events?org_subscription_id=eq.${subBefore.id}&select=id`))
            .length,
          eventsBefore
        );
        assertEquals(
          (await rest(`org_billing_ledger?organization_id=eq.${orgId}&select=id`)).length,
          ledgerBefore
        );
      });

      await t.step('a real refund event finds its payment and leaves the plan alone', async () => {
        const row = await txn(firstTxn);
        const refund = await paymongo('POST', '/v1/refunds', {
          data: {
            attributes: {
              payment_id: firstPaymentId,
              amount: Math.round(Number(row.amount) * 100),
              reason: 'requested_by_customer',
            },
          },
        });
        log(
          'refund API:',
          refund.status,
          refund.json?.errors?.[0]?.detail ?? refund.json?.data?.attributes?.status
        );
        assert(
          refund.status < 300,
          `sandbox refund failed: ${JSON.stringify(refund.json).slice(0, 200)}`
        );
        const resource = refund.json.data;
        assertEquals(resource.type, 'refund');
        assertEquals(resource.attributes.payment_id, firstPaymentId); // the field our handler matches on
        const res = await orchestrator.handlePaymongoWebhookEvent('payment.refunded', {
          data: {
            id: 'evt_refund',
            type: 'event',
            attributes: { type: 'payment.refunded', livemode: false, data: resource },
          },
        });
        assertEquals(res.handled, true);
        assertEquals((await txn(firstTxn)).status, 'refunded');
        assertEquals(
          (await liveSub(orgId)).status,
          'active',
          'the period stands until an admin decides'
        );
      });

      await t.step(
        'past due, then paid in grace: the renewal date does not move (D4)',
        async () => {
          const sub = await liveSub(orgId);
          const oldEnd = new Date(Date.now() - 1 * DAY).toISOString();
          await rest(`org_subscriptions?id=eq.${sub.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              current_period_start: iso(-31),
              current_period_end: oldEnd,
              scheduled_plan_id: null,
            }),
          });
          await orchestrator.runPlatformBillingCycle({ organizationIds: [orgId] });
          const due = await liveSub(orgId);
          assertEquals(due.status, 'past_due');
          const pending = (
            await rest(`org_payment_transactions?organization_id=eq.${orgId}&status=eq.pending`)
          )[0];
          assert(pending, 'a fresh payment link is waiting');
          await pay(pending.id);
          assertEquals(
            await reconcile.reconcilePendingOrgPaymentTransaction(pending.id, { force: true }),
            'fulfilled'
          );
          const renewed = await liveSub(orgId);
          assertEquals(renewed.status, 'active');
          assertEquals(renewed.grace_period_ends_at, null);
          assert(
            Math.abs(
              new Date(renewed.current_period_start).getTime() - new Date(oldEnd).getTime()
            ) < 2000,
            'the new period starts where the old one ended'
          );
        }
      );

      await t.step(
        'suspended works like Free, and paying reactivates with a new anchor',
        async () => {
          const sub = await liveSub(orgId);
          await rest(`org_subscriptions?id=eq.${sub.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ current_period_start: iso(-45), current_period_end: iso(-14) }),
          });
          await orchestrator.runPlatformBillingCycle({ organizationIds: [orgId] });
          await orchestrator.runPlatformBillingCycle({ organizationIds: [orgId] });
          const suspended = await liveSub(orgId);
          assertEquals(suspended.status, 'suspended');
          const plan = await call('org-plan', owner, { query: { orgId } });
          assertEquals(plan.data.subscription.status, 'suspended');

          const pending = (
            await rest(`org_payment_transactions?organization_id=eq.${orgId}&status=eq.pending`)
          )[0];
          assert(pending, 'a payment link exists while suspended');
          const before = Date.now();
          await pay(pending.id);
          assertEquals(
            await reconcile.reconcilePendingOrgPaymentTransaction(pending.id, { force: true }),
            'fulfilled'
          );
          const back = await liveSub(orgId);
          assertEquals(back.status, 'active');
          assertEquals(back.suspended_at, null);
          assert(
            new Date(back.current_period_start).getTime() >= before - 60_000,
            'a new period from the payment date'
          );
        }
      );

      await t.step('renewal paid early starts at the old period end (E11)', async () => {
        const sub = await liveSub(orgId);
        const end = new Date(Date.now() + 3 * DAY).toISOString();
        await rest(`org_subscriptions?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ current_period_start: iso(-27), current_period_end: end }),
        });
        await orchestrator.runPlatformBillingCycle({ organizationIds: [orgId] }); // lead window: issues the link
        const pending = (
          await rest(`org_payment_transactions?organization_id=eq.${orgId}&status=eq.pending`)
        )[0];
        assert(pending, 'the renewal link is issued inside the lead window');
        await pay(pending.id);
        assertEquals(
          await reconcile.reconcilePendingOrgPaymentTransaction(pending.id, { force: true }),
          'fulfilled'
        );
        const renewed = await liveSub(orgId);
        assertEquals(renewed.status, 'active');
        assert(
          Math.abs(new Date(renewed.current_period_start).getTime() - new Date(end).getTime()) <
            2000,
          'the next period begins at the previous end, so no prepaid days are lost'
        );
      });
    } finally {
      await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/organizations?id=eq.${orgId}`, {
        method: 'DELETE',
        headers: svc,
      });
      await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users/${owner.id}`, {
        method: 'DELETE',
        headers: svc,
      });
    }
  },
});
