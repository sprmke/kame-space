import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { parkingBroadcastActionMessage } from './parkingActionMessages.ts';

Deno.test('parking assistant action messages are plain host copy', () => {
  assertEquals(
    parkingBroadcastActionMessage('slot_unavailable'),
    'This slot is already booked for these dates.'
  );
  assertEquals(
    parkingBroadcastActionMessage('offer_expired'),
    'This offer expired. Open the next request instead.'
  );
  assertEquals(
    parkingBroadcastActionMessage('already_claimed'),
    'Another host already accepted this request.'
  );
  assertEquals(parkingBroadcastActionMessage('unexpected_code'), 'unexpected_code');
});
