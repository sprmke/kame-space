/**
 * "Your guest opened their trip" — one host notification, on the guest's first view (plan 7.5).
 *
 * The trip page is the only screen a guest is told to open, so reaching it is the difference
 * between "they might not have seen the dates" and "they have seen the dates, the directions and
 * the balance". Worth one notification, not a feed: the column is stamped on the first authorised
 * read and the update is conditional, so a refresh, a second device or two concurrent reads still
 * produce exactly one row.
 *
 * Deliberately not an email: the host already gets mail for anything that needs a decision. This
 * is a quiet signal in the bell.
 */

import { runAfterResponse } from './backgroundTask.ts';
import { createNotification } from './notificationService.ts';
import { createServiceClient } from './orgAuth.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';

export const GUEST_TRIP_VIEWED_NOTIFICATION_TYPE = 'booking_trip_viewed' as const;

/** First name only: the host knows the booking, and the bell is not the place for full names. */
export function guestTripViewGuestLabel(name: string | null | undefined): string {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return 'Your guest';
  return trimmed.split(/\s+/)[0] ?? 'Your guest';
}

export function guestTripViewedNotification(input: {
  guestName: string | null | undefined;
}): { title: string; body: string } {
  return {
    title: `${guestTripViewGuestLabel(input.guestName)} opened their trip`,
    body: 'Dates, directions and balance are all on their trip page.',
  };
}

/**
 * Stamps the first view and, when the stamp was new, raises the host notification.
 *
 * Returns true only for the read that actually established the first view, which is what the
 * caller can assert in a test. Never throws: a notification must not fail the guest's trip read.
 */
/** PostgREST returns the rows it changed; `[]` means another read already stamped it. */
export function didStampFirstView(data: unknown): boolean {
  return Array.isArray(data) && data.length > 0;
}

export async function recordGuestTripFirstView(input: {
  bookingId: string;
  propertyId: string;
  guestName: string | null | undefined;
  /** The already-loaded row: a revisit skips the write entirely. */
  alreadyViewed?: boolean;
}): Promise<boolean> {
  const bookingId = String(input.bookingId ?? '').trim();
  const propertyId = String(input.propertyId ?? '').trim();
  if (!bookingId || !propertyId) return false;
  // Almost every trip load is a revisit, so spend nothing on them. The conditional update below
  // still guards the two-tabs-at-once case.
  if (input.alreadyViewed) return false;

  try {
    const { data, error } = await createServiceClient()
      .from('guest_submissions')
      .update({ guest_trip_first_viewed_at: new Date().toISOString() })
      .eq('id', bookingId)
      .is('guest_trip_first_viewed_at', null)
      .select('id');

    if (error) {
      console.error('[guestTripView] first-view stamp failed:', error.message);
      return false;
    }
    if (!didStampFirstView(data)) return false;

    const copy = guestTripViewedNotification({ guestName: input.guestName });
    await runAfterResponse('get-guest-trip:first-view', async () => {
      const organizationId = await resolveOrganizationIdForProperty(propertyId).catch(() => null);
      if (!organizationId) return;
      await createNotification({
        organizationId,
        propertyId,
        type: GUEST_TRIP_VIEWED_NOTIFICATION_TYPE,
        title: copy.title,
        body: copy.body,
        bookingId,
        dedupeKey: `${GUEST_TRIP_VIEWED_NOTIFICATION_TYPE}:${bookingId}`,
        metadata: { first_view: true },
      });
    });

    return true;
  } catch (err) {
    console.error('[guestTripView] first-view record threw:', err);
    return false;
  }
}
