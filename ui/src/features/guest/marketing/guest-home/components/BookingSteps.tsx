import { useRef, useState } from 'react';

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'framer-motion';
import { Check } from 'lucide-react';

import {
  CheckInScene,
  ConfirmScene,
  PaperworkScene,
  RefundScene,
  RequestScene,
  STEP_EASE,
} from '@/features/guest/marketing/guest-home/components/BookingStepScenes';
import type { PublicPropertyListItem } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { MarketingImage } from '@/features/guest/marketing/shared/components/MarketingImage';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

/** Pill labels match the guest trip page (`guestTripStatusLabel`). */
const STEPS = [
  {
    title: 'Send a request',
    body: 'Pick your dates, add your guests and a valid ID. No account needed.',
    pill: 'Requested',
  },
  {
    title: 'Host confirms',
    body: 'You get an email the moment your host confirms the stay.',
    pill: 'Confirmed',
  },
  {
    title: 'Building paperwork',
    body: 'Your host prepares the check-in documents the building needs, and parking if you add it.',
    pill: 'Confirmed',
  },
  {
    title: 'Check in',
    body: 'Directions, Wi-Fi, and house rules are waiting in your stay guide.',
    pill: 'Ready',
  },
  {
    title: 'Get your deposit back',
    body: 'After checkout, follow your security deposit until it is refunded.',
    pill: 'Refund in progress',
  },
] as const;

const N = STEPS.length;

/** Condo living room shown when no live stay has loaded yet. */
const FALLBACK_CONDO_PHOTO =
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85';

/**
 * Pinned scroll story. The section is N screens tall; scrolling through it moves the
 * example trip from request to refund. Each step plays its own scene.
 */
export function BookingSteps({ stay }: { stay?: PublicPropertyListItem }) {
  const reduce = usePrefersReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const next = Math.min(N - 1, Math.max(0, Math.floor(v * N)));
    setActive((c) => (c === next ? c : next));
  });

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const travel = track.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / N) * travel, behavior: reduce ? 'auto' : 'smooth' });
  };

  const step = STEPS[active];

  return (
    <section aria-labelledby="home-steps" className="relative bg-[hsl(var(--band))]">
      <div ref={trackRef} className="relative" style={{ height: `${N * 80 + 20}vh` }}>
        <div className="sticky top-0 flex h-[100dvh] items-center overflow-hidden pb-20 pt-[calc(var(--public-nav-h)+0.5rem)] lg:pb-4">
          <div className="public-shell grid w-full items-center gap-5 lg:grid-cols-12 lg:gap-12">
            {/* Copy + rail */}
            <div className="lg:col-span-5">
              <span className="border-border text-muted-foreground inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold">
                How booking works
              </span>
              <h2
                id="home-steps"
                className="public-section-title text-foreground mt-3 text-balance font-semibold"
              >
                From request to refund, on one trip page
              </h2>

              {/* Phone / tablet: compact step header */}
              <div className="mt-4 lg:hidden">
                <div className="flex gap-1.5" role="tablist" aria-label="Booking steps">
                  {STEPS.map((s, i) => (
                    <button
                      key={s.title}
                      type="button"
                      role="tab"
                      aria-selected={i === active}
                      aria-label={s.title}
                      onClick={() => goTo(i)}
                      className="focus-visible:ring-ring relative h-6 flex-1 rounded outline-none focus-visible:ring-2"
                    >
                      <span className="bg-border absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full">
                        <motion.span
                          initial={false}
                          animate={{ scaleX: i <= active ? 1 : 0 }}
                          transition={{ duration: reduce ? 0 : 0.45, ease: STEP_EASE }}
                          className="bg-primary block h-full origin-left"
                        />
                      </span>
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={active}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: STEP_EASE }}
                    className="mt-2"
                    aria-live="polite"
                  >
                    <p className="text-foreground text-base font-semibold">
                      <span className="text-muted-foreground tabular-nums">
                        {active + 1}/{N}{' '}
                      </span>
                      {step.title}
                    </p>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{step.body}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Desktop rail */}
              <ol className="relative mt-10 hidden lg:block">
                <span aria-hidden className="bg-border absolute bottom-6 left-[17px] top-6 w-px" />
                <motion.span
                  aria-hidden
                  className="bg-primary absolute bottom-6 left-[17px] top-6 w-px origin-top"
                  style={{ scaleY: reduce ? scrollYProgress : progress }}
                />
                {STEPS.map((s, i) => {
                  const current = i === active;
                  const done = i < active;
                  return (
                    <li key={s.title}>
                      <button
                        type="button"
                        onClick={() => goTo(i)}
                        aria-current={current ? 'step' : undefined}
                        className="focus-visible:ring-ring group relative flex w-full gap-5 rounded-2xl py-3.5 pr-3 text-left outline-none focus-visible:ring-2"
                      >
                        <span
                          className={cn(
                            'relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                            current &&
                              'bg-primary-strong text-primary-foreground ring-primary/15 scale-110 ring-[6px]',
                            done && 'bg-primary-strong text-primary-foreground',
                            !current &&
                              !done &&
                              'bg-background text-muted-foreground ring-border ring-1'
                          )}
                        >
                          {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}
                        </span>
                        <span className="min-w-0 flex-1 pt-1">
                          <span
                            className={cn(
                              'block text-lg font-semibold leading-snug transition-colors duration-300',
                              current
                                ? 'text-foreground'
                                : 'text-muted-foreground group-hover:text-foreground'
                            )}
                          >
                            {s.title}
                          </span>
                          <motion.span
                            initial={false}
                            animate={{ height: current ? 'auto' : 0, opacity: current ? 1 : 0 }}
                            transition={{ duration: reduce ? 0 : 0.45, ease: STEP_EASE }}
                            className="block overflow-hidden"
                          >
                            <span className="text-muted-foreground block max-w-md pt-1.5 text-[15px] leading-relaxed">
                              {s.body}
                            </span>
                          </motion.span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Trip page preview */}
            <div className="flex justify-center lg:col-span-7 lg:justify-end">
              <TripPreview stay={stay} active={active} reduce={reduce} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TripPreview({
  stay,
  active,
  reduce,
}: {
  stay?: PublicPropertyListItem;
  active: number;
  reduce: boolean;
}) {
  const step = STEPS[active];
  const stayName = stay?.name ?? 'Your condo stay';
  const photo = stay?.images[0] ?? FALLBACK_CONDO_PHOTO;
  const place = stay?.location ? stay.location.split(',')[0] : null;

  return (
    <div className="relative w-full max-w-[400px] lg:max-w-[580px]">
      {/* Double bezel: tray + card */}
      <div className="bg-foreground/[0.04] ring-foreground/[0.06] rounded-[2rem] p-2 ring-1 lg:rounded-[2.5rem] lg:p-2.5 dark:bg-white/[0.04]">
        <div className="bg-card flex h-[min(56dvh,480px)] flex-col overflow-hidden rounded-[calc(2rem-0.5rem)] shadow-[0_40px_80px_-40px_rgba(15,23,42,0.35)] lg:h-[min(calc(100dvh-var(--public-nav-h)-5rem),660px)] lg:rounded-[calc(2.5rem-0.625rem)] dark:shadow-[0_40px_80px_-40px_rgba(0,0,0,0.7)]">
          {/* Property photo, inset like the trip page hero */}
          <div className="shrink-0 p-2.5 pb-0 lg:p-3 lg:pb-0">
            <div className="bg-muted relative h-24 overflow-hidden rounded-[1.25rem] sm:h-32 lg:h-40">
              <MarketingImage
                src={photo}
                alt=""
                fill
                sizes="(min-width: 1024px) 560px, 400px"
                className="object-cover"
              />
            </div>
          </div>

          {/* Trip info */}
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-3 lg:px-6 lg:pt-4">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Example trip</p>
              <p className="text-foreground truncate text-base font-semibold lg:text-xl">
                {stayName}
              </p>
              <p className="text-muted-foreground truncate text-xs lg:text-sm">
                {place ? `${place} · ` : ''}Fri to Sun · 2 guests
              </p>
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={step.pill}
                initial={reduce ? false : { opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.9 }}
                transition={{ duration: 0.35, ease: STEP_EASE }}
                className="bg-primary-strong text-primary-foreground mt-1 shrink-0 rounded-full px-3 py-1 text-xs font-semibold lg:text-sm"
              >
                {step.pill}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Progress */}
          <div className="flex shrink-0 gap-1.5 px-4 pt-3 lg:px-6 lg:pt-4" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className="bg-muted h-1 flex-1 overflow-hidden rounded-full lg:h-1.5"
              >
                <motion.span
                  initial={false}
                  animate={{ scaleX: i <= active ? 1 : 0 }}
                  transition={{ duration: reduce ? 0 : 0.5, ease: STEP_EASE }}
                  className="bg-primary block h-full origin-left"
                />
              </span>
            ))}
          </div>

          {/* Scene */}
          <div className="relative min-h-0 flex-1 overflow-hidden px-4 pt-4 lg:px-6 lg:pb-5 lg:pt-5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                className="h-full"
                initial={reduce ? false : { opacity: 0, y: 24, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={reduce ? undefined : { opacity: 0, y: -16, filter: 'blur(6px)' }}
                transition={{ duration: 0.4, ease: STEP_EASE }}
              >
                {active === 0 ? <RequestScene reduce={reduce} /> : null}
                {active === 1 ? <ConfirmScene reduce={reduce} stayName={stayName} /> : null}
                {active === 2 ? <PaperworkScene reduce={reduce} /> : null}
                {active === 3 ? <CheckInScene reduce={reduce} /> : null}
                {active === 4 ? <RefundScene reduce={reduce} /> : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
