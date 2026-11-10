/**
 * robots.txt rules, kept out of `publicRoutes.ts` so the route registry never lands in the
 * entry bundle. `seoMeta.ts` needs these constants at module scope on every page; the registry
 * is only needed by the SEO surfaces, which are lazy or edge-only.
 */

/**
 * Private prefixes and patterns kept out of every crawler.
 *
 * Prefixes end with `/` (or are exact paths). Wildcard forms the sitemap protocol supports:
 * `/*` for any path segment, and a trailing `?` for query-string scoping.
 *
 * Every entry must correspond to a non-indexable registry route or a private sub-path of one
 * (`check:seo-routes` enforces the reverse direction: no indexable route may be blocked).
 */
export const ROBOTS_DISALLOW = [
  '/org/',
  '/orgs',
  '/admin',
  '/account',
  '/sign-in',
  '/accept-invite',
  '/onboarding',
  '/for-guests/',
  '/for-hosts/login',
  '/for-hosts/register',
  '/for-hosts/preview',
  '/for-hosts/v2',
  '/for-hosts/v3',
  '/explore-preview',
  '/v2',
  '/guest-review',
  '/vouchers',
  '/tickets',
  '/bookings/',
  '/form',
  '/sd-form',
  '/success',
  '/messages',
  '/trips',
  '/stays',
  '/favorites',
  '/wishlist',
  '/profile',
  '/search',
  '/ingest/',
  '/parkings/requests/',
  '/parkings/*/form',
  '/*/form',
  '/*/calendar',
  '/*/messages',
  '/*/document',
  '/*/guest-review',
  '/*/sd-form',
  '/*/success',
  '/properties/*/parking/',
  '/properties/*/stay-guide',
  '/properties/*/showcase',
  // Trip pages always carry ?bookingId=; the trailing ? keeps /properties/trip-house indexable.
  '/*/trip?',
  '/*?*swLat=',
] as const;

/**
 * Crawlers asked to index the public catalogue, each declared with the same private-path
 * disallows as `*`. Answer engines are allowed on purpose: listings should be citable.
 *
 * `CCBot` (Common Crawl) feeds many smaller models and only reads public pages, so it is
 * allowed too. Product decision, recorded here next to the list.
 */
export const AI_CRAWLER_USER_AGENTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'Claude-SearchBot',
  'Claude-User',
  'ClaudeBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Bingbot',
  'CCBot',
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `/*` glob (robots syntax) to a regex. Robots Disallow is prefix-based, so a rule that
 * ends in `/` or `=` matches any longer path; everything else must match exactly. */
function globToRegExp(glob: string, prefix: boolean): RegExp {
  const body = glob
    .split('*')
    .map((part) => escapeRegExp(part))
    .join('.*');
  return new RegExp(prefix ? `^${body}` : `^${body}$`);
}

const DISALLOW_MATCHERS: ReadonlyArray<(target: string) => boolean> = ROBOTS_DISALLOW.map((rule) => {
  if (rule.endsWith('?')) {
    // Query-scoped: the path must match exactly AND carry a query string.
    const pathPattern = globToRegExp(rule.slice(0, -1), false);
    return (target: string) => {
      const queryIndex = target.indexOf('?');
      return queryIndex > 0 && pathPattern.test(target.slice(0, queryIndex));
    };
  }
  if (rule.includes('*')) {
    const regex = globToRegExp(rule, rule.endsWith('/') || rule.endsWith('='));
    return (target: string) => regex.test(target);
  }
  if (rule.endsWith('/')) {
    const exact = rule.slice(0, -1);
    return (target: string) => target === exact || target.startsWith(rule);
  }
  return (target: string) => target === rule || target.startsWith(`${rule}/`);
});

/**
 * Does robots allow a path? Pass the pathname, plus `?search` when the caller has one, so
 * query-scoped rules for trip pages can match.
 */
export function isAllowedByRobots(pathWithSearch: string): boolean {
  return !DISALLOW_MATCHERS.some((matches) => matches(pathWithSearch));
}
