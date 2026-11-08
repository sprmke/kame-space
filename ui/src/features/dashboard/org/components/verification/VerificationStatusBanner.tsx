import type { ReactNode } from 'react';

import { AlertCircle, BadgeCheck, Clock, Info, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type Tone = 'success' | 'pending' | 'danger' | 'neutral';

const TONE_STYLES: Record<Tone, { wrapper: string; icon: string; Icon: LucideIcon }> = {
  success: {
    wrapper: 'border-emerald-500/25 bg-emerald-500/[0.07]',
    icon: 'text-emerald-600 dark:text-emerald-400',
    Icon: BadgeCheck,
  },
  pending: {
    wrapper: 'border-amber-500/30 bg-amber-500/[0.08]',
    icon: 'text-amber-600 dark:text-amber-400',
    Icon: Clock,
  },
  danger: {
    wrapper: 'border-destructive/30 bg-destructive/[0.07]',
    icon: 'text-destructive',
    Icon: AlertCircle,
  },
  neutral: {
    wrapper: 'border-border bg-muted/40',
    icon: 'text-muted-foreground',
    Icon: Info,
  },
};

type Props = {
  tone: Tone;
  title: string;
  /** One short line. Omit when the title already says everything. */
  detail?: ReactNode;
  className?: string;
};

/** Tier status at the top of a panel: approved, in review, or needs action. */
export function VerificationStatusBanner({ tone, title, detail, className }: Props) {
  const { wrapper, icon, Icon } = TONE_STYLES[tone];
  return (
    <div
      role="status"
      className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5', wrapper, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', icon)} aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="text-foreground text-[13px] font-semibold leading-tight">{title}</p>
        {detail ? <p className="text-muted-foreground text-xs leading-snug">{detail}</p> : null}
      </div>
    </div>
  );
}
