import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  META_WEBHOOK_BACKOFF_SECONDS,
  META_WEBHOOK_MAX_ATTEMPTS,
  metaWebhookBackoffSeconds,
} from './metaInboxProcessor.ts';

Deno.test('metaWebhookBackoffSeconds: walks the ladder then gives up', () => {
  assertEquals(metaWebhookBackoffSeconds(1), META_WEBHOOK_BACKOFF_SECONDS[0]);
  assertEquals(metaWebhookBackoffSeconds(2), META_WEBHOOK_BACKOFF_SECONDS[1]);
  assertEquals(metaWebhookBackoffSeconds(5), META_WEBHOOK_BACKOFF_SECONDS[4]);
  assertEquals(metaWebhookBackoffSeconds(META_WEBHOOK_MAX_ATTEMPTS), null);
  assertEquals(metaWebhookBackoffSeconds(META_WEBHOOK_MAX_ATTEMPTS + 3), null);
});

Deno.test('metaWebhookBackoffSeconds: the ladder is bounded and monotonic', () => {
  const ladder = [...META_WEBHOOK_BACKOFF_SECONDS];
  assertEquals(ladder.length >= 4, true);
  for (let i = 1; i < ladder.length; i++) {
    assertEquals(ladder[i]! > ladder[i - 1]!, true);
  }
  assertEquals(ladder[ladder.length - 1]! <= 24 * 3600, true);
});
