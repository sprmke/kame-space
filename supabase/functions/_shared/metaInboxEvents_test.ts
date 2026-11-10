import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { platformFromMetaObject } from './metaInboxEvents.ts';

Deno.test('platformFromMetaObject: maps the webhook object to a platform', () => {
  assertEquals(platformFromMetaObject('page'), 'facebook');
  assertEquals(platformFromMetaObject('instagram'), 'instagram');
});

Deno.test('platformFromMetaObject: an unknown object is not a messaging platform', () => {
  assertEquals(platformFromMetaObject('instagram_account'), null);
  assertEquals(platformFromMetaObject('whatsapp'), null);
  assertEquals(platformFromMetaObject(undefined), null);
});

Deno.test('platformFromMetaObject: does not guess from a recipient id', () => {
  // A Facebook Page id and a guest id can both start with 17. The old code used that
  // prefix, so Messenger messages and Business Suite echoes were filed under Instagram.
  assertEquals(platformFromMetaObject('page'), 'facebook');
});
