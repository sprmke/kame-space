import { describe, expect, it } from 'vitest';

import {
  describeBillingBanner,
  describeBillingState,
  describeSidebarCaption,
  resolvePlanChange,
} from '@/features/dashboard/plans/lib/billingState';
import type {
  OrgBundlePlanDto,
  OrgSubscriptionDto,
} from '@/features/dashboard/plans/lib/orgPlanApi';

const formatDate = (iso: string) => iso.slice(0, 10);
const formatPhp = (n: number) => `PHP ${n}`;

function sub(over: Partial<OrgSubscriptionDto> = {}): OrgSubscriptionDto {
  return {
    id: 's1',
    planId: 'pro',
    planCode: 'pro',
    planName: 'Business',
    pricingModel: 'subscription',
    status: 'active',
    pricePhpSnapshot: 1600,
    currentPeriodStart: '2027-03-01T00:00:00Z',
    currentPeriodEnd: '2027-04-01T00:00:00Z',
    gracePeriodEndsAt: null,
    ...over,
  };
}

function plan(
  code: string,
  sortOrder: number,
  over: Partial<OrgBundlePlanDto> = {}
): OrgBundlePlanDto {
  return {
    id: code,
    code,
    name: code,
    tagline: null,
    sortOrder,
    pricingModel: 'subscription',
    pricePhp: sortOrder * 100,
    discountPercent: 0,
    volumeDiscountTiers: [],
    volumeRampFloorPhp: 500,
    volumeRampAtCount: 10,
    features: {} as OrgBundlePlanDto['features'],
    isDefault: code === 'free',
    ...over,
  };
}

const free = plan('free', 0);
const starter = plan('starter', 10);
const growth = plan('growth', 20);
const pro = plan('pro', 30);
const managed = plan('managed', 40);

const describe_ = (s: OrgSubscriptionDto | null, extra: Record<string, unknown> = {}) =>
  describeBillingState({
    subscription: s,
    canManage: true,
    formatDate,
    formatPhp,
    ...extra,
  });

describe('describeBillingState', () => {
  it('free has no strip and no period line', () => {
    const view = describe_(null);
    expect(view.key).toBe('free');
    expect(view.strip).toBeNull();
    expect(view.periodLine).toBeNull();
  });

  it('active shows the renewal date and the next payment', () => {
    const view = describe_(sub(), {
      upcoming: {
        purpose: 'renewal',
        planId: 'pro',
        planName: 'Business',
        amountPhp: 1600,
        coveredByCredit: false,
        propertyCount: 2,
        dueAt: '2027-04-01T00:00:00Z',
        lineItems: [],
      },
    });
    expect(view.periodLine).toBe('Renews 2027-04-01 · PHP 1600 next payment');
    expect(view.strip).toBeNull();
  });

  it('an open renewal checkout shows Pay renewal', () => {
    const view = describe_(sub(), { openCheckout: { purpose: 'renewal' } });
    expect(view.key).toBe('renewal_ready');
    expect(view.strip?.actions).toEqual(['pay_now']);
  });

  it('an open upgrade checkout is a waiting payment, not a renewal', () => {
    const view = describe_(sub(), { openCheckout: { purpose: 'change' } });
    expect(view.key).toBe('payment_waiting');
    expect(view.strip?.message).toBe('A plan payment is waiting to be completed.');
  });

  it('a scheduled downgrade says the current plan is kept until the date, with Keep plan', () => {
    const view = describe_(
      sub({
        scheduledPlanId: 'starter',
        scheduledPlanName: 'Starter',
        scheduledChangeAt: '2027-04-01T00:00:00Z',
      })
    );
    expect(view.key).toBe('downgrade_scheduled');
    expect(view.periodLine).toBe('Changes to Starter on 2027-04-01');
    expect(view.strip?.message).toBe('You keep Business until 2027-04-01.');
    expect(view.strip?.actions).toEqual(['keep_plan']);
  });

  it('a scheduled cancel offers Resume plan', () => {
    const view = describe_(sub({ cancelAtPeriodEnd: true }));
    expect(view.key).toBe('cancel_scheduled');
    expect(view.periodLine).toBe('Ends 2027-04-01');
    expect(view.strip?.actions).toEqual(['resume_plan']);
  });

  it('past due offers Pay now and Cancel plan with the grace date', () => {
    const view = describe_(sub({ status: 'past_due', gracePeriodEndsAt: '2027-04-06T00:00:00Z' }));
    expect(view.key).toBe('past_due');
    expect(view.strip?.message).toContain('2027-04-06');
    expect(view.strip?.actions).toEqual(['pay_now', 'cancel_now']);
  });

  it('suspended says when the plan ends and offers Pay now / Switch to Free', () => {
    const view = describe_(
      sub({
        status: 'suspended',
        suspendedAt: '2027-04-10T00:00:00Z',
        autoCancelAt: '2027-05-10T00:00:00Z',
      })
    );
    expect(view.key).toBe('suspended');
    expect(view.strip?.message).toContain('2027-05-10');
    expect(view.strip?.actions).toEqual(['pay_now', 'switch_to_free']);
  });

  it('a reward trial offers to keep the plan after the trial', () => {
    const view = describe_(sub({ status: 'trialing', source: 'reward' }));
    expect(view.key).toBe('trial');
    expect(view.periodLine).toBe('Trial ends 2027-04-01');
    expect(view.strip?.actions).toEqual(['keep_after_trial']);
  });

  it('members see the state but never actions', () => {
    const view = describe_(sub({ status: 'past_due' }), { canManage: false });
    expect(view.strip?.actions).toEqual([]);
    expect(view.readOnlyNote).toBe('Only the organization owner can change billing.');
  });

  it('never prints undefined, null or an em dash', () => {
    const states = [
      sub(),
      sub({ status: 'past_due' }),
      sub({ status: 'suspended' }),
      sub({ status: 'trialing' }),
      sub({ cancelAtPeriodEnd: true }),
      sub({ scheduledPlanId: 'starter' }),
      sub({ currentPeriodEnd: null }),
    ];
    for (const s of states) {
      const view = describe_(s);
      const text = [view.periodLine, view.strip?.message].join(' ');
      expect(text).not.toMatch(/undefined|null|—/);
    }
  });
});

describe('describeBillingBanner', () => {
  const fmt = { formatDate };
  it('shows only for past due and suspended', () => {
    expect(describeBillingBanner({ subscription: sub(), canManage: true, ...fmt })).toBeNull();
    expect(describeBillingBanner({ subscription: null, canManage: true, ...fmt })).toBeNull();
    expect(
      describeBillingBanner({
        subscription: sub({ cancelAtPeriodEnd: true }),
        canManage: true,
        ...fmt,
      })
    ).toBeNull();
  });

  it('owners get a pay action, members are told who to ask', () => {
    const owner = describeBillingBanner({
      subscription: sub({ status: 'past_due', gracePeriodEndsAt: '2027-04-06T00:00:00Z' }),
      canManage: true,
      ...fmt,
    });
    expect(owner?.cta?.kind).toBe('pay');
    const member = describeBillingBanner({
      subscription: sub({ status: 'suspended' }),
      canManage: false,
      ...fmt,
    });
    expect(member?.cta).toBeNull();
    expect(member?.message).toContain('Ask the organization owner');
  });
});

describe('describeSidebarCaption', () => {
  const fmt = (iso: string) => iso.slice(5, 10);
  it('summarizes each state', () => {
    expect(describeSidebarCaption(null, fmt)).toBeNull();
    expect(describeSidebarCaption(sub(), fmt)).toBeNull();
    expect(describeSidebarCaption(sub({ status: 'past_due' }), fmt)).toEqual({
      text: 'Past due',
      attention: true,
    });
    expect(describeSidebarCaption(sub({ cancelAtPeriodEnd: true }), fmt)?.text).toBe('Ends 04-01');
    expect(describeSidebarCaption(sub({ scheduledPlanId: 'starter' }), fmt)?.text).toBe(
      'Changes 04-01'
    );
    expect(describeSidebarCaption(sub({ status: 'trialing' }), fmt)?.text).toBe('Trial ends 04-01');
  });
});

describe('resolvePlanChange', () => {
  const pick = (
    s: OrgSubscriptionDto | null,
    current: OrgBundlePlanDto | null,
    target: OrgBundlePlanDto
  ) => resolvePlanChange({ subscription: s, currentPlan: current, target }).kind;

  it('Free org: any paid plan is a purchase', () => {
    expect(pick(null, free, starter)).toBe('pay');
    expect(pick(null, free, free)).toBe('same');
  });

  it('active: higher pays, lower schedules, Free cancels, same does nothing', () => {
    const s = sub({ planId: 'growth', planCode: 'growth' });
    expect(pick(s, growth, pro)).toBe('pay');
    expect(pick(s, growth, starter)).toBe('schedule');
    expect(pick(s, growth, free)).toBe('cancel');
    expect(pick(s, growth, growth)).toBe('same');
  });

  it('a plan already scheduled is not offered again', () => {
    const s = sub({ planId: 'growth', planCode: 'growth', scheduledPlanId: 'starter' });
    expect(pick(s, growth, starter)).toBe('same');
  });

  it('cancel already scheduled: Free is the current outcome', () => {
    const s = sub({ planId: 'growth', planCode: 'growth', cancelAtPeriodEnd: true });
    expect(pick(s, growth, free)).toBe('same');
  });

  it('past due may pay or upgrade, never schedule a downgrade; Free ends it now', () => {
    const s = sub({ planId: 'growth', planCode: 'growth', status: 'past_due' });
    expect(pick(s, growth, growth)).toBe('pay');
    expect(pick(s, growth, pro)).toBe('pay');
    expect(pick(s, growth, starter)).toBe('blocked');
    expect(pick(s, growth, free)).toBe('cancel_now');
  });

  it('suspended may reactivate on any paid plan or leave for Free', () => {
    const s = sub({ planId: 'growth', planCode: 'growth', status: 'suspended' });
    expect(pick(s, growth, starter)).toBe('pay');
    expect(pick(s, growth, free)).toBe('cancel_now');
  });

  it('Managed is sales assisted in both directions', () => {
    expect(pick(null, free, managed)).toBe('sales');
    const s = sub({ planId: 'managed', planCode: 'managed' });
    expect(pick(s, managed, starter)).toBe('blocked');
  });

  it('a reward trial can pay for a plan but not cancel', () => {
    const s = sub({ planId: 'growth', planCode: 'growth', status: 'trialing' });
    expect(pick(s, growth, pro)).toBe('pay');
    expect(pick(s, growth, free)).toBe('blocked');
  });
});
