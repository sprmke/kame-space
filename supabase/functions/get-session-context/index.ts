/**
 * get-session-context — one authenticated call that returns everything the admin shell
 * guards would otherwise fetch in four to six separate round trips.
 *
 * Why this exists
 * ---------------
 * A cold dashboard open used to chain: session, then organizations and properties in
 * parallel, then property-access and entitlements (both blocked on the property id), then
 * the page. Measured 2026-11-09, each authenticated call also paid auth and a rate-limit
 * write, so the chain cost far more than the work inside it.
 *
 * Why it is safe
 * --------------
 * It does **not** replace the guards. It returns the same payloads the existing endpoints
 * return, produced by the same shared loaders, and the client seeds the existing query keys
 * from it. If this call fails, the guards fall back to their own queries exactly as before.
 * Removing the client's bootstrap call fully reverts the behaviour.
 *
 * Auth: verifyAuthenticatedUser. Every payload is scoped to that user.
 * Query: ?orgSlug=slug&propertySlug=slug (both optional; the org shell has no property).
 */

import { buildFeatureAvailabilityEntries } from '../_shared/featureAvailabilityPublicEntries.ts';
import { getFeatureAvailabilityRows } from '../_shared/featureAvailability.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { buildOrgAccessPayload } from '../_shared/orgAccessPayload.ts';
import {
  createServiceClient,
  resolveAssignedListingIdsForOrgUser,
  serializeParking,
  verifyOrgAccess,
} from '../_shared/orgAuth.ts';
import { loadOrganizationsPayload } from '../_shared/listOrganizations.ts';
import { buildSessionContext } from '../_shared/sessionContext.ts';
import { loadPropertiesPayload } from '../_shared/listProperties.ts';
import { loadPropertyEntitlementsBySlug } from '../_shared/propertyEntitlementsLookup.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

/**
 * The parking list as `list-parkings` returns it. Scoped org admins only see assigned parkings,
 * so the same filter runs here rather than being dropped in the name of speed.
 */
async function loadParkingsForBootstrap(
  req: Request,
  user: { id: string },
  ctx: Awaited<ReturnType<typeof verifyOrgAccess>>
) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parkings')
    .select('*')
    .eq('organization_id', ctx.org.id)
    .order('name', { ascending: true });

  if (error) {
    console.error('[get-session-context] parkings:', error.message);
    throw new Error('Failed to list parkings');
  }

  let rows = data ?? [];
  if (!ctx.canListAllProperties) {
    const assigned = await resolveAssignedListingIdsForOrgUser(user.id, ctx.org.id as string);
    const allowed = new Set(assigned.parkingIds);
    rows = rows.filter((row) => allowed.has(row.id as string));
  }

  return {
    parkings: rows.map((row) => ({
      ...serializeParking(row),
      stats: { activeReservations: 0, monthlyRevenue: 0, occupancyRate: 0 },
    })),
  };
}

serveAuthenticated('get-session-context', async (req, user) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug')?.trim() ?? '';
  const propertySlug = url.searchParams.get('propertySlug')?.trim() ?? '';

  const payload = await buildSessionContext(
    { orgSlug, propertySlug },
    {
      organizations: () => loadOrganizationsPayload(createServiceClient(), user),
      properties: (slug) => loadPropertiesPayload(req, user, { orgSlug: slug }),
      propertyScoped: (org, property) => loadPropertyEntitlementsBySlug(req, user, org, property),
      // The shell fetched these three on its own right after this call resolved. They are org
      // scoped, cheap, and independent, so they ride along instead of costing three more round
      // trips. Each payload comes from the same builder its dedicated endpoint uses.
      orgExtras: async (org) => {
        const ctx = await verifyOrgAccess(req, { orgSlug: org });
        const now = new Date();

        const [featureRows, parkingsPayload] = await Promise.all([
          getFeatureAvailabilityRows(),
          loadParkingsForBootstrap(req, user, ctx),
        ]);

        return {
          orgAccess: buildOrgAccessPayload(ctx),
          featureAvailability: {
            serverNow: now.toISOString(),
            entries: buildFeatureAvailabilityEntries(featureRows, now, user),
          },
          parkings: parkingsPayload,
        };
      },
    }
  );

  return jsonSuccess(req, payload);
});
