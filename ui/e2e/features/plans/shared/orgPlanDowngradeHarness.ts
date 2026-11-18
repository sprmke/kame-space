/**
 * Mocked org Plans scheduled-change harness: PlanReviewDialog, PlanCancelDialog and
 * org-subscription-change. A downgrade or cancel is recorded as pending intent on the
 * subscription (nothing changes until the period ends), like the real endpoint.
 */

import { expect, type Page } from '@playwright/test';

import {
  dashboardStatsPayload,
  fulfillJson,
  installPlansE2eSession,
  organizationList,
  orgAccessPayload,
  PLAN_GROWTH,
  PLANS_E2E_CATALOG,
  PLANS_E2E_ORG_ID,
  PLANS_E2E_PROPERTY_ID,
  PLANS_E2E_PROPERTY_SLUG,
  plansE2ePaths,
  planChargedPhp,
  planPreviewPayload,
  emptyPlanFeatures,
} from './orgPlanHarnessShared';
import { bringTierCardIntoView } from './planPageAssertions';
import {
  TIER_ORDER,
  TIER_TITLES,
} from '../../../../src/features/dashboard/plans/lib/planTierExpectations';

export {
  PLANS_E2E_ORG_SLUG,
  PLANS_E2E_PROPERTY_ID,
  PLANS_E2E_PROPERTY_SLUG,
  PLAN_FREE,
  PLAN_GROWTH,
  PLAN_STARTER,
  PLAN_PRO,
} from './orgPlanHarnessShared';

export type PlansDowngradeHarnessOptions = {
  accessKind?: 'owner' | 'member';
  subscriptionStatus?: 'active' | 'past_due' | 'suspended';
  subscriptionPlanId?: string;
  scheduledPlanId?: string | null;
  cancelAtPeriodEnd?: boolean;
};

export type ChangeCall = { action: string; planId?: string; reason?: string | null };

type HarnessState = {
  accessKind: 'owner' | 'member';
  subscriptionStatus: 'active' | 'past_due' | 'suspended';
  subscriptionPlanId: string | null;
  subscriptionId: string | null;
  scheduledPlanId: string | null;
  cancelAtPeriodEnd: boolean;
  changeCalls: ChangeCall[];
};

const PERIOD_END = '2026-09-01T00:00:00.000Z';

function orgPlanPayload(state: HarnessState) {
  const currentPlan =
    PLANS_E2E_CATALOG.find((plan) => plan.id === state.subscriptionPlanId) ?? null;
  const scheduledPlan = PLANS_E2E_CATALOG.find((plan) => plan.id === state.scheduledPlanId) ?? null;
  return {
    plans: PLANS_E2E_CATALOG,
    properties: [
      {
        id: PLANS_E2E_PROPERTY_ID,
        name: 'Solea Mactan',
        slug: PLANS_E2E_PROPERTY_SLUG,
        status: 'ACTIVE',
      },
    ],
    subscription: currentPlan
      ? {
          id: state.subscriptionId ?? 'sub-plans-downgrade-e2e',
          planId: currentPlan.id,
          planCode: currentPlan.code,
          planName: currentPlan.name,
          pricingModel: 'subscription',
          status: state.subscriptionStatus,
          source: 'purchase',
          pricePhpSnapshot: planChargedPhp(currentPlan),
          currentPeriodStart: '2026-08-01T00:00:00.000Z',
          currentPeriodEnd: PERIOD_END,
          gracePeriodEndsAt:
            state.subscriptionStatus === 'past_due' ? '2026-09-06T00:00:00.000Z' : null,
          suspendedAt: state.subscriptionStatus === 'suspended' ? '2026-08-10T00:00:00.000Z' : null,
          autoCancelAt:
            state.subscriptionStatus === 'suspended' ? '2026-09-09T00:00:00.000Z' : null,
          cancelAtPeriodEnd: state.cancelAtPeriodEnd,
          scheduledPlanId: state.scheduledPlanId,
          scheduledPlanName: scheduledPlan?.name ?? null,
          scheduledChangeAt: state.scheduledPlanId ? PERIOD_END : null,
          isPriceOverridden: false,
        }
      : null,
    assignedPropertyIds: currentPlan ? [PLANS_E2E_PROPERTY_ID] : [],
    upcomingPayment: null,
    accountCreditPhp: 0,
    amountOwedPhp: 0,
    billingDetails: null,
    pendingCheckoutUrl: null,
    pendingCheckoutPlanId: null,
    pendingCheckoutPurpose: null,
    transactions: [],
    transactionsNextCursor: null,
  };
}

export async function installPlansDowngradeSession(page: Page) {
  await installPlansE2eSession(page);
}

export async function installPlansDowngradeMocks(
  page: Page,
  options: PlansDowngradeHarnessOptions = {}
) {
  const state: HarnessState = {
    accessKind: options.accessKind ?? 'owner',
    subscriptionStatus: options.subscriptionStatus ?? 'active',
    subscriptionPlanId: options.subscriptionPlanId ?? PLAN_GROWTH,
    subscriptionId: 'sub-plans-downgrade-e2e',
    scheduledPlanId: options.scheduledPlanId ?? null,
    cancelAtPeriodEnd: options.cancelAtPeriodEnd ?? false,
    changeCalls: [],
  };

  await installPlansE2eSession(page);

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();

    switch (endpoint) {
      case 'list-organizations':
        await fulfillJson(route, { success: true, data: organizationList(state.accessKind) });
        return;
      case 'list-properties':
        await fulfillJson(route, {
          success: true,
          data: {
            properties: [
              {
                id: PLANS_E2E_PROPERTY_ID,
                organizationId: PLANS_E2E_ORG_ID,
                name: 'Solea Mactan',
                slug: PLANS_E2E_PROPERTY_SLUG,
                type: 'condo',
                status: 'ACTIVE',
                address: 'Mactan',
                towerAndUnit: null,
                tower: 'Tower A',
                unitNumber: '1204',
                residenceName: 'Solea Mactan',
                maxGuests: 4,
                settings: {},
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        });
        return;
      case 'list-parkings':
        await fulfillJson(route, { success: true, data: { parkings: [] } });
        return;
      case 'org-access':
        await fulfillJson(route, { success: true, data: orgAccessPayload(state.accessKind) });
        return;
      case 'dashboard-stats':
        await fulfillJson(route, { success: true, data: dashboardStatsPayload() });
        return;
      case 'list-bookings':
        await fulfillJson(route, { success: true, data: [], total: 0 });
        return;
      case 'org-settings':
        await fulfillJson(route, {
          success: true,
          data: {
            facebookPageUrl: '',
            airbnbUrl: '',
            instagramUrl: '',
            tiktokUrl: '',
            emailLogoUrl: '',
            updatedAt: null,
            fieldSources: {},
          },
        });
        return;
      case 'org-plan':
        await fulfillJson(route, { success: true, data: orgPlanPayload(state) });
        return;
      case 'preview-org-plan-change': {
        const body = route.request().postDataJSON() as {
          kind?: 'pay' | 'schedule' | 'cancel';
          planId?: string;
        };
        await fulfillJson(route, {
          success: true,
          data: planPreviewPayload({
            kind: body.kind ?? 'pay',
            planId: body.planId ?? null,
            currentPlanId: state.subscriptionPlanId,
          }),
        });
        return;
      }
      case 'org-subscription-change': {
        const body = route.request().postDataJSON() as ChangeCall;
        state.changeCalls.push({ action: body.action, planId: body.planId, reason: body.reason });
        if (body.action === 'schedule_downgrade') {
          state.scheduledPlanId = String(body.planId ?? '');
          state.cancelAtPeriodEnd = false;
        } else if (body.action === 'cancel_at_period_end') {
          state.cancelAtPeriodEnd = true;
          state.scheduledPlanId = null;
        } else if (body.action === 'clear_intent') {
          state.cancelAtPeriodEnd = false;
          state.scheduledPlanId = null;
        } else if (body.action === 'cancel_now') {
          state.subscriptionPlanId = null;
          state.subscriptionId = null;
          state.subscriptionStatus = 'active';
        }
        await fulfillJson(route, { success: true, data: { effectiveAt: PERIOD_END } });
        return;
      }
      case 'property-entitlements':
        await fulfillJson(route, {
          success: true,
          data: {
            ...emptyPlanFeatures(),
            planId: PLAN_GROWTH,
            planCode: 'growth',
            planName: 'Pro',
            pricingModel: 'subscription',
            status: state.subscriptionStatus,
            propertySubscriptionId: state.subscriptionId ?? '',
          },
        });
        return;
      case 'notifications-list':
        await fulfillJson(route, {
          success: true,
          data: { notifications: [], nextCursor: null, unreadCount: 0 },
        });
        return;
      default:
        await fulfillJson(route, { success: true, data: {} });
        return;
    }
  });

  return state;
}

export async function openOrgPlansPage(page: Page, tab: 'plans' | 'billing' = 'plans') {
  await page.goto(plansE2ePaths.orgPlans(tab));
  await expect(page.getByRole('heading', { name: 'Plans & Billing' }).first()).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByRole('tab', { name: 'Plans' })).toBeVisible({ timeout: 15_000 });
}

/** Clicks the card action for `targetPlanName` (Switch at renewal / Cancel plan / Upgrade). */
export async function openPlanChange(page: Page, targetPlanName: string, actionLabel: string) {
  // The tier rail is a carousel: page to the card so the sidebar is not on top of its button.
  const code = TIER_ORDER.find((tier) => TIER_TITLES[tier] === targetPlanName);
  if (code) await bringTierCardIntoView(page, code);
  await page
    .getByRole('button', { name: new RegExp(`^${actionLabel} to ${targetPlanName}$`, 'i') })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
