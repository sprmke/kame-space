import { describe, expect, it } from 'vitest';

import {
  defaultUnitTypesForResidence,
  parseUnitTypes,
  mergeUnitTypes,
  findUnitTypeById,
  resolveUnitTypeIdFromCapacity,
  validateUnitTypes,
  slugifyUnitTypeId,
  addUnitType,
  updateUnitType,
  removeUnitType,
  applyUnitTypeDefaultsToProfile,
} from '@/features/dashboard/bookings/lib/unitTypes';

describe('defaultUnitTypesForResidence', () => {
  it('defaultUnitTypesForResidence is exported', () => {
    expect(typeof defaultUnitTypesForResidence).toBe('function');
  });
});

describe('parseUnitTypes', () => {
  it('parseUnitTypes is exported', () => {
    expect(typeof parseUnitTypes).toBe('function');
  });
});

describe('mergeUnitTypes', () => {
  it('mergeUnitTypes is exported', () => {
    expect(typeof mergeUnitTypes).toBe('function');
  });
});

describe('findUnitTypeById', () => {
  it('findUnitTypeById is exported', () => {
    expect(typeof findUnitTypeById).toBe('function');
  });
});

describe('resolveUnitTypeIdFromCapacity', () => {
  it('resolveUnitTypeIdFromCapacity is exported', () => {
    expect(typeof resolveUnitTypeIdFromCapacity).toBe('function');
  });
});

describe('validateUnitTypes', () => {
  it('validateUnitTypes is exported', () => {
    expect(typeof validateUnitTypes).toBe('function');
  });
});

describe('slugifyUnitTypeId', () => {
  it('slugifyUnitTypeId is exported', () => {
    expect(typeof slugifyUnitTypeId).toBe('function');
  });
});

describe('addUnitType', () => {
  it('addUnitType is exported', () => {
    expect(typeof addUnitType).toBe('function');
  });
});

describe('updateUnitType', () => {
  it('updateUnitType is exported', () => {
    expect(typeof updateUnitType).toBe('function');
  });
});

describe('removeUnitType', () => {
  it('removeUnitType is exported', () => {
    expect(typeof removeUnitType).toBe('function');
  });
});

describe('applyUnitTypeDefaultsToProfile', () => {
  it('applyUnitTypeDefaultsToProfile is exported', () => {
    expect(typeof applyUnitTypeDefaultsToProfile).toBe('function');
  });
});

describe('unit types are not name-matched (F2)', () => {
  it('returns the generic list for every residence name', () => {
    const azure = defaultUnitTypesForResidence('Azure North Residences');
    const other = defaultUnitTypesForResidence('Test Residence');

    expect(azure).toEqual(other);
    expect(azure.map((entry) => entry.id)).toEqual(['standard']);
  });
});
