import type { ReactNode } from 'react';

import type { KameMascotPose } from '@/components/branding/kameMascotAssets';
import { KameMascotImage } from '@/components/branding/KameMascotImage';
import { KameSpaceBrandIcon } from '@/components/branding/KameSpaceBrandIcon';
import { cn } from '@/lib/utils';

type MarkSize = 'sm' | 'md' | 'lg' | 'xl';

type Props = {
  title: string;
  description?: string;
  eyebrow?: string;
  markSize?: MarkSize;
  /**
   * When set, shows that pose from `/assets/mascot/` instead of the platform SVG mark.
   * Pick the pose that matches the page (e.g. `page-not-found`, `coming-soon`).
   */
  mascotPose?: KameMascotPose;
  /** Boost LCP for full-page mascot empties (404 / Services). */
  mascotPriority?: boolean;
  /** Use `h1` on full-page empties (404). Panels keep a paragraph. */
  titleAs?: 'h1' | 'p';
  titleId?: string;
  /** Tighter padding for embedded panels. */
  compact?: boolean;
  className?: string;
  children?: ReactNode;
};

const MARK_CLASS: Record<MarkSize, string> = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14 sm:h-16 sm:w-16',
  lg: 'h-16 w-16 sm:h-20 sm:w-20',
  xl: 'h-20 w-20 sm:h-24 sm:w-24',
};

/** Display width for transparent character PNGs (intrinsic 448×468). */
const MASCOT_WRAP_CLASS: Record<MarkSize, string> = {
  sm: 'w-20 sm:w-24',
  md: 'w-28 sm:w-32',
  lg: 'w-36 sm:w-44',
  xl: 'w-44 sm:w-52 md:w-56',
};

const MASCOT_WASH_CLASS: Record<MarkSize, string> = {
  sm: 'bg-primary/10 pointer-events-none absolute left-1/2 top-4 h-36 w-36 -translate-x-1/2 rounded-full blur-3xl',
  md: 'bg-primary/10 pointer-events-none absolute left-1/2 top-4 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl sm:top-6 sm:h-56 sm:w-56',
  lg: 'bg-primary/10 pointer-events-none absolute left-1/2 top-4 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl sm:top-6 sm:h-56 sm:w-56',
  xl: 'bg-primary/10 pointer-events-none absolute left-1/2 top-2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl sm:top-4 sm:h-64 sm:w-64',
};

/**
 * Shared empty / unavailable shell: platform mark or a library mascot pose + short copy.
 * Prefer this over one-off illustrations or generic icon wells on guest-facing empties.
 */
export function BrandEmptyState({
  title,
  description,
  eyebrow,
  markSize = 'md',
  mascotPose,
  mascotPriority = false,
  titleAs = 'p',
  titleId,
  compact = false,
  className,
  children,
}: Props) {
  const TitleTag = titleAs;
  const showMascot = Boolean(mascotPose);
  const washClass = showMascot
    ? MASCOT_WASH_CLASS[markSize]
    : 'bg-primary/10 pointer-events-none absolute left-1/2 top-6 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl sm:top-8 sm:h-48 sm:w-48';

  return (
    <div
      className={cn(
        'relative flex flex-col items-center text-center',
        compact ? 'gap-2 px-2 py-3' : 'gap-3 px-4 py-8 sm:gap-4 sm:py-10',
        className
      )}
    >
      <div className={washClass} aria-hidden="true" />
      {mascotPose ? (
        <div className={cn('motion-safe:animate-float relative', MASCOT_WRAP_CLASS[markSize])}>
          <KameMascotImage pose={mascotPose} priority={mascotPriority} />
        </div>
      ) : (
        <KameSpaceBrandIcon
          className={cn('motion-safe:animate-float relative', MARK_CLASS[markSize])}
        />
      )}
      {eyebrow ? (
        <span className="text-primary relative text-xs font-bold uppercase tracking-[0.28em]">
          {eyebrow}
        </span>
      ) : null}
      <div className="relative max-w-md space-y-1">
        <TitleTag
          id={titleId}
          className={cn(
            'text-foreground text-balance font-bold tracking-tight',
            compact ? 'text-base' : markSize === 'xl' ? 'public-page-title' : 'text-2xl sm:text-4xl'
          )}
        >
          {title}
        </TitleTag>
        {description ? (
          <p
            className={cn(
              'text-muted-foreground',
              compact
                ? 'text-xs'
                : markSize === 'xl'
                  ? 'public-lead'
                  : 'text-sm sm:text-base'
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="relative mt-2 w-full sm:mt-4">{children}</div> : null}
    </div>
  );
}
