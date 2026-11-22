/**
 * Booking-linked urgent help (SAFE-01) against the local stack.
 *
 * Creates a throwaway guest user and booking, then exercises create → one-open-case →
 * resolve → reopen. No hosted writes.
 *
 * Run with a local stack up:
 *   bun run test:edge:help
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

const { createBookingHelpRequest, loadOpenBookingHelp, resolveBookingHelp } =
  await import('../_shared/bookingHelp.ts');

const supabase = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY);
const TAG = `help-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

Deno.test('urgent help: one open case, resolve, then a new case can open', async () => {
  const email = `${TAG}@example.test`;
  const { data: created, error: userError } = await supabase.auth.admin.createUser({
    email,
    password: `Test-${crypto.randomUUID()}`,
    email_confirm: true,
  });
  if (userError || !created.user) throw new Error(`create user: ${userError?.message}`);
  const userId = created.user.id;

  const { data: property } = await supabase.from('properties').select('id').limit(1).maybeSingle();
  if (!property?.id) throw new Error('No property in the local seed. Run `bun run db:reset`.');

  const { data: booking, error: bookingError } = await supabase
    .from('guest_submissions')
    .insert({
      property_id: property.id,
      guest_auth_user_id: userId,
      guest_facebook_name: TAG,
      primary_guest_name: TAG,
      guest_phone_number: '0917 000 0000',
      guest_address: 'Test address',
      guest_email: email,
      check_in_date: ymd(1),
      check_out_date: ymd(2),
      number_of_nights: 1,
      find_us: 'test',
      payment_receipt_url: '',
      unit_owner: 'Owner',
      tower_and_unit_number: 'Tower 1',
      owner_onsite_contact_person: 'Contact',
      owner_contact_number: '0917 000 0001',
      status: 'READY_FOR_CHECKIN',
    })
    .select('id')
    .single();
  if (bookingError || !booking?.id) throw new Error(`create booking: ${bookingError?.message}`);

  let helpId = '';
  try {
    const first = await createBookingHelpRequest({
      userId,
      userEmail: email,
      bookingId: booking.id,
      kind: 'cant_get_in',
      note: 'Door code does not work',
    });
    assertEquals(first.alreadyOpen, false);
    helpId = String(first.request.id);

    const repeat = await createBookingHelpRequest({
      userId,
      userEmail: email,
      bookingId: booking.id,
      kind: 'cant_get_in',
    });
    assertEquals(repeat.alreadyOpen, true);
    assertEquals(String(repeat.request.id), helpId);

    const open = await loadOpenBookingHelp(booking.id);
    assertEquals(String(open?.id), helpId);

    const resolved = await resolveBookingHelp({
      bookingId: booking.id,
      helpRequestId: helpId,
      userId,
    });
    assertEquals(resolved?.status, 'resolved');
    assertEquals(await loadOpenBookingHelp(booking.id), null);

    const second = await createBookingHelpRequest({
      userId,
      userEmail: email,
      bookingId: booking.id,
      kind: 'other',
      note: 'Second issue',
    });
    assertEquals(second.alreadyOpen, false);
    assertEquals(String(second.request.id) !== helpId, true);
  } finally {
    await supabase.from('booking_help_requests').delete().eq('booking_id', booking.id);
    await supabase.from('guest_submissions').delete().eq('id', booking.id);
    await supabase.auth.admin.deleteUser(userId);
  }
});
