import { describe, expect, it } from 'vitest';

import {
  CLAMPED_NOTICE,
  noticeForFailure,
} from '@/features/dashboard/marketing/lib/video/v2/opNotices';

describe('noticeForFailure', () => {
  it('explains every refusal that a host can act on', () => {
    expect(noticeForFailure('locked')).toContain('locked');
    expect(noticeForFailure('item_limit')).toContain('150');
    expect(noticeForFailure('track_limit')).toContain('10');
    expect(noticeForFailure('duration_limit')).toContain('60');
    expect(noticeForFailure('no_room')).toBeTruthy();
    expect(noticeForFailure('incompatible')).toBeTruthy();
  });

  it('stays quiet for refusals that need no message', () => {
    expect(noticeForFailure('not_found')).toBeNull();
    expect(noticeForFailure('invalid')).toBeNull();
    expect(noticeForFailure(undefined)).toBeNull();
  });

  it('has a clamp notice for the 60 second cap', () => {
    expect(CLAMPED_NOTICE).toContain('60');
  });
});
