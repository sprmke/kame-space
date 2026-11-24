import { useEffect, useRef, useState, type UIEvent } from 'react';

import { motion, useAnimationControls, useInView } from 'framer-motion';

import {
  V5Heading,
  V5_SECTION_Y,
} from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import { V5PoseStack } from '@/features/guest/marketing/for-hosts/v5/components/V5PoseStack';
import { v5Setup } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';

import { useIsBelowLg, usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;
/** One of the 4 columns at `lg` (`gap-8` = 2rem between them). */
const COLUMN = '((100% - 6rem) / 4)';
/** Steps are centred in their columns, so the rail runs from the first column's centre to the last's. */
const RAIL_STYLE = { left: `calc(${COLUMN} / 2)`, right: `calc(${COLUMN} / 2)` };
const STEP_MS = 1500;
const { steps } = v5Setup;
const LAST = steps.length - 1;
const POSES = steps.map((step) => step.pose);

/** Left edge that centres the 9rem mascot over step `index`'s icon (the column centre). */
function walkLeft(index: number) {
  return `calc(${index} * (${COLUMN} + 2rem) + ${COLUMN} / 2 - 4.5rem)`;
}

/**
 * Four setup moves on a rail. From `lg` the title and steps are centred across the full width,
 * and Kame walks the rail one step at a time, changing pose at each stop and ending in a beach
 * chair; hovering a step sends Kame there. On phones and tablets the steps are a swipeable snap
 * row and Kame, beside the title, follows the swipe.
 */
export function V5Setup() {
  const reduceMotion = usePrefersReducedMotion();
  const isBelowLg = useIsBelowLg();
  const railRef = useRef<HTMLOListElement>(null);
  const inView = useInView(railRef, { once: true, margin: '-100px' });
  const draw = reduceMotion || inView;

  const [auto, setAuto] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const shown = picked ?? (reduceMotion ? LAST : auto);

  useEffect(() => {
    if (!inView || reduceMotion || isBelowLg || picked !== null || auto >= LAST) return;
    const id = window.setTimeout(() => setAuto((step) => step + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [inView, reduceMotion, isBelowLg, picked, auto]);

  const hop = useAnimationControls();
  const firstStop = useRef(true);
  useEffect(() => {
    if (firstStop.current) {
      firstStop.current = false;
      return;
    }
    if (!reduceMotion) void hop.start({ y: [0, -18, 0], transition: { duration: 0.55 } });
  }, [shown, reduceMotion, hop]);

  const followSwipe = (event: UIEvent<HTMLOListElement>) => {
    const row = event.currentTarget;
    const card = row.querySelector('li');
    if (!card) return;
    const atEnd = row.scrollLeft >= row.scrollWidth - row.clientWidth - 4;
    const index = atEnd ? LAST : Math.round(row.scrollLeft / (card.offsetWidth + 12));
    setPicked(Math.min(LAST, Math.max(0, index)));
  };

  return (
    <section id="get-started" className={cn('scroll-mt-20', V5_SECTION_Y)}>
      <div className="public-shell">
        <div className="flex items-end justify-between gap-4 lg:justify-center">
          <V5Heading
            title={v5Setup.title}
            lead={v5Setup.lead}
            className="lg:mx-auto lg:text-center"
            leadClassName="lg:mx-auto"
          />
          <V5PoseStack
            poses={POSES}
            active={steps[shown].pose}
            className="-mb-2 w-24 shrink-0 sm:w-28 lg:hidden"
          />
        </div>

        <div aria-hidden className="relative mt-6 hidden h-36 lg:block">
          <div
            className="absolute bottom-0 w-36"
            style={{
              left: walkLeft(shown),
              transition: reduceMotion ? 'none' : 'left 700ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <motion.div animate={hop}>
              <V5PoseStack poses={POSES} active={steps[shown].pose} />
            </motion.div>
          </div>
        </div>

        <ol
          ref={railRef}
          onScroll={isBelowLg ? followSwipe : undefined}
          // A sideways-scrolling row has to be reachable by keyboard; on desktop it is a grid.
          tabIndex={isBelowLg ? 0 : undefined}
          className="focus-visible:ring-ring relative -mx-[var(--public-shell-px)] mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[var(--public-shell-px)] pb-2 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 lg:mx-0 lg:mt-1 lg:grid lg:grid-cols-4 lg:gap-8 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          <span
            aria-hidden
            className="bg-border absolute top-6 hidden h-px lg:block"
            style={RAIL_STYLE}
          />
          <motion.span
            aria-hidden
            className="bg-primary absolute top-6 hidden h-px origin-left lg:block"
            style={RAIL_STYLE}
            initial={reduceMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: draw ? shown / LAST : 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          />
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.li
                key={step.title}
                onPointerEnter={isBelowLg ? undefined : () => setPicked(index)}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={draw ? { opacity: 1, y: 0 } : undefined}
                transition={{
                  duration: 0.5,
                  delay: reduceMotion ? 0 : 0.15 + index * 0.15,
                  ease: EASE,
                }}
                className="border-border bg-card relative w-[78%] shrink-0 snap-start rounded-3xl border p-5 sm:w-[46%] lg:flex lg:w-auto lg:flex-col lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:text-center"
              >
                <div className="flex items-center justify-between lg:justify-center">
                  <span
                    className={cn(
                      'relative z-10 flex size-12 items-center justify-center rounded-2xl border transition-colors duration-300',
                      index === shown
                        ? 'border-primary-strong bg-primary-strong text-white'
                        : index < shown
                          ? 'border-primary/40 bg-background text-primary'
                          : 'border-border bg-background text-muted-foreground'
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span
                    aria-hidden
                    className="text-muted-foreground text-sm font-semibold tabular-nums lg:hidden"
                  >
                    {index + 1} / {steps.length}
                  </span>
                </div>
                <h3 className="text-foreground mt-4 text-lg font-bold tracking-tight lg:mt-5">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-1.5 text-pretty text-sm leading-relaxed lg:max-w-[15rem] lg:text-balance">
                  {step.body}
                </p>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
