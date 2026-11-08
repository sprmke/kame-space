import { describe, expect, it } from 'vitest';

import { CHAT_MESSAGE_MAX_CHARS } from '@/lib/chat/messageLimits';

describe('CHAT_MESSAGE_MAX_CHARS', () => {
  it('is a real cap, so a bad edit cannot block every message', () => {
    expect(Number.isSafeInteger(CHAT_MESSAGE_MAX_CHARS)).toBe(true);
    expect(CHAT_MESSAGE_MAX_CHARS).toBeGreaterThan(0);
  });

  it('stays small enough to fit a chat turn', () => {
    expect(CHAT_MESSAGE_MAX_CHARS).toBeLessThanOrEqual(20_000);
  });
});
