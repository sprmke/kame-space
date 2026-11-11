import { useEffect, useState } from 'react';

import {
  COOKIE_CONSENT_CHANGED_EVENT,
  getCookieConsent,
  type CookieConsentChoice,
} from '@/lib/posthog/cookieConsent';

/**
 * Current analytics-cookie choice, or `null` before the visitor decides.
 * Re-renders on `kh:cookie-consent-changed` so the banner, the Cookie Policy
 * preferences card, and the PWA install offer stay in sync.
 */
export function useCookieConsentChoice(): CookieConsentChoice | null {
  const [choice, setChoice] = useState<CookieConsentChoice | null>(() => getCookieConsent());

  useEffect(() => {
    const sync = () => setChoice(getCookieConsent());
    sync();
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
  }, []);

  return choice;
}
