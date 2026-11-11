/**
 * Guest trip content — which host content a guest sees at which stage.
 * Run: deno test supabase/functions/_shared/guestTripContent_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { guestSectionVisibleAtPhase, guestTripStage } from './guestTripContent.ts';

Deno.test('guestTripStage - a pending request is "before"', () => {
  assertEquals(guestTripStage('PENDING_REVIEW', false), 'before');
  assertEquals(guestTripStage('PENDING_DOCUMENTS', false), 'before');
  assertEquals(guestTripStage('PENDING_GAF', false), 'before');
  assertEquals(guestTripStage('PENDING_PET_REQUEST', false), 'before');
});

Deno.test('guestTripStage - ready for check-in is "arrival" until the stay starts', () => {
  assertEquals(guestTripStage('READY_FOR_CHECKIN', false), 'arrival');
  assertEquals(guestTripStage('READY_FOR_CHECKIN', true), 'stay');
});

Deno.test('guestTripStage - check-out day is "checkout" only inside the stay window', () => {
  assertEquals(guestTripStage('READY_FOR_CHECKOUT', true), 'checkout');
  assertEquals(guestTripStage('READY_FOR_CHECKOUT', false), 'after');
});

Deno.test('guestTripStage - refund, completed and cancelled are "after"', () => {
  assertEquals(guestTripStage('PENDING_SD_REFUND', false), 'after');
  assertEquals(guestTripStage('COMPLETED', false), 'after');
  assertEquals(guestTripStage('CANCELLED', true), 'after');
});

Deno.test('guestSectionVisibleAtPhase - "always" shows at every stage', () => {
  for (const stage of ['before', 'arrival', 'stay', 'checkout', 'after'] as const) {
    assertEquals(guestSectionVisibleAtPhase('always', stage), true);
  }
});

Deno.test('guestSectionVisibleAtPhase - a phase shows only at its own stage', () => {
  assertEquals(guestSectionVisibleAtPhase('arrival', 'arrival'), true);
  assertEquals(guestSectionVisibleAtPhase('arrival', 'stay'), false);
  assertEquals(guestSectionVisibleAtPhase('stay', 'checkout'), false);
  assertEquals(guestSectionVisibleAtPhase('before', 'after'), false);
});
