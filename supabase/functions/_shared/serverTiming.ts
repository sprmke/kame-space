/**
 * `Server-Timing` support for the edge wrappers.
 *
 * Every authenticated call pays auth + blocklist + rate-limit + handler before it
 * returns anything, and without a per-phase number we can only guess which one to
 * attack. These helpers time each phase and expose **durations only** on the
 * response: no user id, no function args, no counts. That keeps the header safe to
 * expose cross-origin to the app (which is exactly what `Timing-Allow-Origin` does)
 * and keeps it out of any PII surface.
 *
 * The header is always emitted, in production too. It costs a handful of `Date.now()`
 * calls and a `Headers` clone, and it is the difference between "the dashboard is
 * slow" and "the dashboard spends 340ms in auth".
 */

/** Phase durations in milliseconds. Keys are lowercase phase names. */
export type EdgeTimings = Record<string, number>;

/** The header name, kept in one place so tests and docs agree. */
export const SERVER_TIMING_HEADER = 'Server-Timing';

/**
 * `*` rather than a literal origin list: the values are durations with no
 * identifiers, and the app is served from several origins (apex, preview URLs,
 * localhost) that would otherwise each need maintaining. Nothing here is
 * credential-bearing.
 */
const TIMING_ALLOW_ORIGIN = '*';

/**
 * Time one phase, recording it even when it throws so a failed auth still shows up
 * in the header instead of silently vanishing from the breakdown.
 */
export async function timePhase<T>(
  timings: EdgeTimings,
  name: string,
  fn: () => Promise<T> | T
): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    timings[name] = Date.now() - started;
  }
}

/** `Server-Timing: auth;dur=12.3, handler;dur=88.2` */
export function formatServerTiming(timings: EdgeTimings): string {
  return Object.entries(timings)
    .filter(([, ms]) => Number.isFinite(ms) && ms >= 0)
    .map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`)
    .join(', ');
}

/**
 * Return a copy of `response` carrying the timing header. The body is passed
 * through untouched (streamed, not buffered), and any response whose body was
 * already consumed is returned as-is rather than throwing.
 */
export function withServerTiming(response: Response, timings: EdgeTimings): Response {
  const header = formatServerTiming(timings);
  if (!header || response.bodyUsed) return response;

  try {
    const headers = new Headers(response.headers);
    headers.set(SERVER_TIMING_HEADER, header);
    headers.set('Timing-Allow-Origin', TIMING_ALLOW_ORIGIN);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    // A response we cannot re-wrap is still a response the caller needs.
    return response;
  }
}
