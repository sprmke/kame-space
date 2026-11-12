import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  META_WEBHOOK_BACKOFF_SECONDS,
  META_WEBHOOK_MAX_ATTEMPTS,
  messageKindFor,
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

Deno.test('messageKindFor: postbacks and unsupported events win over attachments', () => {
  assertEquals(messageKindFor({}, true, 'postback'), 'postback');
  assertEquals(messageKindFor({}, false, 'unsupported'), 'unsupported');
});

Deno.test('messageKindFor: story replies, shares and stickers get a display kind', () => {
  assertEquals(
    messageKindFor({ attachments: [{ type: 'story_mention' }] }, false, 'message'),
    'story_reply'
  );
  assertEquals(
    messageKindFor({ attachments: [{ type: 'share' }] }, false, 'message'),
    'share'
  );
  // A plain image or a sticker is still text-shaped: the media tile renders it.
  assertEquals(
    messageKindFor({ attachments: [{ type: 'image' }] }, false, 'message'),
    'text'
  );
});

Deno.test('messageKindFor: an unsupported type with readable text stays text', () => {
  // Meta marks some messages `fallback` but still sends the body, and a body beats a card.
  assertEquals(
    messageKindFor({ attachments: [{ type: 'fallback' }], text: 'see you at 3' }, false, 'message'),
    'text'
  );
  assertEquals(
    messageKindFor({ attachments: [{ type: 'fallback' }] }, false, 'message'),
    'unsupported'
  );
});
