import { useRef, useState, type ReactNode } from 'react';

import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from 'framer-motion';

import {
  CheckInScene,
  ConfirmScene,
  PaperworkScene,
  RefundScene,
  RequestScene,
} from '@/features/guest/marketing/guest-home/components/BookingStepScenes';
import { useSlice, type Progress } from '@/features/guest/marketing/guest-home/lib/scrub';
import type { PublicPropertyListItem } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { MarketingImage } from '@/features/guest/marketing/shared/components/MarketingImage';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

const STEPS = [
  {
    title: 'Send a request',
    body: 'Pick your dates, add your guests and a valid ID. You don’t need an account.',
  },
  {
    title: 'Your host confirms',
    body: 'You get an email as soon as your host says yes.',
  },
  {
    title: 'Paperwork is handled',
    body: 'Your host prepares the forms the building asks for. Add parking if you need it.',
  },
  {
    title: 'Check in',
    body: 'Directions, Wi-Fi, and house rules are in your stay guide.',
  },
  {
    title: 'Get your deposit back',
    body: 'After checkout, see where your security deposit is until it is refunded.',
  },
] as const;

const N = STEPS.length;

/** Status pill per step range. Labels match the guest trip page (`guestTripStatusLabel`). */
const PILLS = [
  { label: 'Request sent', from: 0, to: 0 },
  { label: 'Confirmed', from: 1, to: 2 },
  { label: 'Ready for check-in', from: 3, to: 3 },
  { label: 'Deposit refund', from: 4, to: 4 },
] as const;

/** Where in a step its scene is finished and holding. Used for clicks and reduced motion. */
const SETTLED = 0.82;

/** Condo living room shown when no live stay has loaded yet. */
const FALLBACK_CONDO_PHOTO =
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85';

/**
 * Pinned scroll story. The section is N screens tall and the example trip is driven by the
 * scroll position alone: scroll down to play it, up to rewind it, stop to hold a frame.
 * Nothing runs on a timer, so no step can be missed by scrolling quickly.
 */
export function BookingSteps({ stay }: { stay?: PublicPropertyListItem }) {
  const reduce = usePrefersReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });

  // Position in steps: 0 at the start of step one, N at the end of the last.
  const raw = useTransform(scrollYProgress, (v) => v * N);
  const eased = useSpring(raw, { stiffness: 260, damping: 34, mass: 0.3 });
  // Reduced motion: no in-between frames, each step shows finished.
  const stepped = useTransform(raw, (v) => Math.min(N - 1, Math.floor(v)) + SETTLED);
  const at = reduce ? stepped : eased;

  useMotionValueEvent(raw, 'change', (v) => {
    const next = Math.min(N - 1, Math.max(0, Math.floor(v)));
    setActive((c) => (c === next ? c : next));
  });

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const travel = track.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: top + ((i + SETTLED) / N) * travel,
      behavior: reduce ? 'auto' : 'smooth',
    });
  };

  return (
    <section aria-labelledby="home-steps" className="relative bg-[hsl(var(--band))]">
      <div ref={trackRef} className="relative" style={{ height: `${N * 80 + 20}vh` }}>
        <div className="sticky top-0 flex h-[100dvh] items-center overflow-hidden pb-20 pt-[calc(var(--public-nav-h)+0.5rem)] lg:pb-4">
          <div className="public-shell grid w-full grid-cols-1 items-center gap-5 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <h2
                id="home-steps"
                className="public-section-title text-foreground text-balance font-semibold"
              >
                From request to refund, on one trip page
              </h2>
              <p className="text-muted-foreground mt-2 hidden text-[15px] lg:block">
                It opens in your browser. There is no app to install.
              </p>

              {/* Phone / tablet: step bar and the current step's text */}
              <div className="mt-3 lg:hidden">
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
                        <SegmentFill at={at} index={i} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid">
                  {STEPS.map((s, i) => (
                    <StepLayer key={s.title} at={at} index={i} className="[grid-area:1/1]">
                      <p className="text-foreground text-base font-semibold">
                        <span className="text-muted-foreground tabular-nums">
                          {i + 1}/{N}{' '}
                        </span>
                        {s.title}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-sm">{s.body}</p>
                    </StepLayer>
                  ))}
                </div>
              </div>

              {/* Desktop rail: every step stays readable, the current one lights up */}
              <ol className="relative mt-8 hidden lg:block">
                <span aria-hidden className="bg-border absolute bottom-8 left-[17px] top-5 w-px" />
                <RailLine at={at} />
                {STEPS.map((s, i) => (
                  <li key={s.title}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={i === active ? 'step' : undefined}
                      className="focus-visible:ring-ring group relative flex w-full gap-5 rounded-2xl py-2.5 pr-3 text-left outline-none focus-visible:ring-2"
                    >
                      <RailDot at={at} index={i} />
                      <RailText at={at} index={i} title={s.title} body={s.body} />
                    </button>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex justify-center lg:col-span-7 lg:justify-end">
              <TripPreview stay={stay} at={at} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Progress segment that fills while its step is on screen and empties on the way back. */
function SegmentFill({ at, index }: { at: Progress; index: number }) {
  const scaleX = useSlice(at, index, index + 1);
  return <motion.span style={{ scaleX }} className="bg-primary block h-full origin-left" />;
}

/**
 * One layer in a stack of per-step content. Fades in as its step arrives and out as the
 * next one takes over. The first layer starts visible and the last one stays.
 */
function StepLayer({
  at,
  index,
  from = index,
  to = index,
  lift = 0,
  scene,
  className,
  children,
}: {
  at: Progress;
  index: number;
  from?: number;
  to?: number;
  lift?: number;
  /** Set on the trip preview scenes so tests can read which one is showing. */
  scene?: number;
  className?: string;
  children: ReactNode;
}) {
  const first = from === 0;
  const last = to === N - 1;
  const stops = [from - 0.14, from, to + 0.88, to + 1];
  const opacity = useTransform(at, stops, [first ? 1 : 0, 1, 1, last ? 1 : 0]);
  const y = useTransform(at, stops, [first ? 0 : lift, 0, 0, last ? 0 : -lift * 0.66]);
  return (
    <motion.div style={{ opacity, y }} className={className} data-step-scene={scene}>
      {children}
    </motion.div>
  );
}

function RailLine({ at }: { at: Progress }) {
  const scaleY = useTransform(at, [0, N - 1 + SETTLED], [0, 1]);
  return (
    <motion.span
      aria-hidden
      style={{ scaleY }}
      className="bg-primary absolute bottom-8 left-[17px] top-5 w-px origin-top"
    />
  );
}

function RailDot({ at, index }: { at: Progress; index: number }) {
  const fill = useSlice(at, index - 0.14, index);
  const reached = index === 0 ? 1 : fill;
  return (
    <span className="bg-background text-muted-foreground ring-border relative z-[1] mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ring-1">
      {index + 1}
      <motion.span
        aria-hidden
        style={{ opacity: reached }}
        className="bg-primary-strong text-primary-foreground absolute inset-0 flex items-center justify-center rounded-full"
      >
        {index + 1}
      </motion.span>
    </span>
  );
}

function RailText({
  at,
  index,
  title,
  body,
}: {
  at: Progress;
  index: number;
  title: string;
  body: string;
}) {
  const stops = [index - 0.14, index, index + 0.88, index + 1];
  const first = index === 0;
  const last = index === N - 1;
  const opacity = useTransform(at, stops, [first ? 1 : 0.5, 1, 1, last ? 1 : 0.5]);
  return (
    <motion.span style={{ opacity }} className="min-w-0 flex-1">
      <span className="text-foreground block text-lg font-semibold leading-snug">{title}</span>
      <span className="text-muted-foreground block max-w-md pt-1 text-[15px] leading-relaxed">
        {body}
      </span>
    </motion.span>
  );
}

/** The scene's own 0..1 progress through its step. */
function useStepProgress(at: Progress, index: number) {
  return useSlice(at, index, index + 1);
}

function Scene({
  at,
  index,
  children,
}: {
  at: Progress;
  index: number;
  children: (p: Progress) => ReactNode;
}) {
  const p = useStepProgress(at, index);
  return (
    <StepLayer
      at={at}
      index={index}
      lift={24}
      scene={index}
      className="absolute inset-0 px-4 pt-4 lg:px-6 lg:pb-5 lg:pt-5"
    >
      {children(p)}
    </StepLayer>
  );
}

function TripPreview({ stay, at }: { stay?: PublicPropertyListItem; at: Progress }) {
  const stayName = stay?.name ?? 'Your condo stay';
  const photo = stay?.images[0] ?? FALLBACK_CONDO_PHOTO;
  const place = stay?.location ? stay.location.split(',')[0] : null;
  // The first pill only appears once the request has gone out.
  const sent = useSlice(at, 0.62, 0.72);

  return (
    <div className="relative w-full max-w-[400px] lg:max-w-[580px]">
      {/* Double bezel: tray + card */}
      <div className="bg-foreground/[0.04] ring-foreground/[0.06] rounded-[2rem] p-2 ring-1 lg:rounded-[2.5rem] lg:p-2.5 dark:bg-white/[0.04]">
        <div className="bg-card flex h-[min(48dvh,480px)] flex-col overflow-hidden rounded-[calc(2rem-0.5rem)] shadow-[0_40px_80px_-40px_rgba(15,23,42,0.35)] lg:h-[min(calc(100dvh-var(--public-nav-h)-5rem),660px)] lg:rounded-[calc(2.5rem-0.625rem)] dark:shadow-[0_40px_80px_-40px_rgba(0,0,0,0.7)]">
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
            <motion.div style={{ opacity: sent }} className="mt-1 grid shrink-0 justify-items-end">
              {PILLS.map((pill) => (
                <StepLayer
                  key={pill.label}
                  at={at}
                  index={pill.from}
                  from={pill.from}
                  to={pill.to}
                  lift={6}
                  className="[grid-area:1/1]"
                >
                  <span className="bg-primary-strong text-primary-foreground block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold lg:text-sm">
                    {pill.label}
                  </span>
                </StepLayer>
              ))}
            </motion.div>
          </div>

          {/* Progress */}
          <div className="flex shrink-0 gap-1.5 px-4 pt-3 lg:px-6 lg:pt-4" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className="bg-muted h-1 flex-1 overflow-hidden rounded-full lg:h-1.5"
              >
                <SegmentFill at={at} index={i} />
              </span>
            ))}
          </div>

          {/* Scenes: all mounted, each driven by its own slice of the scroll */}
          <div className="relative min-h-0 flex-1 overflow-hidden" aria-hidden>
            <Scene at={at} index={0}>
              {(p) => <RequestScene p={p} />}
            </Scene>
            <Scene at={at} index={1}>
              {(p) => <ConfirmScene p={p} stayName={stayName} />}
            </Scene>
            <Scene at={at} index={2}>
              {(p) => <PaperworkScene p={p} />}
            </Scene>
            <Scene at={at} index={3}>
              {(p) => <CheckInScene p={p} />}
            </Scene>
            <Scene at={at} index={4}>
              {(p) => <RefundScene p={p} />}
            </Scene>
          </div>
        </div>
      </div>
    </div>
  );
}
