/**
 * Old public slug → current slug (SEO-17.2 / SEO-17.3).
 *
 * `listing_slug_redirects` is filled by a trigger whenever a property, parking or development
 * slug changes. Public handlers ask this helper before answering 404, so a shared link from
 * before a rename keeps working and search engines see a 301 instead of a dead page.
 */

import { createServiceClient } from './orgAuth.ts';

export type ListingSlugFamily = 'property' | 'parking' | 'development';

const FAMILY_PATH: Record<ListingSlugFamily, string> = {
  property: 'properties',
  parking: 'parkings',
  development: 'developments',
};

/**
 * Current URL path for a historical slug, or null when the slug is not a known redirect.
 * Never throws: a lookup failure must not turn a 404 into a 500.
 */
export async function resolveListingSlugRedirect(
  family: ListingSlugFamily,
  slug: string
): Promise<string | null> {
  const candidate = slug.trim().toLowerCase();
  if (!candidate) return null;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('resolve_listing_slug_redirect', {
      p_family: family,
      p_slug: candidate,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    const currentSlug = (row as { slug?: string } | null)?.slug?.trim();
    if (!currentSlug) return null;
    return `/${FAMILY_PATH[family]}/${currentSlug}`;
  } catch {
    return null;
  }
}
