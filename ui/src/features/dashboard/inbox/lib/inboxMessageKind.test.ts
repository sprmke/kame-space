import { describe, expect, it } from 'vitest';

import { inboxMessageKindLabel } from './inboxMessageKind';

describe('inboxMessageKindLabel', () => {
  it('names a story reply and a shared post', () => {
    expect(inboxMessageKindLabel('story_reply', false)).toBe('Replied to a story');
    expect(inboxMessageKindLabel('share', false)).toBe('Shared a post');
  });

  it('explains an unsupported type instead of showing a bare attachment', () => {
    expect(inboxMessageKindLabel('unsupported', false)).toBe('This message only opens in Meta');
  });

  it('stays out of the way when the message has text', () => {
    // A body always beats a card: Meta marks some messages unsupported but still sends text.
    expect(inboxMessageKindLabel('unsupported', true)).toBeNull();
    expect(inboxMessageKindLabel('story_reply', true)).toBeNull();
  });

  it('returns null for kinds that the media tile already covers', () => {
    expect(inboxMessageKindLabel('text', false)).toBeNull();
    expect(inboxMessageKindLabel('postback', false)).toBeNull();
    expect(inboxMessageKindLabel(undefined, false)).toBeNull();
  });
});
