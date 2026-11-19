import {
  parkingInboxPath,
  parkingSectionPath,
  propertyInboxPath,
  propertySectionPath,
} from '@/features/dashboard/org/lib/tenantPaths';
import { orgSectionPath } from '@/features/dashboard/team/lib/orgPermissions';

export type QuickAccessScope = 'org' | 'property' | 'parking';

export type QuickAccessPaths = {
  messagesHref: string | null;
  helpHref: string | null;
};

export function resolveQuickAccessScope(pathname: string): QuickAccessScope {
  if (/\/parking\//.test(pathname)) return 'parking';
  if (/\/property\//.test(pathname)) return 'property';
  return 'org';
}

export function resolveQuickAccessPaths(input: {
  scope: QuickAccessScope;
  orgSlug: string | null | undefined;
  propertySlug?: string | null;
  parkingSlug?: string | null;
}): QuickAccessPaths {
  const orgSlug = input.orgSlug?.trim();
  if (!orgSlug) return { messagesHref: null, helpHref: null };

  if (input.scope === 'parking' && input.parkingSlug) {
    return {
      messagesHref: parkingInboxPath(orgSlug, input.parkingSlug),
      helpHref: parkingSectionPath(orgSlug, input.parkingSlug, 'help-support'),
    };
  }

  if (input.scope === 'property' && input.propertySlug) {
    return {
      messagesHref: propertyInboxPath(orgSlug, input.propertySlug),
      helpHref: propertySectionPath(orgSlug, input.propertySlug, 'help-support'),
    };
  }

  return {
    messagesHref: null,
    helpHref: orgSectionPath(orgSlug, 'help-support'),
  };
}
