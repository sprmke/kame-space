import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  classifyCheckout,
  dueReminders,
  nextBillingTransition,
  validateCancelAtPeriodEnd,
  validateCancelNow,
  validateClearIntent,
  validateOrgDeletion,
  validateScheduleDowngrade,
  type BillingContext,
  type BillingSettings,
  type PlanRef,
  type SubscriptionState,
} from './orgSubscriptionStateMachine.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2027-03-10T04:00:00Z');
const at = (days: number) => new Date(now.getTime() + days * DAY);

const free: PlanRef = { id: 'free', code: 'free', sortOrder: 0, isDefault: true };
const starter: PlanRef = { id: 'starter', code: 'starter', sortOrder: 10, isDefault: false };
const growth: PlanRef = { id: 'growth', code: 'growth', sortOrder: 20, isDefault: false };
const pro: PlanRef = { id: 'pro', code: 'pro', sortOrder: 30, isDefault: false };
const managed: PlanRef = { id: 'managed', code: 'managed', sortOrder: 40, isDefault: false };
const active = (p: PlanRef) => ({ ...p, isActive: true });

const settings: BillingSettings = {
  renewalLinkLeadDays: 5,
  gracePeriodDays: 5,
  suspensionCancelDays: 30,
};
const ctx: BillingContext = { billablePropertyCount: 2, renewalCoveredByCredit: false };

function sub(over: Partial<SubscriptionState> = {}): SubscriptionState {
  return {
    id: 's1',
    status: 'active',
    source: 'purchase',
    plan: pro,
    currentPeriodStart: at(-20),
    currentPeriodEnd: at(10),
    graceEndsAt: null,
    suspendedAt: null,
    cancelAtPeriodEnd: false,
    scheduledPlanId: null,
    scheduledChangeAt: null,
    ...over,
  };
}

// ─── Self-serve validation ───────────────────────────────────────────────────────

Deno.test('schedule downgrade: active paid to lower paid is allowed', () => {
  assertEquals(validateScheduleDowngrade(sub(), active(starter)), { ok: true });
});

Deno.test('schedule downgrade: rejects upgrade, same plan, Free, Managed, inactive', () => {
  assertEquals(validateScheduleDowngrade(sub({ plan: starter }), active(pro)).ok, false);
  assertEquals(validateScheduleDowngrade(sub(), active(pro)).ok, false);
  assertEquals(validateScheduleDowngrade(sub(), active(free)).ok, false);
  assertEquals(validateScheduleDowngrade(sub(), active(managed)).ok, false);
  assertEquals(validateScheduleDowngrade(sub(), { ...starter, isActive: false }).ok, false);
  assertEquals(validateScheduleDowngrade(null, active(starter)).ok, false);
});

Deno.test('schedule downgrade: blocked for past_due, suspended, Managed and reward trials', () => {
  assertEquals(validateScheduleDowngrade(sub({ status: 'past_due' }), active(starter)).ok, false);
  assertEquals(validateScheduleDowngrade(sub({ status: 'suspended' }), active(starter)).ok, false);
  assertEquals(validateScheduleDowngrade(sub({ plan: managed }), active(starter)).ok, false);
  assertEquals(
    validateScheduleDowngrade(sub({ status: 'trialing', source: 'reward' }), active(starter)).ok,
    false
  );
});

Deno.test('cancel at period end: only active paid, non-managed', () => {
  assertEquals(validateCancelAtPeriodEnd(sub()), { ok: true });
  assertEquals(validateCancelAtPeriodEnd(sub({ status: 'past_due' })).ok, false);
  assertEquals(validateCancelAtPeriodEnd(sub({ status: 'suspended' })).ok, false);
  assertEquals(validateCancelAtPeriodEnd(sub({ plan: managed })).ok, false);
  assertEquals(validateCancelAtPeriodEnd(sub({ status: 'trialing', source: 'reward' })).ok, false);
  assertEquals(validateCancelAtPeriodEnd(null).ok, false);
});

Deno.test('cancel now: only for overdue subscriptions', () => {
  assertEquals(validateCancelNow(sub({ status: 'past_due' })), { ok: true });
  assertEquals(validateCancelNow(sub({ status: 'suspended' })), { ok: true });
  assertEquals(validateCancelNow(sub()).ok, false);
  assertEquals(validateCancelNow(sub({ status: 'past_due', plan: managed })).ok, false);
});

Deno.test('clear intent requires a pending intent', () => {
  assertEquals(validateClearIntent(sub()).ok, false);
  assertEquals(validateClearIntent(sub({ cancelAtPeriodEnd: true })), { ok: true });
  assertEquals(validateClearIntent(sub({ scheduledPlanId: 'starter' })), { ok: true });
});

Deno.test('org deletion: blocked only while a purchased paid plan is live', () => {
  const free: PlanRef = { id: 'free', code: 'free', sortOrder: 0, isDefault: true };
  assertEquals(validateOrgDeletion(null), { ok: true });
  assertEquals(validateOrgDeletion(sub({ plan: free })), { ok: true });
  // Reward trials and admin grants are not paid for by the host.
  assertEquals(validateOrgDeletion(sub({ status: 'trialing', source: 'reward' })), { ok: true });
  assertEquals(validateOrgDeletion(sub({ source: 'admin' })), { ok: true });
  for (const status of ['active', 'past_due', 'suspended'] as const) {
    assertEquals(validateOrgDeletion(sub({ status })).ok, false, status);
  }
  const canceling = validateOrgDeletion(sub({ cancelAtPeriodEnd: true }));
  assertEquals(canceling.ok, false);
  if (!canceling.ok) assertEquals(canceling.message.includes('end of the billing period'), true);
});

// ─── Checkout classification ─────────────────────────────────────────────────────

const classify = (s: SubscriptionState | null, target: PlanRef | null) =>
  classifyCheckout({
    sub: s,
    target: target ? active(target) : null,
    now,
    renewalLeadDays: 5,
  });

Deno.test('classify: no subscription is an initial purchase', () => {
  assertEquals(classify(null, starter), {
    ok: true,
    purpose: 'initial',
    effectivePlanId: 'starter',
  });
  assertEquals(classify(null, null).ok, false);
  assertEquals(classify(null, free).ok, false);
  assertEquals(classify(null, managed).ok, false);
});

Deno.test('classify: active upgrade is a fresh-period change', () => {
  assertEquals(classify(sub({ plan: starter }), pro), {
    ok: true,
    purpose: 'change',
    effectivePlanId: 'pro',
  });
});

Deno.test('classify: active lower plan is rejected (schedule a downgrade instead)', () => {
  assertEquals(classify(sub({ plan: pro }), starter).ok, false);
});

Deno.test('classify: renewal only inside the lead window', () => {
  assertEquals(classify(sub(), null).ok, false); // 10 days out
  const soon = sub({ currentPeriodEnd: at(3) });
  assertEquals(classify(soon, null), { ok: true, purpose: 'renewal', effectivePlanId: 'pro' });
  assertEquals(classify(soon, pro), { ok: true, purpose: 'renewal', effectivePlanId: 'pro' });
});

Deno.test('classify: renewal pays the scheduled plan', () => {
  const s = sub({ currentPeriodEnd: at(2), scheduledPlanId: 'starter', scheduledChangeAt: at(2) });
  assertEquals(classify(s, null), { ok: true, purpose: 'renewal', effectivePlanId: 'starter' });
  assertEquals(classify(s, starter).ok, true);
  // Asking for the current plan while a downgrade is scheduled means: clear the intent.
  assertEquals(classify(s, pro).ok, false);
});

Deno.test('classify: past due retries the same plan, may upgrade, not downgrade', () => {
  const s = sub({ status: 'past_due', currentPeriodEnd: at(-2), plan: growth });
  assertEquals(classify(s, null), { ok: true, purpose: 'retry', effectivePlanId: 'growth' });
  assertEquals(classify(s, pro), { ok: true, purpose: 'change', effectivePlanId: 'pro' });
  assertEquals(classify(s, starter).ok, false);
});

Deno.test('classify: suspended can reactivate on any paid plan', () => {
  const s = sub({ status: 'suspended', currentPeriodEnd: at(-9), plan: pro });
  assertEquals(classify(s, null), { ok: true, purpose: 'reactivation', effectivePlanId: 'pro' });
  assertEquals(classify(s, starter), {
    ok: true,
    purpose: 'reactivation',
    effectivePlanId: 'starter',
  });
});

Deno.test('classify: reward trial keeps the plan after the trial or changes now', () => {
  const trial = sub({ status: 'trialing', source: 'reward', plan: growth });
  assertEquals(classify(trial, null), { ok: true, purpose: 'renewal', effectivePlanId: 'growth' });
  assertEquals(classify(trial, growth), {
    ok: true,
    purpose: 'renewal',
    effectivePlanId: 'growth',
  });
  assertEquals(classify(trial, pro), { ok: true, purpose: 'change', effectivePlanId: 'pro' });
});

Deno.test('classify: Managed subscriptions are sales assisted', () => {
  assertEquals(classify(sub({ plan: managed }), pro).ok, false);
});

// ─── Cron transitions ────────────────────────────────────────────────────────────

const next = (s: SubscriptionState, c: BillingContext = ctx) =>
  nextBillingTransition(s, now, settings, c);

Deno.test('transition: nothing due mid-period', () => {
  assertEquals(next(sub()), null);
});

Deno.test('transition: unpaid period end moves to past_due with grace from the period end', () => {
  const end = at(-1);
  const t = next(sub({ currentPeriodEnd: end }));
  assertEquals(t?.type, 'mark_past_due');
  if (t?.type === 'mark_past_due') {
    assertEquals(t.graceEndsAt.getTime(), end.getTime() + 5 * DAY);
  }
});

Deno.test('transition: cancel at period end beats renewal handling', () => {
  assertEquals(
    next(sub({ currentPeriodEnd: at(-1), cancelAtPeriodEnd: true }))?.type,
    'cancel_at_period_end'
  );
});

Deno.test('transition: no billable properties ends the subscription instead of billing', () => {
  assertEquals(
    next(sub({ currentPeriodEnd: at(-1) }), {
      billablePropertyCount: 0,
      renewalCoveredByCredit: false,
    })?.type,
    'end_no_properties'
  );
});

Deno.test('transition: credit-covered renewal renews without checkout', () => {
  assertEquals(
    next(sub({ currentPeriodEnd: at(-1) }), {
      billablePropertyCount: 2,
      renewalCoveredByCredit: true,
    })?.type,
    'renew_from_credit'
  );
});

Deno.test('transition: past_due waits through grace, then suspends', () => {
  assertEquals(
    next(sub({ status: 'past_due', currentPeriodEnd: at(-3), graceEndsAt: at(2) })),
    null
  );
  assertEquals(
    next(sub({ status: 'past_due', currentPeriodEnd: at(-7), graceEndsAt: at(-2) }))?.type,
    'suspend'
  );
});

Deno.test('transition: suspended auto-cancels after the suspension window', () => {
  assertEquals(
    next(sub({ status: 'suspended', currentPeriodEnd: at(-20), suspendedAt: at(-10) })),
    null
  );
  assertEquals(
    next(sub({ status: 'suspended', currentPeriodEnd: at(-50), suspendedAt: at(-31) }))?.type,
    'auto_cancel'
  );
});

Deno.test('transition: prepaid scheduled downgrade applies at the old period end', () => {
  const prepaid = sub({
    plan: pro,
    currentPeriodEnd: at(25),
    scheduledPlanId: 'starter',
    scheduledChangeAt: at(-1),
  });
  assertEquals(next(prepaid)?.type, 'apply_scheduled_plan');
  const notYet = { ...prepaid, scheduledChangeAt: at(2) };
  assertEquals(next(notYet), null);
});

Deno.test('transition: reward trial ends into Free, never past due', () => {
  const trial = (end: Date) => sub({ status: 'trialing', source: 'reward', currentPeriodEnd: end });
  assertEquals(next(trial(at(-1)))?.type, 'trial_ended');
  assertEquals(next(trial(at(2))), null);
});

Deno.test('transition: admin-managed subscriptions without a period are never touched', () => {
  assertEquals(next(sub({ currentPeriodEnd: null, currentPeriodStart: null })), null);
});

Deno.test('transition: catches up in order after an outage', () => {
  // Period ended 12 days ago: first past_due (grace ended 7 days ago), then suspend.
  let s = sub({ currentPeriodEnd: at(-12) });
  const first = next(s);
  assertEquals(first?.type, 'mark_past_due');
  if (first?.type === 'mark_past_due') {
    s = { ...s, status: 'past_due', graceEndsAt: first.graceEndsAt };
  }
  assertEquals(next(s)?.type, 'suspend');
});

// ─── Reminders ───────────────────────────────────────────────────────────────────

Deno.test('reminders: renewal link only inside the lead window', () => {
  assertEquals(dueReminders(sub(), now, settings, ctx), []);
  const soon = dueReminders(sub({ currentPeriodEnd: at(3) }), now, settings, ctx);
  assertEquals(
    soon.map((r) => r.kind),
    ['renewal_link']
  );
});

Deno.test('reminders: due tomorrow adds a second reminder inside 24h', () => {
  const kinds = dueReminders(
    sub({ currentPeriodEnd: new Date(now.getTime() + 20 * 60 * 60 * 1000) }),
    now,
    settings,
    ctx
  ).map((r) => r.kind);
  assertEquals(kinds, ['renewal_link', 'renewal_due_tomorrow']);
});

Deno.test('reminders: none when canceling, credit covered or no properties', () => {
  const s = sub({ currentPeriodEnd: at(3) });
  assertEquals(dueReminders({ ...s, cancelAtPeriodEnd: true }, now, settings, ctx), []);
  assertEquals(dueReminders(s, now, settings, { ...ctx, renewalCoveredByCredit: true }), []);
  assertEquals(dueReminders(s, now, settings, { ...ctx, billablePropertyCount: 0 }), []);
});

Deno.test('reminders: grace ending within a day, trial ending at 3 and 1 days', () => {
  const pd = sub({
    status: 'past_due',
    currentPeriodEnd: at(-4),
    graceEndsAt: new Date(now.getTime() + 10 * 60 * 60 * 1000),
  });
  assertEquals(
    dueReminders(pd, now, settings, ctx).map((r) => r.kind),
    ['grace_ending']
  );

  const trial = (days: number) =>
    sub({ status: 'trialing', source: 'reward', currentPeriodEnd: at(days) });
  assertEquals(dueReminders(trial(10), now, settings, ctx), []);
  assertEquals(
    dueReminders(trial(2), now, settings, ctx).map((r) => r.kind),
    ['trial_ending_3']
  );
  assertEquals(
    dueReminders(trial(0.5), now, settings, ctx).map((r) => r.kind),
    ['trial_ending_3', 'trial_ending_1']
  );
});
