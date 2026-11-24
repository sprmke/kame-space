import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, motion, useInView } from 'framer-motion';
import {
  Bot,
  CalendarDays,
  Check,
  Facebook,
  Film,
  Globe,
  Image as ImageIcon,
  Instagram,
  Play,
  Receipt,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { usePublicPricingPlans } from '@/features/guest/marketing/for-hosts/hooks/usePublicPricingPlans';
import { v3Images } from '@/features/guest/marketing/for-hosts/shared/hostDemoData';
import { Pill } from '@/features/guest/marketing/for-hosts/shared/Pill';
import { v5BookingFees, v5Hero } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';
import { nightFeeComparison } from '@/features/guest/marketing/for-hosts/v5/lib/feeSavings';
import { MarketingImage } from '@/features/guest/marketing/shared/components/MarketingImage';

import { discountedPlanPricePhp } from '@/features/dashboard/plans/lib/planPricing';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const { ai, studio, inbox, fee } = v5Hero.cards;

const CHANNELS: Record<
  (typeof inbox.channels)[number]['id'],
  { icon: LucideIcon; className: string }
> = {
  web: { icon: Globe, className: 'bg-primary-strong text-white' },
  facebook: { icon: Facebook, className: 'bg-[#1877F2] text-white' },
  instagram: {
    icon: Instagram,
    className: 'bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white',
  },
};

const AI_ITEM_ICONS: Record<(typeof ai.items)[number]['id'], LucideIcon> = {
  maintenance: Wrench,
  finance: Receipt,
};

type StudioSceneId = (typeof studio.scenes)[number]['id'];
const STUDIO_ICONS: Record<StudioSceneId, LucideIcon> = {
  post: ImageIcon,
  video: Film,
  calendar: CalendarDays,
  ai: Sparkles,
};
/** How long each studio scene plays before the next one. */
const STUDIO_SCENE_MS = 2800;
const EASE = [0.16, 1, 0.3, 1] as const;

/** Four weeks of a sample month: `open` nights pop in, the rest are booked. */
const CALENDAR_OPEN = new Set([3, 4, 10, 11, 12, 18, 24, 25]);
const CALENDAR_CELLS = Array.from({ length: 28 }, (_, index) => index);

const peso = (amount: number) => `₱${amount.toLocaleString('en-PH')}`;

/** Small product panels that float around the hero mascot, one per core feature. Sample data. */

export function HeroAskCard() {
  return (
    <>
      <Pill tone="teal">
        <Sparkles className="h-3 w-3" aria-hidden />
        {ai.tag}
      </Pill>
      <p className="bg-muted text-foreground ml-auto mt-2.5 w-fit max-w-[90%] rounded-2xl rounded-br-md px-2.5 py-1.5 text-[11px] font-medium leading-snug">
        {ai.question}
      </p>
      <ul className="mt-2 space-y-1">
        {ai.items.map((item) => {
          const Icon = AI_ITEM_ICONS[item.id];
          return (
            <li
              key={item.id}
              className="border-border bg-background flex items-center gap-1.5 rounded-lg border px-2 py-1"
            >
              <Icon className="text-brand-ink h-3 w-3 shrink-0" aria-hidden />
              <span className="text-foreground text-[11px] font-semibold">{item.module}</span>
              <span className="text-muted-foreground ml-auto truncate text-[10px] tabular-nums">
                {item.detail}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-border text-brand-ink mt-2.5 flex items-center gap-1 border-t pt-2 text-[11px] font-bold">
        <Check className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden />
        {ai.result}
      </p>
    </>
  );
}

/**
 * The marketing studio on a loop: photo editor, video editor, calendar, then AI Studio. It
 * plays only while the panel is on screen and stays on the first scene for reduced motion.
 */
export function HeroStudioCard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduceMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const playing = inView && !reduceMotion;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % studio.scenes.length),
      STUDIO_SCENE_MS
    );
    return () => window.clearInterval(timer);
  }, [playing]);

  const scene = studio.scenes[index];

  return (
    <div ref={ref}>
      <Pill tone="teal">
        <Sparkles className="h-3 w-3" aria-hidden />
        {studio.tag}
      </Pill>
      <div className="mt-2.5 grid grid-cols-4 gap-1">
        {studio.scenes.map((item, itemIndex) => {
          const Icon = STUDIO_ICONS[item.id];
          const on = itemIndex === index;
          return (
            <span
              key={item.id}
              className={cn(
                'relative flex h-6 items-center justify-center overflow-hidden rounded-md transition-colors duration-300',
                on ? 'bg-primary/10 text-brand-ink' : 'bg-muted text-muted-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {on && playing ? (
                <motion.span
                  key={`progress-${index}`}
                  className="bg-primary-strong absolute bottom-0 left-0 h-0.5"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: STUDIO_SCENE_MS / 1000, ease: 'linear' }}
                />
              ) : null}
            </span>
          );
        })}
      </div>
      <div className="border-border relative mt-2 aspect-[5/2] overflow-hidden rounded-lg border sm:aspect-video">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={scene.id}
            className="absolute inset-0"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <StudioScene id={scene.id} text={scene.text} animate={playing} />
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-2 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-brand-ink flex shrink-0 items-center gap-1 whitespace-nowrap font-bold">
          <Check className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden />
          {scene.label}
        </span>
        <span className="text-muted-foreground min-w-0 truncate">{scene.detail}</span>
      </p>
    </div>
  );
}

function StudioScene({ id, text, animate }: { id: StudioSceneId; text: string; animate: boolean }) {
  const seconds = STUDIO_SCENE_MS / 1000;

  if (id === 'calendar') {
    return (
      <div className="bg-background flex h-full flex-col justify-center px-2.5 py-2">
        <p className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-foreground">{text}</span>
          <span className="text-muted-foreground flex items-center gap-1 font-semibold">
            <span className="bg-primary-strong size-1.5 rounded-full" />
            {studio.calendarLegend}
          </span>
        </p>
        <div className="mt-1.5 grid grid-cols-7 gap-[3px]">
          {CALENDAR_CELLS.map((cell) =>
            CALENDAR_OPEN.has(cell) ? (
              <motion.span
                key={cell}
                className="bg-primary-strong h-2.5 rounded-[3px] sm:h-3"
                initial={animate ? { opacity: 0, scale: 0.4 } : false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: EASE, delay: 0.25 + cell * 0.025 }}
              />
            ) : (
              <span key={cell} className="bg-muted-foreground/15 h-2.5 rounded-[3px] sm:h-3" />
            )
          )}
        </div>
      </div>
    );
  }

  if (id === 'ai') {
    return (
      <>
        <motion.div
          className="absolute inset-0"
          initial={animate ? { filter: 'blur(10px) saturate(0.4)', scale: 1.08 } : false}
          animate={{ filter: 'blur(0px) saturate(1)', scale: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.7 }}
        >
          <MarketingImage src={v3Images.listing} alt="" fill className="object-cover" />
        </motion.div>
        <span className="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-0.75rem)] items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-neutral-900 shadow-sm">
          <Sparkles className="h-3 w-3 shrink-0 text-[hsl(168_65%_26%)]" aria-hidden />
          <motion.span
            className="truncate"
            initial={animate ? { clipPath: 'inset(0 100% 0 0)' } : false}
            animate={{ clipPath: 'inset(0 0% 0 0)' }}
            transition={{ duration: 0.6, ease: 'linear' }}
          >
            {text}
          </motion.span>
        </span>
      </>
    );
  }

  if (id === 'video') {
    return (
      <>
        <motion.div
          className="absolute inset-0"
          initial={animate ? { scale: 1 } : false}
          animate={{ scale: animate ? 1.12 : 1 }}
          transition={{ duration: seconds, ease: 'linear' }}
        >
          <MarketingImage src={v3Images.marketing} alt="" fill className="object-cover" />
        </motion.div>
        <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <span className="absolute left-1/2 top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-900">
          <Play className="ml-0.5 h-3 w-3 fill-current" aria-hidden />
        </span>
        <span className="absolute bottom-4 left-2 truncate text-[10px] font-bold text-white">
          {text}
        </span>
        <span className="absolute inset-x-2 bottom-1.5 flex h-1.5 gap-0.5">
          {[0, 1, 2, 3].map((clip) => (
            <span key={clip} className="flex-1 rounded-sm bg-white/45" />
          ))}
          <motion.span
            className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-white"
            initial={animate ? { left: '0%' } : false}
            animate={{ left: animate ? '100%' : '0%' }}
            transition={{ duration: seconds, ease: 'linear' }}
          />
        </span>
      </>
    );
  }

  return (
    <>
      <MarketingImage src={v3Images.marketing} alt="" fill className="object-cover" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
      <motion.span
        className="absolute left-2 top-2 rounded-[3px] border border-dashed border-white px-1.5 py-0.5 text-[11px] font-bold text-white"
        initial={animate ? { opacity: 0, y: 6 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.3 }}
      >
        {text}
        {[
          '-left-[3px] -top-[3px]',
          '-right-[3px] -top-[3px]',
          '-bottom-[3px] -left-[3px]',
          '-bottom-[3px] -right-[3px]',
        ].map((corner) => (
          <span key={corner} className={cn('absolute size-1.5 rounded-[1px] bg-white', corner)} />
        ))}
      </motion.span>
      <span className="absolute bottom-1.5 right-1.5 flex gap-1">
        {['bg-[#F4D35E]', 'bg-white', 'bg-[hsl(168_65%_31%)]'].map((swatch, swatchIndex) => (
          <motion.span
            key={swatch}
            className={cn('size-3 rounded-full ring-1 ring-black/10', swatch)}
            initial={animate ? { opacity: 0, scale: 0.4 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: EASE, delay: 0.7 + swatchIndex * 0.08 }}
          />
        ))}
      </span>
    </>
  );
}

export function HeroInboxCard() {
  return (
    <>
      <p className="text-muted-foreground text-[11px] font-semibold">{inbox.title}</p>
      <ul className="mt-2 grid grid-cols-3 gap-1">
        {inbox.channels.map(({ id, label }) => {
          const { icon: Icon, className } = CHANNELS[id];
          return (
            <li key={id} className="flex flex-col items-center gap-1">
              <span
                className={cn('flex size-7 items-center justify-center rounded-full', className)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="text-foreground text-[10px] font-semibold">{label}</span>
            </li>
          );
        })}
      </ul>
      <p className="bg-muted text-foreground mt-2.5 w-fit max-w-[90%] rounded-2xl rounded-bl-md px-2.5 py-1.5 text-[11px] leading-snug">
        {inbox.question}
      </p>
      <p className="text-brand-ink mt-2 flex items-center justify-end gap-1 text-[10px] font-bold">
        <Bot className="h-3 w-3" aria-hidden />
        {inbox.answerTag}
      </p>
      <p className="bg-primary-strong ml-auto mt-1 w-fit max-w-[90%] rounded-2xl rounded-br-md px-2.5 py-1.5 text-[11px] leading-snug text-white">
        {inbox.answer}
      </p>
    </>
  );
}

/**
 * A month of direct nights against Airbnb's fee, using the savings section defaults so both
 * show the same numbers. Pro's price comes from the live catalog, like the pricing page.
 */
export function HeroFeeCard() {
  const { data: catalog, isPending } = usePublicPricingPlans();
  const { plan, rate, nights, feePercent } = v5BookingFees;
  const live = catalog?.find((item) => item.code === plan.code);
  const planPhp = live ? discountedPlanPricePhp(live.pricePhp, live.discountPercent) : plan.listPhp;
  const { gross, feeNet, planNet, save } = nightFeeComparison({
    rate: rate.initial,
    nights: nights.initial,
    planPhp,
    feePercent,
  });
  const rows = [
    { label: fee.airbnbLabel, value: feeNet, ours: false },
    { label: fee.kameLabel(plan.label), value: planNet, ours: true },
  ];

  return (
    <>
      <p className="text-muted-foreground text-[11px] font-semibold">
        {fee.title(nights.initial, peso(rate.initial))}
      </p>
      <div className="mt-2 space-y-2">
        {rows.map((row) => {
          const loading = row.ours && isPending;
          return (
            <div key={row.label}>
              <p className="flex items-baseline justify-between gap-2 text-[11px]">
                <span
                  className={row.ours ? 'text-foreground font-semibold' : 'text-muted-foreground'}
                >
                  {row.label}
                </span>
                <span
                  className={cn(
                    'font-bold tabular-nums',
                    row.ours ? 'text-brand-ink text-sm' : 'text-muted-foreground'
                  )}
                >
                  {loading ? (
                    <span className="bg-muted block h-4 w-14 animate-pulse rounded" />
                  ) : (
                    peso(row.value)
                  )}
                </span>
              </p>
              <span className="bg-muted mt-1 block h-1.5 overflow-hidden rounded-full">
                <span
                  className={cn(
                    'block h-full rounded-full transition-[width] duration-500',
                    row.ours ? 'bg-primary-strong' : 'bg-muted-foreground/40'
                  )}
                  style={{ width: loading ? '0%' : `${(row.value / gross) * 100}%` }}
                />
              </span>
            </div>
          );
        })}
      </div>
      <Pill tone="green" className="mt-2.5">
        {isPending ? (
          <span className="block h-3 w-24 animate-pulse rounded bg-current opacity-20" />
        ) : (
          fee.gain(peso(save))
        )}
      </Pill>
    </>
  );
}
