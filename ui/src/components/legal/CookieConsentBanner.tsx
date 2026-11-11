import { LegalLink } from '@/components/legal/LegalLink';
import { Button } from '@/components/ui/button';
import { useCookieConsentChoice } from '@/hooks/useCookieConsentChoice';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { setCookieConsent } from '@/lib/posthog/cookieConsent';

/**
 * Cookie Policy owner decision D1. Shown once, before any choice is stored. "Necessary
 * only" and closing the tab both leave PostHog off; only "Allow analytics" starts it (see
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
        className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/90 pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-xl border p-2.5 shadow-lg backdrop-blur-sm sm:max-w-2xl sm:flex-row sm:items-center sm:gap-4 sm:p-3.5 lg:max-w-3xl"
      >
        <p className="text-foreground min-w-0 flex-1 text-[13px] leading-snug">
          Required cookies keep {PLATFORM_APP_NAME} working. Allow analytics cookies too? Read the{' '}
          <LegalLink doc="cookies" />.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] flex-1 sm:min-h-9 sm:flex-none"
            onClick={() => setCookieConsent('declined')}
          >
            Necessary only
          </Button>
          <Button
            type="button"
            className="min-h-[44px] flex-1 sm:min-h-9 sm:flex-none"
            onClick={() => setCookieConsent('accepted')}
          >
            Allow analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
