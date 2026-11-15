/**
 * Unique public listing slugs with redirect reservation (SEO-17.2).
 *
 * A historical slug in `listing_slug_redirects` stays reserved for that listing so another
 * host cannot take it and silently hijack old shares. The same listing may reclaim its own
 * old slug (the rename trigger clears that redirect row).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

import { slugifyName, withSlugSuffix } from './slugUtils.ts';

export type ListingSlugFamily = 'property' | 'parking' | 'development';

const LIVE_TABLE: Record<ListingSlugFamily, string> = {
  property: 'properties',
  parking: 'parkings',
  development: 'developments',
};

/**
 * Pure conflict rule used by allocate + unit tests.
 * Blocked when a different listing owns the slug live or via redirect.
 */
export function listingSlugBlockedByOwners(args: {
  excludeListingId?: string;
  liveOwnerId: string | null;
  redirectOwnerId: string | null;
}): boolean {
  const { excludeListingId, liveOwnerId, redirectOwnerId } = args;
  if (liveOwnerId && liveOwnerId !== excludeListingId) return true;
  if (redirectOwnerId && redirectOwnerId !== excludeListingId) return true;
  return false;
}

export async function findListingSlugOwners(
  supabase: SupabaseClient,
  family: ListingSlugFamily,
  candidate: string
): Promise<{ liveOwnerId: string | null; redirectOwnerId: string | null }> {
  const slug = candidate.trim().toLowerCase();
  if (!slug) {
    return { liveOwnerId: null, redirectOwnerId: null };
  }

  const table = LIVE_TABLE[family];
  const [{ data: live }, { data: redirect }] = await Promise.all([
    supabase.from(table).select('id').eq('slug', slug).maybeSingle(),
    supabase
      .from('listing_slug_redirects')
      .select('listing_id')
      .eq('family', family)
      .eq('old_slug', slug)
      .maybeSingle(),
  ]);

  return {
    liveOwnerId: (live as { id?: string } | null)?.id ?? null,
    redirectOwnerId: (redirect as { listing_id?: string } | null)?.listing_id ?? null,
  };
}

export async function isListingSlugAvailable(
  supabase: SupabaseClient,
  family: ListingSlugFamily,
  candidate: string,
  excludeListingId?: string
): Promise<boolean> {
  const owners = await findListingSlugOwners(supabase, family, candidate);
  return !listingSlugBlockedByOwners({ ...owners, excludeListingId });
}

/** Pick a unique slug that is free on the live table and not reserved by another listing's redirect. */
export async function allocateUniqueListingSlug(
  supabase: SupabaseClient,
  family: ListingSlugFamily,
  name: string,
  preferred?: string,
  excludeListingId?: string
): Promise<string> {
  const base = slugifyName(preferred?.trim() || name);

  for (let i = 0; i < 20; i++) {
    const candidate = withSlugSuffix(base, i);
    if (await isListingSlugAvailable(supabase, family, candidate, excludeListingId)) {
      return candidate;
    }
  }

  for (let i = 0; i < 8; i++) {
    const candidate = `${base}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 64);
    if (await isListingSlugAvailable(supabase, family, candidate, excludeListingId)) {
      return candidate;
    }
  }

  // Extremely unlikely: base + UUID still colliding. Last resort with longer entropy.
  return `${base.slice(0, 40)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
