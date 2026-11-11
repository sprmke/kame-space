import { LegalSimplePage } from '@/features/guest/marketing/legal/components/LegalSimplePage';

import { termsDocument } from '@/lib/legal/termsContent';
import { usePublicStaticRouteSeo } from '@/lib/seo/routeTitle';

export function TermsPage() {
  usePublicStaticRouteSeo('/terms');
  return <LegalSimplePage document={termsDocument} />;
}
