import { LegalSimplePage } from '@/features/guest/marketing/legal/components/LegalSimplePage';

import { termsDocument } from '@/lib/legal/termsContent';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function TermsPage() {
  usePageTitle(publicPageTitle('Terms'));
  return <LegalSimplePage document={termsDocument} />;
}
