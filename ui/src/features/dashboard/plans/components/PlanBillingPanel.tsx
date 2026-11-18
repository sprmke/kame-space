import {
  ArrowRight,
  ArrowUpRight,
  Info,
  Loader2,
  Receipt,
  Settings,
  WalletCards,
} from 'lucide-react';

import { OrgPlanTransactions } from '@/features/dashboard/plans/components/OrgPlanTransactions';
import { PlanTierIconWell } from '@/features/dashboard/plans/components/PlanTierIconWell';
import {
  describeBillingState,
  type BillingStripAction,
  type BillingTone,
} from '@/features/dashboard/plans/lib/billingState';
import type {
  OrgBundlePlanDto,
  OrgPaymentTransactionDto,
  OrgSubscriptionDto,
  OrgUpcomingPaymentDto,
} from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  planDisplayName,
  planDisplayNameFromSubscription,
  planPrice,
  PLANS_TAB_SECTION_TITLES,
  planTabCardHeadingClass,
  upgradeBannerActionLabel,
} from '@/features/dashboard/plans/lib/planPresentation';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatMoneyCompact } from '@/utils/format/currency';
import { formatManilaLongDate } from '@/utils/format/dates';

const BILLING_ALERT_ROW =
  'mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3';

const STRIP_TONE: Record<BillingTone, { border: string; text: string; dot: string }> = {
  danger: { border: 'border-destructive/25', text: 'text-destructive', dot: 'bg-current' },
  warning: { border: 'border-warning/40', text: 'text-foreground', dot: 'bg-warning' },
  info: { border: 'border-primary/15', text: 'text-muted-foreground', dot: 'bg-primary' },
  neutral: { border: 'border-border', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

export type PlanBillingActions = Partial<Record<BillingStripAction, () => void>>;

type PlanBillingSummaryProps = {
  plan: OrgBundlePlanDto | null;
  subscription: OrgSubscriptionDto | null;
  upcomingPayment?: OrgUpcomingPaymentDto | null;
  accountCreditPhp?: number;
  amountOwedPhp?: number;
  canManage?: boolean;
  /** An unpaid PayMongo checkout exists for this org. */
  openCheckout?: { purpose: string | null } | null;
  /** Strip actions the page wires up (pay, keep, resume, cancel, ...). */
  actions?: PlanBillingActions;
  /** A billing request is in flight: disable the strip actions. */
  isBusy?: boolean;
  upgradePlan?: OrgBundlePlanDto | null;
  onManagePlans?: () => void;
  onUpgrade?: (plan: OrgBundlePlanDto) => void;
};

function BillingEmptyState() {
  return (
    <FloatingPanel as="section" padding="lg" aria-labelledby="plans-billing-heading">
      <h2 id="plans-billing-heading" className={planTabCardHeadingClass}>
        {PLANS_TAB_SECTION_TITLES.billing}
      </h2>
      <div className="flex flex-col items-center gap-3 px-2 py-8 text-center sm:py-12">
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <Receipt className="text-muted-foreground size-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-foreground text-sm font-semibold">No payments yet</p>
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            Paid plan charges will appear here after checkout.
          </p>
        </div>
      </div>
    </FloatingPanel>
  );
}

function resolveBillingPrice(
  plan: OrgBundlePlanDto | null,
  subscription: OrgSubscriptionDto | null
) {
  if (plan) {
    return planPrice(
      subscription?.pricePhpSnapshot != null && subscription.pricePhpSnapshot > 0
        ? { ...plan, chargedPricePhp: subscription.pricePhpSnapshot }
        : plan
    );
  }

  if (!subscription) return null;

  return planPrice({
    isDefault: (subscription.pricePhpSnapshot ?? 0) <= 0,
    pricePhp: subscription.pricePhpSnapshot ?? 0,
    pricingModel: subscription.pricingModel ?? 'subscription',
    code: subscription.planCode ?? '',
    discountPercent: 0,
  });
}

/** Label and style of each strip action. The page decides what each one does. */
function actionConfig(
  action: BillingStripAction,
  planName: string,
  renewalReady: boolean,
  waiting: boolean
): { label: string; variant: 'default' | 'outline' | 'ghost'; showArrow?: boolean } {
  switch (action) {
    case 'pay_now':
      return {
        label: renewalReady ? 'Pay renewal' : waiting ? 'Resume payment' : 'Pay now',
        variant: 'default',
        showArrow: true,
      };
    case 'keep_plan':
      return { label: `Keep ${planName}`, variant: 'outline' };
    case 'resume_plan':
      return { label: 'Resume plan', variant: 'outline' };
    case 'keep_after_trial':
      return { label: `Keep ${planName}`, variant: 'default', showArrow: true };
    case 'cancel_now':
      return { label: 'Cancel plan', variant: 'ghost' };
    case 'switch_to_free':
      return { label: 'Switch to Free', variant: 'ghost' };
  }
}

/** Subscription summary — pinned above Plans tabs (tab label covers section context). */
export function PlanBillingSummaryCard({
  plan,
  subscription,
  upcomingPayment,
  accountCreditPhp = 0,
  amountOwedPhp = 0,
  canManage = false,
  openCheckout = null,
  actions = {},
  isBusy = false,
  upgradePlan,
  onManagePlans,
  onUpgrade,
}: PlanBillingSummaryProps) {
  if (!plan && !subscription) return null;

  const name = plan ? planDisplayName(plan) : planDisplayNameFromSubscription(subscription);
  const price = resolveBillingPrice(plan, subscription);
  const state = describeBillingState({
    subscription,
    upcoming: upcomingPayment,
    openCheckout,
    canManage,
    formatDate: formatManilaLongDate,
    formatPhp: formatMoneyCompact,
  });
  const periodStart = subscription?.currentPeriodStart
    ? formatManilaLongDate(subscription.currentPeriodStart)
    : null;
  const showActions = canManage && (Boolean(onManagePlans) || (upgradePlan && onUpgrade));
  const strip = state.strip;
  const stripStyle = strip ? STRIP_TONE[strip.tone] : null;
  const renewalReady = state.key === 'renewal_ready';
  const waiting = state.key === 'payment_waiting';

  return (
    <section
      className="surface-card min-w-0 p-3 sm:p-3.5"
      aria-labelledby="billing-summary-heading"
    >
      <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <PlanTierIconWell planCode={plan?.code ?? subscription?.planCode ?? 'free'} size="sm" />

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <p id="billing-summary-heading" className="text-card-title truncate">
                {name} plan
              </p>
              <Badge
                variant={state.badgeTone}
                className="h-5 shrink-0 px-1.5 text-[10px] leading-none"
              >
                {state.badge}
              </Badge>
              {accountCreditPhp > 0 ? (
                <Badge
                  variant="secondary"
                  className="h-5 shrink-0 gap-1 px-1.5 text-[10px] leading-none"
                  title="Comes off your next payment. It is never paid out as cash."
                >
                  <WalletCards className="size-3" aria-hidden />
                  {formatMoneyCompact(accountCreditPhp)} credit
                </Badge>
              ) : null}
            </div>

            {price ? (
              <p className="text-stat-value mt-0.5 truncate tabular-nums">
                {price.amount}
                {price.suffix ? (
                  <span className="text-muted-foreground ml-1 text-xs font-medium sm:text-sm">
                    {price.suffix}
                  </span>
                ) : null}
              </p>
            ) : null}

            {state.periodLine ? (
              <p className="text-meta mt-0.5 line-clamp-2 sm:line-clamp-1">
                <span className="tabular-nums">{state.periodLine}</span>
                {periodStart && state.key === 'active' ? (
                  <span className="text-muted-foreground/80"> · Since {periodStart}</span>
                ) : null}
              </p>
            ) : null}

            {amountOwedPhp > 0 ? (
              <p className="text-meta mt-0.5">
                {formatMoneyCompact(amountOwedPhp)} for new properties is added to your next
                payment.
              </p>
            ) : null}
          </div>
        </div>

        {showActions ? (
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {onManagePlans ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] shrink-0 px-2.5 sm:px-3"
                onClick={onManagePlans}
              >
                <Settings className="size-4 shrink-0" aria-hidden />
                <span className="max-sm:hidden">Manage subscription</span>
                <span className="sm:hidden">Manage</span>
              </Button>
            ) : null}
            {upgradePlan && onUpgrade ? (
              <Button
                type="button"
                size="sm"
                className="min-h-[44px] shrink-0 px-2.5 sm:px-3"
                onClick={() => onUpgrade(upgradePlan)}
              >
                <ArrowUpRight className="size-4 shrink-0" aria-hidden />
                <span className="sm:hidden">Upgrade</span>
                <span className="hidden sm:inline">{upgradeBannerActionLabel(upgradePlan)}</span>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {strip && stripStyle ? (
        <div className={cn(BILLING_ALERT_ROW, stripStyle.border)}>
          <p className={cn('flex items-start gap-2 text-xs sm:text-sm', stripStyle.text)}>
            <span
              className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', stripStyle.dot)}
              aria-hidden
            />
            {strip.message}
          </p>
          {strip.actions.length > 0 ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {strip.actions.map((action) => {
                const handler = actions[action];
                if (!handler) return null;
                const config = actionConfig(action, name, renewalReady, waiting);
                return (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant={config.variant}
                    className="min-h-[44px] shrink-0"
                    disabled={isBusy}
                    onClick={handler}
                  >
                    {isBusy && config.variant === 'default' ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : null}
                    {config.label}
                    {config.showArrow && !isBusy ? (
                      <ArrowRight className="size-4" aria-hidden />
                    ) : null}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {state.readOnlyNote && subscription ? (
        <p className="text-meta mt-3 flex items-start gap-2 border-t pt-3">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {state.readOnlyNote}
        </p>
      ) : null}
    </section>
  );
}

type PlanBillingHistoryProps = {
  orgId: string | null;
  transactions: OrgPaymentTransactionDto[];
  plans?: OrgBundlePlanDto[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  showIncomplete?: boolean;
  onShowIncompleteChange?: (next: boolean) => void;
};

/** Billing tab body — payment history below the pinned summary card. */
export function PlanBillingHistory({ transactions, ...rest }: PlanBillingHistoryProps) {
  if (transactions.length > 0 || rest.showIncomplete) {
    return <OrgPlanTransactions transactions={transactions} {...rest} />;
  }

  return <BillingEmptyState />;
}
