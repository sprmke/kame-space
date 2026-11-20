/**
 * Local-only test sign-in helpers.
 *
 * These accounts are created by `scripts/dev/seed/` and
 * `scripts/dev/attach-local-admin.sh`, so reviewers can sign in without Google
 * OAuth, which often blocks embedded browser sessions. The UI only shows the
 * buttons when Vite runs in dev mode.
 */

export const LOCAL_TEST_PASSWORD = 'seed-password';

/** First entry of a comma-separated email list, or an empty string. */
export function firstEmail(value: string | undefined | null): string {
  return (value ?? '').split(',')[0]?.trim() ?? '';
}

type Env = Record<string, string | undefined>;

/** Super-admin email used by the host test button; falls back to the local allow list. */
export function resolveHostTestEmail(env: Env): string {
  return (
    env.VITE_LOCAL_TEST_EMAIL?.trim() ||
    firstEmail(env.VITE_SUPER_ADMIN_EMAILS) ||
    firstEmail(env.VITE_ADMIN_ALLOWED_EMAILS)
  );
}

const DEFAULT_GUEST_TEST_EMAIL = 'guest.demo@example.com';

/** Guest portal test account seeded by the canonical dataset. */
export function resolveGuestTestEmail(env: Env): string {
  return env.VITE_LOCAL_GUEST_EMAIL?.trim() || DEFAULT_GUEST_TEST_EMAIL;
}
