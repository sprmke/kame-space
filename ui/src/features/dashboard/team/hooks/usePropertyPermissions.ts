import { useQuery } from '@tanstack/react-query';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { PropertyAccessPayload } from '@/features/dashboard/team/lib/propertyPermissions';

export const PROPERTY_ACCESS_QUERY_KEY = (propertyId: string) =>
  ['property-access', propertyId] as const;

/**
 * Property team permission payload for an explicit property, for lists that span properties
 * (org bookings) where the route has no property in context. Shares the cache with
 * `usePropertyPermissions`, so a property is fetched once however many rows ask.
 */
export function usePropertyPermissionsFor(propertyId: string | null) {
  return useQuery({
    queryKey: PROPERTY_ACCESS_QUERY_KEY(propertyId ?? ''),
    queryFn: () =>
      callEdgeFunction<PropertyAccessPayload>(
        `property-access?property_id=${encodeURIComponent(propertyId!)}`
      ),
    enabled: Boolean(propertyId),
    staleTime: 60_000,
  });
}

export function usePropertyPermissions() {
  return usePropertyPermissionsFor(usePropertyIdParam());
}
