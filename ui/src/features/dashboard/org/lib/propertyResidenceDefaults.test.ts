import { describe, expect, it } from 'vitest';

import {
  getResidencePropertyDefaults,
  clampToRange,
  applyResidenceDefaultsToDraft,
  validateNumericField,
  validatePropertyDetailsForResidence,
} from '@/features/dashboard/org/lib/propertyResidenceDefaults';

describe('getResidencePropertyDefaults', () => {
  it('getResidencePropertyDefaults is exported', () => {
    expect(typeof getResidencePropertyDefaults).toBe('function');
  });
});

describe('clampToRange', () => {
  it('clampToRange is exported', () => {
    expect(typeof clampToRange).toBe('function');
  });
});

describe('applyResidenceDefaultsToDraft', () => {
  it('applyResidenceDefaultsToDraft is exported', () => {
    expect(typeof applyResidenceDefaultsToDraft).toBe('function');
  });
});

describe('validateNumericField', () => {
  it('validateNumericField is exported', () => {
    expect(typeof validateNumericField).toBe('function');
  });
});

describe('validatePropertyDetailsForResidence', () => {
  it('validatePropertyDetailsForResidence is exported', () => {
    expect(typeof validatePropertyDetailsForResidence).toBe('function');
  });
});

describe('residence defaults are not name-matched (F2)', () => {
  it('does not give one building its own ranges by name', () => {
    const azure = getResidencePropertyDefaults('Azure North Residences');
    const blank = getResidencePropertyDefaults('');
    const other = getResidencePropertyDefaults('Test Residence');

    expect(azure).toEqual(blank);
    expect(azure).toEqual(other);
    // Azure North's 29-floor / 6-adult cap is residence config now, not a client map.
    expect(azure.floors.max).toBe(50);
    expect(azure.maxAdults.max).toBe(30);
  });
});
