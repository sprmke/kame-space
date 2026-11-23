import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildBookingWebThreadId } from './webGuestChatIds.ts';

Deno.test('buildBookingWebThreadId is stable and booking-scoped', () => {
  assertEquals(
    buildBookingWebThreadId('11111111-1111-4111-8111-111111111111'),
    'web:booking:11111111-1111-4111-8111-111111111111'
  );
});
