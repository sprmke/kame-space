/**
 * Property access + entitlements resolved from **slugs** instead of a property id.
 *
 * The guards need this data before `list-properties` has returned an id, which is exactly
 * what made the old cold open serial. Resolving by slug lets the bootstrap fetch it in the
 * same phase as everything else.
 *
 * Authorisation is unchanged: `verifyPropertyAccess` performs the same check it performs
 * everywhere else, with the verified user already supplied.
 */

import { type AuthenticatedUser, createServiceClient } from './orgAuth.ts';
import { resolvePropertyEntitlements } from './planEntitlements.ts';
import { resolvePropertyAccessContext } from './propertyScope.ts';
import type { ResolvedPropertyEntitlements } from './planEntitlements.ts';
import type { PropertyAccessContext } from './orgAuth.ts';

export type PropertyScopedBootstrap = {
  propertyAccess: {
    accessKind: PropertyAccessContext['accessKind'];
    permissions: string[];
    memberId: string | null;
    propertyId: string;
    orgSlug: string;
    orgName: string;
    propertySlug: string;
    propertyName: string;
    planLimited: boolean;
  };
  entitlements: ResolvedPropertyEntitlements;
};

/**
 * Resolve the property id from `orgSlug` + `propertySlug`, then run the same access check
 * and entitlement resolution the dedicated endpoints run. Returns null when the slugs do
 * not resolve for this user, so the caller can fall back rather than error.
 */
export async function loadPropertyEntitlementsBySlug(
  req: Request,
  user: AuthenticatedUser,
  orgSlug: string,
  propertySlug: string
): Promise<PropertyScopedBootstrap | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('properties')
    .select('id, slug, organization_id, organizations!inner(slug)')
    .eq('slug', propertySlug)
    .eq('organizations.slug', orgSlug)
    .maybeSingle();

  if (error) {
    console.error('[get-session-context] property slug lookup failed:', error.message);
    throw new Error('Failed to resolve property');
  }
  if (!data) return null;

  const propertyId = (data as { id: string }).id;

  let ctx: PropertyAccessContext;
  try {
    ctx = await resolvePropertyAccessContext(req, propertyId, user);
  } catch {
    // Not permitted for this user: the caller falls back to the per-endpoint guards, which
    // produce the correct redirect or denial with the same code as before.
    return null;
  }

  const entitlements = await resolvePropertyEntitlements(propertyId);

  return {
    propertyAccess: {
      accessKind: ctx.accessKind,
      permissions: ctx.permissions,
      memberId: ctx.memberId ?? null,
      propertyId: ctx.property.id,
      orgSlug: ctx.org.slug,
      orgName: ctx.org.name,
      propertySlug: ctx.property.slug,
      propertyName: ctx.property.name,
      planLimited: ctx.planLimited === true,
    },
    entitlements,
  };
}
