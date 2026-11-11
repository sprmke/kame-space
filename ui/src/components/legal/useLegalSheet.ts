import { useContext } from 'react';

import {
  LegalSheetContext,
  type LegalSheetContextValue,
} from '@/components/legal/legalSheetContext';

export function useLegalSheet(): LegalSheetContextValue | null {
  return useContext(LegalSheetContext);
}
