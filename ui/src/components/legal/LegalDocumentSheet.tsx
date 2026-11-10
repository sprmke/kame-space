import { useEffect, useRef } from 'react';

import { ExternalLink } from 'lucide-react';

import { LegalDocumentBody } from '@/components/legal/LegalDocumentBody';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
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

type LegalDocumentSheetProps = {
  doc: LegalDocId;
  section?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Full policy in a bottom sheet (`<lg`) or dialog (`lg+`), scrolled to the linked
 * section. Sits above any open modal so a checkout or booking form keeps its state.
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
        className="z-[121] flex max-h-[min(90dvh,44rem)] max-w-[min(calc(100vw-1.5rem),36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(90vw,36rem)]"
        overlayClassName="z-[120]"
      >
        <ResponsiveModalHeader className="border-border shrink-0 space-y-1 border-b px-5 py-3 text-left sm:px-6 sm:py-4">
          <ResponsiveModalTitle>{policy.title}</ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-xs">
            Last updated {LEGAL_LAST_UPDATED}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6"
        >
          <LegalDocumentBody
            sections={policy.sections}
            variant="sheet"
            idPrefix={SHEET_ID_PREFIX}
          />
        </div>

        <ResponsiveModalFooter className="border-border shrink-0 gap-2 border-t px-5 py-3.5 pb-[max(env(safe-area-inset-bottom,0px),0.875rem)] sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <Button asChild variant="outline" className="min-h-[44px] sm:min-h-10">
            <a href={legalHref(doc, section)} target="_blank" rel="noopener">
              Open full page
              <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
            </a>
          </Button>
          <Button
            type="button"
            className="min-h-[44px] sm:min-h-10"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
