import { LegalLink } from '@/components/legal/LegalLink';
import { Button } from '@/components/ui/button';
import { useCookieConsentChoice } from '@/hooks/useCookieConsentChoice';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { setCookieConsent } from '@/lib/posthog/cookieConsent';

/**
 * Cookie Policy owner decision D1. Shown once, before any choice is stored. "Necessary
 * only" and closing the tab both leave PostHog off; only "Accept" starts it (see
 * `lib/posthog/client.ts`). Mounted once at the app root, above the legal document sheet
 * so it never blocks reading the full Cookie Policy from the link below.
 *
 * Hidden in an installed app: same-origin storage means an existing choice already
 * carries over, and a first launch without one simply keeps analytics off. The Cookie
 * Policy page still offers `CookiePreferencesControl` there.
 */
export function CookieConsentBanner() {
  const choice = useCookieConsentChoice();
  const { standalone } = useDisplayMode();

  if (choice !== null || standalone) return null;

  return (
    <div className="cookie-consent-overlay pointer-events-none fixed inset-x-0 z-[95] flex justify-center px-3">
      <div
        role="region"
        aria-label="Cookie preferences"
        className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/90 pointer-events-auto w-full max-w-md rounded-2xl border p-3.5 shadow-lg backdrop-blur-sm sm:p-4"
      >
        <p className="text-foreground text-[13px] leading-snug sm:text-sm">
          We use required cookies to run the app and analytics cookies only if you allow them. Read
          the <LegalLink doc="cookies" />.
        </p>
        <div className="mt-2.5 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] flex-1 sm:min-h-9"
            onClick={() => setCookieConsent('declined')}
          >
            Necessary only
          </Button>
          <Button
            type="button"
            className="min-h-[44px] flex-1 sm:min-h-9"
            onClick={() => setCookieConsent('accepted')}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
