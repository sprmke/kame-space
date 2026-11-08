import { useLayoutEffect, useRef, useState } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { BookOpenText, Check, Clock, Copy, KeyRound, type LucideIcon, Wifi } from 'lucide-react';

import {
  MockCard,
  SceneFrame,
  SceneLabel,
  TapPulse,
} from '@/features/guest/auth/components/GuestShowcaseSceneKit';
import { useShowcaseSteps } from '@/features/guest/auth/hooks/useShowcaseTimeline';
import { SWAP, pop } from '@/features/guest/auth/lib/guestShowcaseMotion';

/* ------------------------------ Stay guide ------------------------------ */

function Callout({ icon: Icon, label, show }: { icon: LucideIcon; label: string; show: boolean }) {
  return (
    <div className="min-h-[26px]">
      {show ? (
        <motion.div {...pop(0)}>
          <MockCard className="flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-md">
            <Icon className="text-primary size-3" aria-hidden />
            <span className="text-foreground whitespace-nowrap text-[10px] font-semibold">
              {label}
            </span>
          </MockCard>
        </motion.div>
      ) : null}
    </div>
  );
}

function useScrollDistance() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const measure = () => setDistance(Math.max(0, content.scrollHeight - viewport.clientHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return { viewportRef, contentRef, distance };
}

export function GuestShowcaseGuideScene() {
  // tap Wi-Fi, copied, page scrolls to rules + steps, checkout callout
  const step = useShowcaseSteps([1100, 1350, 2300, 3300, 4400]);
  const { viewportRef, contentRef, distance } = useScrollDistance();
  const copied = step >= 2;

  return (
    <SceneFrame className="@[420px]:gap-4 flex-row items-stretch justify-center gap-3">
      <div className="@[460px]:flex hidden flex-1 flex-col items-end justify-center gap-2">
        <Callout icon={KeyRound} label="Check-in from 2 PM" show />
        <Callout icon={Check} label="Wi-Fi copied" show={copied} />
      </div>

      <div className="relative h-full w-[min(200px,64%)] shrink-0 rounded-[22px] bg-zinc-900 p-[5px] shadow-[0_12px_28px_-10px_rgb(0_0_0/0.45)] dark:bg-zinc-700">
        <div
          ref={viewportRef}
          className="bg-background relative h-full overflow-hidden rounded-[17px]"
        >
          <span
            aria-hidden
            className="from-background pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b to-transparent"
          />
          <span
            aria-hidden
            className="absolute left-1/2 top-1 z-10 h-1 w-9 -translate-x-1/2 rounded-full bg-zinc-900/80 dark:bg-zinc-700"
          />
          <motion.div
            ref={contentRef}
            className="space-y-1.5 p-1.5 pt-3"
            initial={false}
            animate={{ y: step >= 3 ? -distance : 0 }}
            transition={{ duration: 2.2, ease: [0.65, 0, 0.35, 1] }}
          >
            <div
              className="rounded-lg px-2.5 py-2 text-white"
              style={{
                backgroundImage:
                  'linear-gradient(140deg, hsl(18 72% 58%), hsl(345 48% 44%) 70%, hsl(320 40% 34%))',
              }}
            >
              <p className="text-[8px] font-semibold uppercase tracking-wider text-white/80">
                Stay guide
              </p>
              <p className="text-[11px] font-bold leading-tight">Welcome, Ana</p>
              <p className="text-[9px] text-white/85">Sunset 1BR Condo · Dec 9 to 12</p>
            </div>

            <MockCard className="flex items-center gap-1.5 rounded-md p-1.5">
              <Wifi className="text-primary size-3 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-[10px] font-semibold">Sunset_5G</span>
                <span className="text-muted-foreground block text-[9px]">sunnydays24</span>
              </span>
              <span className="bg-primary/10 text-primary relative flex items-center gap-0.5 overflow-hidden rounded-full px-1.5 py-0.5 text-[9px] font-semibold">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={copied ? 'copied' : 'copy'}
                    {...SWAP}
                    className="flex items-center gap-0.5"
                  >
                    {copied ? (
                      <Check className="size-2.5" strokeWidth={3} aria-hidden />
                    ) : (
                      <Copy className="size-2.5" aria-hidden />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </motion.span>
                </AnimatePresence>
                <TapPulse atMs={1100} />
              </span>
            </MockCard>

            <MockCard className="flex items-center gap-1.5 rounded-md p-1.5">
              <KeyRound className="text-primary size-3 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-[10px] font-semibold">Unit 1204</span>
                <span className="text-muted-foreground block text-[9px]">Tower B, 12th floor</span>
              </span>
            </MockCard>

            <MockCard className="rounded-md p-1.5">
              <SceneLabel className="mb-1 text-[8px]">House rules</SceneLabel>
              <div className="flex flex-wrap gap-1">
                {['No smoking', 'Quiet after 10 PM', 'Max 4 guests'].map((rule) => (
                  <span
                    key={rule}
                    className="bg-muted text-foreground rounded-full px-1.5 py-0.5 text-[9px]"
                  >
                    {rule}
                  </span>
                ))}
              </div>
            </MockCard>

            <MockCard className="space-y-1 rounded-md p-1.5">
              <SceneLabel className="text-[8px]">Check-in steps</SceneLabel>
              {['Show your pass at the lobby', 'Pick up keys at the desk', 'Head up to 1204'].map(
                (item, index) => (
                  <p key={item} className="text-foreground flex items-center gap-1.5 text-[9px]">
                    <span className="bg-primary-strong text-primary-foreground flex size-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold">
                      {index + 1}
                    </span>
                    {item}
                  </p>
                )
              )}
            </MockCard>

            <MockCard className="flex items-center gap-1.5 rounded-md p-1.5">
              <Clock className="text-primary size-3 shrink-0" aria-hidden />
              <span className="text-foreground text-[10px] font-semibold">Check out by 12 PM</span>
            </MockCard>
          </motion.div>
        </div>
      </div>

      <div className="@[460px]:flex hidden flex-1 flex-col items-start justify-center gap-2">
        <Callout icon={BookOpenText} label="House rules" show={step >= 4} />
        <Callout icon={Clock} label="Check out by 12 PM" show={step >= 5} />
      </div>
    </SceneFrame>
  );
}
