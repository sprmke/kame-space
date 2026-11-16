import type { ReactNode } from 'react';

import { motion, useTransform } from 'framer-motion';
import { Check } from 'lucide-react';

import { useSlice, type Progress } from '@/features/guest/marketing/guest-home/lib/scrub';

import { cn } from '@/lib/utils';

/**
 * Building blocks for scroll-scrubbed scenes on the home page. Every part reads a 0..1
 * progress value that comes from the scroll position. Nothing here runs on a timer.
 */
const easeOut = (v: number) => 1 - (1 - v) ** 3;

/** Fades and slides into place across `[at, at + span]`. */
export function Rise({
  p,
  at,
  span = 0.14,
  x = 0,
  y = 14,
  className,
  children,
}: {
  p: Progress;
  at: number;
  span?: number;
  x?: number;
  y?: number;
  className?: string;
  children: ReactNode;
}) {
  const t = useSlice(p, at, at + span);
  const tx = useTransform(t, (v) => x * (1 - easeOut(v)));
  const ty = useTransform(t, (v) => y * (1 - easeOut(v)));
  return (
    <motion.div style={{ opacity: t, x: tx, y: ty }} className={className}>
      {children}
    </motion.div>
  );
}

/** Round check that grows in across `[at, at + span]`. */
export function Tick({
  p,
  at,
  span = 0.08,
  className,
}: {
  p: Progress;
  at: number;
  span?: number;
  className?: string;
}) {
  const t = useSlice(p, at, at + span);
  const scale = useTransform(t, easeOut);
  return (
    <span
      aria-hidden
      className={cn(
        'border-border relative flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed',
        className
      )}
    >
      <motion.span
        style={{ scale, opacity: t }}
        className="bg-primary-strong text-primary-foreground absolute -inset-px flex items-center justify-center rounded-full"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </motion.span>
    </span>
  );
}

/** Crossfades `before` into `after` across `[at, at + span]`. Sized by the larger of the two. */
export function Swap({
  p,
  at,
  span = 0.08,
  before,
  after,
  className,
}: {
  p: Progress;
  at: number;
  span?: number;
  before: ReactNode;
  after: ReactNode;
  className?: string;
}) {
  const t = useSlice(p, at, at + span);
  const out = useTransform(t, (v) => 1 - v);
  const outY = useTransform(t, (v) => -6 * v);
  const inY = useTransform(t, (v) => 6 * (1 - v));
  return (
    <span className={cn('inline-grid', className)}>
      <motion.span style={{ opacity: out, y: outY }} className="[grid-area:1/1]">
        {before}
      </motion.span>
      <motion.span style={{ opacity: t, y: inY }} className="[grid-area:1/1]">
        {after}
      </motion.span>
    </span>
  );
}
