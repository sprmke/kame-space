import { describe, expect, it } from 'vitest';

import {
  PDF_DATA_KEYS,
  defaultPdfFieldMap,
  isPdfDataKey,
  pdfDataKeyLabel,
} from '@/lib/residence/pdfDataKeys';

describe('pdfDataKeys', () => {
  it('labels a key without mangling camelCase or the group', () => {
    expect(pdfDataKeyLabel('property.unitOwner')).toBe('Property · Unit owner');
    expect(pdfDataKeyLabel('guest.2.nameWithAge')).toBe('Guest · 2 name with age');
    expect(pdfDataKeyLabel('pet.vaccinationDate')).toBe('Pet · Vaccination date');
  });

  it('only accepts keys in the catalog', () => {
    expect(isPdfDataKey('stay.checkInDate')).toBe(true);
    expect(isPdfDataKey('stay.nope')).toBe(false);
    expect(isPdfDataKey(undefined)).toBe(false);
  });

  it('has no duplicates', () => {
    expect(new Set(PDF_DATA_KEYS).size).toBe(PDF_DATA_KEYS.length);
  });
});

describe('defaultPdfFieldMap', () => {
  it('maps the field names we already use and leaves the rest unmapped', () => {
    expect(
      defaultPdfFieldMap(['unitOwner', 'checkInDate', 'petName', 'hoaReference', '  '])
    ).toEqual({
      unitOwner: 'property.unitOwner',
      checkInDate: 'stay.checkInDate',
      petName: 'pet.name',
    });
  });
});
