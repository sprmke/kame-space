/**
 * What the Billing summary, the sidebar caption and the global banner say about a subscription.
 * Pure, so every state is unit tested. The server decides what is allowed
 * (`orgSubscriptionStateMachine.ts`); this decides what the host reads and which actions show.
 */

import type {
  OrgBundlePlanDto,
  OrgSubscriptionDto,
  OrgUpcomingPaymentDto,
} from '@/features/dashboard/plans/lib/orgPlanApi';

export type BillingTone = 'neutral' | 'info' | 'warning' | 'danger';

export type BillingStripAction =
  'pay_now' | 'keep_plan' | 'resume_plan' | 'cancel_now' | 'keep_after_trial' | 'switch_to_free';

export type BillingStateKey =
  | 'free'
  | 'active'
  | 'renewal_ready'
  | 'payment_waiting'
  | 'downgrade_scheduled'
  | 'cancel_scheduled'
  | 'trial'
  | 'past_due'
  | 'suspended';

export type BillingStateView = {
  key: BillingStateKey;
  /** Status badge text. */
  badge: string;
  badgeTone: 'success' | 'secondary' | 'destructive' | 'default';
  /** Line under the plan name (renewal, end or change date). */
  periodLine: string | null;
  strip: { tone: BillingTone; message: string; actions: BillingStripAction[] } | null;
  /** Non-owners see the state, never the actions. */
  readOnlyNote: string | null;
};

type DescribeInput = {
  subscription: OrgSubscriptionDto | null;
  upcoming?: OrgUpcomingPaymentDto | null;
  /** An unpaid checkout exists. `purpose` says whether it is a due renewal or something the host started. */
  openCheckout?: { purpose: string | null } | null;
  canManage: boolean;
  /** Formats an ISO date for the host (Manila). */
  formatDate: (iso: string) => string;
  formatPhp: (amount: number) => string;
};

const OWNER_ONLY = 'Only the organization owner can change billing.';

export function describeBillingState(input: DescribeInput): BillingStateView {
  const { subscription: sub, formatDate, formatPhp } = input;
  const date = (iso: string | null | undefined) => (iso ? formatDate(iso) : null);
  const actions = (list: BillingStripAction[]) => (input.canManage ? list : []);
  const readOnlyNote = input.canManage ? null : OWNER_ONLY;

  if (!sub) {
    return {
      key: 'free',
      badge: 'Current',
      badgeTone: 'default',
      periodLine: null,
      strip: null,
      readOnlyNote: null,
    };
  }

  const end = date(sub.currentPeriodEnd);

  if (sub.status === 'suspended') {
    const cancelOn = date(sub.autoCancelAt);
    return {
      key: 'suspended',
      badge: 'Suspended',
      badgeTone: 'destructive',
      periodLine: date(sub.suspendedAt)
        ? `Paid features paused since ${date(sub.suspendedAt)}`
        : 'Paid features paused',
      strip: {
        tone: 'danger',
        message: cancelOn
          ? `Pay to turn paid features back on. If the payment is still missing on ${cancelOn}, the plan ends and the organization stays on Free.`
          : 'Pay to turn paid features back on. Guest booking pages keep working.',
        actions: actions(['pay_now', 'switch_to_free']),
      },
      readOnlyNote,
    };
  }

  if (sub.status === 'past_due') {
    const graceEnd = date(sub.gracePeriodEndsAt);
    return {
      key: 'past_due',
      badge: 'Past due',
      badgeTone: 'destructive',
      periodLine: end ? `Payment due since ${end}` : 'Payment overdue',
      strip: {
        tone: 'danger',
        message: graceEnd
          ? `Pay by ${graceEnd} to keep paid features. Guest booking pages are not affected.`
          : 'Pay soon to keep paid features. Guest booking pages are not affected.',
        actions: actions(['pay_now', 'cancel_now']),
      },
      readOnlyNote,
    };
  }

  if (sub.status === 'trialing') {
    return {
      key: 'trial',
      badge: 'Trial',
      badgeTone: 'secondary',
      periodLine: end ? `Trial ends ${end}` : 'Trial',
      strip: {
        tone: 'info',
        message: `Keep ${sub.planName} after your trial. Your paid period starts when the trial ends.`,
        actions: actions(['keep_after_trial']),
      },
      readOnlyNote,
    };
  }

  if (sub.cancelAtPeriodEnd) {
    return {
      key: 'cancel_scheduled',
      badge: 'Ending',
      badgeTone: 'secondary',
      periodLine: end ? `Ends ${end}` : 'Ending at the period end',
      strip: {
        tone: 'warning',
        message: end
          ? `Moves to Free on ${end}. You keep every ${sub.planName} feature until then.`
          : `Moves to Free at the end of the period. You keep every ${sub.planName} feature until then.`,
        actions: actions(['resume_plan']),
      },
      readOnlyNote,
    };
  }

  if (sub.scheduledPlanId) {
    const changeOn = date(sub.scheduledChangeAt ?? sub.currentPeriodEnd);
    const target = sub.scheduledPlanName ?? 'a lower plan';
    return {
      key: 'downgrade_scheduled',
      badge: 'Active',
      badgeTone: 'success',
      periodLine: changeOn ? `Changes to ${target} on ${changeOn}` : `Changes to ${target}`,
      strip: {
        tone: 'info',
        message: changeOn
          ? `You keep ${sub.planName} until ${changeOn}.`
          : `You keep ${sub.planName} until the period ends.`,
        actions: actions(['keep_plan']),
      },
      readOnlyNote,
    };
  }

  const upcoming = input.upcoming;
  const open = input.openCheckout ?? null;
  const renewalReady = Boolean(open) && (open?.purpose === 'renewal' || open?.purpose === 'retry');
  const nextPayment =
    upcoming && !upcoming.coveredByCredit
      ? ` · ${formatPhp(upcoming.amountPhp)} next payment`
      : upcoming?.coveredByCredit
        ? ' · paid with account credit'
        : '';

  if (renewalReady) {
    return {
      key: 'renewal_ready',
      badge: 'Active',
      badgeTone: 'success',
      periodLine: end ? `Renews ${end}${nextPayment}` : null,
      strip: {
        tone: 'info',
        message: 'Your renewal payment is ready.',
        actions: actions(['pay_now']),
      },
      readOnlyNote,
    };
  }

  if (open) {
    return {
      key: 'payment_waiting',
      badge: 'Active',
      badgeTone: 'success',
      periodLine: end ? `Renews ${end}${nextPayment}` : null,
      strip: {
        tone: 'info',
        message: 'A plan payment is waiting to be completed.',
        actions: actions(['pay_now']),
      },
      readOnlyNote,
    };
  }

  return {
    key: 'active',
    badge: 'Active',
    badgeTone: 'success',
    periodLine: end ? `Renews ${end}${nextPayment}` : null,
    strip: null,
    readOnlyNote,
  };
}

// ─── Global banner (org + property shells) ───────────────────────────────────────

export type BillingBanner = {
  tone: BillingTone;
  message: string;
  /** Owner: pay. Members: who to ask. */
  cta: { label: string; kind: 'pay' } | null;
};

/** Only states that need attention. Healthy and scheduled-change states return null. */
export function describeBillingBanner(input: {
  subscription: OrgSubscriptionDto | null;
  canManage: boolean;
  formatDate: (iso: string) => string;
}): BillingBanner | null {
  const sub = input.subscription;
  if (!sub) return null;
  const date = (iso: string | null | undefined) => (iso ? input.formatDate(iso) : null);

  if (sub.status === 'past_due') {
    const grace = date(sub.gracePeriodEndsAt);
    const message = grace
      ? `Payment is overdue. Pay by ${grace} to keep paid features.`
      : 'Payment is overdue. Pay soon to keep paid features.';
    return input.canManage
      ? { tone: 'danger', message, cta: { label: 'Pay now', kind: 'pay' } }
      : {
          tone: 'danger',
          message: `${message} Ask the organization owner to pay.`,
          cta: null,
        };
  }

  if (sub.status === 'suspended') {
    const message = 'Paid features are paused until the overdue payment is made.';
    return input.canManage
      ? { tone: 'danger', message, cta: { label: 'Pay to restore', kind: 'pay' } }
      : {
          tone: 'danger',
          message: `${message} Ask the organization owner to pay.`,
          cta: null,
        };
  }

  return null;
}

/** Short caption on the sidebar plan card. */
export function describeSidebarCaption(
  subscription: OrgSubscriptionDto | null,
  formatShortDate: (iso: string) => string
): { text: string; attention: boolean } | null {
  if (!subscription) return null;
  const short = (iso: string | null | undefined) => (iso ? formatShortDate(iso) : null);
  if (subscription.status === 'suspended') return { text: 'Suspended', attention: true };
  if (subscription.status === 'past_due') return { text: 'Past due', attention: true };
  if (subscription.status === 'trialing') {
    const end = short(subscription.currentPeriodEnd);
    return { text: end ? `Trial ends ${end}` : 'Trial', attention: false };
  }
  if (subscription.cancelAtPeriodEnd) {
    const end = short(subscription.currentPeriodEnd);
    return { text: end ? `Ends ${end}` : 'Ending', attention: false };
  }
  if (subscription.scheduledPlanId) {
    const end = short(subscription.scheduledChangeAt ?? subscription.currentPeriodEnd);
    return { text: end ? `Changes ${end}` : 'Change scheduled', attention: false };
  }
  return null;
}

// ─── Choosing a plan ─────────────────────────────────────────────────────────────

export type PlanChangeKind =
  | { kind: 'pay' }
  | { kind: 'schedule' }
  | { kind: 'cancel' }
  | { kind: 'cancel_now' }
  | { kind: 'blocked'; reason: string }
  | { kind: 'sales' }
  | { kind: 'same' };

/**
 * What choosing `target` means right now. Mirrors the server rules
 * (`classifyCheckout`, `validateScheduleDowngrade`, `validateCancelAtPeriodEnd`).
 */
export function resolvePlanChange(input: {
  subscription: OrgSubscriptionDto | null;
  currentPlan: OrgBundlePlanDto | null;
  target: OrgBundlePlanDto;
}): PlanChangeKind {
  const { subscription: sub, currentPlan, target } = input;

  if (target.code === 'managed') return { kind: 'sales' };
  if (currentPlan?.code === 'managed' && sub) {
    return { kind: 'blocked', reason: 'Contact support to change your Managed plan.' };
  }

  // No subscription: Free. Anything paid is a purchase.
  if (!sub || !currentPlan || currentPlan.isDefault) {
    return target.isDefault ? { kind: 'same' } : { kind: 'pay' };
  }

  const isSameAsScheduled = sub.scheduledPlanId === target.id;
  const sameAsCurrent = target.id === currentPlan.id;

  if (sub.status === 'suspended') {
    if (target.isDefault) return { kind: 'cancel_now' };
    return { kind: 'pay' };
  }

  if (sub.status === 'past_due') {
    if (target.isDefault) return { kind: 'cancel_now' };
    if (sameAsCurrent) return { kind: 'pay' };
    if (target.sortOrder > currentPlan.sortOrder) return { kind: 'pay' };
    return { kind: 'blocked', reason: 'Pay the overdue balance before changing your plan.' };
  }

  if (sub.status === 'trialing') {
    if (target.isDefault) {
      return { kind: 'blocked', reason: 'Your trial ends on its own. Nothing to cancel.' };
    }
    return { kind: 'pay' };
  }

  // active
  if (target.isDefault) return sub.cancelAtPeriodEnd ? { kind: 'same' } : { kind: 'cancel' };
  if (sameAsCurrent) return { kind: 'same' };
  if (isSameAsScheduled) return { kind: 'same' };
  if (target.sortOrder > currentPlan.sortOrder) return { kind: 'pay' };
  return { kind: 'schedule' };
}
