import { AdminEdgeFetchError } from '@/lib/api/adminEdgeFetch';

import { captureError } from './capture';

/**
 * TanStack Query failure reporting — the shared choke point for data reads and writes.
 *
 * Before this, a failed query or mutation was invisible: the user saw a toast, the console
 * got a line, and nothing paged. `QueryCache` / `MutationCache` `onError` is the one place
 * every read and write passes through, so reporting lives here and not at 500 call sites.
 *
 * What is **not** reported, and why:
 *
 * - **Abort** — the request was cancelled on purpose (unmount, route change, a new query
 *   superseding the old one). Not a fault.
 * - **Offline / transport failure** — the browser could not reach the network. `navigator.onLine`
 *   is unreliable (true behind a captive portal or with no route), so a fetch-level TypeError is
 *   treated as a connectivity outcome whether or not the browser reports online. PostHog owns
 *   that count; Sentry owns server faults.
 * - **Missing session** — the dashboard mounted while signed out or the session expired and was
 *   cleared. The auth flow owns that redirect; it is not a server or app fault.
 * - **4xx** — the handler answered correctly. Validation, 401 (the auth flow owns it), 409
 *   races and 429 quotas are normal traffic. Reporting them buries the real faults.
 * - **`meta: { sentry: false }`** — an endpoint allowed to fail, such as a poll.
 *
 * Everything else is a fault: 5xx, or a thrown non-HTTP error (parse, invariant, logic).
 *
 * Fingerprint is `['query', keyRoot, statusBucket]` so one broken endpoint is one issue
 * rather than one per user per retry.
 */

export type QueryErrorKind = 'query' | 'mutation';

/** Same error object seen twice — the cache hook and a per-mutation handler both firing. */
const reported = new WeakSet<object>();

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  status?: unknown;
  requestId?: unknown;
};

function asErrorLike(error: unknown): ErrorLike | null {
  return error && typeof error === 'object' ? (error as ErrorLike) : null;
}

function isAbort(error: unknown): boolean {
  const like = asErrorLike(error);
  if (!like) return false;
  if (like.name === 'AbortError' || like.name === 'CanceledError') return true;
  return typeof like.message === 'string' && /aborted|cancell?ed/i.test(like.message);
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * A fetch-level failure: no response object exists, so there is no server fault to report.
 * `navigator.onLine` cannot be trusted here, so match the browser's own wording.
 */
function isTransportFailure(error: unknown): boolean {
  const like = asErrorLike(error);
  if (!like) return false;
  const name = typeof like.name === 'string' ? like.name : '';
  const message = typeof like.message === 'string' ? like.message : '';
  if (name !== 'TypeError' && name !== 'NetworkError') return false;
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed|connection (?:lost|closed)/i.test(
    message
  );
}

/**
 * Signing in is the auth surface's job. A dashboard read that fires before the session lands,
 * or after it expires, throws one of these; reporting them only adds noise.
 */
const AUTH_MISSING_MESSAGES = [
  'not signed in',
  'no active session. please sign in',
  'your session expired. please sign in again.',
];

function isAuthMissing(error: unknown): boolean {
  const like = asErrorLike(error);
  const message = typeof like?.message === 'string' ? like.message.trim().toLowerCase() : '';
  return message !== '' && AUTH_MISSING_MESSAGES.includes(message);
}

/** Status from our edge wrapper, a Supabase/PostgREST error, or a plain `{ status }` shape. */
function statusOf(error: unknown): number | null {
  if (error instanceof AdminEdgeFetchError) return error.status;
  const like = asErrorLike(error);
  if (!like) return null;
  if (typeof like.status === 'number' && Number.isFinite(like.status)) return like.status;
  return null;
}

function requestIdOf(error: unknown): string | null {
  if (error instanceof AdminEdgeFetchError) return error.requestId;
  const like = asErrorLike(error);
  if (like && typeof like.requestId === 'string' && like.requestId.trim()) {
    return like.requestId.trim();
  }
  return null;
}

function isReportable(error: unknown): boolean {
  if (isAbort(error)) return false;
  if (isOffline()) return false;
  if (isTransportFailure(error)) return false;
  if (isAuthMissing(error)) return false;

  const status = statusOf(error);
  if (status === null) return true; // thrown non-HTTP error: a real fault
  if (status === 0) return false; // transport failure: never reached the server
  if (status === 401) return false; // the auth flow owns this
  return status >= 500;
}

function statusBucket(status: number | null): string {
  if (status === null) return 'thrown';
  if (status === 0) return 'network';
  return `${Math.floor(status / 100)}xx`;
}

/** First key segment only — never ids, which would make every row its own issue. */
function keyRoot(key: readonly unknown[] | undefined): string | undefined {
  const first = key?.[0];
  return typeof first === 'string' && first ? first : undefined;
}

/**
 * Grouping token for a mutation with no mutation key. Without one, every thrown mutation
 * error shared the `unknown` bucket, so "booking_rate must be a number", "ids is not
 * iterable" and any other validation message landed in a single issue. Volatile ids and
 * numbers are replaced so repeat failures still group.
 */
function messageRoot(error: unknown): string {
  const like = asErrorLike(error);
  const message = typeof like?.message === 'string' ? like.message : '';
  const normalized = message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
    .replace(/\d+/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (normalized) return normalized;
  return like?.name === 'Error' || !like?.name ? 'unknown' : String(like.name);
}

export function reportQueryError(
  error: unknown,
  kind: QueryErrorKind,
  key: readonly unknown[] | undefined,
  meta?: Record<string, unknown> | undefined
): void {
  if (meta?.sentry === false) return;
  if (!isReportable(error)) return;

  if (error && typeof error === 'object') {
    if (reported.has(error)) return;
    reported.add(error);
  }

  const status = statusOf(error);
  const root = keyRoot(key);
  const requestId = requestIdOf(error);

  captureError(error, {
    level: status !== null && status >= 500 ? 'error' : 'warning',
    tags: {
      error_kind: kind,
      ...(root ? { query_key_root: root } : {}),
      ...(status !== null ? { http_status: String(status) } : {}),
      ...(requestId ? { request_id: requestId } : {}),
    },
    extra: {
      ...(root ? { query_key_root: root } : {}),
      ...(status !== null ? { http_status: status } : {}),
    },
    fingerprint: [kind, root ?? messageRoot(error), statusBucket(status)],
  });
}
