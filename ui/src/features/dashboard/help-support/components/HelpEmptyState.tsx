import type { ReactNode } from 'react';


import type { KameMascotPose } from '@/components/branding/kameMascotAssets';
import { KameMascotImage } from '@/components/branding/KameMascotImage';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  /** One short line under the title when the empty state needs context. */
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  /** When set, shows a library mascot instead of the icon well (guest account tickets). */
  mascotPose?: KameMascotPose;
};

/**
 * Help / tickets empty. With `mascotPose`, matches guest account empty rhythm
 * (mascot width, copy stack, CTA gap). Without pose, keeps the denser icon well.
 */
export function HelpEmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  mascotPose,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8 sm:py-10' : 'px-4 py-8 sm:px-6 sm:py-10'
      )}
    >
      {mascotPose ? (
        <div className="motion-safe:animate-float relative w-36 sm:w-40" aria-hidden>
          <KameMascotImage pose={mascotPose} />
        </div>
      ) : (
        <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <div className={cn('flex max-w-sm flex-col items-center gap-1.5', mascotPose ? 'mt-5' : 'mt-4')}>
        <p className="text-foreground text-base font-semibold leading-snug tracking-tight [overflow-wrap:anywhere] sm:text-lg">
          {title}
        </p>
        {description ? (
          <p className="text-muted-foreground text-sm leading-relaxed [overflow-wrap:anywhere]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-6 flex w-full max-w-xs justify-center sm:w-auto">{action}</div> : null}
    </div>
  );
}
