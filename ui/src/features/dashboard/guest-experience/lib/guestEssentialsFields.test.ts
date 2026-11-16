import { describe, expect, it } from 'vitest';

import {
  changedEssentialsFields,
  ESSENTIALS_EDITABLE_KEYS,
  ESSENTIALS_FIELDS,
  ESSENTIALS_FIELD_KEYS,
  ESSENTIALS_GROUPS,
  guestEssentialsEqual,
  summarizeGuestEssentials,
} from '@/features/dashboard/guest-experience/lib/guestEssentialsFields';

function blank() {
  return Object.fromEntries(ESSENTIALS_FIELD_KEYS.map((key) => [key, ''])) as Record<
    (typeof ESSENTIALS_FIELD_KEYS)[number],
    string
  >;
}

describe('essentials field catalog', () => {
  it('lists editable fields once across the groups and keeps quiet hours off the editor', () => {
    const grouped = ESSENTIALS_GROUPS.flatMap((group) => group.fields.map((f) => f.key));
    expect(grouped.sort()).toEqual([...ESSENTIALS_EDITABLE_KEYS].sort());
    expect(grouped).not.toContain('quietHours');
    expect(ESSENTIALS_FIELD_KEYS).toContain('quietHours');
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
    expect(
      guestEssentialsEqual({ ...blank(), revealLeadHours: 24 }, { ...blank(), revealLeadHours: 24 })
    ).toBe(true);
  });

  it('is false when only the reveal lead differs', () => {
    expect(
      guestEssentialsEqual({ ...blank(), revealLeadHours: 24 }, { ...blank(), revealLeadHours: 48 })
    ).toBe(false);
  });

  it('is false when a field differs', () => {
    expect(
      guestEssentialsEqual(
        { ...blank(), revealLeadHours: 24 },
        { ...blank(), wifiName: 'x', revealLeadHours: 24 }
      )
    ).toBe(false);
  });
});

describe('summarizeGuestEssentials', () => {
  it('flags empty when no core arrival fields are set', () => {
    const summary = summarizeGuestEssentials({ ...blank(), revealLeadHours: 24 });
    expect(summary.empty).toBe(true);
    expect(summary.needsAttention).toBe(true);
  });

  it('lists filled chips and uses the listing unit when essentials unit is blank', () => {
    const summary = summarizeGuestEssentials(
      { ...blank(), wifiName: 'Kame_2604', doorCode: '4821', revealLeadHours: 24 },
      'Monaco 2604'
    );
    expect(summary.empty).toBe(false);
    expect(summary.chips.some((chip) => chip.includes('Wi-Fi'))).toBe(true);
    expect(summary.chips).toContain('Door code');
    expect(summary.chips).toContain('Monaco 2604');
    expect(summary.chips).toContain('Reveal 24h');
  });
});
