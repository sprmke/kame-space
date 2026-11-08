import { useQuery } from '@tanstack/react-query';

import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { ParkingAccessPayload } from '@/features/dashboard/team/lib/parkingPermissions';

export const PARKING_ACCESS_QUERY_KEY = (parkingId: string) =>
  ['parking-access', parkingId] as const;

/**
 * Parking team permission payload. Pass `parkingIdOverride` on screens that render a parking
 * outside the `/org/:orgSlug/parking/:parkingSlug` route (for example the org setup guide),
 * where `useOptionalParkingContext()` is null.
 */
export function useParkingPermissions(parkingIdOverride?: string | null) {
  const contextParkingId = useOptionalParkingContext()?.parking.id ?? null;
  const parkingId = parkingIdOverride?.trim() || contextParkingId;

  return useQuery({
    queryKey: PARKING_ACCESS_QUERY_KEY(parkingId ?? ''),
    queryFn: () =>
      callEdgeFunction<ParkingAccessPayload>(
        `parking-access?parking_id=${encodeURIComponent(parkingId!)}`
      ),
    enabled: Boolean(parkingId),
    staleTime: 60_000,
  });
}
