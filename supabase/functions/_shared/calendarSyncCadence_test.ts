import { applyLocalSupabaseTestEnv } from '../tests/_localSupabaseEnv.ts';

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { calendarChannel } from './calendarChannels.ts';
import {
  CALENDAR_SYNC_CLAIM_SLACK_MS,
  claimCutoffMs,
  reservationDisplayName,
} from './calendarSyncRun.ts';

applyLocalSupabaseTestEnv();

Deno.test('claim cutoff subtracts the slack so a :00:07 feed is due at :30:00', () => {
  const halfHour = 30 * 60_000;
  assertEquals(claimCutoffMs(halfHour, false), halfHour - CALENDAR_SYNC_CLAIM_SLACK_MS);
  // A feed claimed at :00:07 is inside the 28 minute cutoff at :30:00.
  const claimedAt = 7_000;
  const now = halfHour;
  assertEquals(now - claimedAt >= claimCutoffMs(halfHour, false), true);
});

Deno.test('forced Sync now keeps the short serialisation window', () => {
  assertEquals(claimCutoffMs(30 * 60_000, true), 5_000);
});

Deno.test('claim cutoff never goes negative for a tiny interval', () => {
  assertEquals(claimCutoffMs(60_000, false), 0);
});

Deno.test('Airbnb placeholder names are unchanged', () => {
  const airbnb = calendarChannel('airbnb');
  assertEquals(
    reservationDisplayName(airbnb, { confirmationCode: 'HMABC123', phoneLast4: '1234' }),
    'Airbnb HMABC123'
  );
  assertEquals(
    reservationDisplayName(airbnb, { confirmationCode: null, phoneLast4: '1234' }),
    'Airbnb guest ··1234'
  );
  assertEquals(
    reservationDisplayName(airbnb, { confirmationCode: null, phoneLast4: null }),
    'Airbnb guest'
  );
});

Deno.test('other channels get their own placeholder label', () => {
  assertEquals(
    reservationDisplayName(calendarChannel('agoda'), { confirmationCode: null, phoneLast4: null }),
    'Agoda guest'
  );
  assertEquals(
    reservationDisplayName(calendarChannel('booking_com'), {
      confirmationCode: null,
      phoneLast4: null,
    }),
    'Booking.com guest'
  );
  // A confirmation code from a non-Airbnb channel never leaks into the name prefix.
  assertEquals(
    reservationDisplayName(calendarChannel('agoda'), {
      confirmationCode: 'ABC123',
      phoneLast4: null,
    }),
    'Agoda guest'
  );
});
