import { useEffect, useRef } from 'react';

import { ExternalLink, X } from 'lucide-react';

import { LegalDocumentBody } from '@/components/legal/LegalDocumentBody';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { LEGAL_DOCUMENTS } from '@/lib/legal/legalDocuments';
import {
  LEGAL_LAST_UPDATED,
  legalHref,
  legalSectionDomId,
  type LegalDocId,
} from '@/lib/legal/legalMeta';

const SHEET_ID_PREFIX = 'legal-sheet-';

const HEADER_ACTION_CLASS =
  'text-muted-foreground ring-offset-background hover:bg-muted focus-visible:ring-ring inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl opacity-80 transition-colors hover:text-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

type LegalDocumentSheetProps = {
  doc: LegalDocId;
  section?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Full policy in a bottom sheet (`<lg`) or dialog (`lg+`), scrolled to the linked
 * section. Sits above any open modal so a checkout or booking form keeps its state.
 *
 * Uses the same split chrome as the standard guest/admin shells: one compact header
 * row with the title, last-updated note, and inline actions; a scrolling body; one
 * primary action. "Open full page" is a header action, not a second footer button.
 */
export function LegalDocumentSheet({ doc, section, open, onOpenChange }: LegalDocumentSheetProps) {
  const policy = LEGAL_DOCUMENTS[doc];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Wait a frame so the sheet has laid out before measuring.
    const frame = window.requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      if (!section) {
        scroller.scrollTop = 0;
        return;
      }
      const target = scroller.querySelector<HTMLElement>(
        `#${CSS.escape(legalSectionDomId(section, SHEET_ID_PREFIX))}`
      );
      // The scroller is `relative`, so offsetTop is already measured from its top edge.
      scroller.scrollTop = target ? Math.max(0, target.offsetTop - 8) : 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, doc, section]);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        showCloseButton={false}
        className="z-[121] flex max-h-[min(90dvh,44rem)] max-w-[min(calc(100vw-1.5rem),38rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(90vw,38rem)]"
        overlayClassName="z-[120]"
      >
        <div className="border-border flex shrink-0 items-center gap-1 border-b px-5 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <ResponsiveModalTitle className="text-foreground text-base font-semibold tracking-tight sm:text-base">
              {policy.title}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground text-[11px] sm:text-xs">
              Updated {LEGAL_LAST_UPDATED}
            </ResponsiveModalDescription>
          </div>
          <a
            href={legalHref(doc, section)}
            target="_blank"
            rel="noopener"
            aria-label="Open full page in a new tab"
            title="Open full page"
            className={HEADER_ACTION_CLASS}
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
          <ResponsiveModalClose
            className="text-muted-foreground ring-offset-background hover:bg-muted focus-visible:ring-ring flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl opacity-80 transition-all hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none"
            aria-label="Close"
          >
            <X className="size-5 shrink-0" aria-hidden />
          </ResponsiveModalClose>
        </div>

        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 sm:px-6 sm:py-3.5"
        >
          <LegalDocumentBody
            sections={policy.sections}
            variant="sheet"
            idPrefix={SHEET_ID_PREFIX}
          />
        </div>

        <ResponsiveModalFooter className="border-border shrink-0 border-t px-5 py-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] sm:px-6 sm:py-3">
          <Button
            type="button"
            className="min-h-[44px] w-full sm:min-h-10 sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
