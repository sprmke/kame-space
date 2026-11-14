import { useRef, useState } from 'react';

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { Bot, Check, CircleDollarSign, Megaphone, MessageSquare } from 'lucide-react';

import {
  type V4Outcome,
  v4Outcomes,
} from '@/features/guest/marketing/for-hosts/v4/data/hostLandingV4';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;

function OutcomeScene({ outcome }: { outcome: V4Outcome }) {
  const reduceMotion = usePrefersReducedMotion();
  const scene = outcome.scene;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={scene}
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -12, scale: 0.99 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="absolute inset-0 flex items-center justify-center p-5 sm:p-8 lg:p-10"
      >
        {scene === 'earn' ? (
          <div className="w-full max-w-md">
            <div className="bg-white/8 rounded-2xl border border-white/10 p-5 backdrop-blur sm:p-6">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-medium text-white/50">Direct booking</p>
                  <p className="mt-2 text-xl font-bold text-white">Monaco City View</p>
                  <p className="mt-1 text-sm text-white/55">Nov 21 to 24 · 3 nights</p>
                </div>
                <span className="bg-primary/20 text-primary flex size-11 items-center justify-center rounded-xl">
                  <CircleDollarSign className="size-5" aria-hidden />
                </span>
              </div>
              <div className="mt-8 space-y-4 text-sm">
                <div className="flex justify-between text-white/65">
                  <span>Guest total</span>
                  <span>₱12,900</span>
                </div>
                <div className="flex justify-between text-white/65">
                  <span>Kame booking commission</span>
                  <span>₱0</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-4 text-base font-semibold text-white">
                  <span>Property revenue</span>
                  <span>₱12,900</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-white/40">
              Payment provider fees may still apply.
            </p>
          </div>
        ) : null}

        {scene === 'operate' ? (
          <div className="w-full max-w-lg">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0">
              {[
                'Booking reviewed',
                'Documents approved',
                'Check-in details sent',
                'Deposit refund tracked',
              ].map((label, index) => (
                <div key={label} className="contents">
                  <div className="flex flex-col items-center">
                    <motion.span
                      initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 0.08, duration: 0.35 }}
                      className="bg-primary-strong text-primary-foreground flex size-9 items-center justify-center rounded-full"
                    >
                      <Check className="size-4" aria-hidden />
                    </motion.span>
                    {index < 3 ? <span className="h-12 w-px bg-white/15" /> : null}
                  </div>
                  <div className="pt-1.5">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="mt-1 text-xs text-white/45">Connected to the same booking</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {scene === 'serve' ? (
          <div className="w-full max-w-md space-y-4">
            <div className="ml-auto max-w-[84%] rounded-2xl rounded-br-md bg-white/10 px-4 py-3 text-sm text-white/80">
              Is parking included, and what time can we check in?
            </div>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.45, ease: EASE }}
              className="border-primary/20 bg-primary/12 max-w-[92%] rounded-2xl rounded-bl-md border px-4 py-4"
            >
              <div className="text-primary flex items-center gap-2 text-xs font-semibold">
                <Bot className="size-4" aria-hidden />
                Kame receptionist
              </div>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Check-in starts at 2 PM. Parking is available by request, and I can show you where
                to submit the details.
              </p>
            </motion.div>
            <div className="flex items-center gap-2 px-1 text-xs text-white/40">
              <MessageSquare className="size-3.5" aria-hidden />
              Answered from property information
            </div>
          </div>
        ) : null}

        {scene === 'grow' ? (
          <div className="w-full max-w-lg">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-white/8 rounded-2xl border border-white/10 p-5">
                <Megaphone className="text-primary size-5" aria-hidden />
                <p className="mt-7 text-xs text-white/45">Social post</p>
                <p className="mt-1 text-base font-semibold text-white">Weekend city escape</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="bg-primary h-full w-4/5 rounded-full" />
                </div>
              </div>
              <div className="bg-white/8 rounded-2xl border border-white/10 p-5">
                <span className="text-primary text-3xl font-bold tracking-tight">10%</span>
                <p className="mt-7 text-xs text-white/45">Return guest voucher</p>
                <p className="mt-1 text-base font-semibold text-white">Ready to share</p>
              </div>
            </div>
            <div className="bg-white/8 mt-3 rounded-2xl border border-white/10 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Direct booking page</span>
                <span className="font-semibold text-emerald-300">Live</span>
              </div>
            </div>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}

export function V4OutcomeJourney() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (reduceMotion) return;
    const next = Math.min(
      v4Outcomes.length - 1,
      Math.max(0, Math.floor(latest * v4Outcomes.length))
    );
    setActiveIndex(next);
  });

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="relative scroll-mt-20 bg-slate-950 text-white lg:min-h-[330vh]"
    >
      <div className="container mx-auto px-4 py-20 sm:px-6 sm:py-28 lg:sticky lg:top-0 lg:grid lg:min-h-svh lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-14 lg:px-8 lg:py-16 xl:gap-24">
        <div>
          <p className="text-primary text-sm font-semibold">One system, four outcomes</p>
          <h2 className="mt-4 max-w-[12ch] text-balance text-4xl font-bold tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl lg:leading-[1]">
            Better hosting compounds.
          </h2>
          <div className="mt-10 space-y-3 lg:mt-12">
            {v4Outcomes.map((outcome, index) => {
              const active = index === activeIndex;
              return (
                <button
                  type="button"
                  key={outcome.id}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    'focus-visible:ring-primary group relative w-full rounded-2xl border px-4 py-4 text-left transition-[background-color,border-color] focus-visible:outline-none focus-visible:ring-2 sm:px-5',
                    active ? 'bg-white/8 border-white/20' : 'border-transparent hover:bg-white/5'
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={cn(
                        'mt-0.5 text-xs font-bold tabular-nums',
                        active ? 'text-primary' : 'text-white/30'
                      )}
                    >
                      {outcome.number}
                    </span>
                    <div>
                      <p
                        className={cn(
                          'text-sm font-semibold',
                          active ? 'text-white' : 'text-white/55'
                        )}
                      >
                        {outcome.kicker}
                      </p>
                      <AnimatePresence initial={false}>
                        {active ? (
                          <motion.div
                            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <h3 className="mt-3 max-w-md text-xl font-bold tracking-tight text-white sm:text-2xl">
                              {outcome.title}
                            </h3>
                            <p className="mt-3 max-w-lg text-sm leading-6 text-white/55">
                              {outcome.body}
                            </p>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative mt-10 aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_40%),linear-gradient(145deg,#111827,#020617)] shadow-2xl lg:mt-0 lg:aspect-[1.05/1]">
          <OutcomeScene outcome={v4Outcomes[activeIndex]} />
          <div className="absolute inset-x-6 bottom-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/40">
            <span>{v4Outcomes[activeIndex].detail}</span>
            <span className="ml-4 shrink-0 tabular-nums">
              {activeIndex + 1} / {v4Outcomes.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
