import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const pillTones = {
  neutral: 'bg-muted text-muted-foreground',
  teal: 'bg-primary/10 text-brand-ink',
  amber: 'bg-warning/15 text-warning-foreground dark:text-warning',
  green: 'bg-success/10 text-brand-ink',
} as const;

/** Small status / label chip used on the for-hosts landing demos. */
export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof pillTones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        pillTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
