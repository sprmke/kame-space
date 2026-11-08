import { useLayoutEffect, useRef, useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Star, Ticket } from 'lucide-react';

import {
  MockCard,
  SceneFrame,
  TapPulse,
} from '@/features/guest/auth/components/GuestShowcaseSceneKit';
import { useShowcaseSteps } from '@/features/guest/auth/hooks/useShowcaseTimeline';
import { SWAP, pop, rise } from '@/features/guest/auth/lib/guestShowcaseMotion';
import { voucherReelPool } from '@/features/guest/sd-form/lib/voucher';
import { VOUCHER_WHEEL_SEGMENT_FILLS } from '@/features/guest/sd-form/lib/voucherWheelPalette';

import { cn } from '@/lib/utils';

/*
 * The real after-stay reward: guests spin for a next-stay voucher (same default prize pool and
 * colors as the live wheel in the deposit refund flow).
 */

const PRIZES = [...voucherReelPool()].sort((a, b) => a.amount - b.amount);
const WINNER_INDEX = Math.max(
  0,
  PRIZES.findIndex((prize) => prize.amount === 15)
);
const SEGMENT = 360 / PRIZES.length;
const SPIN_TURNS = 5;
const TARGET_ROTATION = SPIN_TURNS * 360 + (360 - (WINNER_INDEX * SEGMENT + SEGMENT / 2));
const WINNER_LABEL =
  (PRIZES[WINNER_INDEX]?.amount ?? 15) >= 100
    ? 'a free stay'
    : `${PRIZES[WINNER_INDEX]?.amount ?? 15}% off`;
const BULBS = 14;

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(start: number, end: number) {
  const a = polar(100, 100, 88, end);
  const b = polar(100, 100, 88, start);
  return `M100 100 L${a.x} ${a.y} A88 88 0 0 0 ${b.x} ${b.y} Z`;
}

function useSquareSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize(Math.floor(Math.min(width, height)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

function Wheel({ spinning, landed }: { spinning: boolean; landed: boolean }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative size-full">
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 size-full drop-shadow-[0_6px_14px_rgb(0_0_0/0.18)]"
      >
        <circle cx="100" cy="100" r="98" className="fill-primary-strong" />
        {Array.from({ length: BULBS }, (_, index) => {
          const { x, y } = polar(100, 100, 93, (360 / BULBS) * index);
          return (
            <motion.circle
              key={index}
              cx={x}
              cy={y}
              r="2.6"
              fill="#fde68a"
              initial={false}
              animate={
                reduce ? { opacity: 1 } : { opacity: spinning || landed ? [0.35, 1, 0.35] : 0.8 }
              }
              transition={{
                duration: spinning ? 0.35 : 0.9,
                repeat: spinning || landed ? Infinity : 0,
                delay: (index % 2) * (spinning ? 0.17 : 0.45),
              }}
            />
          );
        })}
      </svg>
      {/* Rotate an HTML layer: its transform origin is the true center, unlike an SVG group. */}
      <motion.div
        className="absolute inset-0"
        initial={{ rotate: reduce ? TARGET_ROTATION : 0 }}
        animate={{ rotate: spinning || landed ? TARGET_ROTATION : 0 }}
        transition={{ duration: 3.2, ease: [0.12, 0.8, 0.22, 1] }}
      >
        <svg viewBox="0 0 200 200" className="size-full">
          {PRIZES.map((prize, index) => {
            const start = index * SEGMENT;
            const mid = start + SEGMENT / 2;
            const label = prize.amount >= 100 ? 'FREE' : `${prize.amount}%`;
            const pos = polar(100, 100, 60, mid);
            return (
              <g key={prize.code}>
                <path
                  d={slicePath(start, start + SEGMENT)}
                  fill={VOUCHER_WHEEL_SEGMENT_FILLS[index % VOUCHER_WHEEL_SEGMENT_FILLS.length]}
                />
                {landed && index === WINNER_INDEX ? (
                  <motion.path
                    d={slicePath(start, start + SEGMENT)}
                    fill="white"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.45, 0, 0.45, 0] }}
                    transition={{ duration: 1.2 }}
                  />
                ) : null}
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${mid} ${pos.x} ${pos.y})`}
                  className="fill-white font-bold"
                  style={{ fontSize: label === 'FREE' ? 12 : 15 }}
                >
                  {label}
                </text>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="88" fill="none" stroke="white" strokeOpacity="0.5" />
        </svg>
      </motion.div>
    </div>
  );
}

function WinTicket({ showBookAgain }: { showBookAgain: boolean }) {
  const notchLeft = 'radial-gradient(circle at 0 50%, transparent 6px, #000 6.5px)';
  const notchRight = 'radial-gradient(circle at 100% 50%, transparent 6px, #000 6.5px)';
  const sparks = [-60, -30, 0, 30, 60, 90, -90];

  return (
    <div className="relative">
      {sparks.map((angle, index) => {
        const { x, y } = polar(0, 0, 46, angle);
        return (
          <motion.span
            key={angle}
            aria-hidden
            className={cn(
              'absolute left-1/2 top-1/2 size-1.5 rounded-full',
              index % 2 ? 'bg-amber-400' : 'bg-rose-400'
            )}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], x: x * 1.8, y: y * 1.2, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.1 + index * 0.03, ease: 'easeOut' }}
          />
        );
      })}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 20 }}
        className="bg-primary-strong text-primary-foreground rounded-lg py-2 pl-3.5 pr-3"
        style={{
          maskImage: `${notchLeft}, ${notchRight}`,
          WebkitMaskImage: `${notchLeft}, ${notchRight}`,
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
        }}
      >
        <span className="flex items-center gap-2">
          <Ticket className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold leading-tight">
              You won {WINNER_LABEL}
            </span>
            <span className="block text-[9px] text-white/80">Your next stay at Sunset 1BR</span>
          </span>
        </span>
        <span className="mt-1.5 flex min-h-[22px] items-center justify-between gap-2 border-t border-dashed border-white/35 pt-1.5">
          <span className="text-[9px] font-semibold tracking-wide text-white/85">
            {PRIZES[WINNER_INDEX]?.code ?? 'OFF-15'}
          </span>
          {showBookAgain ? (
            <motion.span
              {...pop(0)}
              className="text-primary-strong rounded-full bg-white px-2 py-0.5 text-[10px] font-bold"
            >
              Book again
            </motion.span>
          ) : null}
        </span>
      </motion.div>
    </div>
  );
}

export function GuestShowcasePerksScene() {
  // tap Spin, wheel spins, lands, book again, deposit back
  const step = useShowcaseSteps([900, 1100, 4400, 5100, 5900]);
  const { ref: wheelBoxRef, size } = useSquareSize();
  const spinning = step >= 2 && step < 3;
  const landed = step >= 3;

  return (
    <SceneFrame className="@[420px]:gap-4 flex-row items-center gap-3">
      <div ref={wheelBoxRef} className="flex h-full flex-[0_0_46%] items-center justify-center">
        {size > 0 ? (
          <div className="relative" style={{ width: size, height: size }}>
            <Wheel spinning={spinning} landed={landed} />
            <motion.span
              aria-hidden
              className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[3px]"
              animate={spinning ? { rotate: [0, -16, 0] } : { rotate: 0 }}
              transition={spinning ? { duration: 0.16, repeat: Infinity } : { duration: 0.2 }}
              style={{ originY: '0%' }}
            >
              <span className="border-t-foreground block border-x-[8px] border-t-[14px] border-x-transparent drop-shadow" />
            </motion.span>
            <span className="absolute inset-0 flex items-center justify-center">
              <span
                className={cn(
                  '@[420px]:text-[11px] relative flex size-[30%] items-center justify-center rounded-full border-4 border-white text-[10px] font-bold shadow-md transition-colors duration-300',
                  landed ? 'bg-card text-primary' : 'bg-primary-strong text-primary-foreground'
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={landed ? 'won' : 'spin'} {...SWAP}>
                    {landed ? <Check className="size-4" strokeWidth={3} aria-hidden /> : 'Spin'}
                  </motion.span>
                </AnimatePresence>
                <TapPulse atMs={900} />
              </span>
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <motion.span
          {...rise(0.1)}
          className="bg-card border-border/70 text-foreground flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold"
        >
          Review sent
          <span className="flex">
            {[0, 1, 2, 3, 4].map((star) => (
              <Star key={star} className="size-2.5 fill-amber-400 text-amber-400" aria-hidden />
            ))}
          </span>
        </motion.span>

        <div className="min-h-[74px]">
          <AnimatePresence mode="wait" initial={false}>
            {landed ? (
              <motion.div key="won" initial={{ opacity: 1 }}>
                <WinTicket showBookAgain={step >= 4} />
              </motion.div>
            ) : (
              <motion.div key="pitch" {...rise(0.2)} exit={{ opacity: 0, y: -6 }}>
                <p className="text-foreground @[420px]:text-sm text-[13px] font-bold leading-tight">
                  Thanks for staying!
                </p>
                <p className="text-muted-foreground @[420px]:text-[11px] mt-0.5 text-[10px] leading-snug">
                  Spin for a voucher on your next stay.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div {...rise(0.3)}>
          <MockCard className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span className="text-foreground text-[10px] font-semibold">Deposit ₱3,000</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={step >= 5 ? 'back' : 'pending'}
                {...SWAP}
                className={cn(
                  'flex items-center gap-1 text-[10px]',
                  step >= 5 ? 'text-primary font-semibold' : 'text-muted-foreground'
                )}
              >
                {step >= 5 ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
                {step >= 5 ? 'Sent to GCash' : 'On its way'}
              </motion.span>
            </AnimatePresence>
          </MockCard>
        </motion.div>
      </div>
    </SceneFrame>
  );
}
