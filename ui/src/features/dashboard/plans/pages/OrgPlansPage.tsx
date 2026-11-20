import { useEffect, useMemo, useState } from 'react';

import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { FileText, HelpCircle, LayoutGrid, Receipt } from 'lucide-react';

import {
  helpSupportNewTicketPath,
  useHelpSupportBasePath,
} from '@/features/dashboard/help-support/lib/helpSupportPaths';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import { canManageOrgBilling } from '@/features/dashboard/org/lib/orgAccessKind';
import { OrgBillingDetailsCard } from '@/features/dashboard/plans/components/OrgBillingDetailsCard';
import {
  PlanBillingHistory,
  PlanBillingSummaryCard,
  type PlanBillingActions,
} from '@/features/dashboard/plans/components/PlanBillingPanel';
import { PlanCancelDialog } from '@/features/dashboard/plans/components/PlanCancelDialog';
import { PlanCheckoutConfirmationBanner } from '@/features/dashboard/plans/components/PlanCheckoutConfirmationBanner';
import { PlanFaqSection } from '@/features/dashboard/plans/components/PlanFaqSection';
import { PlanFeatureMatrix } from '@/features/dashboard/plans/components/PlanFeatureMatrix';
import {
  PlanReviewDialog,
  type CheckoutRequest,
} from '@/features/dashboard/plans/components/PlanReviewDialog';
import { PlanTierRail } from '@/features/dashboard/plans/components/PlanTierRail';
import { PlanUpgradeSuccessModal } from '@/features/dashboard/plans/components/PlanUpgradeSuccessModal';
import { useOrgPaymentHistory } from '@/features/dashboard/plans/hooks/useOrgPaymentHistory';
import {
  useChangeOrgSubscriptionPlan,
  useCreateOrgPlanCheckout,
  useOrgPlan,
} from '@/features/dashboard/plans/hooks/useOrgPlan';
import { useOrgPlanCheckoutConfirmation } from '@/features/dashboard/plans/hooks/useOrgPlanCheckoutConfirmation';
import { resolvePlanChange } from '@/features/dashboard/plans/lib/billingState';
import { openOrgPlanCheckout } from '@/features/dashboard/plans/lib/openOrgPlanCheckout';
import type { CancelReason, OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import { parseOrgPlanCheckoutReturn } from '@/features/dashboard/plans/lib/orgPlanCheckoutParams';
import { consumeOrgPlanUpgradeCelebration } from '@/features/dashboard/plans/lib/orgPlanCheckoutSession';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import {
  buildPlanTiers,
  MANAGED_PLAN_INQUIRY_SUBJECT,
  nextUpgradePlan,
  planDisplayName,
  planFeatureLosses,
  resolveDefaultPlan,
  PLANS_PAGE_SUBTITLE,
  type PLANS_TAB_SECTION_TITLES,
  resolveEffectiveCurrentPlan,
  resolveEffectiveCurrentPlanId,
  resolveMinimumPlanForFeature,
} from '@/features/dashboard/plans/lib/planPresentation';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/AdminMobilePage';
import { PlansPageSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { orgPageTitle, usePageTitle } from '@/lib/pageTitle';
import { formatManilaLongDate } from '@/utils/format/dates';

type PlansTab = keyof typeof PLANS_TAB_SECTION_TITLES;

/** "Dec 3" for card badges. */
function formatShortManilaDate(iso: string | null | undefined): string | null {
  const long = formatManilaLongDate(iso);
  return long ? long.replace(/,\s*\d{4}$/, '') : null;
}

/**
 * Org subscription hub — one plan covers every property in the org, priced per property with
 * volume discounts. Tier changes open PlanReviewDialog for a final review (with proration when
 * it's a genuine mid-cycle change) before charging anything.
 */
export function OrgPlansPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations();
  const org = orgsData?.organizations.find((entry) => entry.slug === orgSlug);
  const helpSupportBase = useHelpSupportBasePath();
  usePageTitle(org?.name ? orgPageTitle(org.name, 'Plans & Billing') : undefined);

  const checkoutReturn = parseOrgPlanCheckoutReturn(searchParams.get('checkout'));

  const clearCheckoutReturnParam = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
  };

  const { data, isLoading, error, refetch } = useOrgPlan(org?.id ?? null, {
    pollWhileCheckoutPending: true,
  });
  const createCheckout = useCreateOrgPlanCheckout(org?.id ?? null);
  const changePlan = useChangeOrgSubscriptionPlan(org?.id ?? null);
  const history = useOrgPaymentHistory(org?.id ?? null, data);
  const checkoutConfirmation = useOrgPlanCheckoutConfirmation({
    orgId: org?.id ?? null,
    data,
    pollWhileConfirming: true,
    checkoutReturn,
    onCheckoutReturnHandled: clearCheckoutReturnParam,
  });

  const [activeTab, setActiveTab] = useState<PlansTab>('billing');
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [cancelMode, setCancelMode] = useState<'period_end' | 'now' | null>(null);
  const [upgradeCelebrationOpen, setUpgradeCelebrationOpen] = useState(false);
  const [celebrationPreviousPlanId, setCelebrationPreviousPlanId] = useState<string | null>(null);
  const [celebrationTargetPlanId, setCelebrationTargetPlanId] = useState<string | null>(null);

  const plans = data?.plans ?? [];
  const subscription = data?.subscription ?? null;

  const effectiveCurrentPlanId = useMemo(
    () => resolveEffectiveCurrentPlanId(plans, subscription?.planId),
    [plans, subscription?.planId]
  );

  const currentPlan = useMemo(
    () => resolveEffectiveCurrentPlan(plans, subscription?.planId),
    [plans, subscription?.planId]
  );

  const upgradeTarget = useMemo(
    () => nextUpgradePlan(plans, effectiveCurrentPlanId),
    [plans, effectiveCurrentPlanId]
  );

  const canManageBilling = canManageOrgBilling(org?.accessKind);

  const cancelLosses = useMemo(() => {
    const free = resolveDefaultPlan(plans);
    return currentPlan && free ? planFeatureLosses(currentPlan.features, free.features) : [];
  }, [plans, currentPlan]);

  /** Sends the host to PayMongo, or finishes in place when account credit covered the payment. */
  const startPayment = async (
    input: Parameters<typeof createCheckout.mutateAsync>[0],
    targetPlanId: string
  ) => {
    if (!org?.id) return;
    const checkout = await createCheckout.mutateAsync(input);
    if (!checkout.checkoutUrl) {
      setActiveTab('billing');
      return;
    }
    openOrgPlanCheckout({
      orgId: org.id,
      transactionId: checkout.transactionId,
      checkoutUrl: checkout.checkoutUrl,
      previousPlanId: effectiveCurrentPlanId ?? null,
      targetPlanId,
    });
  };

  /** Pay what is due: reopen the open checkout, or start the renewal / reactivation payment. */
  const payNow = async () => {
    const targetPlanId =
      data?.pendingCheckoutPlanId ??
      subscription?.scheduledPlanId ??
      subscription?.planId ??
      effectiveCurrentPlanId;
    if (!targetPlanId) return;
    await startPayment({ resume: Boolean(data?.pendingCheckoutUrl) }, targetPlanId).catch(
      () => undefined
    );
  };

  const celebrationPreviousPlan = useMemo(
    () => plans.find((plan) => plan.id === celebrationPreviousPlanId) ?? null,
    [plans, celebrationPreviousPlanId]
  );
  const celebrationTargetPlan = useMemo(
    () => plans.find((plan) => plan.id === celebrationTargetPlanId) ?? currentPlan,
    [plans, celebrationTargetPlanId, currentPlan]
  );

  useEffect(() => {
    if (checkoutConfirmation !== 'success' || !org?.id) return;
    const payload = consumeOrgPlanUpgradeCelebration(org.id);
    if (!payload) return;
    setCelebrationPreviousPlanId(payload.previousPlanId);
    setCelebrationTargetPlanId(payload.targetPlanId);
    setUpgradeCelebrationOpen(true);
  }, [checkoutConfirmation, org?.id]);

  useEffect(() => {
    setPendingPlanId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.id, subscription?.planId, subscription?.scheduledPlanId]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === pendingPlanId) ?? null,
    [plans, pendingPlanId]
  );

  const billingActions: PlanBillingActions = {
    pay_now: () => void payNow(),
    keep_plan: () => void changePlan.mutateAsync({ action: 'clear_intent' }).catch(() => undefined),
    resume_plan: () =>
      void changePlan.mutateAsync({ action: 'clear_intent' }).catch(() => undefined),
    cancel_now: () => setCancelMode('now'),
    switch_to_free: () => setCancelMode('now'),
    keep_after_trial: () => {
      if (!subscription) return;
      void startPayment({ planId: subscription.planId }, subscription.planId).catch(
        () => undefined
      );
    },
  };

  const tiers = useMemo(
    () =>
      buildPlanTiers(plans, effectiveCurrentPlanId, {
        scheduledPlanId: subscription?.scheduledPlanId ?? null,
        cancelScheduled: subscription?.cancelAtPeriodEnd === true,
        scheduledOnLabel: formatShortManilaDate(
          subscription?.scheduledChangeAt ?? subscription?.currentPeriodEnd
        ),
      }),
    [
      plans,
      effectiveCurrentPlanId,
      subscription?.scheduledPlanId,
      subscription?.cancelAtPeriodEnd,
      subscription?.scheduledChangeAt,
      subscription?.currentPeriodEnd,
    ]
  );
  const hasPlans = plans.length > 0;

  const handleSelectPlan = (plan: OrgBundlePlanDto) => {
    if (!canManageBilling) return;
    const change = resolvePlanChange({ subscription, currentPlan, target: plan });
    if (change.kind === 'sales') {
      if (helpSupportBase) {
        navigate(
          helpSupportNewTicketPath(helpSupportBase, { subject: MANAGED_PLAN_INQUIRY_SUBJECT })
        );
      }
      return;
    }
    if (change.kind === 'same') return;
    if (change.kind === 'cancel') {
      setCancelMode('period_end');
      return;
    }
    if (change.kind === 'cancel_now') {
      setCancelMode('now');
      return;
    }
    // pay, schedule and blocked all open the review dialog (blocked explains why).
    setPendingPlanId(plan.id);
    setReviewOpen(true);
  };

  useEffect(() => {
    if (!plans.length) return;

    const tab = searchParams.get('tab');
    if (tab === 'billing') {
      setActiveTab('billing');
    } else if (tab === 'plans' || tab === 'compare' || tab === 'faqs') {
      setActiveTab(tab);
    }

    if (checkoutReturn === 'success') {
      setActiveTab('billing');
      void refetch();
    }

    const reviewPlanId = searchParams.get('reviewPlan');
    const featureParam = searchParams.get('feature');
    let targetPlanId: string | null = reviewPlanId;

    if (!targetPlanId && featureParam) {
      const minimumPlan = resolveMinimumPlanForFeature(plans, featureParam as PlanFeatureKey);
      targetPlanId = minimumPlan?.id ?? null;
    }

    if (canManageBilling && targetPlanId && plans.some((plan) => plan.id === targetPlanId)) {
      setActiveTab('plans');
      setPendingPlanId(targetPlanId);
      setReviewOpen(true);
    }

    if ((tab || reviewPlanId || featureParam) && !checkoutReturn) {
      setSearchParams({}, { replace: true });
    }
  }, [plans, searchParams, setSearchParams, canManageBilling, checkoutReturn, refetch]);

  const isBootstrapping = orgsLoading || (Boolean(org?.id) && isLoading && !data);

  if (isBootstrapping) {
    return (
      <AdminMobilePage
        title="Plans & Billing"
        subtitle={PLANS_PAGE_SUBTITLE}
        titleId="org-plans-heading"
        dense
        className="min-w-0 max-w-full"
      >
        <PlansPageSkeleton />
      </AdminMobilePage>
    );
  }

  if (!org || error) {
    return (
      <AdminMobilePage title="Plans & Billing" subtitle={PLANS_PAGE_SUBTITLE}>
        <FloatingPanel
          padding="lg"
          className="flex flex-col items-center gap-3 py-8 text-center sm:py-12"
        >
          <p className="text-foreground text-sm font-semibold">Could not load plans</p>
          <p className="text-caption max-w-sm">
            {error instanceof Error ? error.message : 'Please try again.'}
          </p>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </FloatingPanel>
      </AdminMobilePage>
    );
  }

  return (
    <AdminMobilePage
      title="Plans & Billing"
      subtitle={PLANS_PAGE_SUBTITLE}
      titleId="org-plans-heading"
      dense
      className="min-w-0 max-w-full"
    >
      {!hasPlans ? (
        <FloatingPanel padding="lg" className="py-8 text-center sm:py-12">
          <p className="text-foreground text-sm font-semibold">No plans available</p>
          <p className="text-caption mx-auto mt-1 max-w-sm">
            Pricing tiers have not been published yet.
          </p>
        </FloatingPanel>
      ) : (
        <div className="native-stagger flex min-w-0 flex-col gap-4 sm:gap-5">
          <PlanCheckoutConfirmationBanner
            state={checkoutConfirmation}
            pendingCheckoutUrl={data?.pendingCheckoutUrl}
            onResumePayment={canManageBilling ? () => void payNow() : undefined}
          />

          {currentPlan || subscription ? (
            <PlanBillingSummaryCard
              plan={currentPlan}
              subscription={subscription}
              upcomingPayment={data?.upcomingPayment}
              accountCreditPhp={data?.accountCreditPhp ?? 0}
              amountOwedPhp={data?.amountOwedPhp ?? 0}
              canManage={canManageBilling}
              openCheckout={
                data?.pendingCheckoutUrl ? { purpose: data.pendingCheckoutPurpose ?? null } : null
              }
              actions={billingActions}
              isBusy={createCheckout.isPending || changePlan.isPending}
              upgradePlan={upgradeTarget}
              onUpgrade={handleSelectPlan}
              onManagePlans={() => setActiveTab('plans')}
            />
          ) : null}

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as PlansTab)}
            className="min-w-0"
          >
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto p-1 max-lg:h-9 sm:w-auto">
              <TabsTrigger
                value="billing"
                className="gap-2 px-3 py-2 max-lg:gap-1.5 max-lg:px-2.5 max-lg:py-0 max-lg:text-[13px]"
              >
                <Receipt className="size-4 shrink-0" aria-hidden />
                <span>Billing</span>
              </TabsTrigger>
              <TabsTrigger
                value="plans"
                className="gap-2 px-3 py-2 max-lg:gap-1.5 max-lg:px-2.5 max-lg:py-0 max-lg:text-[13px]"
              >
                <LayoutGrid className="size-4 shrink-0" aria-hidden />
                <span>Plans</span>
              </TabsTrigger>
              <TabsTrigger
                value="compare"
                className="gap-2 px-3 py-2 max-lg:gap-1.5 max-lg:px-2.5 max-lg:py-0 max-lg:text-[13px]"
              >
                <FileText className="size-4 shrink-0" aria-hidden />
                <span>Compare</span>
              </TabsTrigger>
              <TabsTrigger
                value="faqs"
                className="gap-2 px-3 py-2 max-lg:gap-1.5 max-lg:px-2.5 max-lg:py-0 max-lg:text-[13px]"
              >
                <HelpCircle className="size-4 shrink-0" aria-hidden />
                <span>FAQs</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="billing"
              className="mt-3 space-y-4"
              aria-labelledby="plans-billing-heading"
            >
              <PlanBillingHistory
                orgId={org.id}
                transactions={history.transactions}
                plans={data?.plans ?? []}
                hasMore={history.hasMore}
                isLoadingMore={history.isLoadingMore}
                onLoadMore={() => void history.loadMore()}
                showIncomplete={history.showIncomplete}
                onShowIncompleteChange={history.setShowIncomplete}
              />
              <OrgBillingDetailsCard
                orgId={org.id}
                details={data?.billingDetails}
                canEdit={canManageBilling}
              />
            </TabsContent>

            <TabsContent value="plans" className="mt-3" aria-labelledby="choose-plan-heading">
              <PlanTierRail
                tiers={tiers}
                hasCurrentPlan={Boolean(effectiveCurrentPlanId)}
                canSelect={canManageBilling}
                onSelectPlan={handleSelectPlan}
              />
            </TabsContent>

            <TabsContent value="compare" className="mt-3" aria-labelledby="plan-compare-heading">
              <PlanFeatureMatrix
                tiers={tiers}
                hasCurrentPlan={Boolean(effectiveCurrentPlanId)}
                canSelect={canManageBilling}
                onSelectPlan={handleSelectPlan}
                showHeading
              />
            </TabsContent>

            <TabsContent value="faqs" className="mt-3" aria-labelledby="plan-faq-heading">
              <PlanFaqSection />
            </TabsContent>
          </Tabs>
        </div>
      )}

      <PlanReviewDialog
        open={reviewOpen && Boolean(selectedPlan)}
        orgId={org.id}
        plan={selectedPlan}
        currentPlan={currentPlan}
        subscription={subscription}
        onOpenChange={setReviewOpen}
        onScheduleDowngrade={async (planId) => {
          await changePlan.mutateAsync({ action: 'schedule_downgrade', planId });
        }}
        onCheckoutPaid={async (request: CheckoutRequest) => {
          await startPayment(
            {
              planId: request.planId,
              expectedChargePhp: request.expectedChargePhp,
              idempotencyKey: request.idempotencyKey,
            },
            request.planId
          );
          setReviewOpen(false);
          setActiveTab('billing');
        }}
        isSubmitting={createCheckout.isPending || changePlan.isPending}
      />

      <PlanCancelDialog
        open={cancelMode !== null}
        orgId={org.id}
        planName={currentPlan ? planDisplayName(currentPlan) : 'plan'}
        losses={cancelLosses}
        mode={cancelMode ?? 'period_end'}
        onOpenChange={(next) => {
          if (!next) setCancelMode(null);
        }}
        onConfirm={async (reason: CancelReason | null) => {
          await changePlan.mutateAsync(
            cancelMode === 'now'
              ? { action: 'cancel_now', reason }
              : { action: 'cancel_at_period_end', reason }
          );
        }}
        isSubmitting={changePlan.isPending}
      />

      <PlanUpgradeSuccessModal
        open={upgradeCelebrationOpen}
        onOpenChange={setUpgradeCelebrationOpen}
        previousPlan={celebrationPreviousPlan}
        targetPlan={celebrationTargetPlan}
        onViewCompare={() => setActiveTab('compare')}
      />
    </AdminMobilePage>
  );
}
