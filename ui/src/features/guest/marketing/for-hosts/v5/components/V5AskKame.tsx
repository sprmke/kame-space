import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { Send } from 'lucide-react';

import { Pill } from '@/features/guest/marketing/for-hosts/shared/Pill';
import { Reveal } from '@/features/guest/marketing/for-hosts/shared/Reveal';
import {
  V5_LEAD_CLASS,
  V5_SECTION_Y,
  V5_TITLE_CLASS,
} from '@/features/guest/marketing/for-hosts/v5/components/V5Heading';
import { v5Ask, type V5AskMode } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';

import { KameMascotImage } from '@/components/branding/KameMascotImage';
import { useIsBelowXl, usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const { modes } = v5Ask;
const EASE = [0.16, 1, 0.3, 1] as const;
const TYPING_MS = 900;

/** Decorative thread: the chips below it drive what plays. */
function Thread({
  mode,
  asked,
  typing,
  reduceMotion,
}: {
  mode: V5AskMode;
  asked: number | null;
  typing: boolean;
  reduceMotion: boolean;
}) {
  const item = asked === null ? null : mode.questions[asked];
  if (!item) return null;
  const NoteIcon = mode.noteIcon;

  return (
    <>
      <motion.p
        key={`q-${mode.id}-${asked}`}
        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="bg-primary-strong ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm leading-snug text-white"
      >
        {item.question}
      </motion.p>
      {typing ? (
        <motion.span
          key="typing"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-muted flex w-fit items-center gap-1 rounded-2xl rounded-bl-md px-3.5 py-3"
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="bg-muted-foreground/60 size-1.5 rounded-full motion-safe:animate-bounce"
              style={{ animationDelay: `${dot * 120}ms` }}
            />
          ))}
        </motion.span>
      ) : (
        <motion.div
          key={`a-${mode.id}-${asked}`}
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="max-w-[85%]"
        >
          <div className="bg-muted text-foreground w-fit rounded-2xl rounded-bl-md px-3.5 py-2 text-sm leading-snug">
            <p>{item.answer}</p>
            {item.rows ? (
              <ul className="divide-border mt-1.5 min-w-[13rem] divide-y">
                {item.rows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-baseline justify-between gap-4 py-1.5 text-[13px]"
                  >
                    <span className="font-semibold">{row.label}</span>
                    <span className="text-muted-foreground tabular-nums">{row.value}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {item.note ? (
            <Pill tone="amber" className="mt-2">
              <NoteIcon className="size-3" aria-hidden />
              {item.note}
            </Pill>
          ) : null}
        </motion.div>
      )}
    </>
  );
}

/**
 * Two AI helpers in one chat window: the guest-facing receptionist and the host's dashboard
 * assistant. A switch in the window header swaps the helper; the one-line chips are real buttons
 * and each helper's last chip shows its safety step (hand-off to host, or waits for Confirm).
 * Kame peeks from behind the card. The pose is square with a flat cut on its right and bottom
 * (the right cut runs from 0.5 to 0.93 of its height), and the card must always cover both.
 * Below `xl` it hangs over the card's top-left corner: the card's top crosses the pose at 0.52
 * of its height (just under the chin, the `0.52` in the padding classes) and the card's left edge
 * crosses it at 0.32 of its width, so the headset hand shows beside the card while both cuts stay
 * hidden. On phones the card steps in by 0.14 of the pose width so Kame's body stays on screen.
 * From `xl` there is room beside the card, so it peeks around the left edge instead: the card's
 * left edge sits at 0.72 of the pose width, just past the flat right cut. `--kame` is the pose
 * width throughout.
 */
export function V5AskKame() {
  const reduceMotion = usePrefersReducedMotion();
  const sidePeek = !useIsBelowXl();
  const [modeIndex, setModeIndex] = useState(0);
  const [asked, setAsked] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const mode = modes[modeIndex];

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const ask = (index: number) => {
    window.clearTimeout(timer.current);
    setAsked(index);
    if (reduceMotion) {
      setTyping(false);
      return;
    }
    setTyping(true);
    timer.current = window.setTimeout(() => setTyping(false), TYPING_MS);
  };

  const switchMode = (index: number) => {
    if (index === modeIndex) return;
    setModeIndex(index);
    ask(0);
  };

  return (
    <section
      id="guest-help"
      className={cn(
        'public-shell scroll-mt-20 [--kame:10.5rem] sm:[--kame:11.5rem] lg:[--kame:12.5rem] xl:[--kame:13rem]',
        V5_SECTION_Y
      )}
    >
      {/* Zero-minimum tracks: the one-line chip row must scroll, never widen the column. */}
      <div className="grid grid-cols-1 items-center gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:gap-x-24">
        {/* Same top room as the card column, so the title stays centred on the card. */}
        <Reveal className="lg:pt-[calc(var(--kame)*0.52)] xl:pt-0">
          <h2 className={cn(V5_TITLE_CLASS, 'lg:max-w-[16ch]')}>{v5Ask.title}</h2>
          <p className={cn(V5_LEAD_CLASS, 'mt-3 max-w-md')}>{v5Ask.lead}</p>
        </Reveal>

        <motion.div
          onViewportEnter={() => {
            if (asked === null) ask(0);
          }}
          viewport={{ once: true, amount: 0.6 }}
          initial={reduceMotion ? false : { opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative mx-auto w-full max-w-[30rem] pl-[calc(var(--kame)*0.14)] pt-[calc(var(--kame)*0.52)] lg:mx-0 lg:ml-auto lg:pl-0 xl:pt-0"
        >
          {/* Behind the card: it slides out from under the top edge (or the left edge from `xl`).
              The mask fades out the pose's flat bottom cut where it shows beside the card. */}
          <motion.div
            aria-hidden
            initial={
              reduceMotion ? false : sidePeek ? { x: '30%', opacity: 0 } : { y: '35%', opacity: 0 }
            }
            whileInView={{ x: 0, y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.3 }}
            className="pointer-events-none absolute left-[calc(var(--kame)*-0.18)] top-0 z-0 w-[var(--kame)] [mask-image:linear-gradient(to_bottom,#000_76%,transparent_92%)] lg:left-[calc(var(--kame)*-0.32)] xl:left-[calc(var(--kame)*-0.72)] xl:top-[calc(50%-var(--kame)/2)]"
          >
            <KameMascotImage pose="ai-peek-right-listen" />
          </motion.div>

          <div className="border-border bg-card relative z-10 overflow-hidden rounded-[1.75rem] border shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]">
            <div className="border-border border-b p-2">
              <div
                role="group"
                aria-label={v5Ask.modesLabel}
                className="bg-muted/70 grid grid-cols-2 gap-1 rounded-full p-1"
              >
                {modes.map((item, index) => {
                  const selected = index === modeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => switchMode(index)}
                      className="focus-visible:ring-ring relative flex min-h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
                    >
                      {selected ? (
                        <motion.span
                          layoutId="v5-ask-mode"
                          className="bg-card absolute inset-0 rounded-full shadow-sm"
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : { type: 'spring', stiffness: 380, damping: 32 }
                          }
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          'relative size-4 shrink-0 transition-colors max-[359px]:hidden',
                          selected ? 'text-primary' : 'text-muted-foreground'
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'relative whitespace-nowrap transition-colors',
                          selected ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div aria-hidden className="flex min-h-[12.5rem] flex-col gap-2 px-5 py-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode.id}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-2"
                >
                  <Thread mode={mode} asked={asked} typing={typing} reduceMotion={reduceMotion} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* One line of small chips; on phones it scrolls sideways under a soft right-edge fade. */}
            <div
              role="group"
              aria-label={v5Ask.promptLabel}
              className="flex gap-1.5 overflow-x-auto px-4 pb-3 pt-1.5 [scrollbar-width:none] max-sm:pr-10 max-sm:[mask-image:linear-gradient(to_right,#000_85%,transparent)] [&::-webkit-scrollbar]:hidden"
            >
              {mode.questions.map((item, index) => {
                const selected = asked === index;
                return (
                  <button
                    key={item.chip}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => ask(index)}
                    // 32px chip with a taller invisible hit area, so the tap target stays 44px.
                    className={cn(
                      'focus-visible:ring-ring relative h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors before:absolute before:-inset-y-1.5 before:inset-x-0 focus-visible:outline-none focus-visible:ring-2',
                      selected
                        ? 'border-primary bg-primary/10 text-brand-ink'
                        : 'border-border bg-background text-foreground hover:border-primary/40'
                    )}
                  >
                    {item.chip}
                  </button>
                );
              })}
            </div>
            {/* Screen readers get the answer here; the thread above is decorative. */}
            <p className="sr-only" aria-live="polite">
              {asked !== null && !typing ? mode.questions[asked].answer : ''}
            </p>

            <div
              aria-hidden
              className="border-border mx-4 mb-4 flex items-center gap-2 rounded-full border py-1.5 pl-4 pr-1.5"
            >
              <span className="text-muted-foreground flex-1 truncate text-sm">
                {mode.placeholder}
              </span>
              <span className="bg-primary-strong flex size-8 shrink-0 items-center justify-center rounded-full text-white">
                <Send className="size-3.5" aria-hidden />
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
