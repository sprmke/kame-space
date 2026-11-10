import { LegalSimplePage } from '@/features/guest/marketing/legal/components/LegalSimplePage';

import { CookiePreferencesControl } from '@/components/legal/CookiePreferencesControl';
import { cookiesDocument } from '@/lib/legal/cookiesContent';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function CookiesPage() {
  usePageTitle(publicPageTitle('Cookies'));
  return <LegalSimplePage document={cookiesDocument} afterContent={<CookiePreferencesControl />} />;
}
