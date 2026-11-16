import type { ReactNode } from 'react';

import { KameSpaceBrandIcon } from '@/components/branding/KameSpaceBrandIcon';
import { cn } from '@/lib/utils';

type MarkSize = 'sm' | 'md' | 'lg';

type Props = {
  title: string;
  description?: string;
  eyebrow?: string;
  markSize?: MarkSize;
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
};

/**
 * Shared empty / unavailable shell: brand mark + short copy + optional actions.
 * Prefer this over one-off turtles or generic icon wells on guest-facing empties.
 */
export function BrandEmptyState({
  title,
  description,
  eyebrow,
  markSize = 'md',
  titleAs = 'p',
  titleId,
  compact = false,
  className,
  children,
}: Props) {
  const TitleTag = titleAs;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center text-center',
        compact ? 'gap-2 px-2 py-3' : 'gap-3 px-4 py-8 sm:gap-4 sm:py-10',
        className
      )}
    >
      <div
        className="bg-primary/10 pointer-events-none absolute left-1/2 top-6 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl sm:top-8 sm:h-48 sm:w-48"
        aria-hidden="true"
      />
      <KameSpaceBrandIcon
        className={cn('motion-safe:animate-float relative', MARK_CLASS[markSize])}
      />
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
            compact ? 'text-base' : 'text-2xl sm:text-4xl'
          )}
        >
          {title}
        </TitleTag>
        {description ? (
          <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm sm:text-base')}>
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="relative mt-2 w-full sm:mt-4">{children}</div> : null}
    </div>
  );
}
