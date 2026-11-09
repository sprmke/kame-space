import { describe, expect, it } from 'vitest';

import {
  GENERIC_RESIDENCE_PROFILE,
  RESIDENCE_COPY_DEFAULTS,
  RESIDENCE_FIELD_POLICY,
  parseResidenceProfile,
  resolveCopy,
  resolvePropertyValue,
  resolveTerm,
} from './residenceProfile';

describe('parseResidenceProfile', () => {
  it('returns the generic profile for a null row and never invent Azure values', () => {
    const profile = parseResidenceProfile(null);

    expect(profile.developmentId).toBeNull();
    expect(profile.developmentName).toBeNull();
    expect(profile.approvals.documentRequirements).toEqual([]);
    expect(profile.approvals.pmoEmail).toBeNull();
    expect(profile.structure.propertyTowers).toEqual([]);
    expect(profile.structure.towerLabel).toBe('Tower');
  });

  it('is total for malformed settings', () => {
    for (const settings of ['nope', 42, [], { stay: 'x', occupancy: [], structure: 7 }]) {
      const profile = parseResidenceProfile({ id: 'dev-1', name: 'Somewhere', settings });
      expect(profile.stay.checkInTime).toBe(GENERIC_RESIDENCE_PROFILE.stay.checkInTime);
      expect(profile.occupancy.maxAdultsCap).toBe(GENERIC_RESIDENCE_PROFILE.occupancy.maxAdultsCap);
      expect(profile.structure.propertyTowers).toEqual([]);
    }
  });

  it('clamps a cap above MAX_GUESTS', () => {
    const profile = parseResidenceProfile({
      id: 'dev-1',
      settings: { occupancy: { maxAdultsCap: 99 } },
    });

    expect(profile.occupancy.maxAdultsCap).toBe(5);
  });

  it('reads the flat v1 pmoEmail key so existing rows keep working', () => {
    const profile = parseResidenceProfile({
      id: 'dev-1',
      settings: { pmoEmail: 'pm o@example.com' },
    });

    expect(profile.approvals.pmoEmail).toBe('pm o@example.com');
  });

  it('parses towers from strings and from objects', () => {
    const profile = parseResidenceProfile({
      id: 'dev-1',
      settings: {
        structure: {
          propertyTowers: ['Monaco', { name: 'Bali', code: 'BA', active: false }],
          parkingTowers: [{ name: 'Bay', code: 'BY', levels: ['G'], parkingType: 'outside_tower' }],
        },
      },
    });

    expect(profile.structure.propertyTowers).toEqual([
      { name: 'Monaco', code: 'Monaco', active: true },
      { name: 'Bali', code: 'BA', active: false },
    ]);
    expect(profile.structure.parkingTowers[0]).toEqual({
      name: 'Bay',
      code: 'BY',
      active: true,
      levels: ['G'],
      parkingType: 'outside_tower',
    });
  });

  it('keeps the existing document requirement list', () => {
    const requirements = [
      {
        id: 'gaf',
        label: 'GAF Request',
        order: 1,
        pdfTemplateId: 'gaf',
        approvalSource: 'email-listener',
        triggerCondition: 'always',
        calendarIcon: null,
      },
    ];
    const profile = parseResidenceProfile({
      id: 'dev-1',
      settings: { workflowDefaults: { documentRequirements: requirements } },
    });

    expect(profile.approvals.documentRequirements).toEqual(requirements);
  });
});

describe('resolvePropertyValue', () => {
  it('clamps a property value above the building cap and flags it', () => {
    const profile = parseResidenceProfile({
      id: 'dev-1',
      settings: { occupancy: { maxAdultsCap: 4 } },
    });

    const resolved = resolvePropertyValue('occupancy.maxAdults', profile, { maxAdults: 8 });

    expect(resolved.value).toBe(4);
    expect(resolved.cap).toBe(4);
    expect(resolved.clamped).toBe(true);
    expect(resolved.source).toBe('residence');
  });

  it('uses the property value when it is inside the cap', () => {
    const profile = parseResidenceProfile({
      id: 'dev-1',
      settings: { occupancy: { maxAdultsCap: 4 } },
    });

    const resolved = resolvePropertyValue('occupancy.maxAdults', profile, { maxAdults: 2 });

    expect(resolved.value).toBe(2);
    expect(resolved.source).toBe('property');
    expect(resolved.clamped).toBeUndefined();
  });

  it('lets the building forbid pets even when the property allows them', () => {
    const profile = parseResidenceProfile({
      id: 'dev-1',
      settings: { stay: { petsAllowed: false } },
    });

    const resolved = resolvePropertyValue('stay.petsAllowed', profile, { allowPets: true });

    expect(resolved.value).toBe(false);
    expect(resolved.source).toBe('residence');
  });

  it('lets a property narrow an allowance but not widen it', () => {
    const profile = parseResidenceProfile({ id: 'dev-1', settings: {} });

    expect(resolvePropertyValue('stay.paidParkingAvailable', profile, { allowParking: false }).value).toBe(
      false
    );
    expect(resolvePropertyValue('stay.paidParkingAvailable', profile, { allowParking: true }).value).toBe(
      true
    );
  });

  it('inherits check-in time, with a valid property override', () => {
    const profile = parseResidenceProfile({
      id: 'dev-1',
      settings: { stay: { checkInTime: '15:00' } },
    });

    expect(resolvePropertyValue('stay.checkInTime', profile, {}).value).toBe('15:00');
    expect(resolvePropertyValue('stay.checkInTime', profile, { checkInTime: '16:30' }).value).toBe(
      '16:30'
    );
    expect(resolvePropertyValue('stay.checkInTime', profile, { checkInTime: 'nonsense' }).value).toBe(
      '15:00'
    );
  });

  it('marks a locked field as locked in the policy registry', () => {
    expect(RESIDENCE_FIELD_POLICY['structure.unitNumberFormat'].ownership).toBe('locked');
    expect(RESIDENCE_FIELD_POLICY['occupancy.maxAdults'].ownership).toBe('cap');
    expect(RESIDENCE_FIELD_POLICY['stay.checkInTime'].ownership).toBe('inherited');
  });
});

describe('copy and terms', () => {
  it('falls back to the registry default when a stored value is blank', () => {
    const profile = parseResidenceProfile({ id: 'dev-1', settings: { copy: { 'guestForm.pets.policyTitle': '  ' } } });

    expect(resolveCopy(profile, 'guestForm.pets.policyTitle')).toBe(
      RESIDENCE_COPY_DEFAULTS['guestForm.pets.policyTitle']
    );
  });

  it('returns a stored copy value and a stored term', () => {
    const profile = parseResidenceProfile({
      id: 'dev-1',
      settings: {
        copy: { 'guestForm.pets.policyTitle': 'Pets at this building' },
        terms: { buildingAdmin: 'HOA' },
      },
    });

    expect(resolveCopy(profile, 'guestForm.pets.policyTitle')).toBe('Pets at this building');
    expect(resolveTerm(profile, 'buildingAdmin')).toBe('HOA');
  });
});
