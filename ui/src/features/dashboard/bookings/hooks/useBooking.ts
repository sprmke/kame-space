import { useQuery } from '@tanstack/react-query';

import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import {
  appendOrgId,
  appendParkingId,
  appendPropertyId,
  useOrgScopeKey,
  usePropertyIdParam,
} from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction, type EdgeCallError } from '@/features/dashboard/org/lib/edgeClient';

export const BOOKING_QUERY_KEY = (id: string) => ['booking', id] as const;

export function bookingDetailQueryKey(
  bookingId: string,
  scopeOrPropertyId?: string | null | { propertyId?: string | null; parkingId?: string | null }
) {
  const scope =
    typeof scopeOrPropertyId === 'object' &&
    scopeOrPropertyId !== null &&
    !Array.isArray(scopeOrPropertyId)
      ? scopeOrPropertyId
      : { propertyId: scopeOrPropertyId ?? null, parkingId: null };
  return [
    ...BOOKING_QUERY_KEY(bookingId),
    scope.propertyId ?? null,
    scope.parkingId ?? null,
  ] as const;
}

/** Build the get-booking query string for a scoped full-row read (`format=row`). */
export function buildGetBookingRowQuery(args: {
  bookingId: string;
  propertyId?: string | null;
  parkingId?: string | null;
  orgSlug?: string | null;
  orgId?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('booking_id', args.bookingId);
  params.set('format', 'row');

  if (args.propertyId) {
    appendPropertyId(params, args.propertyId);
  } else if (args.parkingId) {
    appendParkingId(params, args.parkingId);
  } else {
    appendOrgId(params, args.orgSlug ?? null, args.orgId ?? null);
  }

  return params.toString();
}

/**
 * Fetches a single booking row by ID via `get-booking` (admin JWT + edge scope).
 * Same trust boundary as `list-bookings` so platform admins and team members both work
 * after guest_submissions RLS lockdown (browser PostgREST is not used here).
 */
export function useBooking(
  bookingId: string | undefined,
  options?: { propertyId?: string | null; parkingId?: string | null }
) {
  const routePropertyId = usePropertyIdParam();
  const parkingContext = useOptionalParkingContext();
  const routeParkingId = parkingContext?.parking.id ?? null;
  const { orgSlug, orgId } = useOrgScopeKey();

  const propertyId = options?.propertyId !== undefined ? options.propertyId : routePropertyId;
  const parkingId = options?.parkingId !== undefined ? options.parkingId : routeParkingId;

  return useQuery<BookingRow | null>({
    queryKey: bookingDetailQueryKey(bookingId ?? '', { propertyId, parkingId }),
    queryFn: async () => {
      if (!bookingId) return null;

      const qs = buildGetBookingRowQuery({
        bookingId,
        propertyId,
        parkingId,
        orgSlug,
        orgId,
      });

      if (!qs.includes('property_id=') && !qs.includes('parking_id=') && !qs.includes('org_')) {
        throw new Error('Booking scope is required');
      }

      try {
        return await callEdgeFunction<BookingRow>(`get-booking?${qs}`);
      } catch (err) {
        const status = (err as EdgeCallError | undefined)?.status;
        // Missing / out-of-scope booking: same UX as the old PGRST116 path.
        if (status === 404) return null;
        throw err instanceof Error ? err : new Error('Failed to load booking');
      }
    },
    enabled: !!bookingId,
    staleTime: 10_000,
  });
}
