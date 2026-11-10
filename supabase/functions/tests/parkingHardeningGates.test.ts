/**
 * Source-level contracts for the parking hardening fixes. These are intentionally cheap:
 * they fail when a later change silently reverts the permission gate, the atomic claim call,
 * the payment invalidation, or the guest-PII split.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

async function source(path: string): Promise<string> {
  return await Deno.readTextFile(new URL(`../${path}`, import.meta.url));
}

async function latestMigrationDefining(signature: string): Promise<{ file: string; src: string }> {
  const dir = new URL('../../migrations/', import.meta.url);
  const names: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isFile && entry.name.endsWith('.sql')) names.push(entry.name);
  }
  names.sort();
  for (let i = names.length - 1; i >= 0; i -= 1) {
    const src = await Deno.readTextFile(new URL(names[i]!, dir));
    if (src.includes(signature)) return { file: names[i]!, src };
  }
  throw new Error(`No migration defines ${signature}`);
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

Deno.test('parking settings use parking-team permissions, not org parking leaves', async () => {
  const src = await source('parking-settings/index.ts');
  assert(src.includes('resolveScopedParkingTeamAccess'));
  assert(src.includes("'settings:view'"));
  assert(src.includes("'settings:edit'"));
  assert(!src.includes("'org.parkings:manage'"));
});

Deno.test('parking pricing uses pricing:view / pricing:edit', async () => {
  const src = await source('parking-pricing/index.ts');
  assert(src.includes('resolveScopedParkingTeamAccess'));
  assert(src.includes("'pricing:view'"));
  assert(src.includes("'pricing:edit'"));
});

Deno.test('parking uploads require settings:edit', async () => {
  for (const file of ['upload-parking-media/index.ts', 'upload-parking-settings-asset/index.ts']) {
    const src = await source(file);
    assert(src.includes('resolveScopedParkingTeamAccess'));
    assert(src.includes("'settings:edit'"), file);
  }
});

Deno.test('update-parking separates settings edit from archive authority', async () => {
  const src = await source('update-parking/index.ts');
  assert(src.includes("resolveScopedParkingTeamAccess(scopedReq, 'settings:edit')"));
  assert(src.includes("resolveScopedParkingAccess(scopedReq, 'org.parkings:manage')"));
});

Deno.test('telegram parking scope uses notification permissions', async () => {
  const src = await source('_shared/telegramAssetScope.ts');
  assert(src.includes("'notifications:view'"));
  assert(src.includes("'notifications:edit'"));
});

Deno.test('claim goes through the atomic database RPC', async () => {
  const src = await source('_shared/parkingBroadcastActions.ts');
  assert(src.includes("rpc('claim_parking_booking_slot'"));
  assert(src.includes('slot_unavailable'));
  assert(src.includes('offer_expired'));
  assert(src.includes('assertParkingSlotAvailable'));
});

Deno.test('payment fulfillment guards dead checkout rows before confirming', async () => {
  const src = await source('_shared/parkingPaymentOrchestrator.ts');
  assert(src.includes('deadTransaction'));
  assert(src.includes('slotMismatch'));
  assert(src.includes('expirePendingParkingTransactions'));
  assert(src.includes("txn.status === 'expired'"));
  assert(src.includes("txn.status === 'refund_review'"));
  assert(src.includes("txn.status === 'refunded'"));
});

Deno.test('payment analytics cannot abort fulfillment', async () => {
  const src = await source('_shared/parkingPaymentOrchestrator.ts');
  assert(src.includes('captureParkingEvent'));
  assertEquals(src.includes("capturePostHogEvent('parking_"), false);
});

Deno.test('releaseParkingClaim expires pending checkout rows', async () => {
  const src = await source('_shared/parkingPaymentOrchestrator.ts');
  const release = src.slice(src.indexOf('export async function releaseParkingClaim'));
  assert(release.includes('expirePendingParkingTransactions'));
});

Deno.test('guest cancel is a single guarded write', async () => {
  const src = await source('_shared/parkingCancellation.ts');
  assert(!src.includes('releaseParkingClaim(bookingId)'));
  assert(src.includes("status: 'CANCELLED'"));
  assert(src.includes("eq('status', 'PENDING_PAYMENT')"));
});

Deno.test('submit only allows a host-on-behalf email mismatch with bookings:edit', async () => {
  const src = await source('submit-parking-booking-request/index.ts');
  assert(src.includes("verifyParkingTeamAccess(req, parkingId, 'bookings:edit')"));
  assert(src.includes('created_by_host_user_id'));
  assert(src.includes('Sign in with the guest email'));
});

Deno.test('status endpoint redacts endorsement data from non-owners', async () => {
  const src = await source('get-parking-booking-status/index.ts');
  assert(src.includes('viewerOwnsBooking'));
  assert(src.includes('viewerOwnsBooking && booking.endorsement_sent_at'));
  assert(src.includes('viewerOwnsBooking ? (booking.parking_endorsement_note'));
});

Deno.test('every parking admin route is permission-wrapped', async () => {
  const src = await source('../../ui/src/features/dashboard/parking/routes/index.tsx');
  const routeCount = countOccurrences(src, '<Route');
  const guardedCount = countOccurrences(src, 'element={parkingRoute(');
  assertEquals(routeCount, guardedCount);
});

Deno.test('org-wide booking lists include pre-claim parking requests', async () => {
  const sql = await source('../../supabase/migrations/20261324000000_list_bookings_preclaim.sql');
  assert(sql.includes('gs.parking_request_organization_id = p_org_id'));
  assert(sql.includes("b.response = 'pending'"));
  assert(sql.includes('s.parking_request_organization_id IS NOT NULL'));
  const svc = await source('_shared/databaseService.ts');
  assert(svc.includes("eq('parking_request_organization_id', orgId)"));
  assert(svc.includes("from('parking_booking_broadcasts')"));
});

Deno.test('paying host is notified when the payment window expires', async () => {
  const src = await source('_shared/parkingBroadcastExpireCron.ts');
  assert(src.includes("type: 'parking_payment_expired'"));
  assert(src.includes('payment window expired'));
});

Deno.test('guest cancellation and endorsement failure produce host notifications', async () => {
  const cancel = await source('_shared/parkingCancellation.ts');
  assert(cancel.includes("type: 'parking_request_cancelled'"));
  assert(cancel.includes('notifyHostsOfCancellation'));
  const pay = await source('_shared/parkingPaymentOrchestrator.ts');
  assert(pay.includes("type: 'parking_endorsement_failed'"));
});

Deno.test(
  'payouts expose a manual refund path and block disbursement after host cancel',
  async () => {
    const src = await source('parking-payouts/index.ts');
    assert(src.includes("action === 'record_refund'"));
    assert(src.includes("status: 'refunded'"));
    assert(src.includes("'parking.refund_recorded'"));
    assert(src.includes(".eq('status', 'paid')"));
    assert(src.includes('amount cannot exceed the guest charge'));
  }
);

Deno.test('host parking payment + endorsement reads are parking-team gated', async () => {
  const payments = await source('parking-payments/index.ts');
  assert(payments.includes("'finance:view'"));
  assert(payments.includes('verifyBookingBelongsToParking'));
  const resend = await source('resend-parking-endorsement/index.ts');
  assert(resend.includes("'bookings:edit'"));
  assert(resend.includes('verifyBookingBelongsToParking'));
});

Deno.test('offline host booking records a zero ledger row and fulfills', async () => {
  const src = await source('_shared/parkingPaymentOrchestrator.ts');
  const offline = src.slice(src.indexOf('export async function fulfillOfflineParkingPayment'));
  assert(offline.includes("provider: 'offline'"));
  assert(offline.includes('guest_charge_total: 0'));
  assert(offline.includes('fulfillParkingPayment'));
});

Deno.test('host cancel requires a reason and moves paid rows to refund review', async () => {
  const src = await source('transition-parking-booking/index.ts');
  assert(src.includes('A cancellation reason is required after payment'));
  assert(src.includes("status: 'refund_review'"));
  assert(src.includes('sendParkingHostCancelledEmail'));
  assert(src.includes("action: 'parking.cancelled_by_host'"));
});

Deno.test('the latest public listing refresh uses the platform guest rate', async () => {
  const latest = await latestMigrationDefining(
    'CREATE OR REPLACE FUNCTION public.pls_refresh_parking'
  );
  assert(
    latest.src.includes('FROM public.platform_parking_settings'),
    `${latest.file} must read the platform guest rate`
  );
  assert(
    !latest.src.includes('FROM public.parking_settings'),
    `${latest.file} must not write the host rate into the public index`
  );
});

Deno.test('parking dashboard net uses the marketplace host net', async () => {
  const src = await source('_shared/dashboardService.ts');
  assert(src.includes("from('parking_payment_transactions')"));
  assert(src.includes('hostNetTotal'));
  assert(src.includes("bookingKind === 'parking'"));
  assert(src.includes('parkingLedger?.hostNetTotal ?? 0'));
});
