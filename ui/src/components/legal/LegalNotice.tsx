import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type LegalNoticeProps = {
  children: ReactNode;
  align?: 'start' | 'center';
  className?: string;
};

/**
 * The one-line legal notice shown at the moment of action (sign-in, submit, pay).
 * Muted 12px on phone, 13px from `sm`, always wraps. Put `LegalLink`s inside.
 */
export function LegalNotice({ children, align = 'start', className }: LegalNoticeProps) {
  return (
    <p
      className={cn(
        'text-muted-foreground text-xs leading-relaxed sm:text-[13px]',
        // Balanced lines when centered (no orphaned last word); pretty wrapping when left aligned.
        align === 'center' ? 'mx-auto max-w-sm text-balance text-center' : 'text-pretty text-left',
        className
      )}
    >
      {children}
    </p>
  );
}
