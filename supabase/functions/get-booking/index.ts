/**
 * get-booking — single-booking read for hosts (and the AI assistant slim card).
 *
 * Auth matches list-bookings: JWT + property / parking / org scope via edge checks
 * (platform admin included). Service-role DB read bypasses RLS so detail no longer
 * depends on browser PostgREST membership helpers.
 *
 * Query:
 *   booking_id (required)
 *   property_id | parking_id | org_id | org_slug (one scope required)
 *   format=row → full guest_submissions row as `data` (booking detail UI)
 *   (default) → slim booking_card fields for assistant / legacy callers
 *
 * activity-log: N/A — read only
 */

import { computeTotalGuestBalanceFromBooking } from '../_shared/totalGuestBalance.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient, verifyParkingTeamAccess } from '../_shared/orgAuth.ts';
import {
  listPropertyIdsForOrganization,
  readOrgIdFromUrl,
  readOrgSlugFromUrl,
  readPropertyIdFromUrl,
  resolveOrgAccessContext,
  resolveScopedPropertyAccess,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type LoadedBooking = Record<string, unknown> & {
  id: string;
  property_id: string | null;
  parking_id: string | null;
  parking_request_organization_id?: string | null;
  primary_guest_name?: string | null;
  status?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  guest_balance_paid_amount?: unknown;
};

async function loadBookingById(bookingId: string): Promise<LoadedBooking | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('guest_submissions')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !data) return null;
  return data as LoadedBooking;
}

serveAuthenticated('get-booking', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const url = new URL(req.url);
  const bookingId = url.searchParams.get('booking_id')?.trim();
  if (!bookingId) {
    return jsonError(req, 'booking_id is required', 400);
  }

  const wantFullRow = url.searchParams.get('format')?.trim() === 'row';
  const explicitPropertyId = readPropertyIdFromUrl(url);
  const explicitParkingId = url.searchParams.get('parking_id')?.trim() || null;
  const orgSlug = readOrgSlugFromUrl(url);
  const orgId = readOrgIdFromUrl(url);

  let booking: LoadedBooking | null = null;
  let propertyIdForMeta: string | null = null;

  if (explicitPropertyId) {
    const { property } = await resolveScopedPropertyAccess(
      req,
      'bookings:view',
      explicitPropertyId
    );
    propertyIdForMeta = property.id;
    booking = await loadBookingById(bookingId);
    if (!booking || booking.property_id !== property.id) {
      return jsonError(req, 'Booking not found', 404);
    }
  } else if (explicitParkingId) {
    await verifyParkingTeamAccess(req, explicitParkingId, 'bookings:view');
    booking = await loadBookingById(bookingId);
    if (!booking) {
      return jsonError(req, 'Booking not found', 404);
    }
    if (booking.parking_id === explicitParkingId) {
      // claimed parking booking
    } else if (booking.parking_id == null) {
      // pre-claim broadcast candidate; UI verifies candidacy separately
    } else {
      return jsonError(req, 'Booking not found', 404);
    }
  } else if (orgSlug || orgId) {
    const ctx = await resolveOrgAccessContext(req, 'org.bookings:view');
    booking = await loadBookingById(bookingId);
    if (!booking) {
      return jsonError(req, 'Booking not found', 404);
    }

    if (booking.property_id) {
      const orgPropertyIds = await listPropertyIdsForOrganization(ctx.org.id);
      if (!orgPropertyIds.includes(booking.property_id)) {
        return jsonError(req, 'Booking not found in organization', 404);
      }
      propertyIdForMeta = booking.property_id;
    } else if (booking.parking_id) {
      const sb = createServiceClient();
      const { data: parking, error } = await sb
        .from('parkings')
        .select('id, organization_id')
        .eq('id', booking.parking_id)
        .maybeSingle();
      if (error || !parking || parking.organization_id !== ctx.org.id) {
        return jsonError(req, 'Booking not found in organization', 404);
      }
    } else if (booking.parking_request_organization_id === ctx.org.id) {
      // broadcast pre-claim for this org
    } else {
      return jsonError(req, 'Booking not found in organization', 404);
    }
  } else {
    return jsonError(req, 'property_id, parking_id, org_id, or org_slug is required', 400);
  }

  if (!booking) {
    return jsonError(req, 'Booking not found', 404);
  }

  if (wantFullRow) {
    return jsonSuccess(req, booking);
  }

  const metaPropertyId = propertyIdForMeta ?? booking.property_id;
  const sb = createServiceClient();
  const { data: property } = metaPropertyId
    ? await sb.from('properties').select('id, name').eq('id', metaPropertyId).maybeSingle()
    : { data: null };

  const totalDue = computeTotalGuestBalanceFromBooking(booking);
  const balanceDue = totalDue === null ? null : totalDue - num(booking.guest_balance_paid_amount);

  return jsonSuccess(req, {
    bookingId: booking.id,
    guestName: booking.primary_guest_name ?? '',
    status: booking.status,
    checkIn: booking.check_in_date,
    checkOut: booking.check_out_date,
    propertyId: metaPropertyId,
    propertyName: property?.name ?? '',
    balanceDue,
  });
});
