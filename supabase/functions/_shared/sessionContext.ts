/**
 * Composition for `get-session-context`.
 *
 * Kept separate from the handler so the branch rules can be tested without starting an
 * HTTP server, and so the shape the client seeds from lives in one place.
 *
 * Loaders are injected rather than imported directly, which is what makes this testable:
 * the handler passes the real ones, a test passes stubs.
 */

export type SessionContextLoaders<OrgPayload, PropertiesPayload, Scoped> = {
  organizations: () => Promise<OrgPayload>;
  properties: (orgSlug: string) => Promise<PropertiesPayload>;
  propertyScoped: (orgSlug: string, propertySlug: string) => Promise<Scoped | null>;
  /**
   * Org-scoped reads the shell used to fetch on its own: permissions, feature availability and
   * the parking list. Optional so the function stays usable without them.
   */
  orgExtras?: (orgSlug: string) => Promise<{
    orgAccess?: unknown;
    featureAvailability?: unknown;
    parkings?: unknown;
  }>;
};

export type SessionContext<OrgPayload, PropertiesPayload, Scoped> = {
  organizations: OrgPayload;
  properties?: PropertiesPayload;
  propertyAccess: Scoped extends { propertyAccess: infer A } ? A : never | null;
  entitlements: Scoped extends { entitlements: infer E } ? E : never | null;
};

/**
 * Rules, unchanged from the dedicated endpoints:
 * - no org slug: organizations only (the shell has nothing else to scope to);
 * - org only: organizations plus that org's properties;
 * - org plus property: add the property-scoped access and entitlements.
 *
 * The three reads are independent, so they run together.
 */
export async function buildSessionContext<OrgPayload, PropertiesPayload, Scoped>(
  selectors: { orgSlug?: string; propertySlug?: string },
  loaders: SessionContextLoaders<OrgPayload, PropertiesPayload, Scoped>
): Promise<Record<string, unknown>> {
  const orgSlug = selectors.orgSlug?.trim() ?? '';
  const propertySlug = selectors.propertySlug?.trim() ?? '';

  if (!orgSlug) {
    return { organizations: await loaders.organizations() };
  }

  const [organizations, properties, scoped, extras] = await Promise.all([
    loaders.organizations(),
    loaders.properties(orgSlug),
    propertySlug ? loaders.propertyScoped(orgSlug, propertySlug) : Promise.resolve(null),
    loaders.orgExtras ? loaders.orgExtras(orgSlug) : Promise.resolve({}),
  ]);

  const scopedPayload = scoped as { propertyAccess?: unknown; entitlements?: unknown } | null;

  return {
    organizations,
    properties,
    propertyAccess: scopedPayload?.propertyAccess ?? null,
    entitlements: scopedPayload?.entitlements ?? null,
    ...(extras ?? {}),
  };
}
