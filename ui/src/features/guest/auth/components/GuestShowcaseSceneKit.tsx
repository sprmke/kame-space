import { type ReactNode } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

/*
 * Building blocks for the guest showcase scenes. Everything is token-based DOM so scenes follow
 * light/dark, stay crisp at any size, and never wait on image loads.
 */

export function SceneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'from-primary/[0.06] to-background @[420px]:gap-2.5 @[420px]:p-4 absolute inset-0 flex flex-col gap-2 bg-gradient-to-b p-3',
        className
      )}
    >
      {children}
    </div>
  );
}

export function MockCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'border-border/70 bg-card relative rounded-lg border shadow-[0_1px_2px_rgb(0_0_0/0.06)]',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Photo stand-in: tinted gradient tile with a soft horizon so it reads as a place, not a swatch. */
export function Thumb({ hue, className }: { hue: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('relative block shrink-0 overflow-hidden rounded-md', className)}
      style={{
        backgroundImage: `linear-gradient(160deg, hsl(${hue} 75% 70%) 0%, hsl(${hue + 25} 65% 52%) 55%, hsl(${hue + 40} 55% 36%) 100%)`,
      }}
    >
      <span className="absolute inset-x-0 bottom-0 h-1/3 bg-black/15" />
    </span>
  );
}

export function Avatar({ initial, className }: { initial: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-primary-strong text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
        className
      )}
    >
      {initial}
    </span>
  );
}

/**
 * A tap on the element it sits in: a fingertip dot presses down, then a ring expands from the
 * element edge. The parent must be `relative` and carry the radius to echo.
 */
export function TapPulse({ atMs, className }: { atMs: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const delay = atMs / 1000;

  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit]',
        className
      )}
    >
      <motion.span
        className="ring-primary/50 absolute inset-0 rounded-[inherit] ring-2"
        initial={{ opacity: 0, scale: 1 }}
        animate={{ opacity: [0, 1, 0], scale: [1, 1, 1.18] }}
        transition={{ delay: delay + 0.05, duration: 0.6, times: [0, 0.15, 1], ease: 'easeOut' }}
      />
      <motion.span
        className="bg-foreground/30 size-5 rounded-full shadow-[0_2px_6px_rgb(0_0_0/0.25)] backdrop-blur-[1px]"
        initial={{ opacity: 0, scale: 1.6 }}
        animate={{ opacity: [0, 0.9, 0.9, 0], scale: [1.6, 1, 0.8, 1.1] }}
        transition={{ delay: Math.max(0, delay - 0.3), duration: 0.8, times: [0, 0.35, 0.55, 1] }}
      />
    </span>
  );
}

export function SceneLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-muted-foreground text-[9px] font-semibold uppercase tracking-wider',
        className
      )}
    >
      {children}
    </p>
  );
}
