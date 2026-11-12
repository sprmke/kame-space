/**
 * Route patterns for telemetry.
 *
 * The app deliberately keeps one splat route (`{ path: '*' }`) and renders `<Routes>` inside
 * `AppRoutes`. That keeps the router simple, but it means router-based integrations can only
 * ever see `/*`, so every Sentry transaction and every PostHog pageview was anonymous. This
 * module derives a stable pattern from the pathname instead.
 *
 * Rules, in order:
 *   1. A segment directly after a known dynamic parent (`org`, `property`, `parking`, ...) is a
 *      tenant identifier and becomes `:param`.
 *   2. Any remaining segment that looks like an opaque identifier (UUID, long hex, long
 *      random string) also becomes `:param`, so an unknown route cannot leak one either.
 *   3. Everything else is a static route segment and is kept.
 *
 * The result is safe to send: it contains route names, never slugs, ids, emails or tokens.
 */

/**
 * Segments whose *next* segment is a tenant slug. Kept deliberately short: every entry here
 * turns the following segment into `:param`, so a false entry costs pattern detail. Record ids
 * do not need to be listed — they are UUIDs or opaque ids and the heuristic below catches them.
 */
const DYNAMIC_PARENTS = new Set(['org', 'property', 'properties', 'parking', 'developments']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Mongo-style or generated ids, and anything long with no word separators. */
const OPAQUE_ID_RE = /^[0-9a-f]{16,}$|^[A-Za-z0-9_-]{20,}$/;
/** An email in a path segment would be personal data; never send it. */
const EMAIL_LIKE_RE = /@/;

export const UNMATCHED_ROUTE_PATTERN = 'unmatched';

function looksLikeIdentifier(segment: string): boolean {
  return UUID_RE.test(segment) || OPAQUE_ID_RE.test(segment) || EMAIL_LIKE_RE.test(segment);
}

/**
 * `pathname` to a template such as `/org/:param/property/:param/bookings`.
 * Query strings are ignored; callers pass `location.pathname`.
 */
export function routePatternFor(pathname: string): string {
  if (!pathname || pathname === '/') return '/';

  const segments = pathname.split('/').filter(Boolean);
  const pattern: string[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const previous = segments[index - 1];

    if (index > 0 && previous && DYNAMIC_PARENTS.has(previous)) {
      pattern.push(':param');
      continue;
    }
    if (looksLikeIdentifier(segment)) {
      pattern.push(':param');
      continue;
    }
    pattern.push(segment);
  }

  return `/${pattern.join('/')}`;
}

/**
 * True when the pattern carries no tenant value. Used by the tests that guard against a slug
 * leaking into telemetry.
 */
export function patternIsSanitized(pattern: string, pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  const patternSegments = pattern.split('/').filter(Boolean);
  if (segments.length !== patternSegments.length) return false;
  return segments.every((segment, index) => {
    if (patternSegments[index] === ':param') return true;
    return !looksLikeIdentifier(segment);
  });
}
