import { buildSupabaseSession, seedSupabaseSession } from './authSeam';
import { mockPlatformStatus } from './edgeMocks/platformStatus';
import { PERSONAS, TIER_PLAN_ID, type Persona, type PersonaId, type Tier } from './personas';

import type { EdgeMock } from './interceptEdge';
import type { Page } from '@playwright/test';

/**
 * `mockTenant` — the tenant a page renders for, in one call.
 *
 * It covers the four reads every signed-in page makes on boot: the seeded session, the
 * org list, the platform status banner, and feature availability. Anything beyond that is
 * deliberately **not** guessed here: a page's own data endpoints belong to the spec, and a
 * strict spec then fails loudly instead of rendering from an invented payload shape.
 */

export type TenantLevel = 'org' | 'property' | 'parking';
export type TenantState = 'active' | 'paused' | 'suspended' | 'archived';

export type TenantOptions = {
  persona: PersonaId | Persona;
  tier?: Tier;
  level?: TenantLevel;
  state?: TenantState;
  orgId?: string;
  orgSlug?: string;
};

export type Tenant = {
  persona: Persona;
  tier: Tier;
  planId: string;
  level: TenantLevel;
  state: TenantState;
  orgId: string;
  orgSlug: string;
  /** Session payload the app reads from local storage. */
  session: ReturnType<typeof buildSupabaseSession>;
  /** Boot reads only: session, org list, platform status, feature availability. */
  mocks: EdgeMock[];
};

const DEFAULT_ORG_ID = 'org-e2e-001';
const DEFAULT_ORG_SLUG = 'sample-stays-ph';
const OTHER_ORG = { id: 'org-other-001', slug: 'other-stays-ph', name: 'Other Stays PH' };

function organization(id: string, slug: string, name: string) {
  return {
    id,
    name,
    slug,
    description: null,
    logoUrl: null,
    settings: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export function mockTenant(options: TenantOptions): Tenant {
  const persona =
    typeof options.persona === 'string' ? PERSONAS[options.persona] : options.persona;
  const tier = options.tier ?? 'pro';
  const level = options.level ?? 'property';
  const state = options.state ?? 'active';
  const orgId = options.orgId ?? DEFAULT_ORG_ID;
  const orgSlug = options.orgSlug ?? DEFAULT_ORG_SLUG;

  const thisOrg = organization(orgId, orgSlug, 'Sample Stays PH');
  const otherOrg = organization(OTHER_ORG.id, OTHER_ORG.slug, OTHER_ORG.name);

  // A stranger is a valid host who simply does not belong to this tenant, so the org list
  // shows their own org only. A super admin sees no org rows, which is what the shell reads
  // when it decides to show the platform area.
  const organizations =
    persona.id === 'stranger' ? [otherOrg] : persona.isSuperAdmin ? [] : [thisOrg];

  return {
    persona,
    tier,
    planId: TIER_PLAN_ID[tier],
    level,
    state,
    orgId,
    orgSlug,
    // Host session: platform and tenant pages both read the same Supabase user. Who they
    // are is expressed by the org list and permissions, not by a different token.
    session: buildSupabaseSession('host'),
    mocks: [
      mockPlatformStatus(state === 'suspended' ? { maintenanceMode: true, maintenanceMessage: null } : {}),
      {
        name: 'list-organizations',
        method: 'GET',
        body: { success: true, data: { organizations, isSuperAdmin: persona.isSuperAdmin } },
      },
      {
        name: 'get-feature-availability',
        method: 'GET',
        body: {
          success: true,
          data: { serverNow: '2026-01-01T00:00:00.000Z', entries: [] },
        },
      },
    ],
  };
}

/**
 * Seed the signed-in session. Call before `page.goto`.
 *
 * The tenant's boot reads (`tenant.mocks`) are merged into the spec's own
 * `mockEdgeFunctions` call rather than registered here: two route handlers on the same URL
 * pattern would let one silently shadow the other.
 */
export async function installTenant(page: Page, tenant: Tenant): Promise<void> {
  await seedSupabaseSession(page, tenant.session);
}
