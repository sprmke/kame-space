/**
 * `llms.txt` and `llms-full.txt` (SEO-20).
 *
 * A plain-text map of the public site for AI answer engines: one H1, a summary paragraph, then
 * link sections with a one-line description each. `llms-full.txt` adds a line per ACTIVE
 * listing.
 *
 * Rules this module enforces:
 * - Public, ACTIVE data only. No host emails, phone numbers, street addresses or guest data.
 * - Nothing here is invented: links come from the route registry, listings from the same public
 *   search index the browse pages read.
 * - Pure and dependency-free, so the middleware bundle and the unit tests share it.
 */

import { PUBLIC_ROUTES } from './publicRoutes';

export type LlmsLink = { href: string; label: string; note?: string };

export type LlmsListing = {
  name: string;
  path: string;
  kind: string;
  place?: string | null;
  priceFrom?: number | null;
};

export type LlmsTxtInput = {
  siteOrigin: string;
  siteName: string;
  summary: string;
  places: Array<{ label: string; path: string; count?: number }>;
  listings?: LlmsListing[];
};

const DUPLICATE_EMAIL = /\S+@\S+\.\S+/;
const PHONE_LIKE = /\+?\d[\d\s()-]{7,}\d/;

/** Reject anything that looks like contact data or a street address, keeping the file PII-free. */
export function isPublicSafe(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (DUPLICATE_EMAIL.test(text)) return false;
  if (PHONE_LIKE.test(text)) return false;
  // Street addresses: a house/unit number followed by a street word.
  if (/\b\d+\s+[A-Za-z][A-Za-z.'-]*\s+(street|st\.?|avenue|ave\.?|road|rd\.?|lane|drive|dr\.?)\b/i.test(text)) {
    return false;
  }
  return true;
}

function registryLink(id: string): LlmsLink | null {
  const route = PUBLIC_ROUTES.find((entry) => entry.id === id);
  if (!route?.indexable) return null;
  return { href: route.pattern, label: route.title ?? route.id, note: route.description };
}

function section(title: string, links: LlmsLink[], origin: string): string[] {
  const usable = links.filter((link) => link.href && link.label && isPublicSafe(link.label));
  if (usable.length === 0) return [];
  return [
    `## ${title}`,
    '',
    ...usable.map((link) => {
      const note = link.note && isPublicSafe(link.note) ? `: ${link.note}` : '';
      return `- [${link.label}](${origin}${link.href})${note}`;
    }),
    '',
  ];
}

/** `llms.txt`: the map. */
export function buildLlmsTxt(input: LlmsTxtInput): string {
  const origin = input.siteOrigin.replace(/\/+$/, '');
  const lines: string[] = [
    `# ${input.siteName}`,
    '',
    `> ${input.summary}`,
    '',
    `Canonical site: ${origin}/`,
    '',
  ];

  lines.push(
    ...section(
      'For guests',
      ['home', 'properties', 'parkings', 'developments'].flatMap((id) => {
        const link = registryLink(id);
        return link ? [link] : [];
      }),
      origin
    )
  );

  lines.push(
    ...section(
      'Places',
      input.places.map((place) => ({
        href: place.path,
        label: place.label,
        note: place.count ? `${place.count} listings` : undefined,
      })),
      origin
    )
  );

  lines.push(
    ...section(
      'For hosts',
      ['for-hosts', 'for-hosts-pricing'].flatMap((id) => {
        const link = registryLink(id);
        return link ? [link] : [];
      }),
      origin
    )
  );

  lines.push(
    ...section(
      'Help and company',
      ['support', 'contact', 'about', 'terms', 'privacy', 'cookies'].flatMap((id) => {
        const link = registryLink(id);
        return link ? [link] : [];
      }),
      origin
    )
  );

  lines.push(
    '## Notes',
    '',
    '- Listings are added and removed as hosts publish. Only ACTIVE listings appear here.',
    `- Machine-readable URL list: ${origin}/sitemap.xml`,
    ''
  );

  return lines.join('\n');
}

const LISTING_KIND_LABEL: Record<string, string> = {
  property: 'Stay',
  parking: 'Parking',
  development: 'Development',
};

/** One line per listing, capped so the file stays small enough to fetch. */
export function renderListingLine(listing: LlmsListing, origin: string): string | null {
  if (!isPublicSafe(listing.name)) return null;
  const bits = [LISTING_KIND_LABEL[listing.kind] ?? listing.kind];
  if (listing.place && isPublicSafe(listing.place)) bits.push(listing.place);
  if (listing.priceFrom && listing.priceFrom > 0) {
    bits.push(`from PHP ${Math.round(listing.priceFrom)} per night`);
  }
  return `- [${listing.name}](${origin}${listing.path}) (${bits.join(', ')})`;
}

/** `llms-full.txt`: the map plus every ACTIVE listing. */
export function buildLlmsFullTxt(input: LlmsTxtInput): string {
  const origin = input.siteOrigin.replace(/\/+$/, '');
  const listings = (input.listings ?? []).slice(0, 2000);
  const lines = [buildLlmsTxt({ ...input, listings: undefined }).trimEnd(), ''];

  const grouped = new Map<string, LlmsListing[]>();
  for (const listing of listings) {
    const list = grouped.get(listing.kind) ?? [];
    list.push(listing);
    grouped.set(listing.kind, list);
  }

  for (const [kind, items] of grouped) {
    const rendered = items
      .map((listing) => renderListingLine(listing, origin))
      .filter((line): line is string => line !== null);
    if (rendered.length === 0) continue;
    lines.push(`## All ${LISTING_KIND_LABEL[kind] ?? kind} listings`, '', ...rendered, '');
  }

  lines.push(
    `Total listings in this file: ${listings.length}. Full catalogue: ${origin}/sitemap.xml`,
    ''
  );
  return lines.join('\n');
}

/** Minimal file for a host that must not be crawled (previews, dev). */
export function buildLlmsTxtUnavailable(siteName: string): string {
  return [
    `# ${siteName}`,
    '',
    '> This deployment is not public. Use https://kamespace.com for the live catalogue.',
    '',
  ].join('\n');
}
