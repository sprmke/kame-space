import { LegalSimplePage } from '@/features/guest/marketing/legal/components/LegalSimplePage';

import { privacyDocument } from '@/lib/legal/privacyContent';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function PrivacyPage() {
  usePageTitle(publicPageTitle('Privacy'));
  return <LegalSimplePage document={privacyDocument} />;
}
