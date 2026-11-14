/**
 * Pre-arrival reminder — the T-48h nudge (guest journey plan 6.5 / D13).
 *
 * Only the parking reminder existed before, so a guest with an unpaid balance, a fresh stay
 * guide or a changed check-in time heard nothing between "ready for check-in" and arrival.
 *
 * Idempotency is `guest_submissions.pre_arrival_emailed_at`: the candidate query skips a row
 * that already carries it, so a sequential retry does not resend. Two runs overlapping inside
 * the same second could both send; the cron fires hourly, so that window is not reachable in
 * practice and a duplicate reminder is a far smaller problem than a guest who gets none.
 */

import { manilaTodayYmd, normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';
import { verifyCronSecret } from './cronSecretGate.ts';
import { propertyAutomationEnabled } from './propertyAutomationToggles.ts';
import { resolveAppSettings } from './appSettings.ts';
import { buildBookingPlaceholderVars, renderPropertyTemplateSendEmail } from './propertyTemplateEmail.ts';
import { loadBookingEmailDisplayContext } from './emailBookingContext.ts';
import { formatEmailDateRange, formatResendFromAddress } from './propertyEmailBranding.ts';
import { createServiceClient } from './orgAuth.ts';
import { isEmailSuppressed } from './emailSuppression.ts';
import { sendResendEmail } from './sendResendEmail.ts';
import { recordCronItemFailure, reportCronPartialFailure } from './sentryCron.ts';
import { guestBookingEmailLinkPlaceholderExtras } from './guestBookingEmailLinks.ts';
import type { GuestSubmission } from './types.ts';

export function verifyPreArrivalReminderCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'PRE_ARRIVAL_REMINDER_CRON_SECRET',
    headerName: 'x-pre-arrival-reminder-cron-secret',
  });
}

/** Days before check-in the reminder goes out. */
export const PRE_ARRIVAL_LEAD_DAYS = 2;

/** Statuses where an arrival reminder still makes sense. */
const REMINDABLE_STATUSES = new Set(['PENDING_DOCUMENTS', 'PENDING_GAF', 'READY_FOR_CHECKIN']);

export type PreArrivalCandidate = {
  id: string;
  property_id: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  guest_email: string | null;
};

/** `YYYY-MM-DD` plus N days, in UTC arithmetic (dates are already Manila civil dates). */
export function addDaysYmd(ymd: string, days: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Whether this booking's check-in is exactly `PRE_ARRIVAL_LEAD_DAYS` away in Manila.
 *
 * Pure so the window can be tested with a fixed `today`.
 */
export function isPreArrivalReminderDue(
  checkInDate: string,
  todayYmd: string = manilaTodayYmd()
): boolean {
  const checkIn = normalizeBookingDateToYmd(checkInDate);
  if (!checkIn) return false;
  return checkIn === addDaysYmd(todayYmd, PRE_ARRIVAL_LEAD_DAYS);
}

export type PreArrivalSweepResult = {
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
  /**
   * The first failure, verbatim. A batch job that answers `failed: 3` with no reason is not
   * operable: the count lands in Sentry, the message only in a log line nobody can reach from
   * the cron response. The endpoint is cron-secret gated, so the message is returned to pg_net
   * and also attached to the Sentry warning.
   */
  first_error: string | null;
};

/** Loads the bookings due a reminder today. Exported so the cron test can steer it. */
export async function loadPreArrivalCandidates(
  todayYmd: string = manilaTodayYmd()
): Promise<PreArrivalCandidate[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('guest_submissions')
    .select('id, property_id, status, check_in_date, check_out_date, guest_email')
    .not('property_id', 'is', null)
    .is('parking_id', null)
    .is('pre_arrival_emailed_at', null)
    .in('status', [...REMINDABLE_STATUSES])
    .limit(500);

  if (error) {
    console.error('[preArrivalReminder] candidate query failed:', error.message);
    return [];
  }

  return ((data ?? []) as PreArrivalCandidate[]).filter(
    (row) =>
      String(row.guest_email ?? '').trim().length > 0 &&
      isPreArrivalReminderDue(row.check_in_date, todayYmd)
  );
}

const REMINDER_BODY = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">Hi <strong>{{guest_facebook_name}}</strong>, your stay at <strong>{{tower_and_unit_number}}</strong> starts in two days, on {{check_in_date}}.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">Check-in is from {{check_in_time}} and check-out is by {{check_out_time}}.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">Your balance is {{total_guest_balance}}. Everything else - directions, house rules, and your arrival steps - is on your trip page.</p>
<p>{{trip_cta_section}}</p>`;

async function sendReminder(row: PreArrivalCandidate): Promise<boolean> {
  const email = String(row.guest_email ?? '').trim();
  if (!email || (await isEmailSuppressed(email))) return false;

  // The reminder is part of the same conversation as the ready-for-check-in email, so it
  // follows that toggle rather than inventing another one.
  if (!(await propertyAutomationEnabled(row.property_id, 'emailReadyForCheckin'))) return false;

  const settings = await resolveAppSettings(row.property_id);
  const { branding, unitLabel, displayCheckInDate, displayCheckOutDate } =
    await loadBookingEmailDisplayContext(row.property_id, row as never);

  const booking = await createServiceClient()
    .from('guest_submissions')
    .select('*')
    .eq('id', row.id)
    .maybeSingle();
  if (!booking.data) return false;

  const linkExtras = await guestBookingEmailLinkPlaceholderExtras({
    origin: settings.publicGuestAppOrigin,
    propertySlug: String((await resolveSlug(row.property_id)) ?? ''),
    bookingId: row.id,
  });

  const html = await renderPropertyTemplateSendEmail({
    propertyId: row.property_id,
    templateKey: 'email-booking-acknowledgement',
    emailTitle: `Check-in in ${PRE_ARRIVAL_LEAD_DAYS} days`,
    contentOverride: REMINDER_BODY,
    branding,
    placeholderVars: buildBookingPlaceholderVars(
      booking.data as GuestSubmission,
      settings,
      linkExtras,
      branding
    ),
  });

  await sendResendEmail({
    from: formatResendFromAddress(`${unitLabel} - ${branding.organizationName}`, branding.fromEmail),
    to: [email],
    reply_to: settings.emailReplyTo,
    subject: `${unitLabel} - Check-in in ${PRE_ARRIVAL_LEAD_DAYS} days ${formatEmailDateRange(displayCheckInDate, displayCheckOutDate)}`,
    html,
    errorLabel: 'email',
  });

  // Stamp after a successful send. Stamping first would be strictly once-only, but a failed
  // send would then silence the reminder forever for that booking.
  await createServiceClient()
    .from('guest_submissions')
    .update({ pre_arrival_emailed_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('pre_arrival_emailed_at', null);

  return true;
}

async function resolveSlug(propertyId: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from('properties')
    .select('slug')
    .eq('id', propertyId)
    .maybeSingle();
  return String(data?.slug ?? '').trim() || null;
}

/** One sweep. Safe to call twice: the stamp makes the second run a no-op. */
export async function runPreArrivalReminderSweep(
  todayYmd: string = manilaTodayYmd()
): Promise<PreArrivalSweepResult> {
  const candidates = await loadPreArrivalCandidates(todayYmd);
  const result: PreArrivalSweepResult = {
    candidates: candidates.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    first_error: null,
  };

  for (const row of candidates) {
    try {
      const sent = await sendReminder(row);
      if (sent) result.sent += 1;
      else result.skipped += 1;
    } catch (err) {
      console.error(`[preArrivalReminder] send failed for ${row.id}:`, err);
      recordCronItemFailure(result, err);
    }
  }

  // Same rule as the other batch crons: a run where some sends failed still answers ok, so
  // report the count or it looks clean. No-op when nothing failed.
  await reportCronPartialFailure({
    cron: 'pre-arrival-reminders',
    attempted: candidates.length,
    failed: result.failed,
    extra: { sent: result.sent, first_error: result.first_error },
  });

  return result;
}
