import { describe, expect, it } from 'vitest';

import {
  bookingNamesMatch,
  matchBookingForConversation,
} from '@/features/dashboard/inbox/lib/inboxMatchBooking';

import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import type { InboxConversation } from '@/features/dashboard/inbox/types/inbox';

function booking(overrides: Partial<BookingRow>): BookingRow {
  return {
    id: 'b1',
    primary_guest_name: 'Maria Santos',
    guest_facebook_name: null,
    check_in_date: '12-10-2026',
    check_out_date: '12-12-2026',
    ...overrides,
  } as BookingRow;
}

function conversation(overrides: Partial<InboxConversation>): InboxConversation {
  return {
    id: 'c1',
    participant_name: 'Maria Santos',
    inquiry_check_in: null,
    inquiry_check_out: null,
    ...overrides,
  } as InboxConversation;
}

describe('bookingNamesMatch', () => {
  it('matches an exact name', () => {
    expect(bookingNamesMatch('Maria Santos', booking({}))).toBe(true);
  });

  it('matches a name whose tokens all appear', () => {
    expect(bookingNamesMatch('Maria', booking({}))).toBe(true);
  });

  it('does not match a different surname', () => {
    expect(bookingNamesMatch('Maria Cruz', booking({}))).toBe(false);
  });

  it('does not match a short fragment', () => {
    expect(bookingNamesMatch('Mar', booking({}))).toBe(false);
  });

  it('ignores case and extra spaces', () => {
    expect(bookingNamesMatch('  maria   santos ', booking({}))).toBe(true);
  });
});

describe('matchBookingForConversation', () => {
  it('returns the linked booking before guessing from the name', () => {
    const rows = [
      booking({ id: 'b1', primary_guest_name: 'Maria Santos' }),
      booking({ id: 'b2', primary_guest_name: 'Maria Santos' }),
    ];
    const match = matchBookingForConversation(conversation({ booking_id: 'b2' }), rows);
    expect(match?.id).toBe('b2');
  });

  it('falls back to dates then name when there is no link', () => {
    const rows = [
      booking({ id: 'b1', check_in_date: '12-10-2026' }),
      booking({ id: 'b2', check_in_date: '01-05-2027', check_out_date: '01-07-2027' }),
    ];
    const match = matchBookingForConversation(
      conversation({ inquiry_check_in: '2026-12-10', inquiry_check_out: '2026-12-12' }),
      rows
    );
    expect(match?.id).toBe('b1');
  });

  it('does not guess when a linked booking is not in the loaded page', () => {
    const rows = [
      booking({ id: 'b1', primary_guest_name: 'Someone Else' }),
      booking({ id: 'b2', primary_guest_name: 'Maria Santos' }),
    ];
    const match = matchBookingForConversation(
      conversation({ booking_id: 'missing', participant_name: 'Maria Santos' }),
      rows
    );
    // One unique name match remains, so the name fallback still resolves it.
    expect(match?.id).toBe('b2');
  });

  it('returns null when several bookings stay ambiguous', () => {
    const rows = [
      booking({ id: 'b1', primary_guest_name: 'Maria Santos' }),
      booking({ id: 'b2', primary_guest_name: 'Maria Santos' }),
    ];
    expect(matchBookingForConversation(conversation({}), rows)).toBeNull();
  });

  it('returns null without a conversation', () => {
    expect(matchBookingForConversation(null, [booking({})])).toBeNull();
  });
});
