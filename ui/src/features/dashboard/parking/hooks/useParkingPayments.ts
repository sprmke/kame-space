import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type ParkingPaymentRow = {
  id: string;
  bookingId: string;
  parkingId: string;
  guestChargeTotal: number;
  hostGrossTotal: number;
  commissionPct: number;
  hostNetTotal: number;
  nights: number;
  bookingChannel: string;
  status: string;
  paidAt: string | null;
  disbursedAt: string | null;
  disbursementReference: string | null;
  refundReviewAt: string | null;
  refundedAt: string | null;
  refundAmount: number | null;
  refundReason: string | null;
  failureReason: string | null;
};

const PARKING_PAYMENTS_KEY = ['parking-payments'] as const;

function path(parkingId: string, bookingId?: string) {
  const base = `parking-payments?parking_id=${encodeURIComponent(parkingId)}`;
  return bookingId ? `${base}&bookingId=${encodeURIComponent(bookingId)}` : base;
}

export function useParkingPayments() {
  const { parking } = useParkingContext();
  return useQuery({
    queryKey: [...PARKING_PAYMENTS_KEY, parking.id],
    queryFn: () =>
      callEdgeFunction<{ transactions: ParkingPaymentRow[] }>(path(parking.id)).then(
        (data) => data.transactions
      ),
    staleTime: 30_000,
  });
}

export function useParkingBookingPayment(
  bookingId: string | undefined,
  enabled = true
) {
  const { parking } = useParkingContext();
  return useQuery({
    queryKey: [...PARKING_PAYMENTS_KEY, parking.id, bookingId],
    queryFn: () =>
      callEdgeFunction<{ transaction: ParkingPaymentRow | null }>(path(parking.id, bookingId)).then(
        (data) => data.transaction
      ),
    enabled: Boolean(bookingId) && enabled,
    staleTime: 30_000,
  });
}

export function useResendParkingEndorsement() {
  const { parking } = useParkingContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      callEdgeFunction<{ sent: boolean }>(
        `resend-parking-endorsement?parking_id=${encodeURIComponent(parking.id)}`,
        { method: 'POST', body: JSON.stringify({ bookingId }) }
      ),
    onSuccess: (_data, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      toast.success('Endorsement sent');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not resend endorsement'),
  });
}
