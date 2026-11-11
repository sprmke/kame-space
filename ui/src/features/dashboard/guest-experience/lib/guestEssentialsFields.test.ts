import { describe, expect, it } from 'vitest';

import {
  changedEssentialsFields,
  ESSENTIALS_FIELDS,
  ESSENTIALS_FIELD_KEYS,
  ESSENTIALS_GROUPS,
  guestEssentialsEqual,
} from '@/features/dashboard/guest-experience/lib/guestEssentialsFields';

function blank() {
  return Object.fromEntries(ESSENTIALS_FIELD_KEYS.map((key) => [key, ''])) as Record<
    (typeof ESSENTIALS_FIELD_KEYS)[number],
    string
  >;
}

describe('essentials field catalog', () => {
  it('lists every field exactly once across the groups', () => {
    const grouped = ESSENTIALS_GROUPS.flatMap((group) => group.fields.map((f) => f.key));
    expect(grouped.sort()).toEqual([...ESSENTIALS_FIELD_KEYS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('marks the Wi-Fi password and door code as secrets', () => {
    expect(ESSENTIALS_FIELDS.wifiPassword.secret).toBe(true);
    expect(ESSENTIALS_FIELDS.doorCode.secret).toBe(true);
    expect(ESSENTIALS_FIELDS.wifiName.secret).toBeUndefined();
  });

  it('gives every field a label and a placeholder', () => {
    for (const key of ESSENTIALS_FIELD_KEYS) {
      expect(ESSENTIALS_FIELDS[key].label.trim()).not.toBe('');
      expect(ESSENTIALS_FIELDS[key].placeholder.trim()).not.toBe('');
    }
  });

  it('marks the phone fields as tel inputs', () => {
    expect(ESSENTIALS_FIELDS.emergencyContactPhone.phone).toBe(true);
    expect(ESSENTIALS_FIELDS.buildingSecurityPhone.phone).toBe(true);
  });
});

describe('changedEssentialsFields', () => {
  it('returns nothing when the drafts match', () => {
    expect(changedEssentialsFields(blank(), blank())).toEqual([]);
  });

  it('returns only the keys that differ', () => {
    const baseline = blank();
    const draft = { ...blank(), doorCode: '4821', quietHours: '10pm' };
    expect(changedEssentialsFields(baseline, draft)).toEqual(['doorCode', 'quietHours']);
  });

  it('treats clearing a field as a change', () => {
    const baseline = { ...blank(), wifiName: 'Kame' };
    expect(changedEssentialsFields(baseline, blank())).toEqual(['wifiName']);
  });
});

describe('guestEssentialsEqual', () => {
  it('is true for identical drafts', () => {
    expect(guestEssentialsEqual({ ...blank(), revealLeadHours: 24 }, { ...blank(), revealLeadHours: 24 })).toBe(true);
  });

  it('is false when only the reveal lead differs', () => {
    expect(guestEssentialsEqual({ ...blank(), revealLeadHours: 24 }, { ...blank(), revealLeadHours: 48 })).toBe(false);
  });

  it('is false when a field differs', () => {
    expect(
      guestEssentialsEqual({ ...blank(), revealLeadHours: 24 }, { ...blank(), wifiName: 'x', revealLeadHours: 24 })
    ).toBe(false);
  });
});
