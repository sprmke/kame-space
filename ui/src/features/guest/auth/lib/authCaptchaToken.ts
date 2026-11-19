import { isTurnstileConfigured } from '@/components/security/turnstileLoader';

/** Shown when Turnstile is configured but no token is available for `signInWithOtp`. */
export const AUTH_CAPTCHA_UNAVAILABLE_MESSAGE = 'Verification failed. Try again.';

/**
 * GoTrue Attack Protection rejects OTP when captcha is enabled and `captcha_token`
 * is missing. Guest forms may still fail open; auth must not.
 */
export function isAuthCaptchaTokenMissing(token: string | undefined): boolean {
  return isTurnstileConfigured() && !token;
}
