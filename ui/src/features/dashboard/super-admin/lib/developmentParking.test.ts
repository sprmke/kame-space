import { describe, expect, it } from 'vitest';

import {
  defaultParkingLevelsForDevelopment,
  normalizeDevelopmentParkingLevel,
  normalizeDevelopmentParkingLevels,
  readDevelopmentParkingLevels,
} from '@/features/dashboard/super-admin/lib/developmentParking';

describe('normalizeDevelopmentParkingLevel', () => {
  it('maps legacy basement and floor labels to the current level names', () => {
    expect(normalizeDevelopmentParkingLevel('B2')).toBe('Level 2');
    expect(normalizeDevelopmentParkingLevel('G')).toBe('Level 1');
    expect(normalizeDevelopmentParkingLevel('3rd floor')).toBe('Level 3');
    expect(normalizeDevelopmentParkingLevel('Level 4')).toBe('Level 4');
  });
});

describe('normalizeDevelopmentParkingLevels', () => {
  it('drops blanks and duplicates while keeping order', () => {
    expect(
      normalizeDevelopmentParkingLevels(['Level 1', 'B2', 'Level 2', '', 'Level 1'])
    ).toEqual(['Level 1', 'Level 2']);
  });
});

describe('defaultParkingLevelsForDevelopment', () => {
  it('only falls back for a legacy Azure row', () => {
    expect(defaultParkingLevelsForDevelopment('Azure North Residences')).toEqual([
      'Level 1',
      'Level 2',
      'Level 3',
    ]);
    expect(defaultParkingLevelsForDevelopment('Test Residence')).toEqual([]);
  });
});

describe('readDevelopmentParkingLevels', () => {
  it('prefers stored levels and falls back to the legacy default', () => {
    expect(readDevelopmentParkingLevels('Test Residence', ['Podium'])).toEqual(['Podium']);
    expect(readDevelopmentParkingLevels('Azure North Residences', [])).toEqual([
      'Level 1',
      'Level 2',
      'Level 3',
    ]);
    expect(readDevelopmentParkingLevels('Test Residence', [])).toEqual([]);
  });
});
