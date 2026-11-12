/**
 * Analytics-cookie consent (Cookie Policy owner decision D1). Required cookies
 * (sign-in, Turnstile, drafts) are never gated here; this only controls whether
 * PostHog is allowed to load. `null` means no choice has been made yet.
 */
export type CookieConsentChoice = 'accepted' | 'declined';

const STORAGE_KEY = 'kh-cookie-consent';

/** Dispatched on `window` whenever the choice changes, so the PostHog client can react. */
export const COOKIE_CONSENT_CHANGED_EVENT = 'kh:cookie-consent-changed';

export function getCookieConsent(): CookieConsentChoice | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'accepted' || value === 'declined' ? value : null;
  } catch {
    return null;
  }
}

export function setCookieConsent(choice: CookieConsentChoice): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Private browsing or storage blocked — the choice still applies for this page view.
  }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT));
}

/** Lets the Cookie Policy page offer "change your choice" instead of only showing text. */
export function resetCookieConsent(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT));
}
