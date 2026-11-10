import type { MouseEvent, ReactNode } from 'react';

import { useLegalSheet } from '@/components/legal/useLegalSheet';
import { LEGAL_LINK_LABELS, legalHref, type LegalDocId } from '@/lib/legal/legalMeta';
import { cn } from '@/lib/utils';

type LegalLinkProps = {
  doc: LegalDocId;
  /** Section anchor id from `lib/legal/*Content.ts` (for example `billing`). */
  section?: string;
  children?: ReactNode;
  className?: string;
};

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * Policy link used everywhere in the app. A plain click opens the policy in a sheet so the
 * current form, checkout, or modal keeps its state. Cmd/ctrl/middle-click and long-press
 * "open in new tab" still work because it is a real link to `/terms#section`.
 */
export function LegalLink({ doc, section, children, className }: LegalLinkProps) {
  const sheet = useLegalSheet();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!sheet || isModifiedClick(event)) return;
    event.preventDefault();
    // Keep the click from reaching parent rows, labels, or dismissable layers.
    event.stopPropagation();
    sheet.openLegalDocument(doc, section);
  };

  return (
    <a
      href={legalHref(doc, section)}
      onClick={handleClick}
      className={cn(
        'text-foreground hover:text-primary focus-visible:ring-ring decoration-muted-foreground/40 hover:decoration-primary rounded-sm font-medium underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2',
        className
      )}
    >
      {children ?? LEGAL_LINK_LABELS[doc]}
    </a>
  );
}
