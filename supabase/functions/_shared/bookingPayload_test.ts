import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { holdsFullBookingPayload, redactBookingForPermissions } from './bookingPayload.ts';

const ROW = {
  id: 'booking-1',
  primary_guest_name: 'Maria Santos',
  sd_refund_account_name: 'Maria Santos',
  sd_refund_account_number: '1234567890',
  sd_refund_bank: 'BDO',
  guest_essentials_override: { doorCode: '4821' },
  stay_guide_token: 'stay-token',
  document_share_token: 'doc-token',
  guest_form_token: 'form-token',
};

const FULL = ['bookings.detail.pricing:edit', 'bookings.detail.stay:edit'];

Deno.test('view-only caller loses bank details, door code and tokens', () => {
  const out = redactBookingForPermissions(ROW, ['bookings:view']);
  assertEquals(out.sd_refund_account_number, null);
  assertEquals(out.sd_refund_account_name, null);
  assertEquals(out.sd_refund_bank, null);
  assertEquals(out.guest_essentials_override, null);
  assertEquals(out.stay_guide_token, null);
  assertEquals(out.document_share_token, null);
  assertEquals(out.guest_form_token, null);
  // Non-sensitive fields survive.
  assertEquals(out.primary_guest_name, 'Maria Santos');
  assertEquals(out.id, 'booking-1');
});

Deno.test('pricing edit keeps bank details but not the door code', () => {
  const out = redactBookingForPermissions(ROW, ['bookings:view', 'bookings.detail.pricing:edit']);
  assertEquals(out.sd_refund_account_number, '1234567890');
  assertEquals(out.guest_essentials_override, null);
  assertEquals(out.stay_guide_token, null);
});

Deno.test('stay edit keeps the door code but not bank details', () => {
  const out = redactBookingForPermissions(ROW, ['bookings:view', 'bookings.detail.stay:edit']);
  assertEquals(out.guest_essentials_override, { doorCode: '4821' });
  assertEquals(out.stay_guide_token, 'stay-token');
  assertEquals(out.sd_refund_account_number, null);
});

Deno.test('both leaves keep the whole row untouched', () => {
  const out = redactBookingForPermissions(ROW, FULL);
  assertEquals(out, ROW);
  assertEquals(holdsFullBookingPayload(FULL), true);
});

Deno.test('missing fields are not invented', () => {
  const out = redactBookingForPermissions({ id: 'x' }, []);
  assertEquals(out, { id: 'x' });
  assertEquals(holdsFullBookingPayload([]), false);
});
