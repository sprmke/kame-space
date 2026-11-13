import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useLocation, useParams, useSearchParams } from 'react-router-dom';

import {
  dashboardStatsQueryKey,
  fetchDashboardStats,
} from '@/features/dashboard/property/hooks/useDashboardStats';
import { resolveDashboardPeriod } from '@/features/dashboard/property/lib/dashboardPeriod';

import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { PARKINGS_QUERY_KEY } from '@/features/dashboard/org/hooks/useParkings';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { Organization, Property } from '@/features/dashboard/org/types';
import { ORG_ACCESS_QUERY_KEY } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { PROPERTY_ACCESS_QUERY_KEY } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import type { OrgAccessPayload } from '@/features/dashboard/team/lib/orgPermissions';
import type { PropertyAccessPayload } from '@/features/dashboard/team/lib/propertyPermissions';
import {
  type FeatureAvailabilityPayload,
  toFeatureAvailabilitySnapshot,
} from '@/lib/featureAvailability/featureAvailabilityApi';
import { FEATURE_AVAILABILITY_QUERY_KEY } from '@/lib/featureAvailability/useFeatureAvailability';

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
 *   ['org-access', orgSlug]                    useOrgPermissions
 *   ['feature-availability']                   useFeatureAvailabilitySnapshot
 *   ['parkings', orgSlug]                      useParkings
 *
 * It also starts `dashboard-stats` on the property dashboard. That call is the only thing the
 * page's first paint waits on, and it used to start ~300 ms late because the shell's own reads
 * had already taken the connections. Starting it here puts it ahead of them. Same key, same
 * staleTime, so the page reuses the in-flight request instead of firing a second one.
 */

type BootstrapResponse = {
  organizations?: { isSuperAdmin: boolean; organizations: Organization[] };
  properties?: { properties: Property[] };
  propertyAccess?: PropertyAccessPayload;
  entitlements?: Record<string, unknown>;
  /** Org-scoped extras, so the shell does not fetch them separately. */
  orgAccess?: OrgAccessPayload;
  featureAvailability?: FeatureAvailabilityPayload;
  parkings?: { parkings: unknown[] };
};

const entitlementsKey = (propertyId: string) => ['property', propertyId, 'entitlements'] as const;

/**
 * True only for the property dashboard route. The stats call is what that page's first paint
 * waits on, so it is the one route worth starting early. Anywhere else it would be a wasted
 * request, which is why the match is exact rather than a prefix.
 */
export function isPropertyDashboardPath(
  pathname: string,
  orgSlug: string | undefined,
  propertySlug: string | undefined
): boolean {
  if (!orgSlug || !propertySlug) return false;
  const normalised = pathname.replace(/\/+$/, '');
  return normalised === `/org/${orgSlug}/property/${propertySlug}`;
}

export function useSessionBootstrap() {
  const { orgSlug, propertySlug } = useParams<{ orgSlug?: string; propertySlug?: string }>();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const onPropertyDashboard = isPropertyDashboardPath(pathname, orgSlug, propertySlug);

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
      // Org-scoped reads the shell used to fire right after this resolved.
      if (data.orgAccess && orgSlug) {
        queryClient.setQueryData(ORG_ACCESS_QUERY_KEY(orgSlug), data.orgAccess);
      }
      if (data.featureAvailability) {
        queryClient.setQueryData(
          FEATURE_AVAILABILITY_QUERY_KEY,
          toFeatureAvailabilitySnapshot(data.featureAvailability)
        );
      }
      if (data.parkings && orgSlug) {
        queryClient.setQueryData([...PARKINGS_QUERY_KEY, orgSlug] as const, data.parkings);
      }

      if (data.propertyAccess) {
        const propertyId = data.propertyAccess.propertyId;
        queryClient.setQueryData(PROPERTY_ACCESS_QUERY_KEY(propertyId), data.propertyAccess);
        if (data.entitlements) {
          queryClient.setQueryData(entitlementsKey(propertyId), data.entitlements);
        }
        if (onPropertyDashboard) {
          const period = resolveDashboardPeriod(searchParams);
          void queryClient.prefetchQuery({
            queryKey: dashboardStatsQueryKey(propertyId, period),
            queryFn: () => fetchDashboardStats(period.from, period.to, propertyId),
            staleTime: 30_000,
          });
        }
      }

      return data;
    },
  });
}
