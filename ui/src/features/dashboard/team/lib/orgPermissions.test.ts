import { describe, expect, it } from 'vitest';

import {
  hasOrgPermission,
  orgSectionPath,
  canAccessOrgScope,
  ORG_SECTION_VIEW_PERMISSION,
} from '@/features/dashboard/team/lib/orgPermissions';

describe('hasOrgPermission', () => {
  it('accepts a leaf granted through a legacy coarse id', () => {
    expect(hasOrgPermission(['org:settings:edit'], 'org.settings.basic:edit')).toBe(true);
    expect(hasOrgPermission(['org:team:invite'], 'org.team.invitations:add')).toBe(true);
  });

  it('requires every leaf a coarse requirement expands to', () => {
    // Fixed in #366: one leaf used to pass a coarse check.
    expect(hasOrgPermission(['org.team.invitations:edit'], 'org:team:manage')).toBe(false);
    expect(
      hasOrgPermission(
        [
          'org.team.invitations:edit',
          'org.team.invitations:delete',
          'org.team.members:edit',
          'org.team.members:delete',
        ],
        'org:team:manage'
      )
    ).toBe(true);
    expect(hasOrgPermission(['org:team:manage'], 'org:team:manage')).toBe(true);
  });

  it('grants nothing when the requirement expands to nothing', () => {
    expect(hasOrgPermission(['org:delete'], 'org:delete')).toBe(false);
    expect(hasOrgPermission(undefined, 'org:delete')).toBe(false);
  });

  it('treats missing permissions as empty', () => {
    expect(hasOrgPermission(undefined, 'org.dashboard:view')).toBe(false);
    expect(hasOrgPermission([], 'org.dashboard:view')).toBe(false);
  });
});

describe('orgSectionPath', () => {
  it('orgSectionPath is exported', () => {
    expect(typeof orgSectionPath).toBe('function');
  });
});

describe('canAccessOrgScope', () => {
  it('canAccessOrgScope is exported', () => {
    expect(typeof canAccessOrgScope).toBe('function');
  });
});

describe('ORG_SECTION_VIEW_PERMISSION', () => {
  it('is defined', () => {
    expect(ORG_SECTION_VIEW_PERMISSION).toBeDefined();
  });
});
