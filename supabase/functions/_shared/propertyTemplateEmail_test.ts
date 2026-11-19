/**
 * Booking placeholder values + subject resolution (pure; no DB).
 * Run: deno test supabase/functions/_shared/propertyTemplateEmail_test.ts
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// The email module pulls in DatabaseService, whose static initializer needs a client. These
// tests only exercise pure functions, so give it a harmless URL and import dynamically.
Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');

const { buildBookingPlaceholderVars, resolvePropertyTemplateSubject } =
  await import('./propertyTemplateEmail.ts');
import type { AppSettingsResolved } from './appSettings.ts';
import type { GuestSubmission } from './types.ts';

const settings = {
  gafTowerAndUnitNumber: 'Monaco 2604',
  publicGuestAppOrigin: 'https://example.test',
  brandColor: '#2DAA97',
} as unknown as AppSettingsResolved;

function booking(overrides: Record<string, unknown> = {}): GuestSubmission {
  return {
    id: 'booking-1',
    property_id: 'property-1',
    primary_guest_name: 'Jane Dela Cruz',
    guest_facebook_name: 'Jane Guest',
    guest_email: 'jane@example.test',
    guest_phone_number: '09171234567',
    check_in_date: '2026-11-20',
    check_out_date: '2026-11-22',
    check_in_time: '14:00',
    check_out_time: '12:00',
    number_of_adults: 2,
    number_of_children: 0,
    booking_rate: 0,
    down_payment: 0,
    balance: 0,
    security_deposit: 0,
    has_pets: false,
    pet_fee: 0,
    need_parking: false,
    guest_additional_fee: 0,
    ...overrides,
  } as unknown as GuestSubmission;
}

Deno.test('guest first name, labels and stay dates', () => {
  const vars = buildBookingPlaceholderVars(booking(), settings);
  assertEquals(vars.guest_first_name, 'Jane');
  assertEquals(vars.nights_label, '2 nights');
  assertEquals(vars.guests_label, '2 guests');
  assertStringIncludes(vars.stay_dates, 'Nov 20, 2026');
  assertStringIncludes(vars.stay_dates, 'Nov 22, 2026');
});

Deno.test('first name falls back to there, and singular labels read correctly', () => {
  const vars = buildBookingPlaceholderVars(
    booking({
      primary_guest_name: '',
      guest_facebook_name: '',
      check_out_date: '2026-11-21',
      number_of_adults: 1,
    }),
    settings
  );
  assertEquals(vars.guest_first_name, 'there');
  assertEquals(vars.nights_label, '1 night');
  assertEquals(vars.guests_label, '1 guest');
});

Deno.test('balance section hides at zero and shows when due', () => {
  const paid = buildBookingPlaceholderVars(booking(), settings);
  assertEquals(paid.balance_due_section, '');

  const due = buildBookingPlaceholderVars(booking({ booking_rate: 3599, balance: 3599 }), settings);
  assertStringIncludes(due.balance_due_section, 'remaining balance');
  assertStringIncludes(due.balance_due_section, '3,599');
});

Deno.test('subjects decode escaped values and respect locked templates', async () => {
  const decoded = await resolvePropertyTemplateSubject({
    propertyId: undefined,
    templateKey: 'email-review-request',
    vars: { property_name: 'Rock &amp; Roll' },
    fallback: 'fallback',
  });
  assertEquals(decoded, 'How was your stay at Rock & Roll?');

  const locked = await resolvePropertyTemplateSubject({
    propertyId: undefined,
    templateKey: 'email-gaf-request',
    vars: {},
    fallback: 'Monaco 2604 - GAF Request (a to b)',
  });
  assertEquals(locked, 'Monaco 2604 - GAF Request (a to b)');
});
