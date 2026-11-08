/**
 * delete-parking — DELETE a parking slot (org:parkings:manage).
 */

import { createServiceClient, verifyParkingTeamAccess } from '../_shared/orgAuth.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { resolveScopedParkingAccess } from '../_shared/parkingScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('delete-parking', async (req) => {
  requireHttpMethod(req, 'DELETE');
  const body = await readJsonBody(req);

  const parkingId = typeof body.parkingId === 'string' ? body.parkingId.trim() : '';
  if (!parkingId) {
    return jsonError(req, 'parkingId is required');
  }

  const url = new URL(req.url);
  url.searchParams.set('parking_id', parkingId);
  const scopedReq = new Request(url.toString(), {
    method: req.method,
    headers: req.headers,
  });

  const access = await resolveScopedParkingAccess(scopedReq, 'org.parkings:manage');
  const { parkingRow } = access;

  // Org permission alone does not prove this listing is assigned. A scoped org admin must
  // have a parking-team row for it; a parking member (even MANAGER) can never delete.
  const teamAccess = await verifyParkingTeamAccess(req, String(parkingRow.id), 'settings:edit');
  if (teamAccess.accessKind === 'member') {
    return jsonError(req, 'Access restricted', 403);
  }

  const supabase = createServiceClient();

  // The FK is ON DELETE RESTRICT, so a parking with any booking history used to fail with a
  // generic 500 after the user already confirmed. Check first and point them at Archive.
  const { count: bookingCount, error: bookingCountError } = await supabase
    .from('guest_submissions')
    .select('id', { count: 'exact', head: true })
    .or(`parking_id.eq.${parkingRow.id},parking_pinned_id.eq.${parkingRow.id}`);
  if (bookingCountError) {
    console.error('[delete-parking] booking pre-check:', bookingCountError.message);
    return jsonError(req, 'Failed to delete parking', 500);
  }
  if ((bookingCount ?? 0) > 0) {
    return jsonError(req, 'has_bookings', 409);
  }

  const { count: pendingOfferCount, error: offerCountError } = await supabase
    .from('parking_booking_broadcasts')
    .select('id', { count: 'exact', head: true })
    .eq('parking_id', parkingRow.id)
    .eq('response', 'pending');
  if (offerCountError) {
    console.error('[delete-parking] offer pre-check:', offerCountError.message);
    return jsonError(req, 'Failed to delete parking', 500);
  }
  if ((pendingOfferCount ?? 0) > 0) {
    return jsonError(req, 'has_bookings', 409);
  }

  const { error: deleteError } = await supabase.from('parkings').delete().eq('id', parkingRow.id);

  if (deleteError) {
    console.error('[delete-parking]', deleteError.message);
    return jsonError(req, 'Failed to delete parking', 500);
  }

  await logActivity({
    action: 'parking.deleted',
    organizationId: parkingRow.organization_id,
    parkingId: parkingRow.id,
    scope: 'parking',
    actor: buildActorContext('dashboard', { orgAccess: access }, req),
    targetType: 'parking',
    targetId: parkingRow.id,
    targetLabel: parkingRow.name ?? null,
  });

  return jsonSuccess(req, { deletedParkingId: parkingRow.id });
});
