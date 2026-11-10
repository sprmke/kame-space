import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isTransientMetaWebhookError, platformFromMetaObject } from './metaInboxEvents.ts';

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

Deno.test('isTransientMetaWebhookError: database and network failures are retryable', () => {
  assertEquals(isTransientMetaWebhookError(new Error('fetch failed')), true);
  assertEquals(isTransientMetaWebhookError(new Error('error sending request for url')), true);
  assertEquals(isTransientMetaWebhookError(new Error('connection to server reset')), true);
  assertEquals(isTransientMetaWebhookError(new Error('request timed out')), true);
  assertEquals(isTransientMetaWebhookError(new Error('connect ECONNREFUSED')), true);
  assertEquals(isTransientMetaWebhookError(new Error('upstream returned 503')), true);
});

Deno.test('isTransientMetaWebhookError: a bad event is not retryable', () => {
  assertEquals(isTransientMetaWebhookError(new Error('invalid input syntax for type uuid')), false);
  assertEquals(
    isTransientMetaWebhookError(
      new Error('duplicate key value violates unique constraint "social_messages_external"')
    ),
    false
  );
  assertEquals(isTransientMetaWebhookError(null), false);
  assertEquals(isTransientMetaWebhookError(undefined), false);
});
