import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type BookingHelpRequest = {
  id: string;
  booking_id: string;
  kind: 'cant_get_in' | 'not_as_described' | 'unsafe' | 'other';
  note: string | null;
  status: string;
  created_at: string;
};

const bookingHelpKey = (bookingId: string, propertyId: string | null) =>
  ['booking-help', bookingId, propertyId] as const;

/** Open urgent help case for a booking, if any. */
export function useBookingHelp(bookingId: string) {
  const propertyId = usePropertyIdParam();
  return useQuery<BookingHelpRequest | null>({
    queryKey: bookingHelpKey(bookingId, propertyId),
    queryFn: async () => {
      const params = new URLSearchParams({
        booking_id: bookingId,
        property_id: propertyId ?? '',
      });
      const data = await callEdgeFunction<{ request: BookingHelpRequest | null }>(
        `booking-help?${params.toString()}`
      );
      return data.request;
    },
    enabled: Boolean(bookingId && propertyId),
    staleTime: 15_000,
    // Poll only while an open case exists, so ordinary bookings do not poll.
    refetchInterval: (query) => (query.state.data ? 30_000 : false),
  });
}

export function useResolveBookingHelp() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();
  return useMutation({
    mutationFn: async (input: { bookingId: string; helpRequestId: string }) => {
      const params = new URLSearchParams({ property_id: propertyId ?? '' });
      return callEdgeFunction(`booking-help?${params.toString()}`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: (_data, input) => {
      qc.setQueryData(bookingHelpKey(input.bookingId, propertyId), null);
      toast.success('Help request resolved');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not resolve the request'),
  });
}
