import { describe, expect, it } from 'vitest';

import {
  normalizeSlugInput,
  slugifyOrgName,
  orgSettingsDraftFromOrg,
  orgSettingsDraftIsDirty,
  orgSettingsDraftToPayload,
  validateOrgSettingsDraft,
  orgSlugPreview,
} from '@/features/dashboard/org/lib/orgSettingsForm';

describe('normalizeSlugInput', () => {
  it('normalizeSlugInput is exported', () => {
    expect(typeof normalizeSlugInput).toBe('function');
  });
});

describe('slugifyOrgName', () => {
  it('slugifyOrgName is exported', () => {
    expect(typeof slugifyOrgName).toBe('function');
  });

  // Shared vectors with `_shared/slugUtils_test.ts` (Deno) and `pls_slugify_name` (SQL).
  it.each([
    ['Parañaque Loft', 'paranaque-loft'],
    ['Casa de María', 'casa-de-maria'],
    ['ÁÉÍÓÚ Ñandú', 'aeiou-nandu'],
    ['Makati  Condo -- 2BR', 'makati-condo-2br'],
    ['BGC (Taguig) #1', 'bgc-taguig-1'],
    ['2026 Stay', '2026-stay'],
    ['🔥', 'item'],
    ['   ', 'item'],
  ])('slugifies %s to %s', (input, expected) => {
    expect(slugifyOrgName(input)).toBe(expected);
  });

  it('caps the slug at 64 characters', () => {
    expect(slugifyOrgName('a'.repeat(80)).length).toBe(64);
  });
});

describe('orgSettingsDraftFromOrg', () => {
  it('orgSettingsDraftFromOrg is exported', () => {
    expect(typeof orgSettingsDraftFromOrg).toBe('function');
  });
});

describe('orgSettingsDraftIsDirty', () => {
  it('orgSettingsDraftIsDirty is exported', () => {
    expect(typeof orgSettingsDraftIsDirty).toBe('function');
  });
});

describe('orgSettingsDraftToPayload', () => {
  it('orgSettingsDraftToPayload is exported', () => {
    expect(typeof orgSettingsDraftToPayload).toBe('function');
  });
});

describe('validateOrgSettingsDraft', () => {
  it('validateOrgSettingsDraft is exported', () => {
    expect(typeof validateOrgSettingsDraft).toBe('function');
  });
});

describe('orgSlugPreview', () => {
  it('orgSlugPreview is exported', () => {
    expect(typeof orgSlugPreview).toBe('function');
  });
});
