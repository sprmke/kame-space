import { useState } from 'react';

import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { usePublicPricingPlans } from '@/features/guest/marketing/for-hosts/hooks/usePublicPricingPlans';
import {
  V5Heading,
  V5_SECTION_Y,
} from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import { V5PoseStack } from '@/features/guest/marketing/for-hosts/v5/components/V5PoseStack';
import { V5RangeField as RangeField } from '@/features/guest/marketing/for-hosts/v5/components/V5RangeField';
import { V5_PRICING_CTA, v5Fees } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';
import { feeSavings } from '@/features/guest/marketing/for-hosts/v5/lib/feeSavings';

import { discountedPlanPricePhp } from '@/features/dashboard/plans/lib/planPricing';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const { plans, rate: rateRange, nights: nightsRange } = v5Fees;
const POSES = [...plans.map((plan) => plan.pose), v5Fees.lowVolumePose];
const MONTH = Array.from({ length: nightsRange.max }, (_, index) => index);
const EASE = [0.16, 1, 0.3, 1] as const;
const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

/**
 * A per-booking fee next to a flat plan. The host sets a nightly rate and the nights booked
 * direct; the panel shows what a 15.5% fee adds up to, what the plan costs, and how few nights
 * of that fee cover the plan. Plan prices come from the live catalog so they match the pricing
 * page; the amounts that depend on them show a skeleton until it loads.
 */
export function V5Fees() {
  const reduceMotion = usePrefersReducedMotion();
  const { data: catalog, isPending } = usePublicPricingPlans();
  const [planIndex, setPlanIndex] = useState<number>(v5Fees.initialPlan);
  const [rate, setRate] = useState<number>(rateRange.initial);
  const [nights, setNights] = useState<number>(nightsRange.initial);

  const priceOf = (index: number) => {
    const live = catalog?.find((item) => item.code === plans[index].code);
    return live
      ? discountedPlanPricePhp(live.pricePhp, live.discountPercent)
      : plans[index].listPhp;
  };

  const plan = plans[planIndex];
  const planPhp = priceOf(planIndex);
  const { fee, keep, coverNights } = feeSavings({
    rate,
    nights,
    planPhp,
    feePercent: v5Fees.feePercent,
  });
  const ahead = keep > 0;
  const scale = Math.max(fee, planPhp);
  const coverShown = Math.min(coverNights, nights);

  return (
    <section id="savings" className={cn('public-shell scroll-mt-20', V5_SECTION_Y)}>
      <V5Heading title={v5Fees.title} lead={v5Fees.lead} className="max-md:pr-24" />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative mt-7 lg:mt-10"
      >
        <V5PoseStack
          poses={POSES}
          active={!isPending && !ahead ? v5Fees.lowVolumePose : plan.pose}
          className="pointer-events-none absolute -top-[5.25rem] right-4 w-24 sm:-top-24 sm:right-8 sm:w-28 lg:-top-36 lg:right-12 lg:w-44"
        />

        <div className="border-border bg-card relative grid overflow-hidden rounded-[1.75rem] border shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] lg:grid-cols-[1fr_0.9fr]">
          <div className="flex flex-col gap-5 p-5 sm:p-7 lg:gap-6 lg:p-9">
            <div>
              <p id="v5-fee-plan" className="text-foreground text-sm font-medium">
                {v5Fees.planLabel}
              </p>
              <div
                role="group"
                aria-labelledby="v5-fee-plan"
                className="mt-2 grid grid-cols-3 gap-2"
              >
                {plans.map((item, index) => {
                  const selected = index === planIndex;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPlanIndex(index)}
                      className={cn(
                        'focus-visible:ring-ring flex min-h-14 flex-col items-start justify-center rounded-2xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 sm:px-4',
                        selected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background hover:border-primary/40'
                      )}
                    >
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          selected ? 'text-brand-ink' : 'text-foreground'
                        )}
                      >
                        {item.label}
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums sm:text-sm">
                        {isPending ? (
                          <span
                            aria-hidden
                            className="bg-muted my-1 block h-3 w-14 animate-pulse rounded"
                          />
                        ) : (
                          <>
                            {PESO.format(priceOf(index))}
                            {v5Fees.perMonth}
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <RangeField
              id="v5-fee-rate"
              label={rateRange.label}
              display={PESO.format(rate)}
              value={rate}
              min={rateRange.min}
              max={rateRange.max}
              step={rateRange.step}
              onChange={setRate}
            />
            <RangeField
              id="v5-fee-nights"
              label={nightsRange.label}
              display={String(nights)}
              value={nights}
              min={nightsRange.min}
              max={nightsRange.max}
              step={nightsRange.step}
              onChange={setNights}
            />

            <div>
              <div aria-hidden className="flex gap-[3px]">
                {MONTH.map((night) => (
                  <span
                    key={night}
                    className={cn(
                      'h-7 flex-1 rounded-full transition-colors duration-300',
                      night >= nights
                        ? 'bg-muted'
                        : night < coverShown
                          ? 'bg-amber-400'
                          : 'bg-primary-strong'
                    )}
                  />
                ))}
              </div>
              <p className="text-foreground mt-3 min-h-10 text-sm font-medium sm:min-h-0">
                {isPending ? (
                  <span aria-hidden className="bg-muted block h-4 w-56 animate-pulse rounded" />
                ) : coverNights <= nights ? (
                  v5Fees.covers(coverNights, plan.label)
                ) : (
                  v5Fees.paysOffAt(coverNights, plan.label)
                )}
              </p>
            </div>
          </div>

          <div className="bg-primary-strong relative flex flex-col overflow-hidden p-5 text-white max-lg:order-first sm:p-7 lg:p-9">
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -right-24 size-80 rounded-full border-[56px] border-white/5"
            />

            <div className="relative flex flex-col gap-4">
              <FeeBar
                label={v5Fees.feeLabel}
                amount={PESO.format(fee)}
                share={scale > 0 ? fee / scale : 0}
                tone="fee"
              />
              <FeeBar
                label={v5Fees.planRow(plan.label)}
                amount={isPending ? null : PESO.format(planPhp)}
                share={isPending || scale <= 0 ? 0 : planPhp / scale}
                tone="plan"
              />
            </div>

            <div
              aria-live="polite"
              className="relative mt-6 border-t border-white/25 pt-6 lg:mt-auto lg:pt-7"
            >
              <p className="text-sm font-medium">
                {ahead || isPending ? v5Fees.keepLabel : v5Fees.lowVolumeLabel}
              </p>
              <p className="mt-1 text-[2.75rem] font-bold tabular-nums leading-none tracking-[-0.03em] sm:text-6xl">
                {isPending ? (
                  <span
                    aria-hidden
                    className="block h-[1em] w-48 animate-pulse rounded-xl bg-white/25"
                  />
                ) : (
                  PESO.format(Math.abs(keep))
                )}
              </p>
              <p className="mt-3 min-h-6 text-base font-semibold tabular-nums">
                {isPending ? null : ahead ? v5Fees.perYear(PESO.format(keep * 12)) : null}
              </p>
              <p className="mt-1 text-sm">
                {ahead || isPending ? v5Fees.keepTip : v5Fees.lowVolumeTip}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
      <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-muted-foreground text-pretty text-xs sm:text-sm">{v5Fees.note}</p>
        <Link
          to={V5_PRICING_CTA.to}
          className="text-brand-ink focus-visible:ring-ring group inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {V5_PRICING_CTA.label}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </section>
  );
}

function FeeBar({
  label,
  amount,
  share,
  tone,
}: {
  label: string;
  /** `null` while the amount is loading. */
  amount: string | null;
  /** 0 to 1 of the longer bar. */
  share: number;
  tone: 'fee' | 'plan';
}) {
  return (
    <div>
      <p className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xl font-bold tabular-nums sm:text-2xl">
          {amount ?? (
            <span aria-hidden className="block h-6 w-20 animate-pulse rounded-md bg-white/25" />
          )}
        </span>
      </p>
      <div aria-hidden className="mt-2 h-3 overflow-hidden rounded-full bg-white/15">
        <div
          className={cn(
            'h-full min-w-3 rounded-full transition-[width] duration-300 ease-out',
            tone === 'fee' ? 'bg-amber-300' : 'bg-white'
          )}
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>
    </div>
  );
}
