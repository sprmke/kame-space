import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { Link } from 'react-router-dom';

import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { ArrowRight, Check, Play } from 'lucide-react';

import { V5_SECTION_PB } from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import {
  HeroAskCard,
  HeroFeeCard,
  HeroInboxCard,
  HeroStudioCard,
} from '@/features/guest/marketing/for-hosts/v5/components/V5HeroCards';
import { V5TourDialog } from '@/features/guest/marketing/for-hosts/v5/components/V5TourDialog';
import {
  V5_SIGNUP_CTA,
  v5Hero,
  type V5JobId,
} from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';

import { KameMascotImage } from '@/components/branding/KameMascotImage';
import { useIsHoverFine, useIsMobile, usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';

const { jobs } = v5Hero;
const EASE = [0.16, 1, 0.3, 1] as const;
const ROTATE_MS = 4200;

/** Where each job's panel floats around the mascot from `sm` up, and how far it parallaxes. */
const CARD_LAYOUT: Record<
  V5JobId,
  { Card: ComponentType; position: string; depth: number; floatSeconds: number }
> = {
  ai: { Card: HeroAskCard, position: 'sm:left-0 sm:top-2', depth: 20, floatSeconds: 5 },
  marketing: {
    Card: HeroStudioCard,
    position: 'sm:bottom-0 sm:left-2',
    depth: 16,
    floatSeconds: 6.5,
  },
  messages: {
    Card: HeroInboxCard,
    position: 'sm:right-0 sm:top-12',
    depth: 14,
    floatSeconds: 6,
  },
  pricing: { Card: HeroFeeCard, position: 'sm:bottom-8 sm:right-2', depth: 24, floatSeconds: 5.5 },
};

function FloatingCard({
  index,
  active,
  position,
  depth,
  floatSeconds,
  pointerX,
  pointerY,
  reduceMotion,
  onSelect,
  children,
}: {
  index: number;
  active: boolean;
  position: string;
  depth: number;
  floatSeconds: number;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  reduceMotion: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const x = useTransform(pointerX, (value) => value * depth);
  const y = useTransform(pointerY, (value) => value * depth * 0.6);

  return (
    <motion.div
      style={{ x, y }}
      className={cn(
        'w-48 min-w-0 shrink sm:absolute sm:w-48 xl:w-56',
        position,
        // Phones show one panel beside the mascot; from `sm` the idle ones tuck behind it.
        active ? 'relative z-20' : 'z-0 hidden sm:block'
      )}
    >
      <div
        className="motion-safe:animate-float"
        style={{ animationDuration: `${floatSeconds}s`, animationDelay: `${index * -1.3}s` }}
      >
        <motion.button
          type="button"
          tabIndex={-1}
          onClick={onSelect}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: active ? 1 : 0.92 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className={cn(
            'border-border bg-card block w-full rounded-2xl border p-3.5 text-left transition-shadow duration-300',
            active
              ? 'ring-primary/40 shadow-[0_24px_48px_-24px_hsl(var(--shadow-color)/0.5)] ring-2'
              : 'shadow-[0_12px_28px_-20px_hsl(var(--shadow-color)/0.35)]'
          )}
        >
          {children}
        </motion.button>
      </div>
    </motion.div>
  );
}

/**
 * Hero panel tones. `tinted` is the original teal wash; set `HERO_TONE` back to it to revert.
 * `soft` keeps light mode identical and swaps the dark wash for a neutral card with a dimmer glow.
 */
const HERO_SURFACES = {
  tinted: { panel: 'bg-primary/[0.07] dark:bg-primary/10', glow: 'bg-primary/15' },
  soft: {
    panel: 'bg-primary/[0.07] dark:bg-card dark:ring-1 dark:ring-inset dark:ring-white/[0.06]',
    glow: 'bg-primary/15 dark:bg-primary/[0.12]',
  },
} as const;
const HERO_TONE: keyof typeof HERO_SURFACES = 'soft';
const HERO_SURFACE = HERO_SURFACES[HERO_TONE];

/**
 * Hero for `/for-hosts`: the offer on the left, and Kame with four core features on the right.
 * Picking a job (or waiting) swaps the mascot pose and brings that job's panel forward.
 * The stage follows the pointer on mouse devices and holds still under reduced motion.
 */
export function V5Hero() {
  const reduceMotion = usePrefersReducedMotion();
  const hoverFine = useIsHoverFine();
  // The phone layout is a tight row (Kame beside one panel), so the panel must not drift.
  const isPhone = useIsMobile();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { amount: 0.4 });
  const hop = useAnimationControls();
  const mounted = useRef(false);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const pointerX = useSpring(rawX, { stiffness: 120, damping: 20 });
  const pointerY = useSpring(rawY, { stiffness: 120, damping: 20 });
  const mascotX = useTransform(pointerX, (value) => value * -8);
  const mascotY = useTransform(pointerY, (value) => value * -5);

  useEffect(() => {
    if (!auto || !inView || reduceMotion) return;
    const id = window.setInterval(
      () => setActive((current) => (current + 1) % jobs.length),
      ROTATE_MS
    );
    return () => window.clearInterval(id);
  }, [auto, inView, reduceMotion]);

  // Kame hops a little each time the job changes.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (reduceMotion) return;
    void hop.start({ y: [0, -12, 0], transition: { duration: 0.45, ease: EASE } });
  }, [active, hop, reduceMotion]);

  const select = (index: number) => {
    setAuto(false);
    setActive(index);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!hoverFine || isPhone || reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    rawX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
    rawY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2);
  };

  const handlePointerLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  const job = jobs[active];

  return (
    <section className={cn('public-page-top public-shell relative', V5_SECTION_PB)}>
      <div
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={cn(HERO_SURFACE.panel, 'relative overflow-hidden rounded-3xl lg:rounded-[2rem]')}
      >
        <div
          aria-hidden
          className={cn(
            HERO_SURFACE.glow,
            'pointer-events-none absolute -right-24 -top-32 size-[30rem] rounded-full blur-3xl'
          )}
        />

        <div className="relative grid gap-8 px-5 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-8 lg:px-12 lg:py-14 xl:grid-cols-[1fr_1fr] xl:px-16">
          {/* Offer */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <h1 className="text-foreground text-[2rem] font-bold leading-[1.08] tracking-[-0.03em] md:text-5xl md:leading-[1.05] lg:text-[2.5rem] xl:text-6xl xl:leading-[1.04]">
              <span className="block">{v5Hero.headline[0]}</span>
              <span className="text-primary-strong dark:text-primary block">
                {v5Hero.headline[1]}
              </span>
            </h1>
            <p className="public-lead text-muted-foreground dark:text-foreground/80 mt-4 max-w-[38ch] text-pretty lg:mt-5">
              {v5Hero.lead.before}
              <strong className="text-brand-ink dark:text-primary font-bold">
                {v5Hero.lead.brand}
              </strong>
              {v5Hero.lead.after}
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center lg:mt-8">
              <Link
                to={V5_SIGNUP_CTA.to}
                onClick={() => captureAppEvent('for_hosts_cta_clicked', { cta: 'create_account' })}
                className="public-cta bg-primary-strong focus-visible:ring-ring group inline-flex items-center justify-center gap-2 rounded-full font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {V5_SIGNUP_CTA.label}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <V5TourDialog>
                <button
                  type="button"
                  className="public-cta border-border bg-background/70 text-foreground hover:bg-background focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-full border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  <Play className="text-primary size-4" aria-hidden />
                  {v5Hero.tourCta.label}
                </button>
              </V5TourDialog>
            </div>
            <ul className="text-muted-foreground dark:text-foreground/80 mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium lg:mt-6">
              {v5Hero.facts.map((fact) => (
                <li key={fact} className="flex items-center gap-1.5">
                  <Check className="text-primary size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                  {fact}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Stage */}
          <div ref={stageRef}>
            <motion.div
              aria-hidden
              initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.15 }}
              // Phones: Kame stands beside the panel (a row, not a stack), so the stage costs
              // one panel of height. min-h = the tallest panel, so cycling panels never moves
              // the tabs; centring splits any spare room above and below. From `sm` it is the
              // floating composition.
              className="relative mx-auto flex min-h-[14.25rem] max-w-[36rem] flex-row items-center justify-center sm:h-[26rem] sm:min-h-0 sm:flex-col sm:items-center xl:h-[28rem]"
            >
              <span className="border-primary/15 absolute left-1/2 top-1/2 hidden size-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full border sm:block xl:size-[23rem]" />
              <span className="border-primary/10 absolute left-1/2 top-1/2 hidden size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full border sm:block xl:size-[34rem]" />

              {/* Phones: its transparent right margin tucks under the panel (`-mr-3`). */}
              <div className="relative z-10 -mr-3 w-28 shrink-0 max-[359px]:w-20 sm:absolute sm:left-1/2 sm:top-1/2 sm:mr-0 sm:w-64 sm:-translate-x-1/2 sm:-translate-y-1/2 xl:w-[19rem]">
                <motion.button
                  type="button"
                  tabIndex={-1}
                  aria-label={v5Hero.mascotLabel}
                  onClick={() => select((active + 1) % jobs.length)}
                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                  style={{ x: mascotX, y: mascotY }}
                  className="relative block w-full cursor-pointer"
                >
                  <span className="bg-foreground/15 absolute bottom-[5%] left-1/2 h-4 w-[52%] -translate-x-1/2 rounded-[100%] blur-md" />
                  <motion.span animate={hop} className="relative block">
                    {jobs.map((item, index) => (
                      <KameMascotImage
                        key={item.id}
                        pose={item.pose}
                        priority={index === 0}
                        className={cn(
                          'transition-[opacity,transform] duration-500 ease-out',
                          index > 0 && 'absolute inset-0',
                          index === active ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                        )}
                      />
                    ))}
                  </motion.span>
                </motion.button>
              </div>

              {jobs.map((item, index) => {
                const { Card, position, depth, floatSeconds } = CARD_LAYOUT[item.id];
                return (
                  <FloatingCard
                    key={item.id}
                    index={index}
                    active={index === active}
                    position={position}
                    depth={depth}
                    floatSeconds={floatSeconds}
                    pointerX={pointerX}
                    pointerY={pointerY}
                    reduceMotion={reduceMotion}
                    onSelect={() => select(index)}
                  >
                    <Card />
                  </FloatingCard>
                );
              })}
            </motion.div>

            <div
              role="group"
              aria-label={v5Hero.selectorLabel}
              className="border-border bg-background/80 mx-auto mt-5 grid max-w-md grid-cols-4 gap-1 rounded-2xl border p-1 sm:rounded-full"
            >
              {jobs.map((item, index) => {
                const selected = index === active;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => select(index)}
                    className="focus-visible:ring-ring relative flex min-h-11 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl px-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 max-[359px]:text-[10px] sm:flex-row sm:gap-1.5 sm:rounded-full sm:text-[13px]"
                  >
                    {selected ? (
                      <motion.span
                        layoutId="v5-hero-job"
                        className="bg-primary-strong absolute inset-0 rounded-xl sm:rounded-full"
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 380, damping: 32 }
                        }
                      />
                    ) : null}
                    <Icon
                      className={cn(
                        'relative size-4 transition-colors',
                        selected ? 'text-white' : 'text-primary'
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'relative transition-colors',
                        selected ? 'text-white' : 'text-foreground'
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mx-auto mt-3 flex min-h-10 max-w-md items-start justify-center">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={job.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="text-muted-foreground dark:text-foreground/80 text-pretty text-center text-sm leading-snug"
                >
                  {job.line}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
