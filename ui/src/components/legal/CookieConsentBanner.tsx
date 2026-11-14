import { LegalLink } from '@/components/legal/LegalLink';
import { Button } from '@/components/ui/button';
import { useCookieConsentChoice } from '@/hooks/useCookieConsentChoice';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { setCookieConsent } from '@/lib/posthog/cookieConsent';
import { cn } from '@/lib/utils';

/**
 * Cookie Policy owner decision D1. Shown once, before any choice is stored. "Essential
 * only" and closing the tab both leave PostHog off; only "Allow analytics" starts it (see
 * `lib/posthog/client.ts`). Mounted once at the app root.
 *
 * Kept visible on phone (consent cannot hide behind "native chrome"). Positioned with
 * `.cookie-consent-overlay` so it clears the docked tab bar when one is present, and
 * sits at `z-[45]` above the bar (`z-40`) but under sheets/dialogs (`z-50` / `z-[100]`).
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
    <div
      className={cn(
        'cookie-consent-overlay pointer-events-none fixed inset-x-0 z-[45]',
        'flex justify-center px-3 sm:px-4'
      )}
    >
      <div
        role="region"
        aria-label="Cookie preferences"
        className={cn(
          'border-border/60 bg-background/96 shadow-elevated pointer-events-auto',
          'supports-[backdrop-filter]:bg-background/90 backdrop-blur-xl',
          'ring-1 ring-black/[0.04] dark:ring-white/[0.08]',
          'flex w-full flex-col gap-3 rounded-2xl border px-4 py-3.5',
          'max-lg:max-w-lg',
          'sm:gap-3.5',
          'lg:max-w-6xl lg:flex-row lg:items-center lg:gap-4 lg:rounded-full lg:px-5 lg:py-2'
        )}
      >
        <p
          className={cn(
            'text-muted-foreground min-w-0 flex-1 text-[13px] leading-snug',
            'sm:text-sm sm:leading-normal',
            'lg:whitespace-nowrap'
          )}
        >
          Essential cookies keep {PLATFORM_APP_NAME} working. Analytics cookies load only if you
          allow them.{' '}
          <span className="whitespace-nowrap">
            Read our <LegalLink doc="cookies" className="text-foreground" />.
          </span>
        </p>
        <div className={cn('flex shrink-0 items-center gap-2', 'max-lg:w-full', 'lg:gap-1.5')}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'text-muted-foreground hover:text-foreground h-10 min-h-10 flex-1 rounded-full px-3 text-[13px] font-medium',
              'lg:h-9 lg:min-h-9 lg:flex-none lg:px-3.5'
            )}
            onClick={() => setCookieConsent('declined')}
          >
            Essential only
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn(
              'h-10 min-h-10 flex-1 rounded-full px-4 text-[13px] font-medium',
              'lg:h-9 lg:min-h-9 lg:flex-none lg:px-4'
            )}
            onClick={() => setCookieConsent('accepted')}
          >
            Allow analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
