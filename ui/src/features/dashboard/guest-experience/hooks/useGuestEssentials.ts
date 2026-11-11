import { useQuery } from '@tanstack/react-query';

import {
  fetchGuestEssentials,
  type GuestEssentialsDraft,
} from '@/features/dashboard/guest-experience/lib/guestEssentialsApi';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export const GUEST_ESSENTIALS_QUERY_KEY = (propertyId: string) =>
  ['property-guest-essentials', propertyId] as const;

/** Shared cache for the arrival essentials, used by the editor and the readiness card. */
export function useGuestEssentialsQuery() {
  const propertyId = usePropertyIdParam();
  return useQuery<GuestEssentialsDraft>({
    queryKey: GUEST_ESSENTIALS_QUERY_KEY(propertyId ?? ''),
    queryFn: () => fetchGuestEssentials(propertyId!),
    enabled: Boolean(propertyId),
    staleTime: 60_000,
  });
}
