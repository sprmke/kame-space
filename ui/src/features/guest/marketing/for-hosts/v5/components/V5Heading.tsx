import { Reveal } from '@/features/guest/marketing/for-hosts/shared/Reveal';

import { cn } from '@/lib/utils';

/** Section title scale for v5: one step above `public-section-title`, same rhythm. */
export const V5_TITLE_CLASS =
  'text-foreground text-balance whitespace-pre-line text-2xl font-bold leading-tight tracking-[-0.025em] md:text-3xl lg:text-[2.5rem] lg:leading-[1.1]';

export const V5_LEAD_CLASS = 'public-lead text-muted-foreground text-pretty';

/**
 * Vertical rhythm for every v5 section: the same padding above and below, so two neighbours
 * always sit 80 / 112 / 160px apart (phone / tablet / desktop), bands included.
 */
export const V5_SECTION_Y = 'py-10 md:py-14 lg:py-20';
/** The hero has its own top (under the fixed nav), so it only takes the bottom half. */
export const V5_SECTION_PB = 'pb-10 md:pb-14 lg:pb-20';

/** Title (+ optional lead) shared by v5 sections. No eyebrow: the title carries the section. */
export function V5Heading({
  title,
  lead,
  align = 'left',
  className,
  leadClassName,
}: {
  title: string;
  lead?: string;
  align?: 'left' | 'center';
  className?: string;
  /** Extra classes for the lead, e.g. to centre it only from a breakpoint. */
  leadClassName?: string;
}) {
  return (
    <Reveal className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      <h2 className={V5_TITLE_CLASS}>{title}</h2>
      {lead ? (
        <p
          className={cn(
            V5_LEAD_CLASS,
            'mt-3 max-w-xl',
            align === 'center' && 'mx-auto',
            leadClassName
          )}
        >
          {lead}
        </p>
      ) : null}
    </Reveal>
  );
}
