import { cookiesDocument } from '@/lib/legal/cookiesContent';
import type { LegalDocId, LegalDocument } from '@/lib/legal/legalMeta';
import { privacyDocument } from '@/lib/legal/privacyContent';
import { termsDocument } from '@/lib/legal/termsContent';

export const LEGAL_DOCUMENTS: Readonly<Record<LegalDocId, LegalDocument>> = {
  terms: termsDocument,
  privacy: privacyDocument,
  cookies: cookiesDocument,
};
