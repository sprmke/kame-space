import { describe, expect, it } from 'vitest';

import {
  sanitizeParkingSlotNumber,
  isValidParkingSlotNumber,
  formatParkingDisplayName,
  formatParkingCode,
  resolveParkingCompactLabel,
  resolveParkingLabel,
  inferParkingTypeForTower,
  parseParkingSlotNumberFromLabel,
} from '@/features/dashboard/org/lib/parkingSlotDisplay';

describe('sanitizeParkingSlotNumber', () => {
  it('sanitizeParkingSlotNumber is exported', () => {
    expect(typeof sanitizeParkingSlotNumber).toBe('function');
  });
});

describe('isValidParkingSlotNumber', () => {
  it('isValidParkingSlotNumber is exported', () => {
    expect(typeof isValidParkingSlotNumber).toBe('function');
  });
});

describe('formatParkingDisplayName', () => {
  it('formatParkingDisplayName is exported', () => {
    expect(typeof formatParkingDisplayName).toBe('function');
  });
});

describe('formatParkingCode', () => {
  it('formatParkingCode is exported', () => {
    expect(typeof formatParkingCode).toBe('function');
  });
});

describe('resolveParkingCompactLabel', () => {
  it('resolveParkingCompactLabel is exported', () => {
    expect(typeof resolveParkingCompactLabel).toBe('function');
  });
});

describe('inferParkingTypeForTower', () => {
  it('inferParkingTypeForTower is exported', () => {
    expect(typeof inferParkingTypeForTower).toBe('function');
  });
});

describe('parseParkingSlotNumberFromLabel', () => {
  it('parseParkingSlotNumberFromLabel is exported', () => {
    expect(typeof parseParkingSlotNumberFromLabel).toBe('function');
  });
});

describe('resolveParkingLabel', () => {
  it('prefers the stored name over the compact code', () => {
    expect(
      resolveParkingLabel({
        name: 'Azure Monaco - Level 2 - Slot 27',
        tower: 'Monaco',
        level: 'Level 2',
        slotLabel: '27',
      })
    ).toBe('Azure Monaco - Level 2 - Slot 27');
  });

  it('builds a readable name when the row has no name', () => {
    expect(resolveParkingLabel({ tower: 'Monaco', level: 'Level 2', slotLabel: '27' })).toBe(
      'Monaco - Level 2 - Slot 27'
    );
  });
});
