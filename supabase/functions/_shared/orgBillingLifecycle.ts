/**
 * Subscription lifecycle operations that do not take payment: scheduling a downgrade or a cancel
 * for the period end (and undoing it), and the state changes the billing cron performs
 * (apply scheduled plan, past due, suspend, auto-cancel, end at period end).
 *
 * Every write is a compare-and-set on the current status, so a double click, an overlapping cron
 * run or a webhook racing a transition changes the subscription at most once.
 */

import { createServiceClient } from './orgAuth.ts';
import { BillingRuleError } from './billingErrors.ts';
import { formatManilaDateLabel } from './billingPeriod.ts';
import { buildActorContext, logActivity } from './activityLog.ts';
import { listBillablePropertyIds } from './orgBillableProperties.ts';
import { loadQuotePlan, toSubscriptionState } from './orgBillingContext.ts';
import {
  loadOrgBillingOrgContext,
  notifyOrgBilling,
  notifyOrgBillingOnce,
} from './orgBillingNotify.ts';
import { createOrgSubscriptionCheckoutLink } from './orgSubscriptionCheckout.ts';
import { expireAllPendingOrgCheckouts } from './orgPaymentReconcile.ts';
import {
  validateCancelAtPeriodEnd,
  validateCancelNow,
  validateClearIntent,
  validateScheduleDowngrade,
} from './orgSubscriptionStateMachine.ts';
import {
  cancelOrgSubscriptionToFree,
  changeOrgSubscription,
  getActiveOrgSubscription,
  getDefaultPricingPlan,
  reconcileTeamSeatsForProperty,
  syncAiCreditsFromPlan,
  writeOrgSubscriptionEvent,
  type OrgSubscriptionRow,
} from './planEntitlements.ts';
import { parsePlanFeatures } from './planFeatures.ts';
import { capturePostHogEvent } from './posthog.ts';
import type { PlatformPaymentSettings } from './platformPaymentSettings.ts';

const cronActor = () => buildActorContext('cron', { cron: 'platform-billing-cron' });
const db = () => createServiceClient();

export const CANCEL_REASONS = [
  'too_expensive',
  'missing_features',
  'fewer_properties',
  'switching_tool',
  'temporary',
  'other',
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

async function requireLiveSubscription(organizationId: string): Promise<OrgSubscriptionRow> {
  const sub = await getActiveOrgSubscription(organizationId);
  if (!sub) throw new BillingRuleError('No active subscription to change', 'no_subscription');
  return sub;
}

// ─── Host-initiated, no payment ──────────────────────────────────────────────────

export async function scheduleOrgDowngrade(input: {
  organizationId: string;
  targetPlanId: string;
  scheduledBy: string | null;
}): Promise<{
  effectiveAt: string;
  fromPlanName: string;
  toPlanName: string;
  alreadyScheduled: boolean;
}> {
  const sub = await requireLiveSubscription(input.organizationId);
  const target = await loadQuotePlan(input.targetPlanId, { allowInactive: true });
  const verdict = validateScheduleDowngrade(toSubscriptionState(sub), {
    id: target.id,
    code: target.code,
    sortOrder: target.sortOrder,
    isDefault: target.isDefault,
    isActive: target.isActive,
  });
  if (!verdict.ok) throw new BillingRuleError(verdict.message);
  if (!sub.currentPeriodEnd) {
    throw new BillingRuleError(
      'This plan has no billing period yet. Contact support to change it.',
      'no_period'
    );
  }

  if (sub.scheduledPlanId === target.id) {
    return {
      effectiveAt: sub.scheduledChangeAt ?? sub.currentPeriodEnd,
      fromPlanName: sub.planName,
      toPlanName: target.name,
      alreadyScheduled: true,
    };
  }

  const { data, error } = await db()
    .from('org_subscriptions')
    .update({
      scheduled_plan_id: target.id,
      scheduled_change_at: sub.currentPeriodEnd,
      scheduled_by: input.scheduledBy,
      cancel_at_period_end: false,
      cancel_requested_at: null,
      cancel_reason: null,
    })
    .eq('id', sub.id)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new BillingRuleError('The subscription changed. Refresh and try again.', 'conflict', 409);
  }

  // Any open checkout was priced for the old plan.
  await expireAllPendingOrgCheckouts(input.organizationId);

  await writeOrgSubscriptionEvent({
    orgSubscriptionId: sub.id,
    eventType: 'change_scheduled',
    previousPlanId: sub.planId,
    newPlanId: target.id,
    note: `Moves to ${target.name} at the end of the period`,
    createdBy: input.scheduledBy,
  });

  const dateLabel = formatManilaDateLabel(new Date(sub.currentPeriodEnd));
  await notifyBestEffort(input.organizationId, 'change_scheduled', {
    fromPlan: sub.planName,
    toPlan: target.name,
    dateLabel,
  });

  return {
    effectiveAt: sub.currentPeriodEnd,
    fromPlanName: sub.planName,
    toPlanName: target.name,
    alreadyScheduled: false,
  };
}

export async function scheduleOrgCancel(input: {
  organizationId: string;
  reason?: CancelReason | null;
  scheduledBy: string | null;
}): Promise<{ effectiveAt: string; planName: string; alreadyScheduled: boolean }> {
  const sub = await requireLiveSubscription(input.organizationId);
  const verdict = validateCancelAtPeriodEnd(toSubscriptionState(sub));
  if (!verdict.ok) throw new BillingRuleError(verdict.message);
  if (!sub.currentPeriodEnd) {
    throw new BillingRuleError(
      'This plan has no billing period yet. Contact support to change it.',
      'no_period'
    );
  }
  if (sub.cancelAtPeriodEnd) {
    return { effectiveAt: sub.currentPeriodEnd, planName: sub.planName, alreadyScheduled: true };
  }

  const { data, error } = await db()
    .from('org_subscriptions')
    .update({
      cancel_at_period_end: true,
      cancel_requested_at: new Date().toISOString(),
      cancel_reason: input.reason ?? null,
      scheduled_plan_id: null,
      scheduled_change_at: null,
      scheduled_by: input.scheduledBy,
    })
    .eq('id', sub.id)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new BillingRuleError('The subscription changed. Refresh and try again.', 'conflict', 409);
  }

  await expireAllPendingOrgCheckouts(input.organizationId);

  await writeOrgSubscriptionEvent({
    orgSubscriptionId: sub.id,
    eventType: 'cancel_scheduled',
    previousPlanId: sub.planId,
    note: input.reason ? `Cancel at period end (${input.reason})` : 'Cancel at period end',
    createdBy: input.scheduledBy,
  });

  await notifyBestEffort(input.organizationId, 'cancel_scheduled', {
    planName: sub.planName,
    dateLabel: formatManilaDateLabel(new Date(sub.currentPeriodEnd)),
  });
  return { effectiveAt: sub.currentPeriodEnd, planName: sub.planName, alreadyScheduled: false };
}

/** Keep the current plan: removes a scheduled downgrade or cancel. */
export async function clearOrgScheduledChange(input: {
  organizationId: string;
  clearedBy: string | null;
}): Promise<{ planName: string; hadCancel: boolean; hadDowngrade: boolean }> {
  const sub = await requireLiveSubscription(input.organizationId);
  const verdict = validateClearIntent(toSubscriptionState(sub));
  if (!verdict.ok) throw new BillingRuleError(verdict.message, 'nothing_scheduled');

  const hadCancel = sub.cancelAtPeriodEnd;
  const hadDowngrade = Boolean(sub.scheduledPlanId);

  const { data, error } = await db()
    .from('org_subscriptions')
    .update({
      scheduled_plan_id: null,
      scheduled_change_at: null,
      scheduled_by: null,
      cancel_at_period_end: false,
      cancel_requested_at: null,
      cancel_reason: null,
    })
    .eq('id', sub.id)
    .in('status', ['active', 'trialing'])
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new BillingRuleError('The subscription changed. Refresh and try again.', 'conflict', 409);
  }

  // A renewal link issued for the scheduled plan is now wrong. The cron reissues one for the
  // current plan on its next run.
  await expireAllPendingOrgCheckouts(input.organizationId);

  await writeOrgSubscriptionEvent({
    orgSubscriptionId: sub.id,
    eventType: hadCancel ? 'cancel_reverted' : 'change_canceled',
    previousPlanId: sub.planId,
    newPlanId: sub.planId,
    note: hadCancel ? 'Plan resumed' : 'Scheduled plan change removed',
    createdBy: input.clearedBy,
  });

  await notifyBestEffort(input.organizationId, 'scheduled_cleared', { planName: sub.planName });
  return { planName: sub.planName, hadCancel, hadDowngrade };
}

/** Overdue subscriptions can leave right away: nothing paid is being given up. */
export async function cancelOrgSubscriptionNow(input: {
  organizationId: string;
  cancelledBy: string | null;
  reason?: CancelReason | null;
}): Promise<{ planName: string }> {
  const sub = await requireLiveSubscription(input.organizationId);
  const verdict = validateCancelNow(toSubscriptionState(sub));
  if (!verdict.ok) throw new BillingRuleError(verdict.message);

  await expireAllPendingOrgCheckouts(input.organizationId);
  await cancelOrgSubscriptionToFree({
    orgSubscriptionId: sub.id,
    organizationId: input.organizationId,
    previousStatus: sub.status,
    endedReason: 'host_canceled',
    note: input.reason ? `Host canceled (${input.reason})` : 'Host canceled',
    changedBy: input.cancelledBy,
  });
  await notifyBestEffort(input.organizationId, 'plan_ended', { endedReason: 'host_canceled' });
  return { planName: sub.planName };
}

async function notifyBestEffort(
  organizationId: string,
  kind: Parameters<typeof notifyOrgBilling>[0]['kind'],
  params: Parameters<typeof notifyOrgBilling>[0]['params']
): Promise<void> {
  try {
    await notifyOrgBilling({ organizationId, kind, params });
  } catch (err) {
    console.error('[orgBillingLifecycle] notify failed', kind, err);
  }
}

// ─── Cron transitions ────────────────────────────────────────────────────────────

async function logSystem(
  action: Parameters<typeof logActivity>[0]['action'],
  organizationId: string,
  orgName: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await logActivity({
    action,
    organizationId,
    scope: 'org',
    actor: cronActor(),
    targetType: 'subscription',
    targetId: organizationId,
    targetLabel: orgName,
    metadata,
  });
}

/** Moves a prepaid subscription onto its scheduled lower plan once the old period has ended. */
export async function applyScheduledPlan(sub: OrgSubscriptionRow): Promise<void> {
  if (!sub.scheduledPlanId) return;
  const billable = await listBillablePropertyIds(sub.organizationId);
  if (billable.length === 0) return;
  const target = await loadQuotePlan(sub.scheduledPlanId, { allowInactive: true });

  // Clear the intent first (compare-and-set) so an overlapping run cannot apply it twice.
  const { data: claimed, error } = await db()
    .from('org_subscriptions')
    .update({ scheduled_plan_id: null, scheduled_change_at: null, scheduled_by: null })
    .eq('id', sub.id)
    .eq('scheduled_plan_id', sub.scheduledPlanId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!claimed) return;

  await changeOrgSubscription(sub.id, target.id, billable, null);
  await writeOrgSubscriptionEvent({
    orgSubscriptionId: sub.id,
    eventType: 'change_applied',
    previousPlanId: sub.planId,
    newPlanId: target.id,
    note: 'Scheduled plan change applied',
  });

  const ctx = await loadOrgBillingOrgContext(sub.organizationId);
  await logSystem('billing.plan_changed', sub.organizationId, ctx.orgName, {
    to_plan_name: target.name,
    from_plan_name: sub.planName,
    reason: 'scheduled',
  });
  await capturePostHogEvent('org_plan_changed', {
    logPrefix: 'org-billing-lifecycle',
    groups: { organization: sub.organizationId },
    properties: { from_plan: sub.planId, to_plan: target.id, cause: 'downgrade' },
  });
  await notifyOrgBilling({
    organizationId: sub.organizationId,
    kind: 'change_applied',
    context: ctx,
    params: { fromPlan: sub.planName, toPlan: target.name },
    periodKey: `${sub.id}:${target.id}:${(sub.currentPeriodEnd ?? '').slice(0, 10)}`,
  });
}

async function endSubscription(
  sub: OrgSubscriptionRow,
  endedReason: 'host_canceled' | 'nonpayment' | 'trial_ended' | 'no_properties',
  note: string
): Promise<void> {
  await expireAllPendingOrgCheckouts(sub.organizationId);
  await cancelOrgSubscriptionToFree({
    orgSubscriptionId: sub.id,
    organizationId: sub.organizationId,
    previousStatus: sub.status,
    endedReason,
    note,
    changedBy: null,
  });
  const ctx = await loadOrgBillingOrgContext(sub.organizationId);
  await logSystem('billing.subscription_canceled', sub.organizationId, ctx.orgName, {
    ended_reason: endedReason,
    plan_name: sub.planName,
  });
  await capturePostHogEvent('org_plan_changed', {
    logPrefix: 'org-billing-lifecycle',
    groups: { organization: sub.organizationId },
    properties: { from_plan: sub.planId, to_plan: 'free', cause: endedReason },
  });
  await notifyOrgBillingOnce({
    organizationId: sub.organizationId,
    orgSubscriptionId: sub.id,
    kind: 'plan_ended',
    periodKey: `${sub.id}:${endedReason}`,
    params: { endedReason, planName: sub.planName },
  });
}

export const endAtPeriodEnd = (sub: OrgSubscriptionRow) =>
  endSubscription(sub, 'host_canceled', 'Ended at the end of the period as requested');
export const endForNonPayment = (sub: OrgSubscriptionRow) =>
  endSubscription(sub, 'nonpayment', 'Ended after a long overdue payment');
export const endWithoutProperties = (sub: OrgSubscriptionRow) =>
  endSubscription(sub, 'no_properties', 'Ended: no properties left to bill');

export async function markPastDue(sub: OrgSubscriptionRow, graceEndsAt: Date): Promise<boolean> {
  const { data, error } = await db()
    .from('org_subscriptions')
    .update({ status: 'past_due', grace_period_ends_at: graceEndsAt.toISOString() })
    .eq('id', sub.id)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;

  await writeOrgSubscriptionEvent({
    orgSubscriptionId: sub.id,
    eventType: 'past_due',
    previousStatus: 'active',
    newStatus: 'past_due',
    note: 'Renewal not paid by the period end',
  });
  const ctx = await loadOrgBillingOrgContext(sub.organizationId);
  await logSystem('billing.subscription_past_due', sub.organizationId, ctx.orgName, {
    plan_name: sub.planName,
  });

  // A fresh payment link, never a stale one.
  let checkoutUrl: string | null = null;
  try {
    const checkout = await createOrgSubscriptionCheckoutLink({
      organizationId: sub.organizationId,
      planId: null,
      ignoreRenewalWindow: true,
      forceNew: true,
    });
    checkoutUrl = checkout.checkoutUrl;
  } catch (err) {
    console.error('[orgBillingLifecycle] past-due link failed', sub.organizationId, err);
  }

  await notifyOrgBillingOnce({
    organizationId: sub.organizationId,
    orgSubscriptionId: sub.id,
    kind: 'past_due',
    periodKey: (sub.currentPeriodEnd ?? '').slice(0, 10),
    params: {
      planName: sub.planName,
      graceEndLabel: formatManilaDateLabel(graceEndsAt),
      checkoutUrl,
    },
  });
  return true;
}

/** Paid features pause. Free-level access continues; guest pages are untouched. */
export async function suspendSubscription(
  sub: OrgSubscriptionRow,
  settings: PlatformPaymentSettings
): Promise<boolean> {
  const now = new Date();
  const { data, error } = await db()
    .from('org_subscriptions')
    .update({ status: 'suspended', suspended_at: now.toISOString() })
    .eq('id', sub.id)
    .eq('status', 'past_due')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;

  await writeOrgSubscriptionEvent({
    orgSubscriptionId: sub.id,
    eventType: 'suspended',
    previousStatus: 'past_due',
    newStatus: 'suspended',
    note: 'Grace period ended without payment',
  });

  // Paid allowances stop: AI credits drop to the Free allowance, team seats reconcile per
  // property (they fall back to Free while suspended). Paying restores both.
  const freePlan = await getDefaultPricingPlan();
  await syncAiCreditsFromPlan(
    sub.organizationId,
    freePlan.code,
    parsePlanFeatures(freePlan.features).aiMonthlyCreditAllowance,
    'system'
  );
  const propertyIds = await listBillablePropertyIds(sub.organizationId);
  for (const propertyId of propertyIds) {
    try {
      await reconcileTeamSeatsForProperty(propertyId);
    } catch (err) {
      console.error('[orgBillingLifecycle] seat reconcile on suspend', propertyId, err);
    }
  }

  const ctx = await loadOrgBillingOrgContext(sub.organizationId);
  await logSystem('billing.subscription_suspended', sub.organizationId, ctx.orgName, {
    plan_name: sub.planName,
  });
  const cancelDate = new Date(now.getTime() + settings.suspensionCancelDays * 24 * 60 * 60 * 1000);
  await notifyOrgBillingOnce({
    organizationId: sub.organizationId,
    orgSubscriptionId: sub.id,
    kind: 'suspended',
    periodKey: now.toISOString().slice(0, 10),
    params: { planName: sub.planName, cancelDateLabel: formatManilaDateLabel(cancelDate) },
  });
  return true;
}
