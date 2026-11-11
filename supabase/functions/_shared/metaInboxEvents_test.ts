import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  classifyMetaEvent,
  flattenMetaWebhookPayload,
  platformFromMetaObject,
} from './metaInboxEvents.ts';

Deno.test('platformFromMetaObject: maps the webhook object to a platform', () => {
  assertEquals(platformFromMetaObject('page'), 'facebook');
  assertEquals(platformFromMetaObject('instagram'), 'instagram');
});

Deno.test('platformFromMetaObject: an unknown object is not a messaging platform', () => {
  assertEquals(platformFromMetaObject('instagram_account'), null);
  assertEquals(platformFromMetaObject('whatsapp'), null);
  assertEquals(platformFromMetaObject(undefined), null);
});

Deno.test('classifyMetaEvent: a guest message and an echo both key on the mid', () => {
  assertEquals(
    classifyMetaEvent('PAGE', { sender: { id: 'GUEST' }, message: { mid: 'm1', text: 'hi' } }, 'messaging'),
    { eventType: 'message', eventKey: 'msg:m1' }
  );
  assertEquals(
    classifyMetaEvent('PAGE', { sender: { id: 'PAGE' }, message: { mid: 'm1', is_echo: true } }, 'messaging'),
    { eventType: 'echo', eventKey: 'msg:m1' }
  );
});

Deno.test('classifyMetaEvent: standby shares the mid key, so it is stored once', () => {
  const messaging = classifyMetaEvent(
    'PAGE',
    { sender: { id: 'GUEST' }, message: { mid: 'm1' } },
    'messaging'
  );
  const standby = classifyMetaEvent(
    'PAGE',
    { sender: { id: 'GUEST' }, message: { mid: 'm1' } },
    'standby'
  );
  assertEquals(messaging?.eventKey, standby?.eventKey);
});

Deno.test('classifyMetaEvent: read receipts, edits, unsends and reactions', () => {
  assertEquals(
    classifyMetaEvent('PAGE', { sender: { id: 'GUEST' }, read: { watermark: 1700000000000 } }, 'messaging'),
    { eventType: 'read', eventKey: 'read:PAGE:GUEST:1700000000000' }
  );
  assertEquals(
    classifyMetaEvent('IG', { sender: { id: 'GUEST' }, read: { mid: 'm9' } }, 'messaging'),
    { eventType: 'seen', eventKey: 'seen:m9' }
  );
  assertEquals(
    classifyMetaEvent('IG', { sender: { id: 'GUEST' }, seen: { mid: 'm9' } }, 'messaging'),
    { eventType: 'seen', eventKey: 'seen:m9' }
  );
  assertEquals(
    classifyMetaEvent('IG', { sender: { id: 'GUEST' }, message: { mid: 'm2', is_deleted: true } }, 'messaging'),
    { eventType: 'unsend', eventKey: 'del:m2' }
  );
  assertEquals(
    classifyMetaEvent(
      'IG',
      { sender: { id: 'GUEST' }, reaction: { mid: 'm3', action: 'react', emoji: '❤' }, timestamp: 5 },
      'messaging'
    ),
    { eventType: 'reaction', eventKey: 'react:m3:GUEST:react:❤:5' }
  );
  assertEquals(
    classifyMetaEvent('PAGE', { sender: { id: 'GUEST' }, edited_message: { mid: 'm4' }, timestamp: 7 }, 'messaging'),
    { eventType: 'edit', eventKey: 'edit:m4:7' }
  );
});

Deno.test('classifyMetaEvent: a postback without a mid gets a stable payload hash', () => {
  const event = { sender: { id: 'GUEST' }, postback: { title: 'Book a stay', payload: 'BOOK' }, timestamp: 11 };
  const first = classifyMetaEvent('PAGE', event, 'messaging');
  const second = classifyMetaEvent('PAGE', event, 'messaging');
  assertEquals(first?.eventType, 'postback');
  assertEquals(first?.eventKey, second?.eventKey);
  assertStringIncludes(first!.eventKey, 'pb:GUEST:11:');
});

Deno.test('classifyMetaEvent: an event with no usable key is dropped', () => {
  assertEquals(classifyMetaEvent('PAGE', {}, 'messaging'), null);
  assertEquals(classifyMetaEvent('PAGE', { read: { watermark: 1 } }, 'messaging'), null);
});

Deno.test('flattenMetaWebhookPayload: reads messaging and standby into one list', () => {
  const { events, skipped } = flattenMetaWebhookPayload(
    {
      object: 'page',
      entry: [
        {
          id: 'PAGE',
          messaging: [
            { sender: { id: 'GUEST' }, message: { mid: 'm1' }, timestamp: 100 },
            { sender: { id: 'GUEST' }, read: { watermark: 200 }, timestamp: 100 },
          ],
          standby: [{ sender: { id: 'GUEST' }, message: { mid: 'm2' }, timestamp: 101 }],
        },
      ],
    },
    'facebook'
  );
  assertEquals(skipped, 0);
  assertEquals(events.length, 3);
  assertEquals(events[0]!.channel, 'messaging');
  assertEquals(events[2]!.channel, 'standby');
  assertEquals(events[0]!.platform, 'facebook');
  assertEquals(events[0]!.eventTime, '1970-01-01T00:01:40.000Z');
});

Deno.test('flattenMetaWebhookPayload: a delivery receipt is kept, not mistaken for a message', () => {
  const { events } = flattenMetaWebhookPayload(
    {
      object: 'page',
      entry: [
        {
          id: 'PAGE',
          messaging: [{ sender: { id: 'GUEST' }, delivery: { mids: ['m1'] }, timestamp: 100 }],
        },
      ],
    },
    'facebook'
  );
  assertEquals(events.length, 1);
  assertEquals(events[0]!.eventType, 'delivery');
});
