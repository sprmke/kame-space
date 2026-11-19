/**
 * Plans & Billing end to end through the real edge handlers: real GoTrue sessions, real local
 * Postgres, real authorization, PayMongo stubbed. This is what a browser exercises, minus the
 * browser: owner, member without Plans access, member with it, an outsider from another org,
 * and an anonymous caller all hit the same endpoints.
 *
 *   LOCAL_BILLING_LIVE=1 TZ=Asia/Manila deno test --config supabase/functions/deno.json \
 *     --allow-net --allow-env --allow-read --allow-import \
 *     supabase/functions/tests/orgBillingEndpoints.integration_test.ts
 *
 * Needs the local stack with the billing migrations applied. Every run seeds throwaway users
 * and orgs and removes them. The cron is run scoped to the test org (never the whole DB).
 * Skipped unless LOCAL_BILLING_LIVE=1.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

const enabled = Deno.env.get('LOCAL_BILLING_LIVE') === '1';

// Public local-stack demo anon key (identical on every `supabase start`).
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

if (enabled) {
  Deno.env.set('EDGE_HANDLER_TEST', '1');
  Deno.env.set('SUPABASE_URL', LOCAL_SUPABASE_URL);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', LOCAL_SUPABASE_SERVICE_ROLE_KEY);
  Deno.env.set('SUPABASE_ANON_KEY', LOCAL_ANON_KEY);
  Deno.env.set('PLATFORM_BILLING_CRON_SECRET', 'billing-it-cron-secret');
  Deno.env.set('PAYMONGO_SECRET_KEY', 'sk_test_stub');
}

const svcHeaders = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...svcHeaders, Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// ─── PayMongo stub (everything else passes through to the real local stack) ──────

const paidSessions = new Set<string>();
let sessionCounter = 0;
const realFetch = globalThis.fetch;

function installPaymongoStub() {
  globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('https://api.paymongo.com')) return realFetch(input, init);
    const json = (body: unknown, status = 200) =>
      Promise.resolve(new Response(JSON.stringify(body), { status }));
    if (url.endsWith('/checkout_sessions') && init?.method === 'POST') {
      sessionCounter += 1;
      const id = `cs_ep_${Date.now()}_${sessionCounter}`;
      return json({ data: { id, attributes: { checkout_url: `https://pay.test/${id}` } } });
    }
    if (url.endsWith('/expire')) return json({ data: {} });
    const match = url.match(/checkout_sessions\/([^/?]+)/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      return json({
        data: {
          id,
          attributes: { status: paidSessions.has(id) ? 'paid' : 'active', payments: [] },
        },
      });
    }
    return json({ errors: [{ detail: 'unstubbed' }] }, 404);
  }) as typeof fetch;
}

// ─── Users, orgs, sessions ───────────────────────────────────────────────────────

const PLAN = {
  starter: 'd61e1c61-303a-4840-bc53-03ee72aea807',
  growth: '8039cb20-0e8c-4524-9487-faa966d8372f',
} as const;

type Actor = { id: string; email: string; token: string };

async function createActor(label: string): Promise<Actor> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `ep-${label}-${suffix}@example.com`;
  const password = `Pw-${suffix}-xyz!`;
  const created = await (
    await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: svcHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json();
  if (!created.id) throw new Error(`user create failed: ${JSON.stringify(created)}`);
  const session = await (
    await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: LOCAL_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  ).json();
  if (!session.access_token) throw new Error(`sign in failed: ${JSON.stringify(session)}`);
  return { id: created.id, email, token: session.access_token };
}

async function createOrg(owner: Actor, propertyCount: number) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [org] = await rest('organizations', {
    method: 'POST',
    body: JSON.stringify({
      name: `Endpoint IT ${suffix}`,
      slug: `endpoint-it-${suffix}`,
      owner_id: owner.id,
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
  return { orgId: org.id as string, slug: org.slug as string, propertyIds };
}

async function addMember(orgId: string, actor: Actor, permissions: string[]) {
  await rest('organization_members', {
    method: 'POST',
    body: JSON.stringify({
      organization_id: orgId,
      user_id: actor.id,
      role_id: 'ADMIN',
      status: 'active',
      permissions,
      all_listings: true,
    }),
  });
}

async function cleanup(orgIds: string[], actors: Actor[]) {
  for (const orgId of orgIds) {
    await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/organizations?id=eq.${orgId}`, {
      method: 'DELETE',
      headers: svcHeaders,
    });
  }
  for (const actor of actors) {
    await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users/${actor.id}`, {
      method: 'DELETE',
      headers: svcHeaders,
    });
  }
}

// ─── Calling the real handlers ───────────────────────────────────────────────────

type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();

async function handler(name: string): Promise<Handler> {
  const cached = handlers.get(name);
  if (cached) return cached;
  const { getMountedEdgeHandler } = await import('../_shared/serveEdge.ts');
  await import(`../${name}/index.ts`);
  const mounted = getMountedEdgeHandler(name);
  assert(mounted, `${name} did not mount`);
  handlers.set(name, mounted!);
  return mounted!;
}

type Call = {
  status: number;
  body: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  raw: Response;
};

async function call(
  name: string,
  actor: Actor | null,
  init: { method?: string; query?: Record<string, string>; body?: unknown } = {}
): Promise<Call> {
  const url = new URL(`${LOCAL_SUPABASE_URL}/functions/v1/${name}`);
  for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (actor) headers.Authorization = `Bearer ${actor.token}`;
  const response = await (
    await handler(name)
  )(
    new Request(url, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  );
  let body: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('json')) body = await response.clone().json();
  return { status: response.status, body, raw: response };
}

const data = (c: Call) => c.body.data ?? {};
const denied = (c: Call) => c.status === 401 || c.status === 403 || c.status === 404;

const opts = { ignore: !enabled, sanitizeResources: false, sanitizeOps: false };

Deno.test({
  ...opts,
  name: 'lifecycle through the real endpoints: purchase, receipts, details, scheduling, access',
  fn: async (t) => {
    installPaymongoStub();
    const owner = await createActor('owner');
    const outsider = await createActor('outsider');
    const viewer = await createActor('viewer');
    const noAccess = await createActor('noaccess');
    const { orgId, propertyIds } = await createOrg(owner, 2);
    const other = await createOrg(outsider, 1);
    await addMember(orgId, viewer, ['org.dashboard:view', 'org.plans:view']);
    await addMember(orgId, noAccess, ['org.dashboard:view']);

    const orchestrator = await import('../_shared/subscriptionOrchestrator.ts');
    const fulfillment = await import('../_shared/orgPaymentFulfillment.ts');
    let transactionId = '';

    try {
      await t.step('anonymous callers are refused everywhere', async () => {
        for (const [fn, init] of [
          ['org-plan', { query: { orgId } }],
          [
            'preview-org-plan-change',
            { method: 'POST', body: { organizationId: orgId, kind: 'pay' } },
          ],
          [
            'org-subscription-change',
            { method: 'POST', body: { organizationId: orgId, action: 'clear_intent' } },
          ],
          ['create-org-subscription-checkout', { method: 'POST', body: { organizationId: orgId } }],
          ['org-billing-details', { query: { orgId } }],
          ['get-org-payment-receipt', { query: { orgId, transactionId: crypto.randomUUID() } }],
          ['delete-organization', { method: 'DELETE', body: { orgId } }],
        ] as const) {
          assertEquals((await call(fn, null, init)).status, 401, fn);
        }
      });

      await t.step('an outsider from another org cannot read or change this org', async () => {
        for (const [fn, init] of [
          ['org-plan', { query: { orgId } }],
          [
            'preview-org-plan-change',
            { method: 'POST', body: { organizationId: orgId, kind: 'pay', planId: PLAN.growth } },
          ],
          [
            'preview-org-plan-change',
            { method: 'POST', body: { organizationId: orgId, kind: 'add_property' } },
          ],
          [
            'org-subscription-change',
            { method: 'POST', body: { organizationId: orgId, action: 'cancel_now' } },
          ],
          [
            'create-org-subscription-checkout',
            { method: 'POST', body: { organizationId: orgId, planId: PLAN.growth } },
          ],
          ['org-billing-details', { query: { orgId } }],
          [
            'org-billing-details',
            { method: 'PUT', body: { organizationId: orgId, legalName: 'Evil' } },
          ],
          ['delete-organization', { method: 'DELETE', body: { orgId } }],
        ] as const) {
          const result = await call(fn, outsider, init);
          assert(denied(result), `${fn} must refuse an outsider, got ${result.status}`);
        }
        // The attacker's own org is unaffected by any of that.
        assertEquals(
          (await call('org-plan', outsider, { query: { orgId: other.orgId } })).status,
          200
        );
      });

      await t.step(
        'a member without Plans access sees plan state but no money or PII',
        async () => {
          const plan = await call('org-plan', noAccess, { query: { orgId } });
          assertEquals(plan.status, 200);
          assertEquals(data(plan).transactions, []);
          assertEquals(data(plan).billingDetails, null);
          assert(denied(await call('org-billing-details', noAccess, { query: { orgId } })));
          assert(
            denied(
              await call('get-org-payment-receipt', noAccess, {
                query: { orgId, transactionId: crypto.randomUUID() },
              })
            )
          );
        }
      );

      await t.step('only the owner can change billing; a Plans viewer cannot', async () => {
        for (const [fn, init] of [
          [
            'org-subscription-change',
            { method: 'POST', body: { organizationId: orgId, action: 'cancel_now' } },
          ],
          [
            'create-org-subscription-checkout',
            { method: 'POST', body: { organizationId: orgId, planId: PLAN.growth } },
          ],
          [
            'preview-org-plan-change',
            { method: 'POST', body: { organizationId: orgId, kind: 'pay', planId: PLAN.growth } },
          ],
          [
            'org-billing-details',
            { method: 'PUT', body: { organizationId: orgId, legalName: 'Nope' } },
          ],
        ] as const) {
          assert(denied(await call(fn, viewer, init)), `${fn} must be owner only`);
        }
        assertEquals((await call('org-plan', viewer, { query: { orgId } })).status, 200);
      });

      await t.step('free org: plan state, quote and add-property note', async () => {
        const plan = await call('org-plan', owner, { query: { orgId } });
        assertEquals(plan.status, 200);
        assertEquals(data(plan).subscription, null);
        assertEquals(data(plan).assignedPropertyIds, []);
        assert((data(plan).plans as unknown[]).length >= 3);

        const quote = await call('preview-org-plan-change', owner, {
          method: 'POST',
          body: { organizationId: orgId, kind: 'pay', planId: PLAN.growth },
        });
        assertEquals(quote.status, 200);
        assertEquals(data(quote).propertyCount, 2);
        assert(data(quote).chargePhp > 0);

        const add = await call('preview-org-plan-change', owner, {
          method: 'POST',
          body: { organizationId: orgId, kind: 'add_property' },
        });
        assertEquals(add.status, 200);
        assertEquals(data(add).status, 'free');

        // Nothing to schedule or cancel without a plan.
        for (const action of ['cancel_at_period_end', 'clear_intent', 'cancel_now']) {
          const refused = await call('org-subscription-change', owner, {
            method: 'POST',
            body: { organizationId: orgId, action },
          });
          assert(
            refused.status >= 400 && refused.status < 500,
            `${action} on Free: ${refused.status}`
          );
        }
      });

      await t.step('an unknown plan id is a clean 404, never a server error', async () => {
        const fake = crypto.randomUUID();
        for (const [fn, body] of [
          ['preview-org-plan-change', { organizationId: orgId, kind: 'pay', planId: fake }],
          [
            'create-org-subscription-checkout',
            { organizationId: orgId, planId: fake, idempotencyKey: 'k-fake' },
          ],
        ] as const) {
          const res = await call(fn, owner, { method: 'POST', body });
          assertEquals(res.status, 404, `${fn}: ${JSON.stringify(res.body)}`);
          assertEquals(res.body.code, 'plan_not_found');
        }
      });

      await t.step(
        'checkout: stale price refused, idempotent, then paid and receipted',
        async () => {
          const stale = await call('create-org-subscription-checkout', owner, {
            method: 'POST',
            body: {
              organizationId: orgId,
              planId: PLAN.growth,
              expectedChargePhp: 1,
              idempotencyKey: 'k-stale',
            },
          });
          assertEquals(stale.status, 409);
          assertEquals(stale.body.code, 'price_changed');
          assert(stale.body.freshChargePhp > 1);

          const charge = stale.body.freshChargePhp as number;
          const first = await call('create-org-subscription-checkout', owner, {
            method: 'POST',
            body: {
              organizationId: orgId,
              planId: PLAN.growth,
              expectedChargePhp: charge,
              idempotencyKey: 'k-1',
            },
          });
          assertEquals(first.status, 200);
          transactionId = data(first).transactionId;
          assert(String(data(first).checkoutUrl).startsWith('https://pay.test/'));
          const again = await call('create-org-subscription-checkout', owner, {
            method: 'POST',
            body: {
              organizationId: orgId,
              planId: PLAN.growth,
              expectedChargePhp: charge,
              idempotencyKey: 'k-1',
            },
          });
          assertEquals(data(again).transactionId, transactionId);

          const [row] = await rest(`org_payment_transactions?id=eq.${transactionId}`);
          paidSessions.add(row.provider_reference);
          const result = await fulfillment.fulfillOrgSubscriptionPayment({
            transactionId,
            providerReference: row.provider_reference,
            paymentMethodType: 'qrph',
            assignedByUserId: owner.id,
          });
          assertEquals(result.applied, true);
        }
      );

      await t.step('paid org: state, history, receipt PDF and who may download it', async () => {
        const plan = await call('org-plan', owner, { query: { orgId } });
        const sub = data(plan).subscription;
        assertEquals(sub.status, 'active');
        assertEquals(sub.planId, PLAN.growth);
        assertEquals(data(plan).assignedPropertyIds.length, 2);
        const paid = (data(plan).transactions as Array<Record<string, any>>).find(
          // eslint-disable-line @typescript-eslint/no-explicit-any
          (txn) => txn.id === transactionId
        );
        assert(paid, 'payment is in the history');
        assertEquals(paid!.status, 'paid');
        assert(/^KS-R-\d{4}-\d{6}$/.test(paid!.receiptNumber), String(paid!.receiptNumber));
        assert(data(plan).upcomingPayment, 'the next payment is previewed');

        const receipt = await call('get-org-payment-receipt', owner, {
          query: { orgId, transactionId },
        });
        assertEquals(receipt.status, 200);
        assertEquals(receipt.raw.headers.get('content-type'), 'application/pdf');
        const bytes = new Uint8Array(await receipt.raw.arrayBuffer());
        assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
        // A Plans viewer may download it; nobody else, and not through another org's id.
        assertEquals(
          (await call('get-org-payment-receipt', viewer, { query: { orgId, transactionId } }))
            .status,
          200
        );
        assert(
          denied(
            await call('get-org-payment-receipt', noAccess, { query: { orgId, transactionId } })
          )
        );
        const crossOrg = await call('get-org-payment-receipt', outsider, {
          query: { orgId: other.orgId, transactionId },
        });
        assert(
          crossOrg.status >= 400,
          `another org's receipt must not download, got ${crossOrg.status}`
        );
      });

      await t.step(
        'billing details: validated, owner writes, viewer reads, outsider refused',
        async () => {
          const bad = await call('org-billing-details', owner, {
            method: 'PUT',
            body: { organizationId: orgId, legalName: 'Sample Holdings', tin: '12' },
          });
          assertEquals(bad.status, 400);
          const ok = await call('org-billing-details', owner, {
            method: 'PUT',
            body: {
              organizationId: orgId,
              legalName: 'Sample Holdings Inc.',
              address: '12 Mactan Road',
              tin: '123-456-789-000',
              billingEmail: 'billing@sample.test',
            },
          });
          assertEquals(ok.status, 200);
          const read = await call('org-billing-details', viewer, { query: { orgId } });
          assertEquals(data(read).details.legalName, 'Sample Holdings Inc.');
          assertEquals(data(read).details.tin, '123-456-789-000');
          // The TIN is on the plan response for a viewer, and absent for a member without access.
          assertEquals(
            (data(await call('org-plan', viewer, { query: { orgId } })).billingDetails ?? {}).tin,
            '123-456-789-000'
          );
          assertEquals(
            data(await call('org-plan', noAccess, { query: { orgId } })).billingDetails,
            null
          );
          // The activity log records which fields changed, never their values.
          const logs = await rest(
            `activity_log?organization_id=eq.${orgId}&action=eq.billing.details_updated&select=metadata`
          );
          assert(logs.length >= 1);
          assert(
            !JSON.stringify(logs).includes('123-456-789-000'),
            'TIN must not reach the activity log'
          );
        }
      );

      await t.step('scheduling: downgrade, replace with cancel, undo, validation', async () => {
        const change = (body: Record<string, unknown>) =>
          call('org-subscription-change', owner, {
            method: 'POST',
            body: { organizationId: orgId, ...body },
          });

        const scheduled = await change({ action: 'schedule_downgrade', planId: PLAN.starter });
        assertEquals(scheduled.status, 200);
        let sub = data(await call('org-plan', owner, { query: { orgId } })).subscription;
        assertEquals(sub.planId, PLAN.growth, 'the current plan stays until the period ends');
        assertEquals(sub.scheduledPlanId, PLAN.starter);
        assertEquals(sub.status, 'active');

        // Scheduling the same thing twice is harmless; upgrading via "downgrade" is refused.
        assertEquals(
          (await change({ action: 'schedule_downgrade', planId: PLAN.starter })).status,
          200
        );
        const upward = await change({ action: 'schedule_downgrade', planId: PLAN.growth });
        assert(upward.status >= 400 && upward.status < 500, `same plan: ${upward.status}`);

        // A cancel replaces the downgrade (mutually exclusive), and can be taken back.
        const cancel = await change({ action: 'cancel_at_period_end', reason: 'too_expensive' });
        assertEquals(cancel.status, 200);
        sub = data(await call('org-plan', owner, { query: { orgId } })).subscription;
        assertEquals(sub.cancelAtPeriodEnd, true);
        assertEquals(sub.scheduledPlanId, null);
        assertEquals((await change({ action: 'clear_intent' })).status, 200);
        sub = data(await call('org-plan', owner, { query: { orgId } })).subscription;
        assertEquals(sub.cancelAtPeriodEnd, false);
        assertEquals(sub.scheduledPlanId, null);

        // The reason is optional analytics: an unknown one is dropped, never stored as given.
        assertEquals(
          (await change({ action: 'cancel_at_period_end', reason: 'not-a-reason' })).status,
          200
        );
        const [stored] = await rest(
          `org_subscriptions?organization_id=eq.${orgId}&select=cancel_reason,cancel_at_period_end`
        );
        assertEquals(stored.cancel_at_period_end, true);
        assertEquals(stored.cancel_reason, null);
        assertEquals((await change({ action: 'clear_intent' })).status, 200);
        assertEquals((await change({ action: 'does_not_exist' })).status >= 400, true);
        // "Cancel now" is only for overdue subscriptions.
        assert((await change({ action: 'cancel_now' })).status >= 400);
      });

      await t.step('add-property note, and a paid plan blocks deleting the org', async () => {
        const add = await call('preview-org-plan-change', owner, {
          method: 'POST',
          body: { organizationId: orgId, kind: 'add_property' },
        });
        assertEquals(data(add).status, 'covered');
        assertEquals(data(add).planName.length > 0, true);
        assert(data(add).addsMonthlyPhp > 0);
        assert(data(add).trueUpPhp >= 0);

        const blocked = await call('delete-organization', owner, {
          method: 'DELETE',
          body: { orgId },
        });
        assertEquals(blocked.status, 409);
        assert(String(blocked.body.error).toLowerCase().includes('paid plan'));
        assertEquals((await rest(`organizations?id=eq.${orgId}&select=id`)).length, 1);
      });

      await t.step('the cron endpoint refuses callers without the secret', async () => {
        const noSecret = await (
          await handler('platform-billing-cron')
        )(
          new Request(`${LOCAL_SUPABASE_URL}/functions/v1/platform-billing-cron`, {
            method: 'POST',
            body: '{}',
          })
        );
        assert(noSecret.status === 401 || noSecret.status === 403, `got ${noSecret.status}`);
        const wrong = await (
          await handler('platform-billing-cron')
        )(
          new Request(`${LOCAL_SUPABASE_URL}/functions/v1/platform-billing-cron`, {
            method: 'POST',
            headers: { 'x-platform-billing-cron-secret': 'nope' },
            body: '{}',
          })
        );
        assert(wrong.status === 401 || wrong.status === 403, `got ${wrong.status}`);
      });

      await t.step(
        'period end with a scheduled downgrade: applied once, a rerun changes nothing',
        async () => {
          await call('org-subscription-change', owner, {
            method: 'POST',
            body: { organizationId: orgId, action: 'schedule_downgrade', planId: PLAN.starter },
          });
          const [sub] = await rest(
            `org_subscriptions?organization_id=eq.${orgId}&status=eq.active`
          );
          const day = 24 * 60 * 60 * 1000;
          await rest(`org_subscriptions?id=eq.${sub.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              current_period_start: new Date(Date.now() - 31 * day).toISOString(),
              current_period_end: new Date(Date.now() - 1 * day).toISOString(),
              scheduled_change_at: new Date(Date.now() - 1 * day).toISOString(),
            }),
          });
          const eventsBefore = (
            await rest(`org_subscription_events?org_subscription_id=eq.${sub.id}&select=id`)
          ).length;

          await orchestrator.runPlatformBillingCycle({ organizationIds: [orgId] });
          const after = data(await call('org-plan', owner, { query: { orgId } })).subscription;
          assert(
            after.planId === PLAN.starter || after.status === 'past_due',
            `expected the scheduled plan or past due, got ${after.planId} / ${after.status}`
          );
          const eventsAfterFirst = (
            await rest(`org_subscription_events?org_subscription_id=eq.${sub.id}&select=id`)
          ).length;
          assert(eventsAfterFirst > eventsBefore, 'the transition is recorded');
          const notices = (
            await rest(`org_billing_notifications?organization_id=eq.${orgId}&select=id`)
          ).length;

          await orchestrator.runPlatformBillingCycle({ organizationIds: [orgId] });
          assertEquals(
            (await rest(`org_subscription_events?org_subscription_id=eq.${sub.id}&select=id`))
              .length,
            eventsAfterFirst,
            'a second run must not repeat the transition'
          );
          assertEquals(
            (await rest(`org_billing_notifications?organization_id=eq.${orgId}&select=id`)).length,
            notices,
            'a second run must not send the same notice again'
          );
        }
      );

      await t.step('the owner can end an overdue plan and then delete the org', async () => {
        // Make sure it is overdue whichever way the previous step resolved.
        const [sub] = await rest(
          `org_subscriptions?organization_id=eq.${orgId}&status=in.(active,past_due,suspended)`
        );
        if (sub.status === 'active') {
          const day = 24 * 60 * 60 * 1000;
          await rest(`org_subscriptions?id=eq.${sub.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              current_period_start: new Date(Date.now() - 40 * day).toISOString(),
              current_period_end: new Date(Date.now() - 10 * day).toISOString(),
              scheduled_plan_id: null,
              scheduled_change_at: null,
            }),
          });
          await orchestrator.runPlatformBillingCycle({ organizationIds: [orgId] });
        }
        const now = await call('org-subscription-change', owner, {
          method: 'POST',
          body: { organizationId: orgId, action: 'cancel_now', reason: 'other' },
        });
        assertEquals(now.status, 200, JSON.stringify(now.body));
        assertEquals(data(await call('org-plan', owner, { query: { orgId } })).subscription, null);
        const closed = await rest(
          `org_subscriptions?organization_id=eq.${orgId}&select=status,ended_reason`
        );
        assert(
          closed.some(
            (row: { status: string; ended_reason: string }) =>
              row.status === 'canceled' && row.ended_reason === 'host_canceled'
          )
        );
        assertEquals(
          (
            await rest(
              `org_subscription_properties?select=id&org_subscription_id=in.(${(await rest(`org_subscriptions?organization_id=eq.${orgId}&select=id`)).map((r: { id: string }) => r.id).join(',')})`
            )
          ).length,
          0,
          'every property is unenrolled'
        );

        const deleted = await call('delete-organization', owner, {
          method: 'DELETE',
          body: { orgId },
        });
        assertEquals(deleted.status, 200, JSON.stringify(deleted.body));
        assertEquals((await rest(`organizations?id=eq.${orgId}&select=id`)).length, 0);
      });

      await t.step('the database refuses anon on the billing functions and tables', async () => {
        const anonRpc = async (fn: string, body: Record<string, string>) =>
          (
            await realFetch(`${LOCAL_SUPABASE_URL}/rest/v1/rpc/${fn}`, {
              method: 'POST',
              headers: {
                apikey: LOCAL_ANON_KEY,
                Authorization: `Bearer ${LOCAL_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            })
          ).status;
        const zero = '00000000-0000-0000-0000-000000000001';
        assertEquals(
          await anonRpc('cancel_org_subscription_to_free', {
            p_org_subscription_id: zero,
            p_target_plan_id: zero,
            p_previous_status: 'active',
          }),
          401
        );
        assertEquals(await anonRpc('org_billing_balance', { p_organization_id: zero }), 401);
        assertEquals(await anonRpc('assign_org_payment_receipt', { p_transaction_id: zero }), 401);
        for (const table of [
          'org_billing_ledger',
          'org_billing_details',
          'org_billing_notifications',
          'plan_price_migrations',
        ]) {
          const res = await realFetch(`${LOCAL_SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
            headers: { apikey: LOCAL_ANON_KEY, Authorization: `Bearer ${LOCAL_ANON_KEY}` },
          });
          assertEquals(res.status, 401, table);
        }
      });
    } finally {
      globalThis.fetch = realFetch;
      await cleanup([orgId, other.orgId], [owner, outsider, viewer, noAccess]);
    }
    void propertyIds;
  },
});
