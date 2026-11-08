import { useEffect, useState, type ReactNode } from 'react';

import { motion, type MotionProps } from 'framer-motion';
import {
  Car,
  Check,
  CreditCard,
  KeyRound,
  MapPin,
  Minus,
  Plus,
  ScrollText,
  Wifi,
} from 'lucide-react';

import { cn } from '@/lib/utils';

export const STEP_EASE = [0.32, 0.72, 0, 1] as const;
const ICON = { strokeWidth: 1.6, 'aria-hidden': true } as const;

/** Fade-up entrance with a delay. Empty under reduced motion, so content is just there. */
function rise(delay: number, reduce: boolean, y = 14): MotionProps {
  if (reduce) return {};
  return {
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.6, ease: STEP_EASE },
  };
}

/** Flips to true after `ms`, for a beat inside a scene (counter tick, button press). */
function useBeat(ms: number, reduce: boolean) {
  const [on, setOn] = useState(reduce);
  useEffect(() => {
    if (reduce) return undefined;
    const t = window.setTimeout(() => setOn(true), ms);
    return () => window.clearTimeout(t);
  }, [ms, reduce]);
  return on;
}

/** Shared row shell so every scene uses the same rhythm. */
function Row({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'bg-muted/60 flex items-center gap-3 rounded-2xl px-4 py-3 lg:gap-4',
        className
      )}
    >
      {children}
    </div>
  );
}

function IconTile({ icon: Icon, className }: { icon: typeof Car; className?: string }) {
  return (
    <span
      className={cn(
        'bg-background text-foreground ring-border/70 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 lg:size-10',
        className
      )}
    >
      <Icon className="size-4 lg:size-[18px]" {...ICON} />
    </span>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-xs lg:text-[13px]">{children}</p>;
}

function Value({ children }: { children: ReactNode }) {
  return <p className="text-foreground text-[15px] font-semibold lg:text-base">{children}</p>;
}

function DoneDot({ delay, reduce }: { delay: number; reduce: boolean }) {
  return (
    <motion.span
      initial={reduce ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 420, damping: 18 }}
      className="bg-primary-strong text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full"
    >
      <Check className="size-3.5" strokeWidth={3} aria-hidden />
    </motion.span>
  );
}

/* 1. Request: dates land, guest count ticks, ID slides in, request goes out. */
export function RequestScene({ reduce }: { reduce: boolean }) {
  const twoGuests = useBeat(700, reduce);
  const sent = useBeat(1800, reduce);
  return (
    <div className="space-y-2.5 lg:space-y-3">
      <motion.div {...rise(0.05, reduce)}>
        <Row>
          <div className="flex-1">
            <Label>Dates</Label>
            <Value>Fri to Sun · 2 nights</Value>
          </div>
        </Row>
      </motion.div>
      <motion.div {...rise(0.18, reduce)}>
        <Row>
          <div className="flex-1">
            <Label>Guests</Label>
            <Value>
              <motion.span
                key={twoGuests ? 2 : 1}
                initial={reduce ? false : { y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, ease: STEP_EASE }}
                className="inline-block tabular-nums"
              >
                {twoGuests ? 2 : 1}
              </motion.span>{' '}
              adults
            </Value>
          </div>
          <div className="flex gap-2" aria-hidden>
            <span className="border-border text-muted-foreground flex size-8 items-center justify-center rounded-full border">
              <Minus className="size-3.5" {...ICON} />
            </span>
            <motion.span
              animate={twoGuests && !reduce ? { scale: [1, 0.84, 1] } : undefined}
              transition={{ duration: 0.3 }}
              className="border-foreground/30 text-foreground flex size-8 items-center justify-center rounded-full border"
            >
              <Plus className="size-3.5" {...ICON} />
            </motion.span>
          </div>
        </Row>
      </motion.div>
      <motion.div {...rise(0.3, reduce)}>
        <Row className="border-border border border-dashed bg-transparent">
          <motion.span
            initial={reduce ? false : { x: 40, opacity: 0, rotate: 10 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.8, duration: 0.6, ease: STEP_EASE }}
            className="bg-primary/10 text-primary-strong flex h-9 w-12 shrink-0 items-center justify-center rounded-lg lg:h-10 lg:w-14"
          >
            <CreditCard className="size-5" {...ICON} />
          </motion.span>
          <div className="min-w-0 flex-1">
            <Value>Valid ID</Value>
            <Label>Added to your request</Label>
          </div>
          <DoneDot delay={1.2} reduce={reduce} />
        </Row>
      </motion.div>
      <motion.div {...rise(0.42, reduce)}>
        <motion.div
          animate={sent && !reduce ? { scale: [1, 0.97, 1] } : undefined}
          transition={{ duration: 0.28 }}
          className={cn(
            'flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-colors duration-500 lg:h-[52px]',
            'bg-primary-strong text-primary-foreground'
          )}
        >
          {sent ? (
            <>
              <Check className="size-4" strokeWidth={2.5} aria-hidden /> Request sent
            </>
          ) : (
            'Send request'
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

/* 2. Confirm: email notification drops in, a check draws itself. */
export function ConfirmScene({ reduce, stayName }: { reduce: boolean; stayName: string }) {
  return (
    <div className="flex h-full flex-col">
      <motion.div
        initial={reduce ? false : { y: -48, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 22 }}
        className="bg-background ring-border/70 flex items-start gap-3 rounded-2xl p-3.5 shadow-[0_16px_36px_-18px_rgba(15,23,42,0.3)] ring-1 lg:p-4"
      >
        <span className="bg-primary-strong text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
          K
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs font-semibold">Email</p>
            <p className="text-muted-foreground text-xs">now</p>
          </div>
          <Value>Your stay is confirmed</Value>
          <p className="text-muted-foreground truncate text-sm">{stayName} · Fri to Sun</p>
        </div>
      </motion.div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <motion.div
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.6, ease: STEP_EASE }}
          className="bg-primary/10 flex size-20 items-center justify-center rounded-full lg:size-24"
        >
          <svg viewBox="0 0 48 48" className="text-primary-strong size-11 lg:size-12" aria-hidden>
            <motion.circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.6, duration: 0.7, ease: STEP_EASE }}
            />
            <motion.path
              d="M15 24.5l6 6 12-13"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 1.1, duration: 0.45, ease: STEP_EASE }}
            />
          </svg>
        </motion.div>
        <motion.div {...rise(1.2, reduce, 6)} className="text-center">
          <Value>Confirmed by your host</Value>
          <Label>Next: building paperwork</Label>
        </motion.div>
      </div>
    </div>
  );
}

/* 3. Paperwork: the building form gets stamped, parking slides into place. */
export function PaperworkScene({ reduce }: { reduce: boolean }) {
  return (
    <div className="space-y-2.5 lg:space-y-3">
      <motion.div
        {...rise(0.05, reduce)}
        className="bg-background ring-border/70 relative overflow-hidden rounded-2xl p-4 ring-1 lg:p-5"
      >
        <Value>Check-in documents</Value>
        <Label>Prepared by your host for the building</Label>
        <div className="mt-3 space-y-2 lg:mt-4" aria-hidden>
          {[92, 74, 84, 56].map((w, i) => (
            <motion.span
              key={w}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.5, ease: STEP_EASE }}
              className="bg-muted block h-2 origin-left rounded-full"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        <motion.span
          initial={reduce ? false : { scale: 1.8, opacity: 0, rotate: -4 }}
          animate={{ scale: 1, opacity: 1, rotate: -10 }}
          transition={{ delay: 0.85, type: 'spring', stiffness: 380, damping: 16 }}
          className="border-primary-strong dark:border-primary text-brand-ink bg-background absolute bottom-4 right-4 rounded-lg border-2 px-3 py-1 text-xs font-bold uppercase tracking-wider lg:text-sm"
        >
          Approved
        </motion.span>
      </motion.div>

      <motion.div
        initial={reduce ? false : { x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 1.25, duration: 0.6, ease: STEP_EASE }}
      >
        <Row>
          <IconTile icon={Car} />
          <div className="min-w-0 flex-1">
            <Value>Parking reserved</Value>
            <Label>Same building, by the night</Label>
          </div>
          <DoneDot delay={1.6} reduce={reduce} />
        </Row>
      </motion.div>
    </div>
  );
}

/* 4. Check in: the key turns, the stay guide unfolds. */
export function CheckInScene({ reduce }: { reduce: boolean }) {
  const items = [
    { icon: MapPin, label: 'Directions to the unit' },
    { icon: Wifi, label: 'Wi-Fi details' },
    { icon: ScrollText, label: 'House rules' },
  ];
  return (
    <div className="space-y-2.5 lg:space-y-3">
      <motion.div {...rise(0.05, reduce)}>
        <Row className="bg-primary/10">
          <motion.span
            initial={reduce ? false : { rotate: -80, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 14 }}
            className="bg-primary-strong text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl lg:size-11"
          >
            <KeyRound className="size-5" {...ICON} />
          </motion.span>
          <div className="min-w-0 flex-1">
            <Value>Check-in details unlocked</Value>
            <Label>In your stay guide before you arrive</Label>
          </div>
        </Row>
      </motion.div>
      {items.map((item, i) => (
        <motion.div key={item.label} {...rise(0.55 + i * 0.12, reduce, 10)}>
          <Row>
            <IconTile icon={item.icon} />
            <span className="text-foreground flex-1 text-[15px] lg:text-base">{item.label}</span>
            <DoneDot delay={0.8 + i * 0.12} reduce={reduce} />
          </Row>
        </motion.div>
      ))}
    </div>
  );
}

/* 5. Deposit: the refund moves down the line until it lands. */
export function RefundScene({ reduce }: { reduce: boolean }) {
  const nodes = ['Checked out', 'Refund in progress', 'Deposit refunded'];
  return (
    <div className="space-y-4 lg:space-y-5">
      <motion.div
        {...rise(0.05, reduce)}
        className="bg-background ring-border/70 rounded-2xl p-4 ring-1 lg:p-5"
      >
        <div className="flex items-center justify-between">
          <Value>Security deposit</Value>
          <motion.span {...rise(1.7, reduce, 4)} className="text-brand-ink text-sm font-semibold">
            Refunded
          </motion.span>
        </div>
        <div className="bg-muted mt-3 h-2.5 overflow-hidden rounded-full">
          <motion.span
            initial={reduce ? false : { scaleX: 0.08 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.3, duration: 1.4, ease: STEP_EASE }}
            className="bg-primary block h-full origin-left rounded-full"
          />
        </div>
      </motion.div>

      <ol className="relative space-y-4 pl-1 lg:space-y-5">
        <span aria-hidden className="bg-border absolute bottom-3 left-[12px] top-3 w-px" />
        <motion.span
          aria-hidden
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.3, duration: 1.3, ease: STEP_EASE }}
          className="bg-primary absolute bottom-3 left-[12px] top-3 w-px origin-top"
        />
        {nodes.map((label, i) => (
          <li key={label} className="relative flex items-center gap-3">
            <DoneDot delay={0.35 + i * 0.5} reduce={reduce} />
            <motion.span
              {...rise(0.4 + i * 0.5, reduce, 6)}
              className={cn(
                'text-[15px] lg:text-base',
                i === nodes.length - 1 ? 'text-foreground font-semibold' : 'text-muted-foreground'
              )}
            >
              {label}
            </motion.span>
          </li>
        ))}
      </ol>
    </div>
  );
}
