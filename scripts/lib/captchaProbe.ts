/**
 * Read-only probe for Turnstile enforcement (production readiness PR-001).
 *
 * `claim-sd-voucher` runs `antiSpamGate` before it validates or touches the database. A POST
 * with an empty body and no captcha token therefore has exactly two outcomes:
 *
 *   - captcha enforcing  -> 400 `{ captchaFailed: true }`
 *   - captcha not enforcing -> the handler moves on and rejects the empty body (`bookingId is
 *     required`), which never writes anything.
 *
 * The probe cannot create data in either case. It spends one request of the endpoint's
 * 10/min rate limit.
 */

export const CAPTCHA_PROBE_FUNCTION = 'claim-sd-voucher';

export type CaptchaProbeVerdict =
  | { kind: 'enforcing' }
  | { kind: 'not-enforcing'; detail: string }
  | { kind: 'inconclusive'; detail: string };

export function classifyCaptchaProbe(status: number, bodyText: string): CaptchaProbeVerdict {
  let body: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch {
    body = null;
  }

  if (status === 429 || body?.rateLimited === true) {
    return {
      kind: 'inconclusive',
      detail: 'Rate limited before the captcha check. Wait a minute and run it again.',
    };
  }
  if (body?.captchaFailed === true) return { kind: 'enforcing' };
  if (status === 404) {
    return { kind: 'inconclusive', detail: `${CAPTCHA_PROBE_FUNCTION} is not deployed here.` };
  }
  if (status >= 500 && !body) {
    return { kind: 'inconclusive', detail: `Gateway answered ${status} with no JSON body.` };
  }
  const message = typeof body?.error === 'string' ? body.error : bodyText.slice(0, 120);
  return {
    kind: 'not-enforcing',
    detail: `Reached the handler (HTTP ${status}: ${message}). The captcha check did not stop an empty, token-less request.`,
  };
}

/**
 * Supabase Auth Attack Protection (production readiness PR-002).
 *
 * A password sign-in with a throwaway `.invalid` address creates no account and sends no
 * email. With captcha protection on, Auth rejects the request for the missing token before it
 * looks at the credentials (`captcha_failed`). With it off, Auth answers `invalid_credentials`.
 */
export const AUTH_CAPTCHA_PROBE_PATH = '/auth/v1/token?grant_type=password';
export const AUTH_CAPTCHA_PROBE_BODY = {
  email: 'captcha-probe@example.invalid',
  password: 'not-a-real-password',
};

export function classifyAuthCaptchaProbe(status: number, bodyText: string): CaptchaProbeVerdict {
  let code: string | null = null;
  try {
    const parsed = JSON.parse(bodyText) as { error_code?: unknown; code?: unknown };
    if (typeof parsed.error_code === 'string') code = parsed.error_code;
  } catch {
    code = null;
  }
  if (code === 'captcha_failed') return { kind: 'enforcing' };
  if (code === 'invalid_credentials') {
    return {
      kind: 'not-enforcing',
      detail:
        'Auth checked the credentials without asking for a captcha token. Enable captcha under Authentication > Attack Protection.',
    };
  }
  if (status === 429 || code === 'over_request_rate_limit') {
    return { kind: 'inconclusive', detail: 'Auth rate limited the probe. Run it again shortly.' };
  }
  return {
    kind: 'inconclusive',
    detail: `Unexpected Auth answer (HTTP ${status}${code ? `, ${code}` : ''}).`,
  };
}
