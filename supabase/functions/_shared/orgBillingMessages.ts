/**
 * Copy for org billing emails — pure, no DB, no sending. One catalog so every billing message
 * says the same thing the Plans page says. Short, plain, no em dashes (human-copy rule).
 */

export type OrgBillingMessageKind =
  | 'change_scheduled'
  | 'cancel_scheduled'
  | 'scheduled_cleared'
  | 'change_applied'
  | 'plan_ended'
  | 'renewal_link'
  | 'renewal_due_tomorrow'
  | 'past_due'
  | 'grace_ending'
  | 'suspended'
  | 'reactivated'
  | 'renewed_from_credit'
  | 'receipt'
  | 'payment_credited'
  | 'payment_failed'
  | 'trial_ending'
  | 'price_change';

export type OrgBillingMessageParams = {
  orgName: string;
  fromPlan?: string;
  toPlan?: string;
  planName?: string;
  /** Pre-formatted Manila date, e.g. "Dec 3, 2026". */
  dateLabel?: string;
  graceEndLabel?: string;
  cancelDateLabel?: string;
  amountPhp?: number;
  receiptNumber?: string | null;
  propertyCount?: number;
  daysLeft?: number;
  endedReason?: 'host_canceled' | 'nonpayment' | 'trial_ended' | 'no_properties' | 'admin' | string;
  oldPricePhp?: number;
  newPricePhp?: number;
  checkoutUrl?: string | null;
  purpose?: string | null;
};

export type OrgBillingMessage = {
  subject: string;
  headline: string;
  paragraphs: string[];
  ctaLabel?: string;
  /** Absolute URL, or 'plans' to link to the org Plans & Billing page. */
  ctaTarget?: string | 'plans';
};

export function formatPhp(amount: number): string {
  return `₱${Math.round(amount).toLocaleString('en-PH')}`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function buildOrgBillingMessage(
  kind: OrgBillingMessageKind,
  p: OrgBillingMessageParams
): OrgBillingMessage {
  const org = p.orgName;
  switch (kind) {
    case 'change_scheduled':
      return {
        subject: `${org} moves to ${p.toPlan} on ${p.dateLabel}`,
        headline: 'Plan change scheduled',
        paragraphs: [
          `${org} will move from ${p.fromPlan} to ${p.toPlan} on ${p.dateLabel}.`,
          `You keep every ${p.fromPlan} feature until then. You can keep ${p.fromPlan} any time before that date.`,
        ],
        ctaLabel: 'View plan',
        ctaTarget: 'plans',
      };
    case 'cancel_scheduled':
      return {
        subject: `${org} moves to Free on ${p.dateLabel}`,
        headline: 'Plan ends soon',
        paragraphs: [
          `${org}'s ${p.planName} plan will end on ${p.dateLabel}, then the organization moves to Free.`,
          `You keep every paid feature until then. You can resume your plan any time before that date.`,
        ],
        ctaLabel: 'Resume plan',
        ctaTarget: 'plans',
      };
    case 'scheduled_cleared':
      return {
        subject: `${org} keeps the ${p.planName} plan`,
        headline: 'Plan change canceled',
        paragraphs: [`${org} stays on ${p.planName}. Nothing changes at the end of the period.`],
        ctaLabel: 'View plan',
        ctaTarget: 'plans',
      };
    case 'change_applied':
      return {
        subject: `${org} is now on ${p.toPlan}`,
        headline: 'Plan changed',
        paragraphs: [
          `${org} moved from ${p.fromPlan} to ${p.toPlan}.`,
          `Features that are not in ${p.toPlan} are now off. Your data is kept.`,
        ],
        ctaLabel: 'View plan',
        ctaTarget: 'plans',
      };
    case 'plan_ended': {
      const why =
        p.endedReason === 'nonpayment'
          ? 'because the payment stayed overdue'
          : p.endedReason === 'trial_ended'
            ? 'because the trial ended'
            : p.endedReason === 'no_properties'
              ? 'because there were no properties to bill'
              : '';
      return {
        subject: `${org} is now on Free`,
        headline: 'Your plan ended',
        paragraphs: [
          `${org} moved to the Free plan${why ? ` ${why}` : ''}. Paid features are off. Your data is kept.`,
          `You can pick a plan again whenever you are ready.`,
        ],
        ctaLabel: 'Choose a plan',
        ctaTarget: 'plans',
      };
    }
    case 'renewal_link':
      return {
        subject: `Renew ${org} by ${p.dateLabel}`,
        headline: 'Your renewal is ready',
        paragraphs: [
          `${org}'s ${p.planName} plan renews on ${p.dateLabel}${
            p.amountPhp != null ? ` for ${formatPhp(p.amountPhp)}` : ''
          }.`,
          `Pay before then to keep everything running.`,
        ],
        ctaLabel: 'Pay renewal',
        ctaTarget: p.checkoutUrl ?? 'plans',
      };
    case 'renewal_due_tomorrow':
      return {
        subject: `${org} renews tomorrow`,
        headline: 'Renewal due tomorrow',
        paragraphs: [
          `${org}'s ${p.planName} plan renews on ${p.dateLabel}. The payment is still open.`,
        ],
        ctaLabel: 'Pay renewal',
        ctaTarget: p.checkoutUrl ?? 'plans',
      };
    case 'past_due':
      return {
        subject: `Payment overdue for ${org}`,
        headline: 'Your payment is overdue',
        paragraphs: [
          `We did not receive the renewal for ${org}. You keep full access until ${p.graceEndLabel}.`,
          `After that, paid features pause until you pay. Guest booking pages keep working.`,
        ],
        ctaLabel: 'Pay now',
        ctaTarget: p.checkoutUrl ?? 'plans',
      };
    case 'grace_ending':
      return {
        subject: `Last day to pay for ${org}`,
        headline: 'Paid features pause tomorrow',
        paragraphs: [
          `Your grace period ends on ${p.graceEndLabel}. Pay before then to keep paid features on for ${org}.`,
        ],
        ctaLabel: 'Pay now',
        ctaTarget: p.checkoutUrl ?? 'plans',
      };
    case 'suspended':
      return {
        subject: `Paid features paused for ${org}`,
        headline: 'Paid features are paused',
        paragraphs: [
          `${org} works like the Free plan until you pay. Your data and guest booking pages are not affected.`,
          p.cancelDateLabel
            ? `If the payment is still missing on ${p.cancelDateLabel}, the plan ends and ${org} stays on Free.`
            : `If the payment stays missing, the plan ends and ${org} stays on Free.`,
        ],
        ctaLabel: 'Pay to restore',
        ctaTarget: p.checkoutUrl ?? 'plans',
      };
    case 'reactivated':
      return {
        subject: `${org} is back on ${p.planName}`,
        headline: 'Paid features are back',
        paragraphs: [`Thanks for paying. ${org} is active on ${p.planName} again.`],
        ctaLabel: 'View plan',
        ctaTarget: 'plans',
      };
    case 'renewed_from_credit':
      return {
        subject: `${org} renewed with account credit`,
        headline: 'Renewed with credit',
        paragraphs: [
          `${org}'s ${p.planName} plan renewed using your account credit. It is active until ${p.dateLabel}.`,
        ],
        ctaLabel: 'View billing',
        ctaTarget: 'plans',
      };
    case 'receipt': {
      const lines = [
        `${org} is on ${p.planName}${
          p.propertyCount != null
            ? ` for ${p.propertyCount} ${plural(p.propertyCount, 'property', 'properties')}`
            : ''
        }. We received ${p.amountPhp != null ? formatPhp(p.amountPhp) : 'your payment'}.`,
      ];
      if (p.dateLabel) lines.push(`Your plan is paid through ${p.dateLabel}.`);
      if (p.receiptNumber) lines.push(`Receipt number: ${p.receiptNumber}.`);
      return {
        subject: `Payment received for ${org}`,
        headline: 'Payment received',
        paragraphs: lines,
        ctaLabel: 'View receipt',
        ctaTarget: 'plans',
      };
    }
    case 'payment_credited':
      return {
        subject: `Payment added as credit for ${org}`,
        headline: 'We kept your payment as credit',
        paragraphs: [
          `We received ${p.amountPhp != null ? formatPhp(p.amountPhp) : 'a payment'} for ${org}, but your plan had already changed, so it could not be applied.`,
          `It is now account credit and comes off your next payment. If you would rather have a refund, contact support.`,
        ],
        ctaLabel: 'View billing',
        ctaTarget: 'plans',
      };
    case 'payment_failed':
      return {
        subject: `Payment did not go through for ${org}`,
        headline: 'Payment could not be completed',
        paragraphs: [`Your last payment attempt for ${org} did not go through. You can try again.`],
        ctaLabel: 'Try again',
        ctaTarget: 'plans',
      };
    case 'trial_ending': {
      const days = p.daysLeft ?? 0;
      return {
        subject: `${org} trial ends ${days <= 1 ? 'tomorrow' : `in ${days} days`}`,
        headline: 'Your trial is ending',
        paragraphs: [
          `The ${p.planName} trial for ${org} ends on ${p.dateLabel}, then the organization moves to Free.`,
          `Keep ${p.planName} to carry on without a break. Your paid period starts when the trial ends.`,
        ],
        ctaLabel: `Keep ${p.planName}`,
        ctaTarget: p.checkoutUrl ?? 'plans',
      };
    }
    case 'price_change':
      return {
        subject: `${p.planName} price change for ${org}`,
        headline: 'A price change is coming',
        paragraphs: [
          `From ${p.dateLabel}, the ${p.planName} plan for ${org} costs ${
            p.newPricePhp != null ? formatPhp(p.newPricePhp) : 'a new price'
          } a month${p.oldPricePhp != null ? ` instead of ${formatPhp(p.oldPricePhp)}` : ''}.`,
          `Your current period is not affected. You can change or cancel your plan before then.`,
        ],
        ctaLabel: 'View plan',
        ctaTarget: 'plans',
      };
  }
}
