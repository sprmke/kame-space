import { LegalLink } from '@/components/legal/LegalLink';
import { Button } from '@/components/ui/button';
import { useCookieConsentChoice } from '@/hooks/useCookieConsentChoice';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { setCookieConsent } from '@/lib/posthog/cookieConsent';
import { cn } from '@/lib/utils';

const consentActionClassName =
  "relative h-8 min-h-0 shrink-0 px-2.5 text-xs font-medium before:absolute before:-inset-x-1.5 before:-inset-y-2.5 before:content-[''] lg:before:content-none";

/**
 * Cookie Policy owner decision D1. Shown once, before any choice is stored. "Essential
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
    <div className="cookie-consent-overlay pointer-events-none fixed inset-x-0 z-[95] flex justify-center px-3 sm:px-4">
      <div
        role="region"
        aria-label="Cookie preferences"
        className={cn(
          'border-border/70 bg-background/95 shadow-soft-sm pointer-events-auto',
          'supports-[backdrop-filter]:bg-background/88 backdrop-blur-md',
          'flex w-full max-w-[22rem] flex-col gap-1.5 rounded-lg border px-2.5 py-2',
          'sm:max-w-3xl sm:flex-row sm:items-center sm:gap-3 sm:px-3 sm:py-2'
        )}
      >
        <p className="text-muted-foreground min-w-0 flex-1 text-xs leading-relaxed sm:text-[13px] sm:leading-snug">
          Essential cookies run {PLATFORM_APP_NAME}. Analytics stay off until you allow them.{' '}
          <LegalLink doc="cookies" className="text-foreground" />.
        </p>
        <div className="flex shrink-0 items-stretch gap-1.5 sm:items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              consentActionClassName,
              'text-muted-foreground hover:text-foreground flex-1 sm:flex-none'
            )}
            onClick={() => setCookieConsent('declined')}
          >
            Essential only
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn(consentActionClassName, 'flex-1 sm:flex-none')}
            onClick={() => setCookieConsent('accepted')}
          >
            Allow analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
