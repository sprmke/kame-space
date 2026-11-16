import type { ReactNode } from 'react';

import { motion, useTransform } from 'framer-motion';
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

import { Rise, Swap, Tick } from '@/features/guest/marketing/guest-home/components/ScrubParts';
import { useSlice, type Progress } from '@/features/guest/marketing/guest-home/lib/scrub';

import { cn } from '@/lib/utils';

const ICON = { strokeWidth: 1.6, 'aria-hidden': true } as const;

/**
 * One scene per booking step. Each takes `p`, the 0..1 scroll progress through its own
 * step, and derives every movement from it. Beats finish by about 0.8 so the finished
 * state holds for a moment before the next step takes over.
 */
type SceneProps = { p: Progress };

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

/* 1. Request: the form is already there. Guests tick up, the ID slides in, the request goes out. */
export function RequestScene({ p }: SceneProps) {
  const press = useSlice(p, 0.14, 0.26);
  const plusScale = useTransform(press, [0, 0.5, 1], [1, 0.84, 1]);
  const send = useSlice(p, 0.6, 0.72);
  const sendScale = useTransform(send, [0, 0.5, 1], [1, 0.97, 1]);

  return (
    <div className="space-y-2.5 lg:space-y-3">
      <Row>
        <div className="flex-1">
          <Label>Dates</Label>
          <Value>Fri to Sun · 2 nights</Value>
        </div>
      </Row>
      <Row>
        <div className="flex-1">
          <Label>Guests</Label>
          <Value>
            <Swap p={p} at={0.18} className="tabular-nums" before="1 adult" after="2 adults" />
          </Value>
        </div>
        <div className="flex gap-2" aria-hidden>
          <span className="border-border text-muted-foreground flex size-8 items-center justify-center rounded-full border">
            <Minus className="size-3.5" {...ICON} />
          </span>
          <motion.span
            style={{ scale: plusScale }}
            className="border-foreground/30 text-foreground flex size-8 items-center justify-center rounded-full border"
          >
            <Plus className="size-3.5" {...ICON} />
          </motion.span>
        </div>
      </Row>
      <Row className="border-border border border-dashed bg-transparent">
        <Rise
          p={p}
          at={0.3}
          span={0.16}
          x={40}
          y={0}
          className="bg-primary/10 text-primary-strong flex h-9 w-12 shrink-0 items-center justify-center rounded-lg lg:h-10 lg:w-14"
        >
          <CreditCard className="size-5" {...ICON} />
        </Rise>
        <div className="min-w-0 flex-1">
          <Value>Valid ID</Value>
          <Label>
            <Swap p={p} at={0.42} before="Add a photo of your ID" after="Added to your request" />
          </Label>
        </div>
        <Tick p={p} at={0.44} />
      </Row>
      <motion.div
        style={{ scale: sendScale }}
        className="bg-primary-strong text-primary-foreground flex h-12 items-center justify-center rounded-full text-[15px] font-semibold lg:h-[52px]"
      >
        <Swap
          p={p}
          at={0.64}
          before="Send request"
          after={
            <span className="inline-flex items-center gap-2">
              <Check className="size-4" strokeWidth={2.5} aria-hidden /> Request sent
            </span>
          }
          className="justify-items-center"
        />
      </motion.div>
    </div>
  );
}

/* 2. Confirm: the email drops in, then a check draws itself. */
export function ConfirmScene({ p, stayName }: SceneProps & { stayName: string }) {
  const badge = useSlice(p, 0.2, 0.34);
  const badgeScale = useTransform(badge, [0, 1], [0.6, 1]);
  const ring = useSlice(p, 0.3, 0.54);
  const check = useSlice(p, 0.54, 0.68);

  return (
    <div className="flex h-full flex-col">
      <Rise
        p={p}
        at={0}
        span={0.18}
        y={-40}
        className="bg-background ring-border/70 flex items-start gap-3 rounded-2xl p-3.5 ring-1 lg:p-4"
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
      </Rise>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <motion.div
          style={{ scale: badgeScale, opacity: badge }}
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
              style={{ pathLength: ring }}
            />
            <motion.path
              d="M15 24.5l6 6 12-13"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pathLength: check, opacity: check }}
            />
          </svg>
        </motion.div>
        <Rise p={p} at={0.66} span={0.1} y={6} className="text-center">
          <Value>Confirmed by your host</Value>
          <Label>Next: building paperwork</Label>
        </Rise>
      </div>
    </div>
  );
}

function DocLine({ p, index, width }: SceneProps & { index: number; width: number }) {
  const scaleX = useSlice(p, 0.04 + index * 0.06, 0.24 + index * 0.06);
  return (
    <motion.span
      style={{ scaleX, width: `${width}%` }}
      className="bg-muted block h-2 origin-left rounded-full"
    />
  );
}

/* 3. Paperwork: the building form fills in and gets stamped, then parking slides into place. */
export function PaperworkScene({ p }: SceneProps) {
  const stamp = useSlice(p, 0.42, 0.54);
  const stampScale = useTransform(stamp, [0, 1], [1.8, 1]);
  const stampRotate = useTransform(stamp, [0, 1], [-4, -10]);

  return (
    <div className="space-y-2.5 lg:space-y-3">
      <div className="bg-background ring-border/70 relative overflow-hidden rounded-2xl p-4 ring-1 lg:p-5">
        <Value>Check-in documents</Value>
        <Label>Prepared by your host for the building</Label>
        <div className="mt-3 space-y-2 lg:mt-4" aria-hidden>
          {[92, 74, 84, 56].map((w, i) => (
            <DocLine key={w} p={p} index={i} width={w} />
          ))}
        </div>
        <motion.span
          style={{ scale: stampScale, rotate: stampRotate, opacity: stamp }}
          className="border-primary-strong dark:border-primary text-brand-ink bg-background absolute bottom-4 right-4 rounded-lg border-2 px-3 py-1 text-xs font-bold uppercase tracking-wider lg:text-sm"
        >
          Approved
        </motion.span>
      </div>

      <Rise p={p} at={0.56} span={0.16} x={48} y={0}>
        <Row>
          <IconTile icon={Car} />
          <div className="min-w-0 flex-1">
            <Value>Parking reserved</Value>
            <Label>Same building, by the night</Label>
          </div>
          <Tick p={p} at={0.7} />
        </Row>
      </Rise>
    </div>
  );
}

const GUIDE_ITEMS = [
  { icon: MapPin, label: 'Directions to the unit' },
  { icon: Wifi, label: 'Wi-Fi details' },
  { icon: ScrollText, label: 'House rules' },
];

/* 4. Check in: the key turns, the stay guide opens line by line. */
export function CheckInScene({ p }: SceneProps) {
  const turn = useSlice(p, 0.04, 0.26);
  const rotate = useTransform(turn, [0, 1], [-80, 0]);

  return (
    <div className="space-y-2.5 lg:space-y-3">
      <Row className="bg-primary/10">
        <motion.span
          style={{ rotate }}
          className="bg-primary-strong text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl lg:size-11"
        >
          <KeyRound className="size-5" {...ICON} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <Value>Check-in details ready</Value>
          <Label>In your stay guide before you arrive</Label>
        </div>
      </Row>
      {GUIDE_ITEMS.map((item, i) => (
        <Rise key={item.label} p={p} at={0.24 + i * 0.15} y={10}>
          <Row>
            <IconTile icon={item.icon} />
            <span className="text-foreground flex-1 text-[15px] lg:text-base">{item.label}</span>
            <Tick p={p} at={0.34 + i * 0.15} />
          </Row>
        </Rise>
      ))}
    </div>
  );
}

const REFUND_NODES = ['Checked out', 'Refund in progress', 'Deposit refunded'];

/* 5. Deposit: the refund moves down the line until it lands. */
export function RefundScene({ p }: SceneProps) {
  const travel = useSlice(p, 0.08, 0.7);
  const bar = useTransform(travel, [0, 1], [0.08, 1]);

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="bg-background ring-border/70 rounded-2xl p-4 ring-1 lg:p-5">
        <div className="flex items-center justify-between">
          <Value>Security deposit</Value>
          <span className="text-brand-ink text-sm font-semibold">
            <Swap
              p={p}
              at={0.68}
              before="On the way"
              after="Refunded"
              className="justify-items-end"
            />
          </span>
        </div>
        <div className="bg-muted mt-3 h-2.5 overflow-hidden rounded-full">
          <motion.span
            style={{ scaleX: bar }}
            className="bg-primary block h-full origin-left rounded-full"
          />
        </div>
      </div>

      <ol className="relative space-y-4 pl-1 lg:space-y-5">
        <span aria-hidden className="bg-border absolute bottom-3 left-[15px] top-3 w-px" />
        <motion.span
          aria-hidden
          style={{ scaleY: travel }}
          className="bg-primary absolute bottom-3 left-[15px] top-3 w-px origin-top"
        />
        {REFUND_NODES.map((label, i) => (
          <li key={label} className="relative flex items-center gap-3">
            <Tick p={p} at={0.08 + i * 0.3} className="bg-card" />
            <Rise
              p={p}
              at={0.08 + i * 0.3}
              span={0.1}
              y={6}
              className={cn(
                'text-[15px] lg:text-base',
                i === REFUND_NODES.length - 1
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground'
              )}
            >
              {label}
            </Rise>
          </li>
        ))}
      </ol>
    </div>
  );
}
