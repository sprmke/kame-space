import { LegalSimplePage } from '@/features/guest/marketing/legal/components/LegalSimplePage';

import { privacyDocument } from '@/lib/legal/privacyContent';
import { usePublicStaticRouteSeo } from '@/lib/seo/routeTitle';

export function PrivacyPage() {
  usePublicStaticRouteSeo('/privacy');
  return <LegalSimplePage document={privacyDocument} />;
}
