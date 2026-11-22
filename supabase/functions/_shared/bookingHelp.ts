/**
 * Booking-linked urgent help (readiness SAFE-01).
 *
 * "Get help now" on the trip page creates one open `booking_help_requests` row, notifies the
 * host in-app/push, and pages the ops channel. A `cant_get_in` or `unsafe` report is P0; the
 * others are P1. The 30-minute no-reply escalation cron is the next slice; this change makes
 * the report and the first alert reliable.
 */

import { createNotification } from './notificationService.ts';
import { raiseOpsAlertAfterResponse } from './ops/opsAlert.ts';
import { createServiceClient } from './orgAuth.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';
import { isWithinBookingHelpWindow } from './bookingHelpWindow.ts';

export { isWithinBookingHelpWindow };

export const BOOKING_HELP_KINDS = ['cant_get_in', 'not_as_described', 'unsafe', 'other'] as const;

export type BookingHelpKind = (typeof BOOKING_HELP_KINDS)[number];

export const BOOKING_HELP_COLUMNS =
  'id, booking_id, property_id, organization_id, kind, note, status, created_at, updated_at, escalated_at, resolved_at';

export class BookingHelpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isBookingHelpKind(value: unknown): value is BookingHelpKind {
  return typeof value === 'string' && (BOOKING_HELP_KINDS as readonly string[]).includes(value);
}

export function bookingHelpKindLabel(kind: BookingHelpKind): string {
  switch (kind) {
    case 'cant_get_in':
      return "I can't get in";
    case 'not_as_described':
      return 'Not as described';
    case 'unsafe':
      return 'Unsafe or emergency';
    default:
      return 'Other issue';
  }
}

/** The window is 24 hours before check-in through the check-out day (Manila). */
type HelpRow = Record<string, unknown>;

export async function createBookingHelpRequest(input: {
  userId: string;
  userEmail?: string | null;
  bookingId: string;
  kind: BookingHelpKind;
  note?: string | null;
}): Promise<{ request: HelpRow; alreadyOpen: boolean }> {
  const supabase = createServiceClient();
  const bookingId = String(input.bookingId ?? '').trim();
  if (!bookingId) throw new BookingHelpError('bookingId is required');

  const { data: booking, error } = await supabase
    .from('guest_submissions')
    .select(
      `id, property_id, guest_auth_user_id, guest_email, primary_guest_name, status,
       parking_id, check_in_date, check_out_date, parking_check_in_date, parking_check_out_date`
    )
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw new BookingHelpError('Could not load this booking. Try again.', 500);
  if (!booking) throw new BookingHelpError('Booking not found', 404);

  const guestUserId = String(booking.guest_auth_user_id ?? '');
  const emailMatches =
    !guestUserId &&
    input.userEmail &&
    String(booking.guest_email ?? '')
      .trim()
      .toLowerCase() === String(input.userEmail).trim().toLowerCase();
  if (guestUserId !== input.userId && !emailMatches) {
    throw new BookingHelpError('Booking not found', 404);
  }

  const checkInDate = String(booking.parking_check_in_date ?? booking.check_in_date ?? '').trim();
  const checkOutDate = String(
    booking.parking_check_out_date ?? booking.check_out_date ?? ''
  ).trim();
  if (String(booking.status ?? '') === 'CANCELLED') {
    throw new BookingHelpError('This booking is cancelled', 409);
  }
  if (!isWithinBookingHelpWindow({ checkInDate, checkOutDate })) {
    throw new BookingHelpError(
      'Get help now opens 24 hours before check-in and stays open through check-out.',
      409
    );
  }

  const { data: existing } = await supabase
    .from('booking_help_requests')
    .select(BOOKING_HELP_COLUMNS)
    .eq('booking_id', bookingId)
    .in('status', ['open', 'escalated'])
    .maybeSingle();
  if (existing) return { request: existing as HelpRow, alreadyOpen: true };

  const propertyId = String(booking.property_id ?? '');
  const organizationId = await resolveOrganizationIdForProperty(propertyId).catch(() => null);
  const kind = input.kind;
  const note =
    String(input.note ?? '')
      .trim()
      .slice(0, 1000) || null;

  const { data: inserted, error: insertError } = await supabase
    .from('booking_help_requests')
    .insert({
      booking_id: bookingId,
      property_id: propertyId,
      organization_id: organizationId,
      guest_user_id: input.userId,
      kind,
      note,
      status: 'open',
    })
    .select(BOOKING_HELP_COLUMNS)
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raced } = await supabase
        .from('booking_help_requests')
        .select(BOOKING_HELP_COLUMNS)
        .eq('booking_id', bookingId)
        .in('status', ['open', 'escalated'])
        .maybeSingle();
      if (raced) return { request: raced as HelpRow, alreadyOpen: true };
    }
    throw new BookingHelpError('Could not send the request. Try again.', 500);
  }

  const label = bookingHelpKindLabel(kind);
  if (organizationId) {
    try {
      await createNotification({
        organizationId,
        propertyId,
        type: 'booking_help_requested',
        title: `Guest needs help: ${label}`,
        body: note || 'Open the booking to see details and reply.',
        bookingId,
        dedupeKey: `booking-help:${bookingId}:${String(inserted.id)}`,
        metadata: { help_request_id: String(inserted.id), kind },
      });
    } catch (notificationError) {
      console.error('[booking-help] host notification failed (non-fatal):', notificationError);
    }
  }

  try {
    await raiseOpsAlertAfterResponse({
      key: `guest_help:${bookingId}`,
      tier: kind === 'cant_get_in' || kind === 'unsafe' ? 'p0' : 'p1',
      source: 'journey',
      title: `Guest needs help: ${label}`,
      summary: 'A guest used Get help now. Reply in the booking so the guest is not stranded.',
      context: { booking_id: bookingId, property_id: propertyId, kind },
    });
  } catch (alertError) {
    console.error('[booking-help] ops alert failed (non-fatal):', alertError);
  }

  // The help request row is the audit record; no separate org activity row is needed.

  return { request: inserted as HelpRow, alreadyOpen: false };
}

/** The open case for a booking, for the host's booking detail. */
export async function loadOpenBookingHelp(bookingId: string): Promise<HelpRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('booking_help_requests')
    .select(BOOKING_HELP_COLUMNS)
    .eq('booking_id', String(bookingId))
    .in('status', ['open', 'escalated'])
    .maybeSingle();
  return (data as HelpRow | null) ?? null;
}

/** Mark the guest's open case resolved so the host has a close action and a new case can open. */
export async function resolveBookingHelp(input: {
  bookingId: string;
  helpRequestId: string;
  userId: string;
}): Promise<HelpRow | null> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('booking_help_requests')
    .update({ status: 'resolved', resolved_at: now, resolved_by: input.userId, updated_at: now })
    .eq('id', input.helpRequestId)
    .eq('booking_id', input.bookingId)
    .in('status', ['open', 'escalated'])
    .select(BOOKING_HELP_COLUMNS)
    .maybeSingle();
  if (error) throw new BookingHelpError('Could not resolve the request. Try again.', 500);
  return (data as HelpRow | null) ?? null;
}
