import posthog from 'posthog-js';

import { shouldAutocapture } from '@/lib/posthog/analyticsMode';
import { postHogBeforeSend } from '@/lib/posthog/beforeSend';
import { COOKIE_CONSENT_CHANGED_EVENT, getCookieConsent } from '@/lib/posthog/cookieConsent';
import {
  detectAnalyticsEnvironment,
  detectAppTrack,
  resolvePostHogApiHost,
} from '@/lib/posthog/env';

const apiKey = (import.meta.env.VITE_POSTHOG_KEY as string | undefined)?.trim();
const apiHost = resolvePostHogApiHost();
const supabaseFunctionsHost = (() => {
  const functionsUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!functionsUrl) return undefined;

  try {
    return new URL(functionsUrl).hostname;
  } catch {
    return undefined;
  }
})();

export const isPostHogEnabled = Boolean(apiKey && apiHost);

const isProdBuild = import.meta.env.PROD;
const sessionReplayEnabled =
  (import.meta.env.VITE_POSTHOG_SESSION_REPLAY as string | undefined)?.trim().toLowerCase() ===
  'true';

let hasStartedPostHog = false;

// Cookie Policy owner decision D1: PostHog never loads until the cookie banner
// records an "accepted" choice, so no analytics cookie or request happens first.
function startPostHog(): void {
  if (hasStartedPostHog || !isPostHogEnabled) return;
  hasStartedPostHog = true;
  posthog.init(apiKey!, {
    api_host: apiHost,
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    persistence: 'localStorage+cookie',
    opt_out_capturing_by_default: false,
    autocapture: shouldAutocapture(),
    disable_session_recording: isProdBuild && !sessionReplayEnabled,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask], input, textarea',
    },
    ...(supabaseFunctionsHost ? { tracing_headers: [supabaseFunctionsHost] } : {}),
    // Guest URLs carry capability tokens; an unsanitized `$current_url` would hand PostHog
    // a working link to someone's booking.
    before_send: postHogBeforeSend,
    // PostHog is analytics only. Sentry owns every error, and having both capture the same
    // exception produced two histories that disagreed about the same incident.
    capture_exceptions: false,
    // Web vitals and network timing belong to Sentry tracing; two sources would be two
    // versions of the truth.
    capture_performance: false,
    loaded: (ph) => {
      ph.register({
        environment: detectAnalyticsEnvironment(),
        app_track: detectAppTrack(),
      });
    },
  });
}

function startPostHogIfConsented(): void {
  if (getCookieConsent() === 'accepted') startPostHog();
}

startPostHogIfConsented();

if (typeof window !== 'undefined') {
  window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, startPostHogIfConsented);
}

/** Configured AND actually running. Capture/identify/group call sites gate on this, not `isPostHogEnabled`. */
export function isPostHogActive(): boolean {
  return hasStartedPostHog;
}

// Singleton. Do not call posthog.init() elsewhere — import this module instead.
export { posthog };
