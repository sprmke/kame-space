import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  deriveReplyStatusFromMetaMessages,
  latestInboundMessageAt,
} from './metaInboxBackfill.ts';

const PAGE_ID = '100000000000000';
const IG_ID = '17841400000000000';

Deno.test('deriveReplyStatusFromMetaMessages: an Instagram account reply is outbound', () => {
  const selfIds = new Set([PAGE_ID, IG_ID]);
  const messages = [
    { from: { id: 'GUEST_PSID' }, created_time: '2026-11-10T01:00:00.000Z' },
    { from: { id: IG_ID }, created_time: '2026-11-10T02:00:00.000Z' },
  ];
  assertEquals(deriveReplyStatusFromMetaMessages(messages, selfIds), 'replied');
});

Deno.test('deriveReplyStatusFromMetaMessages: a guest message leaves the thread pending', () => {
  const selfIds = new Set([PAGE_ID, IG_ID]);
  const messages = [
    { from: { id: IG_ID }, created_time: '2026-11-10T01:00:00.000Z' },
    { from: { id: 'GUEST_PSID' }, created_time: '2026-11-10T02:00:00.000Z' },
  ];
  assertEquals(deriveReplyStatusFromMetaMessages(messages, selfIds), 'pending');
});

Deno.test('deriveReplyStatusFromMetaMessages: an empty thread has no status', () => {
  assertEquals(deriveReplyStatusFromMetaMessages([], new Set([PAGE_ID])), 'none');
});

Deno.test('latestInboundMessageAt: ignores replies from the account itself', () => {
  const selfIds = new Set([PAGE_ID, IG_ID]);
  const messages = [
    { from: { id: 'GUEST_PSID' }, created_time: '2026-11-10T01:00:00.000Z' },
    { from: { id: IG_ID }, created_time: '2026-11-10T02:00:00.000Z' },
  ];
  assertEquals(latestInboundMessageAt(messages, selfIds), '2026-11-10T01:00:00.000Z');
});

Deno.test('latestInboundMessageAt: null when the account spoke last', () => {
  const selfIds = new Set([PAGE_ID, IG_ID]);
  const messages = [{ from: { id: IG_ID }, created_time: '2026-11-10T02:00:00.000Z' }];
  assertEquals(latestInboundMessageAt(messages, selfIds), null);
});
