/**
 * Guest booking link — ownership rules for a chat thread.
 * Run: deno test supabase/functions/_shared/guestBookingLink_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { guestOwnsBookingRow } from './guestBookingLink.ts';

const USER = { id: 'user-1', email: 'Maria@Example.com' };

Deno.test('guestOwnsBookingRow - matches on the linked user id', () => {
  assertEquals(guestOwnsBookingRow({ guest_user_id: 'user-1' }, USER), true);
});

Deno.test('guestOwnsBookingRow - rejects another user id even with a shared email', () => {
  assertEquals(
    guestOwnsBookingRow({ guest_user_id: 'user-2', guest_email: 'maria@example.com' }, USER),
    false
  );
});

Deno.test('guestOwnsBookingRow - falls back to the booking email before the guest signs in', () => {
  assertEquals(guestOwnsBookingRow({ guest_email: 'maria@example.com' }, USER), true);
});

Deno.test('guestOwnsBookingRow - email match is case-insensitive and trimmed', () => {
  assertEquals(guestOwnsBookingRow({ guest_email: '  MARIA@EXAMPLE.COM ' }, USER), true);
});

Deno.test('guestOwnsBookingRow - rejects a different email', () => {
  assertEquals(guestOwnsBookingRow({ guest_email: 'someone@example.com' }, USER), false);
});

Deno.test('guestOwnsBookingRow - rejects a row with no owner and no email', () => {
  assertEquals(guestOwnsBookingRow({}, USER), false);
  assertEquals(guestOwnsBookingRow({ guest_email: '' }, USER), false);
});
