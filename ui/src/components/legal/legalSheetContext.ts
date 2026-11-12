import { createContext } from 'react';

import type { LegalDocId } from '@/lib/legal/legalMeta';

export type LegalSheetContextValue = {
  openLegalDocument: (doc: LegalDocId, section?: string) => void;
};

/** `null` outside `LegalSheetProvider`; `LegalLink` then falls back to plain navigation. */
export const LegalSheetContext = createContext<LegalSheetContextValue | null>(null);
