/**
 * Org subscription state machine — pure, no DB. One place for "what is allowed" and "what
 * happens next", used by the self-serve endpoints, checkout, the billing cron and the previews.
 *
 * Statuses (org_subscriptions.status): active, trialing, past_due, suspended, canceled.
 * Free means no live row. Pending intent lives on the row, not in a new status:
 *   - scheduled_plan_id (+ scheduled_change_at): downgrade waiting for the period end
 *   - cancel_at_period_end: moves to Free at the period end
 * They are mutually exclusive (DB CHECK).
 *
 * Mirror for display: ui/src/features/dashboard/plans/lib/planPresentation.ts
 */

import { daysUntil } from './billingPeriod.ts';

export const MANAGED_PLAN_CODE = 'managed';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'suspended' | 'canceled';
export type SubscriptionSource = 'purchase' | 'admin' | 'reward';

export const LIVE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'active',
  'trialing',
  'past_due',
  'suspended',
];

/** Suspended subs keep plan identity for billing UI but block paid feature gates. */
export function subscriptionStatusBlocksFeatureGates(status: string): boolean {
  return status === 'suspended';
}

export type PlanRef = {
  id: string;
  code: string;
  sortOrder: number;
  isDefault: boolean;
};

export type SubscriptionState = {
  id: string;
  status: SubscriptionStatus;
  source: SubscriptionSource;
  plan: PlanRef;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  suspendedAt: Date | null;
  cancelAtPeriodEnd: boolean;
  scheduledPlanId: string | null;
  scheduledChangeAt: Date | null;
};

export type ValidationResult = { ok: true } | { ok: false; message: string };

const ok: ValidationResult = { ok: true };
const fail = (message: string): ValidationResult => ({ ok: false, message });

function isRewardTrial(sub: SubscriptionState): boolean {
  return sub.status === 'trialing' && sub.source === 'reward';
}

/** Paid to lower paid, applied at the period end. */
export function validateScheduleDowngrade(
  sub: SubscriptionState | null,
  target: PlanRef & { isActive: boolean }
): ValidationResult {
  if (!sub) return fail('No active subscription to change');
  if (sub.plan.code === MANAGED_PLAN_CODE) {
    return fail('Contact support to change your Managed plan');
  }
  if (target.code === MANAGED_PLAN_CODE) return fail('Contact sales for the Managed plan');
  if (target.isDefault) return fail('Use cancel to move to the Free plan');
  if (!target.isActive) return fail('That plan is no longer available');
  if (isRewardTrial(sub)) {
    return fail('Your trial ends on its own. Pick a plan to keep it, or let it end.');
  }
  if (sub.status === 'past_due') {
    return fail('Pay the overdue balance before changing your plan');
  }
  if (sub.status === 'suspended') {
    return fail('Pay to restore access before switching to a different paid plan');
  }
  if (sub.status !== 'active' && sub.status !== 'trialing') {
    return fail('Subscription is not eligible for a plan change');
  }
  if (target.id === sub.plan.id || target.sortOrder >= sub.plan.sortOrder) {
    return fail('Use checkout to upgrade or update billing');
  }
  return ok;
}

/** Paid to Free at the period end (host can resume until then). */
export function validateCancelAtPeriodEnd(sub: SubscriptionState | null): ValidationResult {
  if (!sub) return fail('No active subscription to cancel');
  if (sub.plan.code === MANAGED_PLAN_CODE) {
    return fail('Contact support to change your Managed plan');
  }
  if (isRewardTrial(sub)) return fail('Your trial ends on its own. Nothing to cancel.');
  if (sub.status === 'past_due' || sub.status === 'suspended') {
    return fail('Use cancel plan now for an overdue subscription');
  }
  if (sub.status !== 'active') return fail('Subscription is not eligible for cancellation');
  if (sub.plan.isDefault) return fail('Already on the Free plan');
  return ok;
}

/** Immediate move to Free; only for subscriptions that already stopped being fully paid. */
export function validateCancelNow(sub: SubscriptionState | null): ValidationResult {
  if (!sub) return fail('No active subscription to cancel');
  if (sub.plan.code === MANAGED_PLAN_CODE) {
    return fail('Contact support to change your Managed plan');
  }
  if (sub.status !== 'past_due' && sub.status !== 'suspended') {
    return fail('Cancel at the end of the period instead');
  }
  return ok;
}

/**
 * Deleting an organization would drop a paid plan the host has already paid for (and orphan any
 * open checkout). Block it until the plan has ended. Free, reward trials and admin grants carry
 * nothing the host paid for, so they never block.
 */
export function validateOrgDeletion(sub: SubscriptionState | null): ValidationResult {
  if (!sub || sub.plan.isDefault) return ok;
  if (sub.source !== 'purchase') return ok;
  return fail(
    sub.cancelAtPeriodEnd
      ? 'This organization still has a paid plan until the end of the billing period. Delete it after the plan ends.'
      : 'This organization has a paid plan. Cancel the plan from Plans & Billing, then delete the organization after the plan ends.'
  );
}

export function validateClearIntent(sub: SubscriptionState | null): ValidationResult {
  if (!sub) return fail('No active subscription');
  if (!sub.cancelAtPeriodEnd && !sub.scheduledPlanId) return fail('Nothing is scheduled');
  return ok;
}

export type CheckoutPurpose = 'initial' | 'renewal' | 'retry' | 'change' | 'reactivation';

export type CheckoutClassification =
  { ok: true; purpose: CheckoutPurpose; effectivePlanId: string } | { ok: false; message: string };

/**
 * What a payment for `target` means for this subscription. `target` omitted = "pay what is due"
 * (the renewal of the scheduled or current plan).
 */
export function classifyCheckout(input: {
  sub: SubscriptionState | null;
  target: (PlanRef & { isActive: boolean }) | null;
  now: Date;
  renewalLeadDays: number;
}): CheckoutClassification {
  const { sub, target, now } = input;

  if (target) {
    if (!target.isActive) return { ok: false, message: 'Plan not found' };
    if (target.isDefault) return { ok: false, message: 'Free plan does not require checkout' };
    if (target.code === MANAGED_PLAN_CODE) {
      return { ok: false, message: 'Contact sales for the Managed plan' };
    }
  }

  if (!sub) {
    if (!target) return { ok: false, message: 'Choose a plan to subscribe' };
    return { ok: true, purpose: 'initial', effectivePlanId: target.id };
  }

  if (sub.plan.code === MANAGED_PLAN_CODE) {
    return { ok: false, message: 'Contact support to change your Managed plan' };
  }

  const dueSoon =
    sub.currentPeriodEnd != null &&
    daysUntil(sub.currentPeriodEnd, now) <= Math.max(0, input.renewalLeadDays);
  const dueNowOrPast =
    sub.currentPeriodEnd != null && sub.currentPeriodEnd.getTime() <= now.getTime();
  const nextPlanId = sub.scheduledPlanId ?? sub.plan.id;

  if (sub.status === 'suspended') {
    const planId = target?.id ?? sub.plan.id;
    return { ok: true, purpose: 'reactivation', effectivePlanId: planId };
  }

  if (isRewardTrial(sub)) {
    if (!target || target.id === sub.plan.id) {
      return { ok: true, purpose: 'renewal', effectivePlanId: sub.plan.id };
    }
    return { ok: true, purpose: 'change', effectivePlanId: target.id };
  }

  if (sub.status === 'past_due') {
    if (!target || target.id === nextPlanId) {
      return { ok: true, purpose: 'retry', effectivePlanId: nextPlanId };
    }
    if (target.sortOrder > sub.plan.sortOrder) {
      return { ok: true, purpose: 'change', effectivePlanId: target.id };
    }
    return { ok: false, message: 'Pay the overdue balance before changing your plan' };
  }

  // active
  if (!target || target.id === nextPlanId) {
    if (!dueSoon && !dueNowOrPast) {
      return { ok: false, message: 'Your next payment is not due yet' };
    }
    return { ok: true, purpose: 'renewal', effectivePlanId: nextPlanId };
  }
  if (target.id === sub.plan.id) {
    // Back on the current plan while a downgrade is scheduled: clear the intent instead.
    return { ok: false, message: 'Keep your current plan to undo the scheduled change' };
  }
  if (target.sortOrder > sub.plan.sortOrder) {
    return { ok: true, purpose: 'change', effectivePlanId: target.id };
  }
  return { ok: false, message: 'Schedule a downgrade to move to a lower plan' };
}

// ─── Billing cron ────────────────────────────────────────────────────────────────

export type BillingSettings = {
  renewalLinkLeadDays: number;
  gracePeriodDays: number;
  suspensionCancelDays: number;
};

export type BillingTransition =
  | { type: 'apply_scheduled_plan' }
  | { type: 'cancel_at_period_end' }
  | { type: 'end_no_properties' }
  | { type: 'renew_from_credit' }
  | { type: 'mark_past_due'; graceEndsAt: Date }
  | { type: 'suspend' }
  | { type: 'auto_cancel' }
  | { type: 'trial_ended' };

export type BillingContext = {
  billablePropertyCount: number;
  /** True when account credit already covers the next payment (no checkout needed). */
  renewalCoveredByCredit: boolean;
};

/**
 * The next state change due for a subscription, or null. The cron applies it and asks again, so
 * a multi-day outage catches up deterministically in order. Admin-managed subscriptions without
 * a period (no current_period_end) are never touched.
 */
export function nextBillingTransition(
  sub: SubscriptionState,
  now: Date,
  settings: BillingSettings,
  ctx: BillingContext
): BillingTransition | null {
  if (sub.status === 'canceled') return null;
  const end = sub.currentPeriodEnd;
  if (!end) return null;
  const ended = end.getTime() <= now.getTime();

  if (isRewardTrial(sub)) {
    return ended ? { type: 'trial_ended' } : null;
  }

  if (sub.status === 'active' || sub.status === 'trialing') {
    if (sub.scheduledPlanId && sub.scheduledChangeAt && !ended) {
      // Renewal for the lower plan was paid early; switch the plan when the old period ends.
      return sub.scheduledChangeAt.getTime() <= now.getTime()
        ? { type: 'apply_scheduled_plan' }
        : null;
    }
    if (!ended) return null;
    if (sub.cancelAtPeriodEnd) return { type: 'cancel_at_period_end' };
    if (ctx.billablePropertyCount === 0) return { type: 'end_no_properties' };
    if (ctx.renewalCoveredByCredit) return { type: 'renew_from_credit' };
    const graceEndsAt = new Date(end.getTime() + settings.gracePeriodDays * 24 * 60 * 60 * 1000);
    return { type: 'mark_past_due', graceEndsAt };
  }

  if (sub.status === 'past_due') {
    if (ctx.billablePropertyCount === 0) return { type: 'end_no_properties' };
    if (ctx.renewalCoveredByCredit) return { type: 'renew_from_credit' };
    const graceEnd =
      sub.graceEndsAt ?? new Date(end.getTime() + settings.gracePeriodDays * 24 * 60 * 60 * 1000);
    return graceEnd.getTime() <= now.getTime() ? { type: 'suspend' } : null;
  }

  if (sub.status === 'suspended') {
    const since = sub.suspendedAt ?? sub.graceEndsAt ?? end;
    const cancelAt = since.getTime() + settings.suspensionCancelDays * 24 * 60 * 60 * 1000;
    return cancelAt <= now.getTime() ? { type: 'auto_cancel' } : null;
  }

  return null;
}

export type BillingReminder =
  | { kind: 'renewal_link'; periodKey: string }
  | { kind: 'renewal_due_tomorrow'; periodKey: string }
  | { kind: 'grace_ending'; periodKey: string }
  | { kind: 'trial_ending_3'; periodKey: string }
  | { kind: 'trial_ending_1'; periodKey: string };

/** Reminders due right now. Each is sent once per `periodKey` (see org_billing_notifications). */
export function dueReminders(
  sub: SubscriptionState,
  now: Date,
  settings: BillingSettings,
  ctx: BillingContext
): BillingReminder[] {
  const end = sub.currentPeriodEnd;
  if (!end || sub.status === 'canceled') return [];
  const periodKey = end.toISOString().slice(0, 10);
  const msUntilEnd = end.getTime() - now.getTime();
  const out: BillingReminder[] = [];

  if (isRewardTrial(sub)) {
    if (msUntilEnd > 0 && msUntilEnd <= 3 * 24 * 60 * 60 * 1000) {
      out.push({ kind: 'trial_ending_3', periodKey });
    }
    if (msUntilEnd > 0 && msUntilEnd <= 24 * 60 * 60 * 1000) {
      out.push({ kind: 'trial_ending_1', periodKey });
    }
    return out;
  }

  if (sub.status === 'active' && !sub.cancelAtPeriodEnd && ctx.billablePropertyCount > 0) {
    const leadMs = settings.renewalLinkLeadDays * 24 * 60 * 60 * 1000;
    if (msUntilEnd > 0 && msUntilEnd <= leadMs && !ctx.renewalCoveredByCredit) {
      out.push({ kind: 'renewal_link', periodKey });
      if (msUntilEnd <= 24 * 60 * 60 * 1000) {
        out.push({ kind: 'renewal_due_tomorrow', periodKey });
      }
    }
  }

  if (sub.status === 'past_due' && sub.graceEndsAt) {
    const msToGraceEnd = sub.graceEndsAt.getTime() - now.getTime();
    if (msToGraceEnd > 0 && msToGraceEnd <= 24 * 60 * 60 * 1000) {
      out.push({ kind: 'grace_ending', periodKey: sub.graceEndsAt.toISOString().slice(0, 10) });
    }
  }

  return out;
}
