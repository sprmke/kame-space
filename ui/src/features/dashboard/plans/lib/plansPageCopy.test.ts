import { describe, expect, it } from 'vitest';

import { PLANS_PAGE_SUBTITLE } from '@/features/dashboard/plans/lib/plansPageCopy';

describe('PLANS_PAGE_SUBTITLE', () => {
  it('is one plain sentence', () => {
    expect(PLANS_PAGE_SUBTITLE.trim()).toBe(PLANS_PAGE_SUBTITLE);
    expect(PLANS_PAGE_SUBTITLE.length).toBeLessThanOrEqual(160);
  });

  it('follows the copy rule: no em dash or en dash', () => {
    expect(PLANS_PAGE_SUBTITLE).not.toMatch(/[\u2013\u2014]/);
  });
});
