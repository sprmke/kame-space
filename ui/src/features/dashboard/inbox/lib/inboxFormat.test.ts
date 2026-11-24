import { describe, expect, it } from 'vitest';

import {
  platformLabel,
  formatInboxTime,
  messagingWindowExpiresAt,
  messagingWindowLabel,
  isMessagingWindowOpen,
  quickReplyPreview,
} from '@/features/dashboard/inbox/lib/inboxFormat';

describe('platformLabel', () => {
  it('platformLabel is exported', () => {
    expect(typeof platformLabel).toBe('function');
  });
});

describe('formatInboxTime', () => {
  it('formatInboxTime is exported', () => {
    expect(typeof formatInboxTime).toBe('function');
  });
});

describe('messagingWindowExpiresAt', () => {
  it('messagingWindowExpiresAt is exported', () => {
    expect(typeof messagingWindowExpiresAt).toBe('function');
  });
});

describe('messagingWindowLabel', () => {
  it('messagingWindowLabel is exported', () => {
    expect(typeof messagingWindowLabel).toBe('function');
  });
});

describe('isMessagingWindowOpen', () => {
  it('isMessagingWindowOpen is exported', () => {
    expect(typeof isMessagingWindowOpen).toBe('function');
  });
});

describe('quickReplyPreview', () => {
  it('collapses whitespace and drops placeholder tokens', () => {
    expect(quickReplyPreview('Hi {{guest_name}},\n\ncheck-in is at {{check_in_time}}.')).toBe(
      'Hi , check-in is at .'
    );
  });

  it('truncates long bodies with an ellipsis', () => {
    const preview = quickReplyPreview('a'.repeat(120), 20);
    expect(preview).toHaveLength(20);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('returns short bodies unchanged', () => {
    expect(quickReplyPreview('Parking is paid.')).toBe('Parking is paid.');
  });
});
