import { Button } from '@/components/ui/button';
import { useCookieConsentChoice } from '@/hooks/useCookieConsentChoice';
import { setCookieConsent } from '@/lib/posthog/cookieConsent';

/**
 * Cookie Policy page control. Chooses directly instead of only resetting: an installed
 * app hides the floating banner, so this is the one place a standalone user can opt in.
 */
export function CookiePreferencesControl() {
  const choice = useCookieConsentChoice();

  return (
    <div className="border-border mt-8 rounded-xl border p-4">
      <p className="text-sm font-semibold">Cookie settings</p>
      <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
        {choice === 'accepted'
          ? 'Analytics cookies are on.'
          : choice === 'declined'
            ? 'Only required cookies are on.'
            : 'No choice yet. Required cookies keep the app working.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={choice === 'accepted' ? 'default' : 'outline'}
          className="min-h-[44px] sm:min-h-9"
          onClick={() => setCookieConsent('accepted')}
        >
          Allow analytics
        </Button>
        <Button
          type="button"
          variant={choice === 'declined' ? 'default' : 'outline'}
          className="min-h-[44px] sm:min-h-9"
          onClick={() => setCookieConsent('declined')}
        >
          Necessary only
        </Button>
      </div>
    </div>
  );
}
