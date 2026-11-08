import { describe, expect, it } from 'vitest';

import { NOTIFICATIONS_HUB_PAGE_SUBTITLE } from '@/features/dashboard/notifications/lib/notificationsHubPageCopy';

describe('NOTIFICATIONS_HUB_PAGE_SUBTITLE', () => {
  it('is a single plain line', () => {
    expect(NOTIFICATIONS_HUB_PAGE_SUBTITLE.trim()).toBe(NOTIFICATIONS_HUB_PAGE_SUBTITLE);
    expect(NOTIFICATIONS_HUB_PAGE_SUBTITLE.length).toBeLessThanOrEqual(80);
  });

  it('follows the copy rule: no em dash or en dash', () => {
    expect(NOTIFICATIONS_HUB_PAGE_SUBTITLE).not.toMatch(/[\u2013\u2014]/);
  });
});
