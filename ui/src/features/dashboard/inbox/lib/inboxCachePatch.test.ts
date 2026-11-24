import { describe, expect, it } from 'vitest';

import {
  conversationMatchesThreadFilters,
  patchMessageRows,
  patchThreadRows,
  readInboxThreadFilters,
} from './inboxCachePatch';
import type { InboxConversation, InboxMessage } from '@/features/dashboard/inbox/types/inbox';

function thread(id: string, lastMessageAt: string, preview = id): InboxConversation {
  return { id, last_message_at: lastMessageAt, subject_preview: preview } as InboxConversation;
}

function message(id: string, sentAt: string, body = id): InboxMessage {
  return {
    id,
    conversation_id: 'c1',
    direction: 'inbound',
    body_text: body,
    sent_at: sentAt,
    attachments: [],
    delivery_status: 'sent',
    is_ai_generated: false,
  } as InboxMessage;
}

function threadsData(...conversations: InboxConversation[]) {
  return { pages: [{ conversations }], pageParams: [null] };
}

function messagesData(...messages: InboxMessage[]) {
  return { pages: [{ messages }], pageParams: [undefined] };
}

describe('patchThreadRows', () => {
  it('replaces an existing thread in place and keeps its position', () => {
    const data = threadsData(
      thread('a', '2026-11-10T10:00:00Z'),
      thread('b', '2026-11-10T09:00:00Z')
    );
    const patched = patchThreadRows(data, [thread('b', '2026-11-10T09:00:00Z', 'new preview')]);
    expect(patched!.pages[0]!.conversations.map((row) => row.id)).toEqual(['a', 'b']);
    expect(patched!.pages[0]!.conversations[1]!.subject_preview).toBe('new preview');
  });

  it('inserts a never-seen thread and sorts it to the top', () => {
    const data = threadsData(thread('a', '2026-11-10T10:00:00Z'));
    const patched = patchThreadRows(data, [thread('new', '2026-11-10T11:00:00Z')]);
    expect(patched!.pages[0]!.conversations.map((row) => row.id)).toEqual(['new', 'a']);
  });

  it('returns the input untouched when there is nothing to apply', () => {
    const data = threadsData(thread('a', '2026-11-10T10:00:00Z'));
    expect(patchThreadRows(data, [])).toBe(data);
    expect(patchThreadRows(undefined, [thread('a', '2026-11-10T10:00:00Z')])).toBeUndefined();
  });

  it('does not resurrect a mock row', () => {
    const data = threadsData(thread('a', '2026-11-10T10:00:00Z'));
    const patched = patchThreadRows(data, [thread('mock-1', '2026-11-10T11:00:00Z')]);
    expect(patched!.pages[0]!.conversations.map((row) => row.id)).toEqual(['a']);
  });
});

describe('patchMessageRows', () => {
  it('patches a read receipt without reordering', () => {
    const data = messagesData(
      message('m1', '2026-11-10T10:00:00Z'),
      message('m2', '2026-11-10T10:01:00Z')
    );
    const read = { ...message('m1', '2026-11-10T10:00:00Z'), read_at: '2026-11-10T10:05:00Z' };
    const patched = patchMessageRows(data, [read]);
    expect(patched!.pages[0]!.messages.map((row) => row.id)).toEqual(['m1', 'm2']);
    expect(patched!.pages[0]!.messages[0]!.read_at).toBe('2026-11-10T10:05:00Z');
  });

  it('inserts a new message in send order', () => {
    const data = messagesData(message('m1', '2026-11-10T10:00:00Z'));
    const patched = patchMessageRows(data, [
      message('m3', '2026-11-10T10:03:00Z'),
      message('m2', '2026-11-10T10:02:00Z'),
    ]);
    expect(patched!.pages[0]!.messages.map((row) => row.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('is idempotent: applying the same delta twice changes nothing', () => {
    const data = messagesData(message('m1', '2026-11-10T10:00:00Z'));
    const once = patchMessageRows(data, [message('m2', '2026-11-10T10:01:00Z')]);
    const twice = patchMessageRows(once, [message('m2', '2026-11-10T10:01:00Z')]);
    expect(twice!.pages[0]!.messages.map((row) => row.id)).toEqual(['m1', 'm2']);
  });

  it('returns the input untouched when there is nothing to apply', () => {
    const data = messagesData(message('m1', '2026-11-10T10:00:00Z'));
    expect(patchMessageRows(data, [])).toBe(data);
    expect(patchMessageRows(undefined, [message('m1', '2026-11-10T10:00:00Z')])).toBeUndefined();
  });
});

describe('readInboxThreadFilters', () => {
  it('finds the filter object in a threads query key', () => {
    const filters = { status: 'unread', platform: 'facebook', search: 'maria' };
    expect(
      readInboxThreadFilters(['inbox-threads', 'org', 'id', { propertyId: 'p' }, filters, false])
    ).toEqual(filters);
  });

  it('returns null when the key carries no filter object', () => {
    expect(readInboxThreadFilters(['inbox-threads', 'org', 'id'])).toBeNull();
  });
});

describe('conversationMatchesThreadFilters', () => {
  const row = {
    id: 'c1',
    platform: 'web',
    unread_count: 2,
    reply_status: 'pending',
    participant_name: 'Carlo Mendoza',
    subject_preview: 'Can you waive the pet fee?',
  } as InboxConversation;

  it('accepts everything with no filters', () => {
    expect(conversationMatchesThreadFilters(row, null)).toBe(true);
    expect(conversationMatchesThreadFilters(row, {})).toBe(true);
  });

  it('rejects another platform', () => {
    expect(conversationMatchesThreadFilters(row, { platform: 'facebook' })).toBe(false);
    expect(conversationMatchesThreadFilters(row, { platform: 'web' })).toBe(true);
  });

  it('applies the status filter', () => {
    expect(conversationMatchesThreadFilters(row, { status: 'unread' })).toBe(true);
    expect(
      conversationMatchesThreadFilters({ ...row, unread_count: 0 }, { status: 'unread' })
    ).toBe(false);
    expect(conversationMatchesThreadFilters(row, { status: 'pending' })).toBe(true);
    expect(conversationMatchesThreadFilters(row, { status: 'replied' })).toBe(false);
  });

  it('matches search against the name and preview, case-insensitively', () => {
    expect(conversationMatchesThreadFilters(row, { search: 'carlo' })).toBe(true);
    expect(conversationMatchesThreadFilters(row, { search: 'PET FEE' })).toBe(true);
    expect(conversationMatchesThreadFilters(row, { search: 'maria' })).toBe(false);
  });
});

describe('patchThreadRows with list filters', () => {
  it('does not insert a fresh row that the list filters exclude', () => {
    const data = threadsData(thread('a', '2026-11-10T10:00:00Z'));
    const patched = patchThreadRows(
      data,
      [{ ...thread('web', '2026-11-10T11:00:00Z'), platform: 'web' } as InboxConversation],
      { matches: (row) => row.platform === 'facebook' }
    );
    expect(patched!.pages[0]!.conversations.map((row) => row.id)).toEqual(['a']);
  });

  it('drops an updated row once it no longer matches', () => {
    const data = threadsData({
      ...thread('a', '2026-11-10T10:00:00Z'),
      platform: 'facebook',
      reply_status: 'pending',
    } as InboxConversation);
    const patched = patchThreadRows(
      data,
      [
        {
          ...thread('a', '2026-11-10T10:00:00Z'),
          platform: 'facebook',
          reply_status: 'replied',
        } as InboxConversation,
      ],
      { matches: (row) => row.reply_status === 'pending' }
    );
    expect(patched!.pages[0]!.conversations).toEqual([]);
  });
});
