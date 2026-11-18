/**
 * What a checkout was for, captured when it was created, and whether a payment that arrives
 * later is still valid for the subscription as it is now. Pure, no DB.
 *
 * The rule: money is never ignored. A payment whose intent no longer fits (the period was
 * already renewed, the host changed plan, the subscription ended) is not applied to the
 * subscription. It becomes account credit and the owner is told.
 */

export type PaymentPurpose = 'initial' | 'renewal' | 'retry' | 'change' | 'reactivation';

export type PaymentIntent = {
  v: 1;
  purpose: PaymentPurpose;
  /** Subscription the checkout was created against (null for a first purchase). */
  subscriptionId: string | null;
  /** The plan being paid for. */
  planId: string;
  /** current_period_end when the checkout was created (renewals must match it). */
  basePeriodEnd: string | null;
  baseStatus: string | null;
  targetTotalPhp: number;
  settleDebtPhp: number;
  consumeCreditPhp: number;
  newCreditPhp: number;
  propertyCount: number;
  /** True when this payment buys today's plan pricing (fresh purchase or a price migration). */
  pricingRefresh?: boolean;
};

export type IntentSubscription = {
  id: string;
  status: string;
  planId: string;
  scheduledPlanId: string | null;
  currentPeriodEnd: string | null;
};

export type StaleReason =
  'subscription_exists' | 'subscription_ended' | 'period_already_renewed' | 'plan_changed';

export type IntentApplication =
  | {
      ok: true;
      /** create: new subscription. fresh: new period from today. anchored: next period after the current one. */
      mode: 'create' | 'fresh' | 'anchored';
    }
  | { ok: false; reason: StaleReason };

const LIVE = new Set(['active', 'trialing', 'past_due', 'suspended']);

function sameInstant(a: string | null, b: string | null): boolean {
  if (!a || !b) return a === b;
  return new Date(a).getTime() === new Date(b).getTime();
}

export function validatePaymentIntent(
  intent: PaymentIntent,
  sub: IntentSubscription | null
): IntentApplication {
  const live = sub && LIVE.has(sub.status) ? sub : null;

  switch (intent.purpose) {
    case 'initial':
      return live ? { ok: false, reason: 'subscription_exists' } : { ok: true, mode: 'create' };

    case 'change':
    case 'reactivation':
      // The host paid to be on this plan. If the old subscription ended in the meantime, start a
      // new one instead of dropping the payment.
      if (!live) return { ok: true, mode: 'create' };
      if (intent.subscriptionId && live.id !== intent.subscriptionId) {
        return { ok: false, reason: 'subscription_ended' };
      }
      return { ok: true, mode: 'fresh' };

    case 'renewal':
    case 'retry': {
      if (!live || (intent.subscriptionId && live.id !== intent.subscriptionId)) {
        return { ok: false, reason: 'subscription_ended' };
      }
      if (!sameInstant(live.currentPeriodEnd, intent.basePeriodEnd)) {
        return { ok: false, reason: 'period_already_renewed' };
      }
      if (intent.planId !== (live.scheduledPlanId ?? live.planId)) {
        return { ok: false, reason: 'plan_changed' };
      }
      // A suspended subscription's period lapsed long ago: pay for a fresh period from today.
      return { ok: true, mode: live.status === 'suspended' ? 'fresh' : 'anchored' };
    }
  }
}

export function staleReasonMessage(reason: StaleReason): string {
  switch (reason) {
    case 'subscription_exists':
      return 'The organization already had a plan when this payment arrived';
    case 'subscription_ended':
      return 'The subscription ended before this payment arrived';
    case 'period_already_renewed':
      return 'This period was already paid';
    case 'plan_changed':
      return 'The plan changed before this payment arrived';
  }
}

/** Reads a stored intent; null for rows created before intents existed. */
export function parsePaymentIntent(value: unknown): PaymentIntent | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1 || typeof raw.planId !== 'string' || typeof raw.purpose !== 'string') return null;
  return raw as unknown as PaymentIntent;
}

/** Best-effort intent for a pending transaction created before intents were stored. */
export function legacyPaymentIntent(input: {
  planId: string;
  propertyCount: number;
  amountPhp: number;
  sub: IntentSubscription | null;
}): PaymentIntent {
  const { sub } = input;
  const purpose: PaymentPurpose = !sub
    ? 'initial'
    : sub.planId === input.planId
      ? 'renewal'
      : 'change';
  return {
    v: 1,
    purpose,
    subscriptionId: sub?.id ?? null,
    planId: input.planId,
    basePeriodEnd: sub?.currentPeriodEnd ?? null,
    baseStatus: sub?.status ?? null,
    targetTotalPhp: input.amountPhp,
    settleDebtPhp: 0,
    consumeCreditPhp: 0,
    newCreditPhp: 0,
    propertyCount: input.propertyCount,
  };
}
