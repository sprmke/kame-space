import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { webGuestConversationLookup } from './webGuestThreadLookup.ts';

Deno.test('webGuestConversationLookup prefers the parking scope', () => {
  assertEquals(
    webGuestConversationLookup({
      platform: 'web',
      guest_user_id: 'guest-1',
      property_id: 'property-1',
      parking_id: 'parking-1',
    }),
    { column: 'parking_id', value: 'parking-1' }
  );
});

Deno.test('webGuestConversationLookup uses the property scope for a property chat', () => {
  assertEquals(
    webGuestConversationLookup({
      platform: 'web',
      guest_user_id: 'guest-1',
      property_id: 'property-1',
      parking_id: null,
    }),
    { column: 'property_id', value: 'property-1' }
  );
});

Deno.test('webGuestConversationLookup ignores non-web threads', () => {
  assertEquals(
    webGuestConversationLookup({
      platform: 'facebook',
      guest_user_id: 'guest-1',
      property_id: 'property-1',
    }),
    null
  );
});

Deno.test('webGuestConversationLookup needs a guest and a scope', () => {
  assertEquals(
    webGuestConversationLookup({ platform: 'web', property_id: 'property-1' }),
    null
  );
  assertEquals(
    webGuestConversationLookup({ platform: 'web', guest_user_id: 'guest-1' }),
    null
  );
});
