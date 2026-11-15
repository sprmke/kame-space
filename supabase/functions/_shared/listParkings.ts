/**
 * The parking list for one organization.
 *
 * Shared by `list-parkings` and `get-session-context` so the two cannot drift: the bootstrap seeds
 * the same cache entry the dedicated endpoint would have returned. Scoped org admins only see
 * their assigned parkings, exactly as before.
 */

import type { SupabaseClient } from './supabaseJs.ts';
import type { OrgAccessContext } from './orgAuth.ts';
import { resolveAssignedListingIdsForOrgUser, serializeParking } from './orgAuth.ts';

function emptyParkingStats() {
  return { activeReservations: 0, monthlyRevenue: 0, occupancyRate: 0 };
}

export async function loadParkingsPayload(
  supabase: SupabaseClient,
  user: { id: string },
  ctx: Pick<OrgAccessContext, 'org' | 'canListAllProperties'>
) {
  // Bounded by how many parkings one organization has, which is a handful in practice; the same
  // reasoning the guard's allowlist records for `list-parkings`.
  const { data, error } = await supabase
    .from('parkings')
    .select('*')
    .eq('organization_id', ctx.org.id)
    .order('name', { ascending: true });

  if (error) {
    console.error('[listParkings]', error.message);
    throw new Error('Failed to list parkings');
  }

  let rows = data ?? [];

  if (!ctx.canListAllProperties) {
    const assigned = await resolveAssignedListingIdsForOrgUser(user.id, ctx.org.id as string);
    const allowed = new Set(assigned.parkingIds);
    rows = rows.filter((row) => allowed.has(row.id as string));
  }

  return {
    parkings: rows.map((row) => ({ ...serializeParking(row), stats: emptyParkingStats() })),
  };
}
