/**
 * public-sitemap — sitemap.xml for the public guest site (served at /sitemap.xml by the
 * Vercel middleware). Auth: anon key (verify_jwt=false).
 * Query: part=N (only when the catalog needs a sitemap index).
 *
 * Reads slugs from the public listing search index (ACTIVE listings only). Absolute
 * URLs use PUBLIC_GUEST_APP_ORIGIN for this deployment, never the request host.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { resolvePublicGuestAppOrigin } from '../_shared/publicAppOrigin.ts';
import {
  buildSitemapIndex,
  buildUrlset,
  developmentSubPath,
  listingPath,
  MAX_URLS_PER_SITEMAP,
  placePath,
  STATIC_SITEMAP_LASTMOD,
  STATIC_SITEMAP_PATHS,
  type SitemapEntry,
  type SitemapFamily,
} from '../_shared/publicSitemap.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { servePublic } from '../_shared/serveEdge.ts';

const PAGE = 1_000;

function laterOf(current: string | null, next: unknown): string | null {
  if (typeof next !== 'string') return current;
  if (!current) return next;
  return Date.parse(next) > Date.parse(current) ? next : current;
}

async function loadEntries(): Promise<SitemapEntry[]> {
  const supabase = createServiceClient();
  const entries: SitemapEntry[] = STATIC_SITEMAP_PATHS.map((path) => ({
    path,
    lastmod: STATIC_SITEMAP_LASTMOD[path] ?? null,
  }));

  // Place pages carry the newest listing change in that place; a development sub-page is only
  // listed once it has at least one unit or slot, and carries that development's newest change.
  const placeLastmod = new Map<string, string | null>();
  const placeOrder: string[] = [];
  const development = new Map<
    string,
    { properties: boolean; parking: boolean; lastmod: string | null }
  >();

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('public_listing_search')
      .select('family, id, slug, place_slug, residence_slug, refreshed_at')
      .order('family')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`sitemap read failed: ${error.message}`);
    const rows = data ?? [];

    for (const row of rows) {
      const family = row.family as SitemapFamily;
      const refreshedAt = row.refreshed_at as string | null;
      entries.push({ path: listingPath(family, row.slug as string), lastmod: refreshedAt });

      const placeKey = `${family}:${row.place_slug as string}`;
      if (!placeLastmod.has(placeKey)) {
        placeLastmod.set(placeKey, refreshedAt);
        placeOrder.push(placeKey);
      } else {
        placeLastmod.set(placeKey, laterOf(placeLastmod.get(placeKey) ?? null, refreshedAt));
      }

      const residenceSlug = (row.residence_slug as string | null)?.trim();
      if (residenceSlug && (family === 'property' || family === 'parking')) {
        const current = development.get(residenceSlug) ?? {
          properties: false,
          parking: false,
          lastmod: null,
        };
        if (family === 'property') current.properties = true;
        else current.parking = true;
        current.lastmod = laterOf(current.lastmod, refreshedAt);
        development.set(residenceSlug, current);
      }
    }

    if (rows.length < PAGE) break;
  }

  for (const placeKey of placeOrder) {
    const separator = placeKey.indexOf(':');
    const family = placeKey.slice(0, separator) as SitemapFamily;
    const placeSlug = placeKey.slice(separator + 1);
    entries.push({
      path: placePath(family, placeSlug),
      lastmod: placeLastmod.get(placeKey) ?? null,
    });
  }

  // `residence_slug` is a copy of the development slug captured when the listing was indexed.
  // A renamed or deleted development would otherwise put a 404 in the sitemap, so the candidates
  // are confirmed against the developments table before they are listed.
  if (development.size > 0) {
    const slugs = [...development.keys()];
    const { data: existing, error: developmentError } = await supabase
      .from('developments')
      .select('slug')
      .in('slug', slugs)
      // Exactly the candidate set, so the read is bounded by the page loop above.
      .limit(slugs.length);
    if (developmentError) throw new Error(`sitemap read failed: ${developmentError.message}`);
    const live = new Set(
      (existing ?? [])
        .map((row) => (row.slug as string | null)?.trim())
        .filter((slug): slug is string => Boolean(slug))
    );

    for (const [slug, state] of development) {
      if (!live.has(slug)) continue;
      if (state.properties) {
        entries.push({ path: developmentSubPath(slug, 'properties'), lastmod: state.lastmod });
      }
      if (state.parking) {
        entries.push({ path: developmentSubPath(slug, 'parking'), lastmod: state.lastmod });
      }
    }
  }

  return entries;
}

function xml(req: Request, body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

servePublic('public-sitemap', async (req) => {
  if (req.method !== 'GET') return xml(req, '', 405);
  const limited = await publicGetRateLimitGate(req, 'public-sitemap');
  if (limited) return limited;

  const origin = resolvePublicGuestAppOrigin();
  const entries = await loadEntries();
  const parts = Math.max(1, Math.ceil(entries.length / MAX_URLS_PER_SITEMAP));
  const partRaw = Number.parseInt(new URL(req.url).searchParams.get('part') ?? '', 10);

  if (parts > 1 && !Number.isFinite(partRaw)) {
    return xml(req, buildSitemapIndex(origin, parts));
  }
  const part = Number.isFinite(partRaw) ? partRaw : 1;
  if (part < 1 || part > parts) return xml(req, '', 404);
  const slice = entries.slice((part - 1) * MAX_URLS_PER_SITEMAP, part * MAX_URLS_PER_SITEMAP);
  return xml(req, buildUrlset(origin, slice));
});
