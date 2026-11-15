import { describe, expect, it } from 'vitest';

import {
  parsePropertiesQuery,
  writePropertiesQuery,
  countActivePropertyFilters,
  clearPropertyFilters,
  toPropertyCard,
  PROPERTIES_SORTS,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';

describe('parsePropertiesQuery', () => {
  it('parsePropertiesQuery is exported', () => {
    expect(typeof parsePropertiesQuery).toBe('function');
  });
});

describe('writePropertiesQuery', () => {
  it('writePropertiesQuery is exported', () => {
    expect(typeof writePropertiesQuery).toBe('function');
  });
});

describe('countActivePropertyFilters', () => {
  it('countActivePropertyFilters is exported', () => {
    expect(typeof countActivePropertyFilters).toBe('function');
  });
});

describe('clearPropertyFilters', () => {
  it('clearPropertyFilters is exported', () => {
    expect(typeof clearPropertyFilters).toBe('function');
  });
});

describe('toPropertyCard', () => {
  it('toPropertyCard is exported', () => {
    expect(typeof toPropertyCard).toBe('function');
  });
});

describe('PROPERTIES_SORTS', () => {
  it('is defined', () => {
    expect(PROPERTIES_SORTS).toBeDefined();
  });
});

describe('propertiesQuery flexible dates', () => {
  it('carries flex to the API only with both dates', () => {
    const query = parsePropertiesQuery(
      new URLSearchParams('checkIn=2026-12-01&checkOut=2026-12-03&flex=2')
    );
    expect(query.flex).toBe(2);
    expect(writePropertiesQuery(query).get('flex')).toBe('2');
    expect(writePropertiesQuery({ ...query, checkIn: '' }).has('flex')).toBe(false);
  });

  it('ignores flex without dates', () => {
    expect(parsePropertiesQuery(new URLSearchParams('flex=2')).flex).toBe(0);
  });
});
