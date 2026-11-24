import { useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';

import { usePublicPricingPlans } from '@/features/guest/marketing/for-hosts/hooks/usePublicPricingPlans';
import {
  V5Heading,
  V5_SECTION_Y,
} from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import { V5RangeField } from '@/features/guest/marketing/for-hosts/v5/components/V5RangeField';
import {
  V5_PRICING_CTA,
  v5BookingFees,
} from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';
import { nightFeeComparison } from '@/features/guest/marketing/for-hosts/v5/lib/feeSavings';

import { discountedPlanPricePhp } from '@/features/dashboard/plans/lib/planPricing';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const copy = v5BookingFees;
const { plan, rate: rateRange, nights: nightsRange } = copy;
const EASE = [0.16, 1, 0.3, 1] as const;
const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});
const MINUS = '−';
const CARD_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-strong';

/**
 * Airbnb's per-booking fee next to the flat Pro plan, counted in nights. The host sets a
 * nightly rate and adds or taps away one card per night booked; the panel answers how many
 * nights of fee pay for Pro, then shows what the host gets on each side and the difference.
 * Pro's price comes from the live catalog so it matches the pricing page; figures that depend
 * on it show a skeleton until it loads. Trial replacement for `V5Fees`.
 */
export function V5BookingFees() {
  const reduceMotion = usePrefersReducedMotion();
  const { data: catalog, isPending } = usePublicPricingPlans();
  const [rate, setRate] = useState<number>(rateRange.initial);
  // Stable ids so the tapped card is the one that leaves.
  const [nights, setNights] = useState<number[]>(() =>
    Array.from({ length: nightsRange.initial }, (_, index) => index)
  );
  const nextId = useRef<number>(nightsRange.initial);

  const live = catalog?.find((item) => item.code === plan.code);
  const planPhp = live ? discountedPlanPricePhp(live.pricePhp, live.discountPercent) : plan.listPhp;
  const { feePerNight, gross, fee, feeNet, planNet, save, coverNights } = nightFeeComparison({
    rate,
    nights: nights.length,
    planPhp,
    feePercent: copy.feePercent,
  });
  const ahead = save > 0;
  const canRemove = nights.length > nightsRange.min;
  const canAdd = nights.length < nightsRange.max;

  const addNight = () => {
    if (!canAdd) return;
    // Read the id now: the updater can run later or twice.
    const id = nextId.current;
    nextId.current += 1;
    setNights((current) => (current.length >= nightsRange.max ? current : [...current, id]));
  };
  const removeNight = (id: number) => {
    if (!canRemove) return;
    setNights((current) =>
      current.length > nightsRange.min ? current.filter((item) => item !== id) : current
    );
  };

  const skeleton = (className: string) => (
    <span aria-hidden className={cn('block animate-pulse rounded-md bg-white/25', className)} />
  );
  const cardMotion = reduceMotion
    ? {}
    : {
        layout: true,
        initial: { opacity: 0, scale: 0.85 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.85, pointerEvents: 'none' as const },
        transition: { duration: 0.25, ease: EASE },
      };

  return (
    <section id="savings" className={cn('public-shell scroll-mt-20', V5_SECTION_Y)}>
      <V5Heading title={copy.title} lead={copy.lead} />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="border-border bg-card relative mt-7 overflow-hidden rounded-[1.75rem] border shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] lg:mt-10"
      >
        <div className="p-5 sm:p-7">
          <div className="mx-auto w-full max-w-xl">
            <V5RangeField
              id="v5-booking-fee-rate"
              label={rateRange.label}
              display={PESO.format(rate)}
              suffix={copy.perNight}
              valueText={copy.perNightText(PESO.format(rate))}
              value={rate}
              min={rateRange.min}
              max={rateRange.max}
              step={rateRange.step}
              onChange={setRate}
            />
          </div>
        </div>

        <div className="bg-primary-strong relative grid gap-8 overflow-hidden p-5 text-white sm:p-7 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:p-9">
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -right-24 size-80 rounded-full border-[56px] border-white/5"
          />

          <div className="relative">
            <p
              aria-live="polite"
              className="text-balance text-2xl font-bold leading-tight tracking-[-0.02em] sm:text-3xl lg:text-[2.25rem]"
            >
              {isPending ? skeleton('h-[1.1em] w-64') : copy.pays(coverNights, plan.label)}
            </p>

            <div className="mt-6 flex items-baseline justify-between gap-4">
              <p id="v5-booking-fee-nights" className="text-sm font-medium">
                {copy.nightsLabel}
              </p>
              <p className="text-lg font-bold tabular-nums">{nights.length}</p>
            </div>
            <ul
              aria-labelledby="v5-booking-fee-nights"
              className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {nights.map((id, index) => {
                  const covers = !isPending && index < coverNights;
                  const amount = (
                    <span className="block text-sm font-bold tabular-nums sm:text-base">
                      {PESO.format(feePerNight)}
                    </span>
                  );
                  // Nights that pay for the plan stay put; only the nights you keep can go.
                  return (
                    <motion.li key={id} {...cardMotion}>
                      {covers ? (
                        <div className="flex min-h-14 w-full flex-col items-start justify-center rounded-xl bg-amber-300 px-3 py-2 text-amber-950 transition-colors duration-300">
                          {amount}
                          <span className="block min-h-4 text-xs font-medium">
                            {copy.chipCovers(plan.label)}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!canRemove}
                          onClick={() => removeNight(id)}
                          className={cn(
                            'flex min-h-14 w-full flex-col items-start justify-center rounded-xl border border-white/40 px-3 py-2 text-left text-white transition-colors duration-300 enabled:hover:bg-white/10 disabled:cursor-default',
                            CARD_FOCUS
                          )}
                        >
                          <span className="sr-only">{copy.removeNight(index + 1)}: </span>
                          {amount}
                          <span className="block min-h-4 text-xs font-medium">
                            {isPending ? null : copy.chipKeep}
                          </span>
                        </button>
                      )}
                    </motion.li>
                  );
                })}
                {canAdd ? (
                  <motion.li key="add" {...cardMotion}>
                    <button
                      type="button"
                      onClick={addNight}
                      className={cn(
                        'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-xl border border-dashed border-white/60 px-2 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/10 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm',
                        CARD_FOCUS
                      )}
                    >
                      <Plus className="size-4" aria-hidden />
                      {copy.addNight}
                    </button>
                  </motion.li>
                ) : null}
              </AnimatePresence>
            </ul>
          </div>

          <div className="relative flex flex-col">
            {/* Phones: labels stay on one line and the figures scale with the width, so even
                six-digit totals fit beside them. */}
            <table className="mb-7 w-full text-left text-sm tabular-nums">
              <thead>
                <tr className="border-b border-white/25">
                  <td className="pb-2" />
                  <th scope="col" className="pb-2 text-right font-medium">
                    {copy.airbnb}
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap pb-2 pl-3 text-right font-medium sm:pl-4"
                  >
                    {copy.kame(plan.label)}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/15">
                  <th scope="row" className="whitespace-nowrap py-3 pr-2 font-medium">
                    {copy.guestsPay}
                  </th>
                  <td className="py-3 text-right text-[clamp(0.8125rem,3.9vw,1rem)] font-semibold sm:text-base">
                    {PESO.format(gross)}
                  </td>
                  <td className="py-3 pl-3 text-right text-[clamp(0.8125rem,3.9vw,1rem)] font-semibold sm:pl-4 sm:text-base">
                    {PESO.format(gross)}
                  </td>
                </tr>
                <tr className="border-b border-white/25">
                  <th scope="row" className="whitespace-nowrap py-3 pr-2 font-medium">
                    {copy.fees}
                  </th>
                  <td className="py-3 text-right text-[clamp(0.8125rem,3.9vw,1rem)] font-semibold sm:text-base">
                    {MINUS}
                    {PESO.format(fee)}
                  </td>
                  <td className="py-3 pl-3 text-right text-[clamp(0.8125rem,3.9vw,1rem)] font-semibold sm:pl-4 sm:text-base">
                    {isPending ? skeleton('ml-auto h-5 w-14') : `${MINUS}${PESO.format(planPhp)}`}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="whitespace-nowrap pr-2 pt-3 font-semibold">
                    {copy.youGet}
                  </th>
                  <td className="pt-3 text-right text-[clamp(0.9375rem,4.6vw,1.25rem)] font-bold sm:text-2xl">
                    {PESO.format(feeNet)}
                  </td>
                  <td className="pl-3 pt-3 text-right text-[clamp(0.9375rem,4.6vw,1.25rem)] font-bold sm:pl-4 sm:text-2xl">
                    {isPending ? skeleton('ml-auto h-7 w-20') : PESO.format(planNet)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Wraps instead of squeezing: when the amount and the button do not fit on one line, the
                button drops below; the amount and its unit never break apart. */}
            <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-4 rounded-2xl bg-black/15 p-4 sm:p-5 lg:mt-auto">
              <div aria-live="polite">
                <p className="text-sm font-medium">
                  {ahead || isPending
                    ? copy.saveLabel(plan.label)
                    : copy.lowVolumeLabel(plan.label)}
                </p>
                <div className="mt-1 flex items-baseline gap-1 whitespace-nowrap font-bold tabular-nums">
                  {isPending ? (
                    skeleton('h-10 w-40 rounded-xl')
                  ) : (
                    <>
                      <span className="text-[clamp(2rem,9vw,2.5rem)] leading-none tracking-[-0.03em] sm:text-5xl">
                        {PESO.format(Math.abs(save))}
                      </span>
                      {ahead ? <span className="text-base">{copy.perMonth}</span> : null}
                    </>
                  )}
                </div>
                {!isPending && !ahead ? (
                  <p className="mt-2 text-sm font-semibold">{copy.lowVolumeTip}</p>
                ) : null}
              </div>
              <Link
                to={V5_PRICING_CTA.to}
                className={cn(
                  'group inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-5 text-sm font-semibold text-[hsl(168_65%_20%)] shadow-sm transition-colors hover:bg-white/90',
                  CARD_FOCUS
                )}
              >
                {V5_PRICING_CTA.label}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
