import { useRef, useState } from 'react';

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { Check } from 'lucide-react';

import { v3Workflow } from '@/features/guest/marketing/for-hosts/shared/hostDemoData';
import {
  InViewWorkflowScene,
  WorkflowScene,
} from '@/features/guest/marketing/for-hosts/shared/HostWorkflowScenes';
import { Pill } from '@/features/guest/marketing/for-hosts/shared/Pill';
import { Reveal } from '@/features/guest/marketing/for-hosts/shared/Reveal';
import {
  V5_LEAD_CLASS,
  V5_SECTION_Y,
  V5_TITLE_CLASS,
} from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import { v5Workflow } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const { sampleGuest } = v3Workflow;
const { stages } = v5Workflow;
const EASE = [0.16, 1, 0.3, 1] as const;

function Header() {
  return (
    <div>
      <h2 className={V5_TITLE_CLASS}>{v5Workflow.title}</h2>
      <p className={cn(V5_LEAD_CLASS, 'mt-3 max-w-md')}>{v5Workflow.lead}</p>
    </div>
  );
}

function YouTag() {
  return (
    <Pill tone="amber" className="ml-2 align-middle">
      You
    </Pill>
  );
}

function stageTone(index: number) {
  if (stages[index].needsYou) return 'amber';
  return index === stages.length - 1 ? 'green' : 'teal';
}

/** One booking's card: guest strip, status and step progress on top, the step's scene below. */
function StageCanvas({ active, reduceMotion }: { active: number; reduceMotion: boolean }) {
  return (
    <div
      aria-hidden
      className="border-border bg-card overflow-hidden rounded-[1.75rem] border shadow-[0_32px_80px_-40px_hsl(var(--shadow-color)/0.35)]"
    >
      <div className="border-border flex items-center gap-3 border-b px-6 py-4">
        <span className="bg-primary/10 text-brand-ink flex size-9 items-center justify-center rounded-full text-xs font-bold">
          {sampleGuest.initials}
        </span>
        <div className="min-w-0">
          <p className="text-foreground text-sm font-bold">{sampleGuest.name}</p>
          <p className="text-muted-foreground text-xs">
            {sampleGuest.stay} · {sampleGuest.unit}
          </p>
        </div>
        <div className="ml-auto flex w-36 flex-col items-end gap-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={stages[active].status}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Pill tone={stageTone(active)}>{stages[active].status}</Pill>
            </motion.span>
          </AnimatePresence>
          <div className="flex w-full gap-1">
            {stages.map((stage, index) => (
              <span
                key={stage.status}
                className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full"
              >
                <motion.span
                  className="bg-primary absolute inset-0 origin-left rounded-full"
                  initial={false}
                  animate={{ scaleX: index <= active ? 1 : 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.45, ease: EASE }}
                />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex h-[26rem] items-center justify-center px-8 [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px] xl:h-[28rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            className="flex w-full justify-center"
            initial={reduceMotion ? false : { opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              transition: { duration: 0.4, ease: EASE },
            }}
            exit={
              reduceMotion
                ? undefined
                : { opacity: 0, y: -10, filter: 'blur(6px)', transition: { duration: 0.18 } }
            }
          >
            <div className="flex w-full justify-center lg:scale-[1.15] xl:scale-[1.3]">
              <WorkflowScene index={active} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Phone and tablet: a timeline whose rail fills as the reader scrolls down the steps. */
function WorkflowTimeline() {
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 0.7', 'end 0.7'] });

  return (
    <div className={cn('public-shell lg:hidden', V5_SECTION_Y)}>
      <Reveal>
        <Header />
      </Reveal>
      <ol ref={listRef} className="relative mt-8">
        <span aria-hidden className="bg-border absolute bottom-6 left-[9px] top-2 w-0.5" />
        <motion.span
          aria-hidden
          className="bg-primary absolute bottom-6 left-[9px] top-2 w-0.5 origin-top"
          style={{ scaleY: scrollYProgress }}
        />
        {stages.map((stage, index) => (
          <li key={stage.status} className="relative flex gap-4 pb-9 last:pb-0">
            <span className="border-primary bg-primary relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2">
              <Check className="size-3 text-white" strokeWidth={3} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground text-base font-semibold">
                {stage.title}
                {stage.needsYou ? <YouTag /> : null}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{stage.body}</p>
              <InViewWorkflowScene index={index} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The six-step booking story. From `lg` the section pins and scroll walks one booking through
 * every step: words on the left rail, the step playing as a short scene on the right. Rail steps
 * are buttons that scroll to their stop. Below `lg` it is a timeline with a scene per step.
 */
export function V5Workflow() {
  const reduceMotion = usePrefersReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const next = Math.min(stages.length - 1, Math.max(0, Math.floor(value * stages.length)));
    setActive((current) => (current === next ? current : next));
  });

  const goToStage = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const travel = track.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: top + ((index + 0.5) / stages.length) * travel,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <section id="how-it-works" className="bg-muted/40 scroll-mt-20">
      <div
        ref={trackRef}
        className="relative hidden [overflow-anchor:none] lg:block"
        style={{ height: `${stages.length * 55 + 45}vh` }}
      >
        <div className="sticky top-0 flex h-[100dvh] items-center pt-[var(--public-nav-h)]">
          <div className="public-shell w-full">
            <div className="grid grid-cols-[0.85fr_1.15fr] items-center gap-14 xl:gap-24">
              <div>
                <Header />
                <ol className="relative mt-8">
                  <span
                    aria-hidden
                    className="bg-border absolute bottom-[22px] left-[9px] top-[22px] w-0.5"
                  />
                  <motion.span
                    aria-hidden
                    className="bg-primary absolute left-[9px] top-[22px] w-0.5 origin-top"
                    style={{ bottom: '22px', scaleY: scrollYProgress }}
                  />
                  {stages.map((stage, index) => {
                    const reached = index <= active;
                    const current = index === active;
                    return (
                      <li key={stage.status}>
                        <button
                          type="button"
                          onClick={() => goToStage(index)}
                          aria-current={current ? 'step' : undefined}
                          className="focus-visible:ring-ring group relative flex min-h-11 w-full gap-4 rounded-lg py-2.5 text-left focus-visible:outline-none focus-visible:ring-2"
                        >
                          <span
                            className={cn(
                              'relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300',
                              reached ? 'border-primary bg-primary' : 'border-border bg-background'
                            )}
                          >
                            {reached ? (
                              <Check className="size-3 text-white" strokeWidth={3} aria-hidden />
                            ) : null}
                          </span>
                          <span className="min-w-0">
                            <span
                              className={cn(
                                'block text-base font-semibold transition-colors duration-300',
                                current
                                  ? 'text-foreground'
                                  : 'text-muted-foreground group-hover:text-foreground'
                              )}
                            >
                              {stage.title}
                              {stage.needsYou ? <YouTag /> : null}
                            </span>
                            {/* CSS grid rows, not a measured `height: auto` tween: framer re-pins
                                the window scroll while it measures, which cuts a smooth jump
                                (hero "Watch the tour", nav links) short inside this section. */}
                            <span
                              className={cn(
                                'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                                current
                                  ? 'grid-rows-[1fr] opacity-100'
                                  : 'grid-rows-[0fr] opacity-0'
                              )}
                            >
                              <span className="text-muted-foreground block max-w-sm overflow-hidden text-sm leading-relaxed">
                                <span className="block pt-1">{stage.body}</span>
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <StageCanvas active={active} reduceMotion={reduceMotion} />
            </div>
          </div>
        </div>
      </div>

      <WorkflowTimeline />
    </section>
  );
}
