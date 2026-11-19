/**
 * get-parking-booking-status — public narrow read for the guest status page.
 * The booking UUID in the URL is the bearer capability — do not add a list endpoint.
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolveOrgSettings } from '../_shared/orgSettings.ts';
import {
  DEFAULT_ORG_BRAND_COLOR,
  resolveOrgBrandColorFromSettings,
} from '../_shared/orgSettingsValidation.ts';
import { resolveParkingHostContact } from '../_shared/parkingBroadcast.ts';
import { loadResolvedBrandColorByParkingId } from '../_shared/parkingBranding.ts';
import { computeParkingPaymentAmounts } from '../_shared/parkingPaymentOrchestrator.ts';
import { resolveParkingPlatformSettings } from '../_shared/parkingPlatformSettings.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

const POST_PAYMENT_STATUSES = new Set(['PENDING_REVIEW', 'READY_FOR_CHECKIN', 'COMPLETED']);

type PaymentPreview = {
  nights: number;
  hostGrossTotal: number;
  guestFeeTotal: number;
  guestChargeTotal: number;
};

/**
 * Rent + service fee for the status/pay page. Before a transaction exists this is a read-only
 * preview (computeParkingPaymentAmounts does no writes); once one does, the snapshot wins so the
 * figure the guest already paid never moves under them (decision: "never re-derived").
 */
async function resolveGuestPaymentPreview(
  supabase: ReturnType<typeof createServiceClient>,
  booking: {
    id: string;
    status: string;
    parking_id: string | null;
    parking_check_in_date: string | null;
    parking_check_out_date: string | null;
    check_in_date: string | null;
    check_out_date: string | null;
    parking_booking_channel: string | null;
  }
): Promise<PaymentPreview | null> {
  if (booking.status === 'PENDING_PAYMENT') {
    if (!booking.parking_id) return null;
    const { data: pendingTxn } = await supabase
      .from('parking_payment_transactions')
      .select('parking_id, nights, host_gross_total, guest_fee_total, guest_charge_total')
      .eq('booking_id', booking.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (pendingTxn && String(pendingTxn.parking_id) === String(booking.parking_id)) {
      return {
        nights: Number(pendingTxn.nights),
        hostGrossTotal: Number(pendingTxn.host_gross_total),
        guestFeeTotal: Number(pendingTxn.guest_fee_total),
        guestChargeTotal: Number(pendingTxn.guest_charge_total),
      };
    }
    const amounts = await computeParkingPaymentAmounts(
      booking.parking_id,
      String(booking.parking_check_in_date ?? booking.check_in_date ?? ''),
      String(booking.parking_check_out_date ?? booking.check_out_date ?? ''),
      (booking.parking_booking_channel as 'standard' | 'direct_link' | null) ?? 'standard'
    );
    return {
      nights: amounts.nights,
      hostGrossTotal: amounts.hostGrossTotal,
      guestFeeTotal: amounts.guestFeeTotal,
      guestChargeTotal: amounts.guestChargeTotal,
    };
  }

  if (POST_PAYMENT_STATUSES.has(booking.status)) {
    const { data: paidTxn } = await supabase
      .from('parking_payment_transactions')
      .select('nights, host_gross_total, guest_fee_total, guest_charge_total')
      .eq('booking_id', booking.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!paidTxn) return null;
    return {
      nights: Number(paidTxn.nights),
      hostGrossTotal: Number(paidTxn.host_gross_total),
      guestFeeTotal: Number(paidTxn.guest_fee_total),
      guestChargeTotal: Number(paidTxn.guest_charge_total),
    };
  }

  return null;
}

function readParkingCoverImage(
  settings: Record<string, unknown> | null | undefined
): string | null {
  if (!settings || typeof settings !== 'object') return null;
  const coverImage = settings.coverImage;
  if (typeof coverImage === 'string' && coverImage.trim()) return coverImage.trim();
  const images = settings.images;
  if (Array.isArray(images)) {
    const first = images.find((value) => typeof value === 'string' && value.trim());
    if (typeof first === 'string') return first.trim();
  }
  return null;
}

servePublic('get-parking-booking-status', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  const limited = await publicGetRateLimitGate(req, 'get-parking-booking-status', {
    maxPerMin: 30,
  });
  if (limited) return limited;

  const url = new URL(req.url);
  const bookingId = url.searchParams.get('bookingId')?.trim();
  if (!bookingId) {
    return jsonError(req, 'bookingId query param is required');
  }

  const supabase = createServiceClient();
  const { data: booking, error } = await supabase
    .from('guest_submissions')
    .select(
      `id, status, parking_id, parking_check_in_date, parking_check_out_date,
       check_in_date, check_out_date, parking_broadcast_expires_at,
       parking_payment_expires_at, parking_broadcast_batch_number,
       parking_endorsement_note, parking_request_organization_id,
       endorsement_sent_at, endorsement_send_error, endorsement_email_snapshot,
       guest_auth_user_id, guest_email, parking_booking_channel`
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) {
    return jsonError(req, 'Not found', 404);
  }

  // Must be a parking request/booking row — never leak property stay bookings.
  const isParkingRow =
    Boolean(booking.parking_id) || Boolean(booking.parking_request_organization_id);
  if (!isParkingRow) {
    return jsonError(req, 'Not found', 404);
  }

  // The booking UUID travels through emails, screenshots and referrers, so it is not enough
  // to reveal the endorsement HTML (guest name, plate, unit) or host contact. Those are only
  // returned to the owning signed-in guest (M-10). No write here: this is a GET.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  let viewerUserId: string | null = null;
  let viewerEmail = '';
  if (token) {
    const { data: userData } = await supabase.auth.getUser(token);
    if (userData?.user) {
      viewerUserId = userData.user.id;
      viewerEmail = (userData.user.email ?? '').trim().toLowerCase();
    }
  }
  const guestEmail = String(booking.guest_email ?? '')
    .trim()
    .toLowerCase();
  const viewerOwnsBooking =
    Boolean(viewerUserId) &&
    (String(booking.guest_auth_user_id ?? '') === viewerUserId ||
      (Boolean(guestEmail) && guestEmail === viewerEmail));

  let parkingLabel: string | null = null;
  let parkingSlug: string | null = null;
  let parkingName: string | null = null;
  let residenceName: string | null = null;
  let coverImage: string | null = null;
  let brandColor = DEFAULT_ORG_BRAND_COLOR;
  let logoUrl: string | null = null;
  let organizationName: string | null = null;
  let hostContact: { name: string; email: string; phone: string | null } | null = null;

  if (booking.parking_id) {
    const { data: parking } = await supabase
      .from('parkings')
      .select('name, slug, slot_label, tower, residence_name, settings, organization_id')
      .eq('id', booking.parking_id)
      .maybeSingle();
    if (parking) {
      parkingLabel =
        [parking.slot_label, parking.tower].filter(Boolean).join(' · ') || parking.name;
      parkingSlug = (parking.slug as string | undefined) ?? null;
      parkingName = (parking.name as string | undefined) ?? null;
      residenceName = (parking.residence_name as string | undefined) ?? null;
      coverImage = readParkingCoverImage((parking.settings ?? {}) as Record<string, unknown>);
      brandColor = await loadResolvedBrandColorByParkingId(String(booking.parking_id));
      const orgSettings = await resolveOrgSettings(parking.organization_id as string);
      logoUrl = orgSettings.emailLogoUrl?.trim() || null;
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', parking.organization_id)
        .maybeSingle();
      organizationName = (org?.name as string | undefined) ?? null;

      // Phase 5 decision #6 — guest sees host contact only once endorsement is sent, and
      // only when the caller is the owning guest (M-10).
      if (booking.endorsement_sent_at && viewerOwnsBooking) {
        hostContact = await resolveParkingHostContact(supabase, {
          id: String(booking.parking_id),
          organization_id: parking.organization_id as string,
        });
      }
    }
  } else if (booking.parking_request_organization_id) {
    const orgId = String(booking.parking_request_organization_id);
    const { data: org } = await supabase
      .from('organizations')
      .select('name, settings')
      .eq('id', orgId)
      .maybeSingle();
    organizationName = (org?.name as string | undefined) ?? null;
    brandColor = resolveOrgBrandColorFromSettings((org?.settings ?? {}) as Record<string, unknown>);
    const orgSettings = await resolveOrgSettings(orgId);
    logoUrl = orgSettings.emailLogoUrl?.trim() || null;
  }

  // Which TTL is live depends on status — parking_broadcast_expires_at is stale once claimed
  // (claim doesn't touch it), parking_payment_expires_at only applies during PENDING_PAYMENT.
  const expiresAt =
    booking.status === 'PENDING_PAYMENT'
      ? (booking.parking_payment_expires_at ?? null)
      : (booking.parking_broadcast_expires_at ?? null);

  const platformSettings = await resolveParkingPlatformSettings();
  const payment = await resolveGuestPaymentPreview(supabase, booking);

  return jsonSuccess(req, {
    status: booking.status,
    checkInDate: String(booking.parking_check_in_date ?? booking.check_in_date ?? ''),
    checkOutDate: String(booking.parking_check_out_date ?? booking.check_out_date ?? ''),
    expiresAt,
    batchNumber: Number(booking.parking_broadcast_batch_number ?? 1),
    parkingLabel,
    parkingSlug,
    parkingName,
    residenceName,
    coverImage,
    brandColor,
    logoUrl,
    endorsementNote: viewerOwnsBooking ? (booking.parking_endorsement_note ?? null) : null,
    organizationName,
    endorsementSentAt: booking.endorsement_sent_at ?? null,
    viewerOwnsBooking,
    endorsementSendError: viewerOwnsBooking ? (booking.endorsement_send_error ?? null) : null,
    endorsementEmailSnapshot:
      viewerOwnsBooking && booking.endorsement_sent_at
        ? (booking.endorsement_email_snapshot ?? null)
        : null,
    hostContact,
    supportEscalationPhone: platformSettings.supportEscalationPhone,
    payment,
  });
});
