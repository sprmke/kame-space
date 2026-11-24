import { describe, expect, it } from 'vitest';

import {
  formatParkingCode,
  formatParkingDisplayName,
  isValidParkingSlotNumber,
  parseParkingSlotNumberFromLabel,
  sanitizeParkingSlotNumber,
} from '@/features/dashboard/org/lib/parkingSlotDisplay';

describe('sanitizeParkingSlotNumber', () => {
  it('keeps digits, letters and the separator', () => {
    expect(sanitizeParkingSlotNumber('12A')).toBe('12A');
    expect(sanitizeParkingSlotNumber('b-04')).toBe('b-04');
    expect(sanitizeParkingSlotNumber('12 A!')).toBe('12A');
  });

  it('caps the label at eight characters', () => {
    expect(sanitizeParkingSlotNumber('ABCDEFGHIJ')).toHaveLength(8);
  });
});

describe('isValidParkingSlotNumber', () => {
  it('accepts numeric and lettered labels', () => {
    expect(isValidParkingSlotNumber('12')).toBe(true);
    expect(isValidParkingSlotNumber('12A')).toBe(true);
    expect(isValidParkingSlotNumber('A12')).toBe(true);
    expect(isValidParkingSlotNumber('B-04')).toBe(true);
  });

  it('rejects empty, symbol-only and overlong labels', () => {
    expect(isValidParkingSlotNumber('')).toBe(false);
    expect(isValidParkingSlotNumber('A')).toBe(false);
    expect(isValidParkingSlotNumber('---')).toBe(false);
    expect(isValidParkingSlotNumber('ABCDEFGHI')).toBe(false);
  });
});

describe('formatParkingDisplayName', () => {
  it('keeps the lettered label intact', () => {
    expect(formatParkingDisplayName('Monaco', 'Level 1', '12A')).toBe(
      'Monaco - Level 1 - Slot 12A'
    );
  });
});

describe('formatParkingCode', () => {
  it('keeps the lettered label intact', () => {
    expect(formatParkingCode('Monaco', 'Level 1', '12A')).toBe('ML1S12A');
  });
});

describe('parseParkingSlotNumberFromLabel', () => {
  it('returns a valid label as-is', () => {
    expect(parseParkingSlotNumberFromLabel('12A')).toBe('12A');
    expect(parseParkingSlotNumberFromLabel('B-04')).toBe('B-04');
  });

  it('keeps a short stored label instead of rewriting it', () => {
    expect(parseParkingSlotNumberFromLabel('M-B1-001')).toBe('M-B1-001');
  });

  it('falls back to trailing digits for long composite labels', () => {
    expect(parseParkingSlotNumberFromLabel('Monaco - Level 1 - Slot 26')).toBe('26');
  });
});
