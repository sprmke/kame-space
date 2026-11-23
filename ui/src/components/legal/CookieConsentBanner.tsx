import { useLocation } from 'react-router-dom';

import { LegalLink } from '@/components/legal/LegalLink';
import { FixedBottomNoticeBar } from '@/components/pwa/FixedBottomNoticeBar';
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
 * Fixed flush bottom bar via `FixedBottomNoticeBar`. Publishes `--cookie-consent-h` so
 * install / update notices can stack above it. Hidden in standalone (installed) apps.
 */
export function CookieConsentBanner() {
  const choice = useCookieConsentChoice();
  const { standalone } = useDisplayMode();
  const { pathname } = useLocation();

  // Operator consoles are not a consumer surface; the banner would cover page
  // actions there and analytics consent belongs to guest/marketing pages.
  const isOperatorConsole = pathname.startsWith('/admin') || pathname.startsWith('/bookings');
  if (choice !== null || standalone || isOperatorConsole) return null;

  return (
    <FixedBottomNoticeBar
      overlayClassName="cookie-consent-overlay"
      heightCssVar="--cookie-consent-h"
      role="region"
      aria-label="Cookie preferences"
      className="max-lg:flex-col max-lg:gap-3 max-lg:py-3 sm:max-lg:gap-3.5"
    >
      <p
        className={cn(
          'text-muted-foreground max-w-3xl text-center text-[13px] leading-snug',
          'sm:text-sm sm:leading-normal'
        )}
      >
        Essential cookies keep {PLATFORM_APP_NAME} working. Analytics cookies load only if you allow
        them.{' '}
        <span className="whitespace-nowrap">
          Read our <LegalLink doc="cookies" className="text-foreground" />.
        </span>
      </p>
      <div className="flex shrink-0 items-center justify-center gap-2 lg:gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-10 min-h-10 rounded-full px-3 text-[13px] font-medium',
            'lg:h-9 lg:min-h-9 lg:px-3.5'
          )}
          onClick={() => setCookieConsent('declined')}
        >
          Essential only
        </Button>
        <Button
          type="button"
          size="sm"
          className={cn(
            'h-10 min-h-10 rounded-full px-4 text-[13px] font-medium',
            'lg:h-9 lg:min-h-9 lg:px-4'
          )}
          onClick={() => setCookieConsent('accepted')}
        >
          Allow analytics
        </Button>
      </div>
    </FixedBottomNoticeBar>
  );
}
