import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';

import { LegalSheetContext } from '@/components/legal/legalSheetContext';
import type { LegalDocId } from '@/lib/legal/legalMeta';

type LegalSheetTarget = { doc: LegalDocId; section?: string };

// Policy text only loads the first time someone opens a link.
const LegalDocumentSheet = lazy(() =>
  import('@/components/legal/LegalDocumentSheet').then((m) => ({ default: m.LegalDocumentSheet }))
);

/** Mounted once in `App`. `LegalLink` opens the policy here instead of leaving the current flow. */
export function LegalSheetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<LegalSheetTarget | null>(null);
  const [open, setOpen] = useState(false);

  const openLegalDocument = useCallback((doc: LegalDocId, section?: string) => {
    setTarget({ doc, section });
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openLegalDocument }), [openLegalDocument]);

  return (
    <LegalSheetContext.Provider value={value}>
      {children}
      {target ? (
        <Suspense fallback={null}>
          <LegalDocumentSheet
            doc={target.doc}
            section={target.section}
            open={open}
            onOpenChange={setOpen}
          />
        </Suspense>
      ) : null}
    </LegalSheetContext.Provider>
  );
}
