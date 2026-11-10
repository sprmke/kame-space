import { LegalSimplePage } from '@/features/guest/marketing/legal/components/LegalSimplePage';

import { CookiePreferencesControl } from '@/components/legal/CookiePreferencesControl';
import { cookiesDocument } from '@/lib/legal/cookiesContent';
import { usePublicStaticRouteSeo } from '@/lib/seo/routeTitle';

export function CookiesPage() {
  usePublicStaticRouteSeo('/cookies');
  return <LegalSimplePage document={cookiesDocument} afterContent={<CookiePreferencesControl />} />;
}
