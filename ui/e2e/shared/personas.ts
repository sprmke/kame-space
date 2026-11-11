/**
 * E2E personas, derived from the real permission catalogs.
 *
 * A persona is "who is signed in", not "what the mocks say". Every permission list here comes
 * from the same constants the app renders from (`propertyTeamConstants`, `parkingTeamConstants`,
 * `orgTeamConstants`), so adding or renaming a leaf updates the personas that hold it instead
 * of leaving a stale copy in a harness.
 *
 * Org `Operations` and `Read Only` have no client catalog: they are seeded server-side custom
 * templates. Use `orgCustom(leaves)` with the leaves the test needs rather than inventing a
 * list here, which would silently disagree with what the server grants.
 */

import { goldenPlanId } from '../../src/features/dashboard/plans/lib/planTierGolden';
import {
  ORG_ROLE_PERMISSIONS,
  type BuiltinOrgRole,
} from '../../src/features/dashboard/team/lib/orgTeamConstants';
import { PARKING_ROLE_PERMISSIONS } from '../../src/features/dashboard/team/lib/parkingTeamConstants';
import {
  PROPERTY_ADMIN_ROLE_ID,
  SEEDED_TEMPLATE_PERMISSIONS,
} from '../../src/features/dashboard/team/lib/propertyTeamConstants';

export type PersonaId =
  | 'anon'
  | 'guest'
  | 'orgOwner'
  | 'orgAdmin'
  | 'orgCustom'
  | 'propFull'
  | 'propOperations'
  | 'propReadOnly'
  | 'propCustom'
  | 'parkingManager'
  | 'parkingStaff'
  | 'parkingViewer'
  | 'parkingCustom'
  | 'superAdmin'
  | 'stranger';

export type PersonaLevel = 'public' | 'guest' | 'org' | 'property' | 'parking' | 'platform';

export type Persona = {
  id: PersonaId;
  level: PersonaLevel;
  isSuperAdmin: boolean;
  /** Server role id the page reads, or null when nobody is signed in. */
  roleId: string | null;
  permissions: string[];
};

export type Tier = 'free' | 'starter' | 'growth' | 'pro' | 'managed';

export const TIER_PLAN_ID: Record<Tier, string> = {
  free: goldenPlanId('free'),
  starter: goldenPlanId('starter'),
  growth: goldenPlanId('growth'),
  pro: goldenPlanId('pro'),
  managed: goldenPlanId('managed'),
};

const orgRole = (role: BuiltinOrgRole): string[] => [...ORG_ROLE_PERMISSIONS[role]];
const propertyTemplate = (name: keyof typeof SEEDED_TEMPLATE_PERMISSIONS): string[] => [
  ...SEEDED_TEMPLATE_PERMISSIONS[name],
];

export const PERSONAS: Record<
  Exclude<PersonaId, 'orgCustom' | 'propCustom' | 'parkingCustom'>,
  Persona
> = {
  anon: { id: 'anon', level: 'public', isSuperAdmin: false, roleId: null, permissions: [] },
  guest: { id: 'guest', level: 'guest', isSuperAdmin: false, roleId: null, permissions: [] },

  orgOwner: {
    id: 'orgOwner',
    level: 'org',
    isSuperAdmin: false,
    roleId: 'OWNER',
    permissions: orgRole('OWNER'),
  },
  orgAdmin: {
    id: 'orgAdmin',
    level: 'org',
    isSuperAdmin: false,
    roleId: 'ADMIN',
    permissions: orgRole('ADMIN'),
  },

  propFull: {
    id: 'propFull',
    level: 'property',
    isSuperAdmin: false,
    roleId: PROPERTY_ADMIN_ROLE_ID,
    permissions: propertyTemplate('Full Access'),
  },
  propOperations: {
    id: 'propOperations',
    level: 'property',
    isSuperAdmin: false,
    roleId: 'Operations',
    permissions: propertyTemplate('Operations'),
  },
  propReadOnly: {
    id: 'propReadOnly',
    level: 'property',
    isSuperAdmin: false,
    roleId: 'Read Only',
    permissions: propertyTemplate('Read Only'),
  },

  parkingManager: {
    id: 'parkingManager',
    level: 'parking',
    isSuperAdmin: false,
    roleId: 'MANAGER',
    permissions: [...PARKING_ROLE_PERMISSIONS.MANAGER],
  },
  parkingStaff: {
    id: 'parkingStaff',
    level: 'parking',
    isSuperAdmin: false,
    roleId: 'STAFF',
    permissions: [...PARKING_ROLE_PERMISSIONS.STAFF],
  },
  parkingViewer: {
    id: 'parkingViewer',
    level: 'parking',
    isSuperAdmin: false,
    roleId: 'VIEWER',
    permissions: [...PARKING_ROLE_PERMISSIONS.VIEWER],
  },

  superAdmin: {
    id: 'superAdmin',
    level: 'platform',
    isSuperAdmin: true,
    roleId: 'OWNER',
    permissions: orgRole('OWNER'),
  },

  /** A valid host from another organisation: signed in, no access to this tenant. */
  stranger: {
    id: 'stranger',
    level: 'org',
    isSuperAdmin: false,
    roleId: null,
    permissions: [],
  },
};

/** A custom template, for matching the exact leaves a server-side template grants. */
export function orgCustom(permissions: string[]): Persona {
  return { id: 'orgCustom', level: 'org', isSuperAdmin: false, roleId: 'custom', permissions };
}

export function propCustom(permissions: string[]): Persona {
  return {
    id: 'propCustom',
    level: 'property',
    isSuperAdmin: false,
    roleId: 'custom',
    permissions,
  };
}

export function parkingCustom(permissions: string[]): Persona {
  return {
    id: 'parkingCustom',
    level: 'parking',
    isSuperAdmin: false,
    roleId: 'custom',
    permissions,
  };
}

/** True when the persona holds every leaf in `required`, matching the server's coarse rule. */
export function personaHas(persona: Persona, required: readonly string[]): boolean {
  return required.every((leaf) => persona.permissions.includes(leaf));
}
