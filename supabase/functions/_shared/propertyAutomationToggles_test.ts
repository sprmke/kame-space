/**
 * Property automation toggles — key contract + merge behaviour.
 * Run: deno test supabase/functions/_shared/propertyAutomationToggles_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  DEFAULT_PROPERTY_AUTOMATION_TOGGLES,
  mergePropertyAutomationToggles,
  parsePropertyAutomationTogglesPatch,
  PLAN_GATED_AUTOMATION_TOGGLE_KEYS,
  PROPERTY_AUTOMATION_TOGGLE_KEYS,
} from './propertyAutomationToggles.ts';

Deno.test('property automation keys - 12 keys, retired parking broadcast removed', () => {
  assertEquals(PROPERTY_AUTOMATION_TOGGLE_KEYS.length, 12);
  assertEquals(PROPERTY_AUTOMATION_TOGGLE_KEYS.includes('emailParkingBroadcast' as never), false);
});

Deno.test(
  'plan-gated property toggles - 5 keys, guest check-in and SD refund emails stay free',
  () => {
    assertEquals(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.length, 5);
    assertEquals(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.includes('emailNewBookingRequest'), false);
    assertEquals(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.includes('emailReviewRequest'), false);
    assertEquals(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.includes('emailGafRequest'), true);
    // BIL-01: a downgrade must never silence a guest who already booked.
    assertEquals(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.includes('emailReadyForCheckin'), false);
    assertEquals(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.includes('emailSdRefundCheckout'), false);
  }
);

Deno.test('mergePropertyAutomationToggles - ignores unknown stored keys', () => {
  const merged = mergePropertyAutomationToggles({
    emailParkingBroadcast: false,
    emailGafRequest: false,
  });
  assertEquals('emailParkingBroadcast' in merged, false);
  assertEquals(merged.emailGafRequest, false);
  assertEquals(merged.emailNewBookingRequest, true);
  assertEquals(merged.emailPreArrivalReminder, true);
  assertEquals(Object.keys(merged).length, 12);
});

Deno.test('mergePropertyAutomationToggles - defaults when raw is junk', () => {
  assertEquals(mergePropertyAutomationToggles(null), DEFAULT_PROPERTY_AUTOMATION_TOGGLES);
  assertEquals(mergePropertyAutomationToggles([]), DEFAULT_PROPERTY_AUTOMATION_TOGGLES);
  assertEquals(mergePropertyAutomationToggles('x'), DEFAULT_PROPERTY_AUTOMATION_TOGGLES);
});

Deno.test('parsePropertyAutomationTogglesPatch - ignores retired key', () => {
  const patch = parsePropertyAutomationTogglesPatch({
    emailParkingBroadcast: true,
    emailReadyForCheckin: false,
  });
  assertEquals(patch, { emailReadyForCheckin: false });
  assertEquals(parsePropertyAutomationTogglesPatch({ emailParkingBroadcast: true }), null);
});
