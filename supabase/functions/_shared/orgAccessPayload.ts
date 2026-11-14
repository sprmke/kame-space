/**
 * The org-access response body, in one place.
 *
 * `org-access` and `get-session-context` must return the same shape: the client seeds one query
 * cache entry from either. Keeping the builder here is what makes that true by construction
 * rather than by copying thirty fields and hoping they stay in sync.
 */

import type { OrgAccessContext } from './orgAuth.ts';
import { hasOrgPermission } from './orgTeamPermissions.ts';

export function buildOrgAccessPayload(ctx: OrgAccessContext) {
  return {
    accessKind: ctx.accessKind,
    permissions: ctx.permissions,
    memberId: ctx.memberId ?? null,
    canListAllProperties: ctx.canListAllProperties,
    orgId: ctx.org.id,
    orgSlug: ctx.org.slug,
    orgName: ctx.org.name,
    planLimited: ctx.planLimited === true,
    canManageTeam: hasOrgPermission(ctx.permissions, 'org:team:manage'),
    canInviteTeam: hasOrgPermission(ctx.permissions, 'org:team:invite'),
    canCreateProperties: hasOrgPermission(ctx.permissions, 'org:properties:create'),
    canManageProperties: hasOrgPermission(ctx.permissions, 'org:properties:manage'),
    canCreateParkings: hasOrgPermission(ctx.permissions, 'org:parkings:create'),
    canManageParkings: hasOrgPermission(ctx.permissions, 'org:parkings:manage'),
    canEditBasicSettings: hasOrgPermission(ctx.permissions, 'org.settings.basic:edit'),
    canEditSocials: hasOrgPermission(ctx.permissions, 'org.settings.socials:edit'),
    canEditAiPlatform: hasOrgPermission(ctx.permissions, 'org.settings.aiPlatform:edit'),
    canEditAiAssistant: hasOrgPermission(ctx.permissions, 'org.settings.aiAssistant:edit'),
    canEditSettings:
      hasOrgPermission(ctx.permissions, 'org.settings.basic:edit') ||
      hasOrgPermission(ctx.permissions, 'org.settings.socials:edit') ||
      hasOrgPermission(ctx.permissions, 'org.settings.aiPlatform:edit') ||
      hasOrgPermission(ctx.permissions, 'org.settings.aiAssistant:edit'),
    canViewPlans: hasOrgPermission(ctx.permissions, 'org.plans:view'),
  };
}
