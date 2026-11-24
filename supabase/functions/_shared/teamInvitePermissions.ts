/**
 * Privilege ceiling for team invitations (readiness PR-014 / issue #162).
 *
 * A member who can invite must not be able to grant a role with permissions they do not hold
 * themselves. Without this, an Operations member with `team:invite` could invite a Full Access
 * account and then use it, which is a straight privilege escalation.
 *
 * Owners and platform admins hold the full catalog, so they are exempt. Org admins are checked
 * against their effective org permissions, and property/parking members against theirs.
 */

export type InviteAccessKind = 'owner' | 'platform_admin' | 'org_admin' | 'member';

/** Requested permissions the inviter does not hold. Empty means the grant is allowed. */
export function invitePermissionsBeyondInviter(input: {
  requested: readonly string[];
  granted: readonly string[];
  accessKind: InviteAccessKind | string;
}): string[] {
  if (input.accessKind === 'owner' || input.accessKind === 'platform_admin') return [];
  const held = new Set(input.granted);
  return [...new Set(input.requested)].filter((permission) => !held.has(permission));
}

/** Throws when an invitation would grant more than the inviter has. */
export function assertInvitePermissionsWithinInviter(input: {
  requested: readonly string[];
  granted: readonly string[];
  accessKind: InviteAccessKind | string;
}): void {
  const extra = invitePermissionsBeyondInviter(input);
  if (extra.length > 0) {
    throw new Error('You cannot grant permissions you do not have.');
  }
}
