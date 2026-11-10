import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useParams } from 'react-router-dom';

import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { Organization, Property } from '@/features/dashboard/org/types';
import { PROPERTY_ACCESS_QUERY_KEY } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import type { PropertyAccessPayload } from '@/features/dashboard/team/lib/propertyPermissions';

/**
 * One call that seeds the query keys the admin guards already read.
 *
 * The guards are unchanged. This fills the exact keys they look for, so on a cold open they
 * find data instead of each firing its own request. If this call fails, nothing is seeded,
 * `isError` is true, and the shell renders the guards, which fetch for themselves exactly as
 * before. Removing the caller reverts the behaviour completely.
 *
 * Seeded keys, matching their hooks:
 *   ['organizations']                          useOrganizations
 *   ['properties', orgSlug]                    useProperties
 *   ['property-access', propertyId]            usePropertyPermissions
 *   ['property', propertyId, 'entitlements']   usePropertyEntitlements
 */

type BootstrapResponse = {
  organizations?: { isSuperAdmin: boolean; organizations: Organization[] };
  properties?: { properties: Property[] };
  propertyAccess?: PropertyAccessPayload;
  entitlements?: Record<string, unknown>;
};

const entitlementsKey = (propertyId: string) => ['property', propertyId, 'entitlements'] as const;

export function useSessionBootstrap() {
  const { orgSlug, propertySlug } = useParams<{ orgSlug?: string; propertySlug?: string }>();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['session-context', orgSlug ?? '', propertySlug ?? ''] as const,
    enabled: Boolean(orgSlug),
    // Always fresh: this decides whether the dashboard can paint, so a stale answer would
    // hide access changes.
    staleTime: 0,
    // No retry. This gates the shell, so a failure must fall through to the per-guard
    // fetches immediately rather than making the user wait out a retry backoff.
    retry: 0,
    queryFn: async (): Promise<BootstrapResponse> => {
      const params = new URLSearchParams({ orgSlug: orgSlug! });
      if (propertySlug) params.set('propertySlug', propertySlug);

      const data = await callEdgeFunction<BootstrapResponse>(
        `get-session-context?${params.toString()}`
      );

      if (data.organizations) {
        queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, data.organizations);
      }
      if (data.properties && orgSlug) {
        queryClient.setQueryData(['properties', orgSlug] as const, data.properties);
      }
      if (data.propertyAccess) {
        const propertyId = data.propertyAccess.propertyId;
        queryClient.setQueryData(PROPERTY_ACCESS_QUERY_KEY(propertyId), data.propertyAccess);
        if (data.entitlements) {
          queryClient.setQueryData(entitlementsKey(propertyId), data.entitlements);
        }
      }

      return data;
    },
  });
}
