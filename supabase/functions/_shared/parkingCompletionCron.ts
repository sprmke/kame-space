/**
 * Parking auto-complete sweep (M-6). A paid parking booking past its checkout date should not
 * sit at READY_FOR_CHECKIN forever because the host forgot to press Complete. Stats, finance
 * and payout eligibility all read the status.
 *
 * Deliberately completes only READY_FOR_CHECKIN. A PENDING_REVIEW booking past checkout means
 * something else went wrong (never approved, endorsement stuck); it is surfaced to the host
 * instead of being silently closed.
 */

import { manilaTodayYmd, normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';
import { createServiceClient } from './orgAuth.ts';
import { buildActorContext } from './activityLog.ts';
import { logParkingStatusChange } from './parkingActivity.ts';
import { verifyCronSecret } from './cronSecretGate.ts';

export function verifyParkingCompletionCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'PARKING_COMPLETION_CRON_SECRET',
    headerName: 'x-parking-completion-cron-secret',
  });
}

type CompletionCandidate = {
  id: string;
  status: string;
  parking_id: string | null;
  parking_check_in_date: string | null;
  parking_check_out_date: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  guest_email: string | null;
  primary_guest_name: string | null;
};

export async function runParkingCompletionSweep(): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const today = manilaTodayYmd();

  const { data, error } = await supabase
    .from('guest_submissions')
    .select(
      `id, status, parking_id, parking_check_in_date, parking_check_out_date,
       check_in_date, check_out_date, guest_email, primary_guest_name`
    )
    .eq('status', 'READY_FOR_CHECKIN')
    .not('parking_id', 'is', null)
    .limit(1000);

  if (error) throw new Error(`runParkingCompletionSweep select: ${error.message}`);

  const due = ((data ?? []) as CompletionCandidate[]).filter((row) => {
    const checkOut = normalizeBookingDateToYmd(
      String(row.parking_check_out_date ?? row.check_out_date ?? '')
    );
    return Boolean(checkOut) && String(checkOut) < today;
  });

  let completed = 0;
  for (const row of due) {
    const nowIso = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('guest_submissions')
      .update({ status: 'COMPLETED', status_updated_at: nowIso, updated_at: nowIso })
      .eq('id', row.id)
      .eq('status', 'READY_FOR_CHECKIN')
      .select(
        `id, parking_id, parking_request_organization_id, primary_guest_name,
         guest_facebook_name, parking_check_in_date, check_in_date`
      )
      .maybeSingle();
    if (updateError) {
      console.error(`[complete-parking-bookings] ${row.id}:`, updateError.message);
      continue;
    }
    if (!updated) continue;
    completed += 1;
    await logParkingStatusChange({
      booking: updated,
      fromStatus: 'READY_FOR_CHECKIN',
      toStatus: 'COMPLETED',
      action: 'parking.auto_completed',
      actor: buildActorContext('cron', { cron: 'complete-parking-bookings' }),
      metadata: { reason: 'checkout_passed' },
    });
  }

  return { scanned: data?.length ?? 0, completed };
}
