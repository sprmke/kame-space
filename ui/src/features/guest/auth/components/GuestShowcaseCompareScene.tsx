import { useEffect, useRef, type PointerEvent } from 'react';

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from 'framer-motion';
import {
  ArrowLeftRight,
  Car,
  Check,
  Clock,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Receipt,
  ShieldCheck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';

import { useShowcaseSteps } from '@/features/guest/auth/hooks/useShowcaseTimeline';
import { SHOWCASE_EASE, pop } from '@/features/guest/auth/lib/guestShowcaseMotion';

import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

/*
 * "Same trip, two ways." Five moments of one stay, row by row: on the left, where each chore
 * usually happens (another inbox, another app, a follow-up); on the right, the same moment
 * handled on the guest's trip page. The divider wipes from the clutter to the trip page, rests
 * in the middle, then each row is matched (cross out, connector, check) and a tally closes it.
 * Decorative: the chapter title and description carry the message for screen readers.
 */

const OUR_LABEL = PLATFORM_APP_NAME || 'Book here';

interface Moment {
  usual: { icon: LucideIcon; text: string; short: string; source: string };
  kame: { icon: LucideIcon; text: string; short: string };
  tilt: number;
  nudge: string;
}

const MOMENTS: readonly Moment[] = [
  {
    usual: {
      icon: Users,
      text: 'Booked through a middleman',
      short: 'Via a middleman',
      source: 'Another app',
    },
    kame: { icon: ShieldCheck, text: 'Booked with Mara directly', short: 'Direct with host' },
    tilt: -2.5,
    nudge: '4%',
  },
  {
    usual: {
      icon: MessageSquare,
      text: 'Send the receipt in chat',
      short: 'Receipt by chat',
      source: 'Chat · no reply yet',
    },
    kame: { icon: Receipt, text: 'Receipt uploaded and confirmed', short: 'Receipt confirmed' },
    tilt: 2,
    nudge: '8%',
  },
  {
    usual: {
      icon: Mail,
      text: 'Email your ID to the admin',
      short: 'Email your ID',
      source: 'Email · building',
    },
    kame: { icon: FileText, text: 'Building documents approved', short: 'Docs approved' },
    tilt: -1.5,
    nudge: '2%',
  },
  {
    usual: {
      icon: Phone,
      text: 'Call around for parking',
      short: 'Call for parking',
      source: 'Phone · missed call',
    },
    kame: { icon: Car, text: 'Parking P2-14 with your stay', short: 'Parking P2-14' },
    tilt: 2.5,
    nudge: '6%',
  },
  {
    usual: {
      icon: Clock,
      text: 'Chase your deposit refund',
      short: 'Chase deposit',
      source: 'Follow up in 3 days',
    },
    kame: { icon: Wallet, text: 'Deposit refund tracked', short: 'Refund tracked' },
    tilt: -2,
    nudge: '3%',
  },
];

/** Shared row grid so both layers and the connectors line up exactly. */
const ROWS_CLASS =
  'absolute inset-x-0 top-9 bottom-10 flex flex-col justify-between gap-1 @[420px]:top-10 @[420px]:bottom-11';

function UsualSide({ matched }: { matched: number }) {
  return (
    <div className="bg-muted absolute inset-0 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-60 [background-image:radial-gradient(hsl(var(--foreground)/0.08)_1px,transparent_1px)] [background-size:10px_10px]"
      />
      <span className="bg-foreground/80 text-background absolute left-2.5 top-2.5 z-10 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
        Usual apps
      </span>
      <div className={ROWS_CLASS}>
        {MOMENTS.map((moment, index) => {
          const crossed = index < matched;
          return (
            <div key={moment.usual.text} className="relative flex-1">
              <motion.div
                className="absolute top-1/2 w-[41%]"
                style={{ left: moment.nudge }}
                initial={{ opacity: 0, scale: 0.85, y: '-50%', rotate: moment.tilt * 3 }}
                animate={{ opacity: crossed ? 0.6 : 1, scale: 1, y: '-50%', rotate: moment.tilt }}
                transition={{
                  opacity: { duration: 0.3, delay: crossed ? 0 : 0.1 + index * 0.14 },
                  scale: { delay: 0.1 + index * 0.14, type: 'spring', stiffness: 380, damping: 16 },
                  rotate: {
                    delay: 0.1 + index * 0.14,
                    type: 'spring',
                    stiffness: 200,
                    damping: 12,
                  },
                }}
              >
                <div className="border-border/70 bg-card @[420px]:px-2 relative flex items-center gap-1.5 rounded-md border px-1.5 py-1 shadow-[0_2px_6px_rgb(0_0_0/0.1)]">
                  <moment.usual.icon
                    className="text-muted-foreground @[420px]:size-3.5 size-3 shrink-0"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground @[420px]:hidden block text-[9.5px] font-semibold leading-tight">
                      {moment.usual.short}
                    </span>
                    <span className="text-foreground @[420px]:block hidden truncate text-[10px] font-semibold">
                      {moment.usual.text}
                    </span>
                    <span className="text-muted-foreground @[420px]:block hidden truncate text-[9px]">
                      {moment.usual.source}
                    </span>
                  </span>
                  {crossed ? (
                    <motion.span
                      {...pop(0)}
                      className="bg-destructive text-destructive-foreground flex size-3.5 shrink-0 items-center justify-center rounded-full"
                    >
                      <X className="size-2" strokeWidth={3.5} aria-hidden />
                    </motion.span>
                  ) : null}
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KameSide({ matched }: { matched: number }) {
  return (
    <div className="from-primary/[0.14] to-background absolute inset-0 overflow-hidden bg-gradient-to-br">
      <span className="bg-primary-strong text-primary-foreground absolute right-2.5 top-2.5 z-10 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
        {OUR_LABEL}
      </span>
      <div className={ROWS_CLASS}>
        {MOMENTS.map((moment, index) => {
          const done = index < matched;
          return (
            <div key={moment.kame.text} className="relative flex-1">
              <div
                className={cn(
                  '@[420px]:px-2 absolute right-[3%] top-1/2 flex w-[44%] -translate-y-1/2 items-center gap-1.5 rounded-md border px-1.5 py-1 transition-colors duration-300',
                  done
                    ? 'border-primary/40 bg-card shadow-[0_2px_6px_rgb(0_0_0/0.08)]'
                    : 'border-border/60 bg-card/70'
                )}
              >
                <moment.kame.icon
                  className="text-primary @[420px]:size-3.5 size-3 shrink-0"
                  aria-hidden
                />
                <span className="text-foreground @[420px]:truncate @[420px]:text-[10px] min-w-0 flex-1 text-[9.5px] font-semibold leading-tight">
                  <span className="@[420px]:hidden">{moment.kame.short}</span>
                  <span className="@[420px]:inline hidden">{moment.kame.text}</span>
                </span>
                <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                  <span className="border-border absolute inset-0 rounded-full border" />
                  {done ? (
                    <motion.span
                      {...pop(0)}
                      className="bg-primary-strong text-primary-foreground absolute inset-0 flex items-center justify-center rounded-full"
                    >
                      <Check className="size-2" strokeWidth={3.5} aria-hidden />
                    </motion.span>
                  ) : null}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Dashed links drawn across the divider as each row is matched. */
function Connectors({ matched }: { matched: number }) {
  return (
    <div aria-hidden className={cn(ROWS_CLASS, 'pointer-events-none z-20')}>
      {MOMENTS.map((moment, index) => (
        <div key={moment.kame.text} className="relative flex-1">
          {index < matched ? (
            <motion.span
              className="border-primary absolute left-[46%] right-[47%] top-1/2 origin-left border-t-2 border-dashed"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3, ease: SHOWCASE_EASE }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Tally({ show }: { show: boolean }) {
  return (
    <div className="@[420px]:bottom-2.5 pointer-events-none absolute inset-x-2.5 bottom-2 z-20 flex items-end justify-between gap-2">
      {show ? (
        <>
          <motion.span
            {...pop(0)}
            className="bg-foreground/80 text-background @[420px]:text-[10px] rounded-full px-2 py-1 text-[9.5px] font-semibold"
          >
            5 places to keep up with
          </motion.span>
          <motion.span
            {...pop(0.15)}
            className="bg-primary-strong text-primary-foreground @[420px]:text-[10px] rounded-full px-2 py-1 text-[9.5px] font-semibold"
          >
            1 trip page
          </motion.span>
        </>
      ) : null}
    </div>
  );
}

const SWEEP_MS = 4000;
const MATCH_TIMES = MOMENTS.map((_, index) => SWEEP_MS + 300 + index * 550);
const TALLY_MS = SWEEP_MS + 300 + MOMENTS.length * 550 + 300;

export function GuestShowcaseCompareScene() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const split = useMotionValue(reduce ? 50 : 100);
  const clipPath = useTransform(split, (value) => `inset(0 ${100 - value}% 0 0)`);
  const handleLeft = useTransform(split, (value) => `${value}%`);
  const step = useShowcaseSteps([...MATCH_TIMES, TALLY_MS]);
  const matched = Math.min(step, MOMENTS.length);

  useEffect(() => {
    if (reduce) return;
    // Show the clutter, wipe to the trip page, then rest in the middle so rows can be matched.
    controls.current = animate(split, [100, 100, 4, 4, 50], {
      duration: SWEEP_MS / 1000,
      times: [0, 0.3, 0.62, 0.76, 1],
      ease: SHOWCASE_EASE,
    });
    return () => controls.current?.stop();
  }, [reduce, split]);

  const moveTo = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const percent = ((clientX - rect.left) / rect.width) * 100;
    split.set(Math.min(96, Math.max(4, percent)));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    controls.current?.stop();
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveTo(event.clientX);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) moveTo(event.clientX);
  };
  const endDrag = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 cursor-ew-resize touch-pan-y select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <KameSide matched={matched} />
      <motion.div className="absolute inset-0" style={{ clipPath }}>
        <UsualSide matched={matched} />
      </motion.div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 z-10 w-0"
        style={{ left: handleLeft }}
      >
        <span className="absolute inset-y-0 -left-px w-0.5 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_0_10px_rgb(0_0_0/0.18)]" />
        <span className="bg-card text-foreground border-border absolute left-0 top-2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full border shadow-md">
          <ArrowLeftRight className="size-3.5" aria-hidden />
        </span>
      </motion.div>

      <Connectors matched={matched} />
      <Tally show={step > MOMENTS.length} />
    </div>
  );
}
