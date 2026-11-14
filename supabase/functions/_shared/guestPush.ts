/**
 * Guest OS push — the guest's own booking milestones on their device.
 *
 * Scope: **signed-in guests only.** A booking links to a guest account through
 * `guest_submissions.guest_user_id`, which `linkGuestBookingsByEmail` fills the first time the
 * guest signs in with the email they booked with. An anonymous booking has no user to push to,
 * and it keeps its email, so nothing here is a dead end.
 *
 * Why not the `notifications` table: that table addresses org / property / parking team members,
 * and its realtime policy is scoped to them. Pushing straight to the user's subscriptions keeps
 * one model for the bell and one for the guest's phone, and needs no policy change.
 *
 * Preferences are shared with the host surface: `notification_preferences` is per user, and
 * `booking_*` types land in the **Bookings** group, so a guest who mutes Bookings also stops
 * these. Quiet hours apply too.
 */

import { createServiceClient } from './orgAuth.ts';
import { guestJourneyStatusWord } from './guestJourneyCopy.ts';
import { loadNotificationPreferences, shouldDeliverPush } from './notificationPreferences.ts';
import { loadPushSubscriptions } from './pushRecipients.ts';
import { guestTripPath } from './publicGuestPaths.ts';
import { isPushConfigured, sendPushBatch, type PushPayload } from './webPushService.ts';

/**
 * Statuses worth waking a phone for: the two a guest is actually waiting on. Everything else
 * either needs a decision from the guest (handled in-app) or is a refund they are already
 * emailing about.
 */
const GUEST_PUSH_STATUSES = new Set(['PENDING_DOCUMENTS', 'READY_FOR_CHECKIN']);

export type GuestPushCopy = {
  /** Reuses the guest vocabulary so the phone never says a different word than the page. */
  type: string;
  title: string;
  body: string;
};

/**
 * Copy for one milestone. Pure, so the words and the status gating are tested without a device.
 *
 * `checkInLabel` is pre-formatted by the caller (e.g. `Dec 10, 2026`).
 */
export function guestPushCopyForStatus(input: {
  status: string;
  propertyName: string;
  checkInLabel: string;
}): GuestPushCopy | null {
  const status = String(input.status ?? '').trim();
  if (!GUEST_PUSH_STATUSES.has(status)) return null;

  const propertyName = String(input.propertyName ?? '').trim();
  const word = guestJourneyStatusWord(status);
  const title = propertyName ? `${propertyName}: ${word}` : word;

  return {
    type: `booking_${status === 'READY_FOR_CHECKIN' ? 'ready_for_checkin' : 'confirmed'}_push`,
    title,
    body:
      status === 'READY_FOR_CHECKIN'
        ? `Check-in ${input.checkInLabel}. Your arrival steps are on your trip page.`
        : `Check-in ${input.checkInLabel}. Open your trip for the details.`,
  };
}

/** `YYYY-MM-DD` → `Dec 10, 2026`, or the raw value when it cannot be parsed. */
export function guestPushCheckInLabel(checkInDate: string): string {
  const raw = String(checkInDate ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return raw;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

type GuestPushBooking = {
  id?: unknown;
  property_id?: unknown;
  guest_user_id?: unknown;
  check_in_date?: unknown;
};

/**
 * Sends one guest milestone push. Never throws and never blocks the transition: a phone that
 * cannot be reached is not a failed status change.
 *
 * Returns true only when at least one device accepted the push, which is what a test asserts.
 */
export async function sendGuestPushForBookingStatus(
  booking: GuestPushBooking,
  toStatus: string
): Promise<boolean> {
  try {
    const status = String(toStatus ?? '').trim();
    if (!GUEST_PUSH_STATUSES.has(status)) return false;
    if (!isPushConfigured()) return false;

    const bookingId = String(booking.id ?? '').trim();
    const propertyId = String(booking.property_id ?? '').trim();
    const guestUserId = String(booking.guest_user_id ?? '').trim();
    // No linked account means the guest booked anonymously. They still get the email.
    if (!bookingId || !propertyId || !guestUserId) return false;

    const sb = createServiceClient();
    const { data: property } = await sb
      .from('properties')
      .select('slug, name')
      .eq('id', propertyId)
      .maybeSingle();
    const slug = String(property?.slug ?? '').trim();
    if (!slug) return false;

    const copy = guestPushCopyForStatus({
      status,
      propertyName: String(property?.name ?? ''),
      checkInLabel: guestPushCheckInLabel(String(booking.check_in_date ?? '')),
    });
    if (!copy) return false;

    const prefs = await loadNotificationPreferences(sb, guestUserId);
    if (!shouldDeliverPush(copy.type, prefs).deliver) return false;

    const subs = await loadPushSubscriptions(sb, [guestUserId]);
    if (subs.length === 0) return false;

    const payload: PushPayload = {
      title: copy.title,
      body: copy.body,
      // App-relative, so the service worker resolves it against whatever host it opened under.
      path: guestTripPath('', slug, bookingId),
      type: copy.type,
      // Stable per booking + milestone, so a retried transition replaces the notification
      // instead of stacking a second one on the lock screen.
      tag: `guest-${bookingId}-${status}`,
    };

    const results = await sendPushBatch(subs, payload, 10);
    const gone = results.filter((r) => !r.ok && r.gone).map((r) => r.id);
    if (gone.length > 0) {
      // Same hygiene as the host fan-out: a dead endpoint is retired, not retried forever.
      await sb
        .from('push_subscriptions')
        .update({ disabled_at: new Date().toISOString() })
        .in('id', gone)
        .is('disabled_at', null);
    }

    return results.some((r) => r.ok);
  } catch (err) {
    console.error('[guestPush] send failed (non-fatal):', err);
    return false;
  }
}
