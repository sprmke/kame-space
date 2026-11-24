/**
 * Guest link failures (expired checkout email, revoked token, wrong booking) used to render the
 * raw server string, e.g. "Access token required". That reads like an internal error and leaves
 * the guest with no next step, so map it to plain words here and keep the recovery actions in
 * `GuestLinkUnavailable`.
 */

const EXPIRED_LINK = /access token|invalid or expired|unauthori[sz]ed|401|expired/i;

export type GuestLinkProblem = {
  /** Short title: "This link has expired" or "This form isn't available". */
  title: string;
  /** One or two sentences a guest can act on. */
  body: string;
  /** True when the fix is a fresh link from the host. */
  expired: boolean;
};

export function describeGuestLinkProblem(error: unknown): GuestLinkProblem {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  if (EXPIRED_LINK.test(raw)) {
    return {
      title: 'This link has expired',
      body: 'Ask your host to send a new link, or message them here and they can resend it.',
      expired: true,
    };
  }

  return {
    title: "This page isn't available",
    body: 'The link may be incomplete. Open it again from your email, or message your host for help.',
    expired: false,
  };
}
