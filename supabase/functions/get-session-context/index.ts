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
import { createServiceClient, verifyOrgAccess } from '../_shared/orgAuth.ts';
import { loadParkingsPayload } from '../_shared/listParkings.ts';
import { loadOrganizationsPayload } from '../_shared/listOrganizations.ts';
import { buildSessionContext } from '../_shared/sessionContext.ts';
import { loadPropertiesPayload } from '../_shared/listProperties.ts';
import { loadPropertyEntitlementsBySlug } from '../_shared/propertyEntitlementsLookup.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

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
          loadParkingsPayload(createServiceClient(), user, ctx),
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
