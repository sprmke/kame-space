import type { ReactNode } from 'react';

import { Link } from 'react-router-dom';

import type { KameMascotPose } from '@/components/branding/kameMascotAssets';
import { KameMascotImage } from '@/components/branding/KameMascotImage';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type GuestAccountEmptyStateProps = {
  /** Short headline (required). */
  title: string;
  /** One supporting line under the title. */
  description?: string;
  /** Library pose for this empty. Prefer a pose that matches the page. */
  mascotPose: KameMascotPose;
  actionLabel?: string;
  actionHref?: string;
  /** Leading icon on the primary CTA (required when an action is shown). */
  actionIcon?: LucideIcon;
  /** Click handler when there is no `actionHref` (e.g. Try again). */
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
};

const CTA_CLASS =
  'mt-6 inline-flex min-h-11 w-full max-w-xs gap-2 rounded-full px-5 sm:w-auto';

/**
 * Guest account empty card: library mascot + title + short description + optional CTA.
 * One layout for every account empty: fixed mascot width, tight copy stack, rounded CTA.
 */
export function GuestAccountEmptyState({
  title,
  description,
  mascotPose,
  actionLabel,
  actionHref,
  actionIcon: ActionIcon,
  onAction,
  className,
  children,
}: GuestAccountEmptyStateProps) {
  const showAction = Boolean(actionLabel && (actionHref || onAction) && ActionIcon);

  return (
    <div
      className={cn(
        'border-border bg-card flex w-full min-h-full flex-1 flex-col items-center justify-center rounded-2xl border px-5 py-8 text-center shadow-sm sm:px-6 sm:py-10',
        className
      )}
    >
      <div className="motion-safe:animate-float relative w-36 sm:w-40" aria-hidden>
        <KameMascotImage pose={mascotPose} />
      </div>

      <div className="mt-5 flex max-w-sm flex-col items-center gap-1.5">
        <p className="text-foreground text-base font-semibold tracking-tight sm:text-lg">{title}</p>
        {description ? (
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>

      {showAction && ActionIcon && actionLabel ? (
        actionHref ? (
          <Button asChild className={CTA_CLASS}>
            <Link to={actionHref}>
              <ActionIcon className="size-4 shrink-0" aria-hidden />
              {actionLabel}
            </Link>
          </Button>
        ) : (
          <Button type="button" className={CTA_CLASS} onClick={onAction}>
            <ActionIcon className="size-4 shrink-0" aria-hidden />
            {actionLabel}
          </Button>
        )
      ) : null}
      {children}
    </div>
  );
}
