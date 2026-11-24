import { useEffect, useRef, useState, type ReactNode } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Inbox, Sparkles, User, type LucideIcon } from 'lucide-react';

import { Reveal } from '@/features/guest/marketing/for-hosts/shared/Reveal';
import {
  V5_LEAD_CLASS,
  V5_SECTION_Y,
  V5_TITLE_CLASS,
} from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import {
  V5PoseStack,
  type V5CornerPeek,
} from '@/features/guest/marketing/for-hosts/v5/components/V5PoseStack';
import { v5Ai, type V5AiAction } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const { jobs, steps } = v5Ai;
const POSES = jobs.flatMap((job) =>
  job.action ? [job.pose, job.donePose ?? v5Ai.donePose] : [job.pose]
);
const EASE = [0.16, 1, 0.3, 1] as const;
/**
 * Kame peeks from the card's bottom-right corner. Each job pose has a flat body cut whose hand
 * grips past it; the numbers are where that cut sits across the 448px art (measured from the
 * PNGs), so the cut lands on the card edge and the hand rests on it.
 */
const CORNER_PEEK: V5CornerPeek = {
  radius: '1.75rem',
  edges: {
    'v5-ai-assistant': 356 / 448,
    'v5-ai-receptionist': 353 / 448,
    'v5-ai-receipts': 360 / 448,
    'v5-ai-import': 369 / 448,
    'v5-ai-pricing': 360 / 448,
    'v5-ai-analytics': 363 / 448,
    'v5-ai-replies': 384 / 448,
    'v5-ai-marketing': 354 / 448,
    'v5-ai-done-stamp': 370 / 448,
    'v5-ai-done-celebrate': 360 / 448,
  },
};
/** One job's timeline: the input lands, AI works, the result shows, the host taps, next job. */
const THINK_AT = 450;
const ANSWER_AT = 1150;
const TAP_AT = 2700;
const NEXT_AT = 4700;

type Phase = 'input' | 'thinking' | 'answer';

function Step({
  icon: Icon,
  label,
  tone = 'muted',
  dim = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  tone?: 'muted' | 'ai';
  dim?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="relative grid grid-cols-[2rem_1fr] gap-3">
      {/* Only the marker dims for a step not reached yet, so the label keeps its contrast. */}
      <span
        className={cn(
          'relative z-10 flex size-8 items-center justify-center rounded-full transition-colors duration-300',
          dim
            ? 'bg-muted text-muted-foreground'
            : tone === 'ai'
              ? 'bg-primary-strong text-white'
              : 'bg-muted text-foreground'
        )}
      >
        <Icon className="size-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-semibold">{label}</p>
        {children}
      </div>
    </li>
  );
}

/** How long each mode label shows before it rolls to the next. */
const MODE_ROLL_MS = 1300;

/**
 * The host's one tap. When the job has two modes (Send or Auto-send), the label rolls between
 * them like a drum so the host sees both options; the mode showing at the tap is the one used.
 */
function ActionButton({
  action,
  done,
  onTap,
  reduceMotion,
}: {
  action: V5AiAction;
  done: boolean;
  onTap: () => void;
  reduceMotion: boolean;
}) {
  const modes = action.alt ? [action, action.alt] : [action];
  const [mode, setMode] = useState(0);

  useEffect(() => {
    if (done || modes.length < 2) return;
    const id = window.setInterval(() => setMode((m) => (m + 1) % modes.length), MODE_ROLL_MS);
    return () => window.clearInterval(id);
  }, [done, modes.length]);

  const current = modes[mode];

  return (
    <button
      type="button"
      aria-disabled={done}
      aria-label={done ? current.done : modes.map((m) => m.label).join(' or ')}
      onClick={done ? undefined : onTap}
      className={cn(
        'focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        done ? 'bg-primary/10 text-brand-ink cursor-default' : 'bg-primary-strong text-white'
      )}
    >
      {done ? (
        current.done
      ) : (
        <span aria-hidden className="inline-grid overflow-hidden [perspective:400px]">
          {/* Every label sits in the same cell, hidden, so the button keeps the widest width. */}
          {modes.map((m) => (
            <span key={m.label} className="invisible [grid-area:1/1]">
              {m.label}
            </span>
          ))}
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={current.label}
              initial={reduceMotion ? { opacity: 0 } : { rotateX: -90, y: '60%', opacity: 0 }}
              animate={{ rotateX: 0, y: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { rotateX: 90, y: '-60%', opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="text-center [backface-visibility:hidden] [grid-area:1/1]"
            >
              {current.label}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
    </button>
  );
}

/**
 * The AI jobs section. Every job plays the same three steps (something comes in, AI does the
 * work, the host approves) so the page shows how little is left for the host. It cycles on
 * its own while in view until the host picks a job; after that the approve button waits for
 * a real tap.
 */
export function V5AiWork() {
  const reduceMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState<Phase>('answer');
  const [done, setDone] = useState(false);
  const [auto, setAuto] = useState(true);
  const timers = useRef<number[]>([]);
  const autoRef = useRef(true);
  const visible = useRef(false);
  /** Next job to play when the section scrolls back into view. */
  const resumeAt = useRef<number | null>(0);

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clear, []);

  const later = (run: () => void, ms: number) => {
    timers.current.push(window.setTimeout(run, ms));
  };

  const play = (index: number) => {
    clear();
    resumeAt.current = null;
    setActive(index);
    setDone(false);
    if (reduceMotion) {
      setPhase('answer');
      return;
    }
    setPhase('input');
    later(() => setPhase('thinking'), THINK_AT);
    later(() => setPhase('answer'), ANSWER_AT);
    if (!autoRef.current) return;
    if (jobs[index].action) later(() => setDone(true), TAP_AT);
    later(() => {
      const next = (index + 1) % jobs.length;
      if (visible.current) play(next);
      else resumeAt.current = next;
    }, NEXT_AT);
  };

  const pick = (index: number) => {
    autoRef.current = false;
    setAuto(false);
    play(index);
  };

  const job = jobs[active];
  const Icon = job.icon;
  const answered = phase === 'answer';

  return (
    <section id="ai" className={cn('public-shell scroll-mt-20', V5_SECTION_Y)}>
      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-14 xl:gap-20">
        <div>
          <Reveal>
            <h2 className={V5_TITLE_CLASS}>{v5Ai.title}</h2>
            <p className={cn(V5_LEAD_CLASS, 'mt-3 max-w-xl')}>{v5Ai.lead}</p>
          </Reveal>

          <div
            role="group"
            aria-label={v5Ai.pickerLabel}
            className="mt-6 grid grid-cols-4 gap-1.5 lg:mt-8 lg:grid-cols-2 lg:gap-2"
          >
            {jobs.map((item, index) => {
              const selected = index === active;
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pick(index)}
                  className={cn(
                    'focus-visible:ring-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:flex-row sm:gap-2 sm:text-[13px] lg:min-h-12 lg:justify-start lg:px-3.5 lg:text-sm',
                    selected
                      ? 'border-primary-strong bg-primary-strong text-white'
                      : 'border-border bg-card text-foreground hover:border-primary/40'
                  )}
                >
                  <ItemIcon
                    className={cn('size-4 shrink-0', selected ? 'text-white' : 'text-primary')}
                    strokeWidth={2}
                    aria-hidden
                  />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <motion.div
          onViewportEnter={() => {
            visible.current = true;
            if (autoRef.current && resumeAt.current !== null) play(resumeAt.current);
          }}
          onViewportLeave={() => {
            visible.current = false;
          }}
          viewport={{ amount: 0.4 }}
          className="relative"
        >
          <Reveal className="relative">
            <div className="border-border bg-card ring-primary/10 relative overflow-hidden rounded-[1.75rem] border shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] ring-4">
              <div className="border-border flex items-center gap-3 border-b px-4 py-4 sm:px-6">
                <span className="bg-primary/10 text-brand-ink flex size-11 shrink-0 items-center justify-center rounded-2xl">
                  <Icon className="size-5" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 max-[359px]:min-h-[3.5rem]">
                  <p className="text-foreground text-base font-bold leading-tight">{job.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{job.summary}</p>
                </div>
              </div>

              <ol
                aria-live={auto ? 'off' : 'polite'}
                className="relative space-y-5 px-4 py-5 sm:px-6"
              >
                <span
                  aria-hidden
                  className="bg-border absolute bottom-10 left-8 top-8 w-px sm:left-10"
                />

                <Step icon={Inbox} label={steps.input}>
                  <p className="text-foreground mt-0.5 min-h-10 text-sm font-medium leading-snug">
                    {job.input}
                  </p>
                </Step>

                <Step icon={Sparkles} label={steps.ai} tone="ai" dim={phase === 'input'}>
                  <div className="mt-1.5 min-h-[9.5rem] max-[359px]:min-h-[11rem] sm:min-h-[8.25rem]">
                    {phase === 'thinking' ? (
                      <span
                        aria-hidden
                        className="bg-muted flex w-fit items-center gap-1 rounded-full px-3.5 py-3"
                      >
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full"
                            style={{ animationDelay: `${dot * 120}ms` }}
                          />
                        ))}
                      </span>
                    ) : null}
                    {answered ? (
                      <motion.div
                        key={job.id}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: EASE }}
                        className="bg-muted/60 rounded-2xl px-3.5 py-3 sm:max-w-md"
                      >
                        <p className="text-foreground text-sm font-bold">{job.title}</p>
                        <ul className="divide-border mt-1 divide-y">
                          {job.rows.map((row, index) => (
                            <motion.li
                              key={row.label}
                              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, ease: EASE, delay: 0.1 + index * 0.1 }}
                              className="flex items-baseline justify-between gap-4 py-1.5 text-[13px]"
                            >
                              <span className="text-muted-foreground shrink-0">{row.label}</span>
                              <span className="text-foreground text-right font-semibold">
                                {row.value}
                              </span>
                            </motion.li>
                          ))}
                        </ul>
                      </motion.div>
                    ) : null}
                  </div>
                </Step>

                <Step icon={User} label={steps.you} dim={!answered}>
                  {/* Tall and padded enough to hold Kame (bottom-right corner) without it reaching
                      the AI result above or the button beside it; sizes track Kame's width. Under
                      360px there is no room for both, so Kame hides and the button gets the row. */}
                  <div className="mt-1.5 flex min-h-[5rem] items-start pr-[6.5rem] max-[359px]:min-h-11 max-[359px]:pr-0 sm:min-h-[6rem] sm:pr-28 xl:min-h-[7rem] xl:pr-32">
                    {answered && job.action ? (
                      <ActionButton
                        key={job.id}
                        action={job.action}
                        done={done}
                        onTap={() => setDone(true)}
                        reduceMotion={reduceMotion}
                      />
                    ) : null}
                    {answered && job.handled ? (
                      <p className="text-brand-ink flex items-center gap-2 text-sm font-semibold">
                        <Check className="size-4" strokeWidth={2.5} aria-hidden />
                        {job.handled}
                      </p>
                    ) : null}
                  </div>
                </Step>
              </ol>
            </div>
            {/* Outside the card's clipping so the hand can rest on the edge. */}
            <V5PoseStack
              poses={POSES}
              active={done ? (job.donePose ?? v5Ai.donePose) : job.pose}
              cornerPeek={CORNER_PEEK}
              className="pointer-events-none absolute bottom-0 right-0 z-10 w-28 max-[359px]:hidden sm:w-32 xl:w-36"
            />
          </Reveal>
        </motion.div>
      </div>
    </section>
  );
}
