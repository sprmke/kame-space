/**
 * parking-payments — parking-scoped, host-readable ledger.
 *
 * GET ?parking_id=…             → recent marketplace transactions for this slot
 * GET ?parking_id=…&bookingId=… → the transaction for one booking
 *
 * Gated on `finance:view`. The super-admin `parking-payouts` endpoint remains the only
 * place that can mutate disbursement/refund state.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import {
  resolveScopedParkingTeamAccess,
  verifyBookingBelongsToParking,
} from '../_shared/parkingScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const LIST_LIMIT = 100;

function serialize(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    bookingId: String(row.booking_id),
    parkingId: String(row.parking_id),
    guestChargeTotal: Number(row.guest_charge_total ?? 0),
    hostGrossTotal: Number(row.host_gross_total ?? 0),
    commissionPct: Number(row.commission_pct ?? 0),
    hostNetTotal: Number(row.host_net_total ?? 0),
    nights: Number(row.nights ?? 0),
    bookingChannel: (row.booking_channel as string | undefined) ?? 'standard',
    status: String(row.status),
    paidAt: (row.paid_at as string | undefined) ?? null,
    disbursedAt: (row.disbursed_at as string | undefined) ?? null,
    disbursementReference: (row.disbursement_reference as string | undefined) ?? null,
    refundReviewAt: (row.refund_review_at as string | undefined) ?? null,
    refundedAt: (row.refunded_at as string | undefined) ?? null,
    refundAmount: row.refund_amount == null ? null : Number(row.refund_amount),
    refundReason: (row.refund_reason as string | undefined) ?? null,
    failureReason: (row.failure_reason as string | undefined) ?? null,
  };
}

serveAuthenticated('parking-payments', async (req) => {
  if (req.method !== 'GET') return jsonError(req, 'Method not allowed', 405);

  const { parkingRow } = await resolveScopedParkingTeamAccess(req, 'finance:view');
  const supabase = createServiceClient();
  const url = new URL(req.url);
  const bookingId = url.searchParams.get('bookingId')?.trim() ?? '';

  if (bookingId) {
    await verifyBookingBelongsToParking(bookingId, String(parkingRow.id));
    const { data, error } = await supabase
      .from('parking_payment_transactions')
      .select(
        `id, booking_id, parking_id, guest_charge_total, host_gross_total, commission_pct,
         host_net_total, nights, booking_channel, status, paid_at, disbursed_at,
         disbursement_reference, refund_review_at, refunded_at, refund_amount,
         refund_reason, failure_reason`
      )
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);
    return jsonSuccess(req, {
      transaction: data ? serialize(data as Record<string, unknown>) : null,
    });
  }

  const { data, error } = await supabase
    .from('parking_payment_transactions')
    .select(
      `id, booking_id, parking_id, guest_charge_total, host_gross_total, commission_pct,
       host_net_total, nights, booking_channel, status, paid_at, disbursed_at,
       disbursement_reference, refund_review_at, refunded_at, refund_amount,
       refund_reason, failure_reason`
    )
    .eq('parking_id', String(parkingRow.id))
    .in('status', ['paid', 'refund_review', 'refunded'])
    .order('paid_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) return jsonError(req, error.message, 500);

  return jsonSuccess(req, {
    transactions: (data ?? []).map((row) => serialize(row as Record<string, unknown>)),
  });
});
