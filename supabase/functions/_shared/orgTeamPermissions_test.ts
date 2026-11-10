import { assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  ORG_ADMIN_ROLE_ID,
  ORG_PERMISSION_IDS,
  ORG_PROPERTY_MEMBER_PERMISSIONS,
  ORG_ROLE_PERMISSIONS,
  allOrgPermissions,
  assertValidOrgRoleId,
  effectiveOrgMemberPermissions,
  hasOrgPermission,
  normalizeOrgPermissionIds,
} from './orgTeamPermissions.ts';

/*
 * Org-side RBAC. These helpers decide what an invited org admin can see and change, so a
 * widening here is a permission leak rather than a display bug.
 */

Deno.test('the catalog has no duplicate ids', () => {
  assertEquals(new Set(ORG_PERMISSION_IDS).size, ORG_PERMISSION_IDS.length);
});

Deno.test('allOrgPermissions returns a copy of the catalog', () => {
  const all = allOrgPermissions();
  assertEquals(all.length, ORG_PERMISSION_IDS.length);

  (all as string[]).push('made.up:leaf');
  assertEquals(allOrgPermissions().length, ORG_PERMISSION_IDS.length);
});

Deno.test('owner holds every permission, admin holds a strict subset', () => {
  assertEquals(ORG_ROLE_PERMISSIONS.OWNER.length, ORG_PERMISSION_IDS.length);

  for (const leaf of ORG_ROLE_PERMISSIONS.ADMIN) {
    assertEquals(ORG_PERMISSION_IDS.includes(leaf), true, `${leaf} is not in the catalog`);
  }
  assertEquals(ORG_ROLE_PERMISSIONS.ADMIN.length < ORG_ROLE_PERMISSIONS.OWNER.length, true);
});

Deno.test('admin cannot grant roles, but can manage members and invitations', () => {
  const admin = ORG_ROLE_PERMISSIONS.ADMIN;

  assertEquals(admin.includes('org.team.members:edit'), true);
  assertEquals(admin.includes('org.team.invitations:delete'), true);
  assertEquals(admin.includes('org.team.roles:add'), false);
  assertEquals(admin.includes('org.team.roles:delete'), false);
  assertEquals(admin.includes('org.settings.basic:edit'), false);
});

Deno.test('property-only members get no org screens', () => {
  assertEquals(ORG_PROPERTY_MEMBER_PERMISSIONS, []);
});

Deno.test('normalizeOrgPermissionIds drops non-arrays and unknown ids', () => {
  assertEquals(normalizeOrgPermissionIds(null), []);
  assertEquals(normalizeOrgPermissionIds('org.dashboard:view'), []);
  assertEquals(normalizeOrgPermissionIds([1, null, 'org.dashboard:view']), ['org.dashboard:view']);
  assertEquals(normalizeOrgPermissionIds(['not.a.leaf']), []);
});

Deno.test('legacy coarse ids expand to granular leaves once', () => {
  assertEquals(normalizeOrgPermissionIds(['org:settings:edit']).sort(), [
    'org.settings.aiAssistant:edit',
    'org.settings.aiPlatform:edit',
    'org.settings.basic:edit',
    'org.settings.socials:edit',
  ]);

  assertEquals(normalizeOrgPermissionIds(['org:team:manage']).sort(), [
    'org.team.invitations:delete',
    'org.team.invitations:edit',
    'org.team.members:delete',
    'org.team.members:edit',
  ]);
});

Deno.test('dropped legacy ids grant nothing', () => {
  assertEquals(normalizeOrgPermissionIds(['org:delete']), []);
  assertEquals(normalizeOrgPermissionIds(['org:import:manage']), []);
});

Deno.test('hasOrgPermission accepts a leaf granted through a legacy id', () => {
  assertEquals(hasOrgPermission(['org:settings:edit'], 'org.settings.basic:edit'), true);
  assertEquals(hasOrgPermission(['org:team:invite'], 'org.team.invitations:add'), true);
});

Deno.test('a legacy coarse requirement is satisfied by ANY one of its leaves', () => {
  // Known over-grant, issue #366. `hasOrgPermission` expands the
  // required legacy id and uses `.some()`, so holding one leaf passes a coarse check.
  // `org-access` computes `canManageTeam` from `org:team:manage`, so a member with only
  // `org.team.invitations:edit` is told they can manage the team.
  // Pinned as-is because tightening it changes live RBAC, which is not a test change.
  assertEquals(hasOrgPermission(['org.settings.basic:edit'], 'org:settings:edit'), true);
  assertEquals(hasOrgPermission(['org.team.invitations:edit'], 'org:team:manage'), true);
});

Deno.test('hasOrgPermission rejects a missing or unknown requirement', () => {
  assertEquals(hasOrgPermission([], 'org.dashboard:view'), false);
  assertEquals(hasOrgPermission(['not.a.leaf'], 'org.dashboard:view'), false);
});

Deno.test('effectiveOrgMemberPermissions is empty for an inactive member', () => {
  assertEquals(
    effectiveOrgMemberPermissions({
      permissions: ['org.dashboard:view'],
      status: 'inactive',
      role_id: ORG_ADMIN_ROLE_ID,
    }),
    []
  );
});

Deno.test('an explicit permissions array wins over the ADMIN default', () => {
  assertEquals(
    effectiveOrgMemberPermissions({
      permissions: [],
      status: 'active',
      role_id: ORG_ADMIN_ROLE_ID,
    }),
    []
  );
});

Deno.test('a row without a permissions array falls back to the ADMIN preset', () => {
  assertEquals(
    effectiveOrgMemberPermissions({
      permissions: null,
      status: 'active',
      role_id: ORG_ADMIN_ROLE_ID,
    }).sort(),
    [...ORG_ROLE_PERMISSIONS.ADMIN].sort()
  );
});

Deno.test('a non-admin row without a permissions array has nothing', () => {
  assertEquals(
    effectiveOrgMemberPermissions({
      permissions: undefined,
      status: 'active',
      role_id: '3f2b8c1e-9a4d-4c7e-8b21-5d6f7a8b9c0d',
    }),
    []
  );
});

Deno.test('assertValidOrgRoleId accepts ADMIN and template UUIDs only', () => {
  assertValidOrgRoleId('ADMIN');
  assertValidOrgRoleId('3f2b8c1e-9a4d-4c7e-8b21-5d6f7a8b9c0d');

  assertThrows(() => assertValidOrgRoleId('admin'), Error, 'Invalid org role');
  assertThrows(() => assertValidOrgRoleId('OWNER'), Error, 'Invalid org role');
  assertThrows(() => assertValidOrgRoleId(''), Error, 'Invalid org role');
});
