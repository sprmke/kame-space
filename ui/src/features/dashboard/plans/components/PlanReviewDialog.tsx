import { useEffect, useRef, useState } from 'react';

import { AlertTriangle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

import { PlanChangeList } from '@/features/dashboard/plans/components/PlanChangeList';
import { PlanTierIconWell } from '@/features/dashboard/plans/components/PlanTierIconWell';
import {
  usePayPlanPreview,
  useSchedulePlanPreview,
} from '@/features/dashboard/plans/hooks/useOrgPlan';
import { resolvePlanChange } from '@/features/dashboard/plans/lib/billingState';
import {
  OrgBillingApiError,
  type OrgBundlePlanDto,
  type OrgSubscriptionDto,
  type PayPlanPreview,
  type SchedulePlanPreview,
} from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  PESO_WHOLE,
  planDisplayName,
  planFeatureGains,
  planFeatureLosses,
} from '@/features/dashboard/plans/lib/planPresentation';

import { PlanBillingLegalNotice } from '@/components/legal/LegalNoticePresets';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';
import { formatManilaLongDate } from '@/utils/format/dates';

export type CheckoutRequest = {
  planId: string;
  /** The amount shown on screen. The server refuses a higher fresh amount. */
  expectedChargePhp: number;
  idempotencyKey: string;
};

type PlanReviewDialogProps = {
  open: boolean;
  orgId: string | null;
  /** The plan being reviewed. */
  plan: OrgBundlePlanDto | null;
  currentPlan: OrgBundlePlanDto | null;
  subscription?: OrgSubscriptionDto | null;
  onOpenChange: (open: boolean) => void;
  /** Starts a payment (PayMongo, or applies straight away when account credit covers it). */
  onCheckoutPaid: (request: CheckoutRequest) => Promise<void>;
  /** Schedules a downgrade for the end of the period. No payment. */
  onScheduleDowngrade: (planId: string) => Promise<void>;
  isSubmitting: boolean;
};

function PlanStub({
  plan,
  priceLabel,
  muted,
}: {
  plan: OrgBundlePlanDto;
  priceLabel: string | null;
  muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PlanTierIconWell planCode={plan.code} size="sm" muted={muted} />
      <div className="min-w-0">
        <p
          className={cn(
            'truncate text-sm font-semibold',
            muted ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {planDisplayName(plan)}
        </p>
        {priceLabel ? (
          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">{priceLabel}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Circular chip. Downgrade ← (toward the new plan on the left). Upgrade → (toward the new plan on the right). */
function PlanCompareArrow({ direction }: { direction: 'forward' | 'back' }) {
  const Icon = direction === 'back' ? ArrowLeft : ArrowRight;
  return (
    <span
      className="border-border bg-background text-foreground flex size-8 shrink-0 items-center justify-center rounded-full border shadow-sm"
      aria-hidden
    >
      <Icon className="size-3.5" strokeWidth={2.25} />
    </span>
  );
}

function QuoteLines({ preview }: { preview: PayPlanPreview }) {
  return (
    <div className="border-border space-y-1.5 rounded-xl border p-3 text-sm">
      {(preview.lineItems ?? []).map((line, index) => (
        <div key={`${line.kind}-${index}`} className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">{line.label}</span>
          <span className="shrink-0 tabular-nums">
            {line.amountPhp < 0 ? '−' : ''}
            {PESO_WHOLE.format(Math.abs(line.amountPhp))}
          </span>
        </div>
      ))}
      <div className="border-border flex items-center justify-between gap-3 border-t pt-1.5 font-semibold">
        <span>{preview.coveredByCredit ? 'Paid with account credit' : 'Due today'}</span>
        <span className="tabular-nums">{PESO_WHOLE.format(preview.chargePhp)}</span>
      </div>
    </div>
  );
}

function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PlanReviewDialog({
  open,
  orgId,
  plan,
  currentPlan,
  subscription,
  onOpenChange,
  onCheckoutPaid,
  onScheduleDowngrade,
  isSubmitting,
}: PlanReviewDialogProps) {
  const idempotencyKey = useRef(newIdempotencyKey());
  const [priceNotice, setPriceNotice] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      idempotencyKey.current = newIdempotencyKey();
      setPriceNotice(null);
    }
  }, [open, plan?.id]);

  const change =
    plan && open
      ? resolvePlanChange({ subscription: subscription ?? null, currentPlan, target: plan })
      : null;
  const kind = change?.kind ?? null;
  const isPay = kind === 'pay';
  const isSchedule = kind === 'schedule';
  const blockedReason =
    change?.kind === 'blocked'
      ? change.reason
      : change?.kind === 'same'
        ? 'You are already on this plan.'
        : change && !isPay && !isSchedule
          ? 'Use the options on Plans & Billing for this change.'
          : null;

  const payPreview = usePayPlanPreview(orgId, plan?.id ?? null, open && isPay);
  const schedulePreview = useSchedulePlanPreview(
    orgId,
    'schedule',
    plan?.id ?? null,
    open && isSchedule
  );

  if (!plan) return null;

  const gains = isPay ? planFeatureGains(currentPlan?.features ?? null, plan.features) : [];
  const losses =
    currentPlan && (isSchedule || isPay)
      ? planFeatureLosses(currentPlan.features, plan.features)
      : [];
  const planTitle = planDisplayName(plan);
  const pay = payPreview.data;
  const schedule: SchedulePlanPreview | undefined = schedulePreview.data;
  const effectiveDate = schedule ? formatManilaLongDate(schedule.effectiveAt) : null;

  const activePreview = isPay ? payPreview : isSchedule ? schedulePreview : null;
  const previewError = activePreview?.error instanceof Error ? activePreview.error.message : null;
  const loading = Boolean(activePreview?.isLoading || activePreview?.isFetching);

  const title = isSchedule
    ? `Downgrade to ${planTitle}`
    : pay?.purpose === 'renewal' || pay?.purpose === 'retry'
      ? `Pay for ${planTitle}`
      : pay?.purpose === 'reactivation'
        ? `Turn ${planTitle} back on`
        : !currentPlan
          ? `Choose ${planTitle}`
          : `Upgrade to ${planTitle}`;

  const description = blockedReason
    ? blockedReason
    : isSchedule
      ? effectiveDate
        ? `Takes effect on ${effectiveDate}. You keep ${currentPlan ? planDisplayName(currentPlan) : 'your plan'} until then.`
        : 'Takes effect at the end of your billing period.'
      : pay?.coveredByCredit
        ? 'Your account credit covers this. Nothing to pay today.'
        : pay?.startsNewPeriod && subscription
          ? 'You are changing mid-period. Unused time on your current plan is credited.'
          : 'Review what changes before you continue.';

  const confirmDisabled =
    isSubmitting ||
    Boolean(blockedReason) ||
    loading ||
    Boolean(previewError) ||
    (isPay && !pay) ||
    (isSchedule && !schedule);

  const handleConfirm = async () => {
    setPriceNotice(null);
    try {
      if (isSchedule) {
        await onScheduleDowngrade(plan.id);
        onOpenChange(false);
        return;
      }
      if (!pay) return;
      await onCheckoutPaid({
        planId: plan.id,
        expectedChargePhp: pay.chargePhp,
        idempotencyKey: idempotencyKey.current,
      });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof OrgBillingApiError && err.code === 'price_changed') {
        setPriceNotice(
          err.freshChargePhp != null
            ? `The price changed to ${PESO_WHOLE.format(err.freshChargePhp)}. Review it and confirm again.`
            : 'The price changed. Review it and confirm again.'
        );
        void payPreview.refetch();
      }
      // Other errors already toast from the mutation; the dialog stays open to retry.
    }
  };

  const primaryLabel = isSchedule
    ? effectiveDate
      ? `Switch on ${effectiveDate}`
      : 'Schedule change'
    : pay?.coveredByCredit
      ? 'Apply with credit'
      : 'Continue to payment';

  const currentTotalLabel =
    subscription?.pricePhpSnapshot != null && subscription.pricePhpSnapshot > 0
      ? `${PESO_WHOLE.format(subscription.pricePhpSnapshot)}/month`
      : null;
  const targetMonthly = isSchedule
    ? schedule?.nextRenewalPhp
    : (pay?.nextRenewalPhp ?? pay?.targetTotalPhp);
  const targetLabel =
    targetMonthly != null && targetMonthly > 0 ? `${PESO_WHOLE.format(targetMonthly)}/month` : null;
  const propertyCount = isSchedule ? (schedule?.propertyCount ?? 0) : (pay?.propertyCount ?? 0);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        /* Above other dialogs (e.g. Generate calendar) so the modal-scrim blurs them too. */
        overlayClassName="z-[110]"
        className={cn(
          'z-[111] flex max-h-[min(90dvh,42rem)] w-[min(calc(100vw-1.5rem),28rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
          'sm:max-w-[28rem] sm:p-0'
        )}
        aria-describedby="plan-review-description"
      >
        <ResponsiveModalHeader className="border-border shrink-0 space-y-1 border-b px-4 pb-3 pr-14 pt-5 text-left sm:px-5">
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          <ResponsiveModalDescription id="plan-review-description">
            {description}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5"
          aria-busy={loading}
        >
          <div className="space-y-5">
            {currentPlan && !currentPlan.isDefault && currentPlan.id !== plan.id ? (
              <div
                className="border-border bg-muted/30 rounded-xl border p-3"
                aria-label={
                  isSchedule
                    ? `Downgrade to ${planTitle} from ${planDisplayName(currentPlan)}`
                    : `Upgrade from ${planDisplayName(currentPlan)} to ${planTitle}`
                }
              >
                <div className="flex items-center justify-between gap-3">
                  {isSchedule ? (
                    <>
                      <div className="min-w-0">
                        <PlanStub plan={plan} priceLabel={targetLabel} />
                      </div>
                      <PlanCompareArrow direction="back" />
                      <div className="min-w-0">
                        <PlanStub plan={currentPlan} priceLabel={currentTotalLabel} muted />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <PlanStub plan={currentPlan} priceLabel={currentTotalLabel} muted />
                      </div>
                      <PlanCompareArrow direction="forward" />
                      <div className="min-w-0">
                        <PlanStub plan={plan} priceLabel={targetLabel} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-border bg-muted/30 rounded-xl border p-3">
                <PlanStub plan={plan} priceLabel={targetLabel} />
              </div>
            )}

            {propertyCount > 0 ? (
              <p className="text-muted-foreground text-xs">
                Billing covers all {propertyCount} {propertyCount === 1 ? 'property' : 'properties'}{' '}
                in your organization.
              </p>
            ) : null}

            {priceNotice ? (
              <div
                role="alert"
                className="border-warning/40 bg-warning/10 flex items-start gap-2 rounded-xl border p-3 text-sm"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{priceNotice}</span>
              </div>
            ) : null}

            {loading && !pay && !schedule ? (
              <div className="space-y-2" aria-hidden>
                <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
                <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
                <div className="bg-muted h-10 w-full animate-pulse rounded-xl" />
              </div>
            ) : null}

            {previewError ? (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-3 text-sm"
              >
                {previewError}
              </div>
            ) : null}

            {isPay && pay ? <QuoteLines preview={pay} /> : null}

            {isPay && pay ? (
              <p className="text-muted-foreground text-xs">
                {pay.startsNewPeriod
                  ? `Your new billing period runs to ${formatManilaLongDate(pay.periodEnd)}.`
                  : `This pays the period ending ${formatManilaLongDate(pay.periodEnd)}.`}{' '}
                Renews at {PESO_WHOLE.format(pay.nextRenewalPhp)}/month.
              </p>
            ) : null}

            {isSchedule && schedule ? (
              <p className="text-muted-foreground text-xs">
                From {effectiveDate} you pay {PESO_WHOLE.format(schedule.nextRenewalPhp)}/month.
                Nothing is charged or turned off today.
              </p>
            ) : null}

            {isPay && gains.length === 0 && losses.length === 0 && pay ? (
              <p className="text-muted-foreground text-sm">
                Same features as your current plan. Only the monthly price changes.
              </p>
            ) : (
              <div className="space-y-5">
                <PlanChangeList title="Unlocks" items={gains} tone="gain" />
                <PlanChangeList
                  title={isSchedule && effectiveDate ? `Turns off on ${effectiveDate}` : 'Removes'}
                  items={losses}
                  tone="loss"
                />
              </div>
            )}

            {isSchedule && schedule && schedule.impact.length > 0 ? (
              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  What this affects
                </p>
                <ul className="mt-2 space-y-2.5">
                  {schedule.impact.map((item) => (
                    <li key={item.key} className="text-sm leading-relaxed">
                      <span className="text-foreground font-medium">{item.label}.</span>{' '}
                      <span className="text-muted-foreground">{item.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <PlanBillingLegalNotice kind={isSchedule ? 'downgrade' : 'checkout'} />
          </div>
        </div>

        <ResponsiveModalFooter className="border-border shrink-0 gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => onOpenChange(false)}
          >
            {blockedReason ? 'Close' : 'Cancel'}
          </Button>
          {blockedReason ? null : (
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={confirmDisabled}
              onClick={handleConfirm}
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {primaryLabel}
            </Button>
          )}
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
