import { describe, expect, it } from 'vitest';

import {
  planLimitedTeamBannerMessage,
  planLimitedAccessDeniedTitle,
  planLimitedAccessDeniedMessage,
} from '@/features/dashboard/team/lib/planLimitedTeamCopy';

describe('planLimitedTeamBannerMessage', () => {
  it('explains seat limit for one or many members', () => {
    expect(planLimitedTeamBannerMessage(1)).toContain('1 member is paused');
    expect(planLimitedTeamBannerMessage(3)).toContain('3 members are paused');
  });
});

describe('planLimitedAccessDeniedTitle', () => {
  it('uses Access paused', () => {
    expect(planLimitedAccessDeniedTitle()).toBe('Access paused');
  });
});

describe('planLimitedAccessDeniedMessage', () => {
  it('explains plan limit or downgrade without leaking other tenants', () => {
    expect(planLimitedAccessDeniedMessage('property')).toContain('plan limit or downgrade');
    expect(planLimitedAccessDeniedMessage('org')).toContain('organization owner');
  });
});
