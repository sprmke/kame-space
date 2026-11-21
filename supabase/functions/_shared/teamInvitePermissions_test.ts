import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  assertInvitePermissionsWithinInviter,
  invitePermissionsBeyondInviter,
} from './teamInvitePermissions.ts';

Deno.test('owners and platform admins can grant any role', () => {
  assertEquals(
    invitePermissionsBeyondInviter({
      requested: ['settings:edit', 'team:members:delete'],
      granted: [],
      accessKind: 'owner',
    }),
    []
  );
  assertEquals(
    invitePermissionsBeyondInviter({
      requested: ['settings:edit'],
      granted: [],
      accessKind: 'platform_admin',
    }),
    []
  );
});

Deno.test('a member cannot grant permissions they do not hold', () => {
  const beyond = invitePermissionsBeyondInviter({
    requested: ['bookings:view', 'settings:edit', 'team:invite'],
    granted: ['bookings:view', 'team:invite'],
    accessKind: 'member',
  });
  assertEquals(beyond, ['settings:edit']);
});

Deno.test('a subset of the inviter permissions is allowed', () => {
  assertEquals(
    invitePermissionsBeyondInviter({
      requested: ['bookings:view', 'team:invite'],
      granted: ['bookings:view', 'team:invite', 'settings:edit'],
      accessKind: 'org_admin',
    }),
    []
  );
});

Deno.test('duplicate requested permissions are compared once', () => {
  assertEquals(
    invitePermissionsBeyondInviter({
      requested: ['settings:edit', 'settings:edit'],
      granted: ['bookings:view'],
      accessKind: 'member',
    }),
    ['settings:edit']
  );
});

Deno.test('assertInvitePermissionsWithinInviter throws with a clear message', () => {
  assertThrows(
    () =>
      assertInvitePermissionsWithinInviter({
        requested: ['settings:edit'],
        granted: ['bookings:view'],
        accessKind: 'member',
      }),
    Error,
    'You cannot grant permissions you do not have.'
  );
});
