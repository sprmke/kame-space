import type { EdgeCallError } from '@/features/dashboard/org/lib/edgeClient';

export type AccessDenialReason = 'default' | 'plan_limited' | 'unavailable';

/**
 * Pick the denial screen for org/property shells.
 * Plan-limited seats win when we already know the caller is paused.
 * Transport / 5xx failures must not look like a permanent RBAC deny.
 */
export function resolveAccessDenialReason(args: {
  planLimited?: boolean | null;
  /** True when the access query failed or returned no payload. */
  checkFailed?: boolean;
  error?: unknown;
}): AccessDenialReason {
  if (args.planLimited === true) return 'plan_limited';
  if (args.checkFailed && isAccessVerifyUnavailable(args.error)) return 'unavailable';
  return 'default';
}

/** True when access could not be checked (network / edge down / gateway), not a firm deny. */
export function isAccessVerifyUnavailable(error: unknown): boolean {
  if (error == null) return true;
  if (error instanceof TypeError) return true;
  if (typeof error !== 'object') return true;

  const status = (error as EdgeCallError).status;
  if (typeof status !== 'number') {
    const message = String((error as Error).message ?? '').toLowerCase();
    return (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('load failed')
    );
  }
  if (status === 0) return true;
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  return false;
}
