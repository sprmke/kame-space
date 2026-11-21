import { describe, expect, it } from 'vitest';

import {
  formatSuperAdminDate,
  formatSuperAdminDateTime,
  parseSuperAdminDate,
  superAdminDateParts,
} from '@/features/dashboard/super-admin/lib/superAdminDates';

describe('parseSuperAdminDate', () => {
  it('parses a Postgres timestamptz with a short offset', () => {
    const date = parseSuperAdminDate('2026-11-16T19:21:40+00');
    expect(date?.toISOString()).toBe('2026-11-16T19:21:40.000Z');
  });

  it('parses a full offset', () => {
    expect(parseSuperAdminDate('2026-11-16T19:21:40+00:00')?.toISOString()).toBe(
      '2026-11-16T19:21:40.000Z'
    );
  });

  it('parses a Z-suffixed timestamp', () => {
    expect(parseSuperAdminDate('2026-11-16T19:21:40Z')?.toISOString()).toBe(
      '2026-11-16T19:21:40.000Z'
    );
  });

  it('parses a compact offset without a colon', () => {
    expect(parseSuperAdminDate('2026-11-16T19:21:40+0800')?.toISOString()).toBe(
      '2026-11-16T11:21:40.000Z'
    );
  });

  it('treats a date-only value as a local calendar day', () => {
    const date = parseSuperAdminDate('2026-11-16');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10);
    expect(date?.getDate()).toBe(16);
  });

  it('returns null for empty and invalid values', () => {
    expect(parseSuperAdminDate(null)).toBeNull();
    expect(parseSuperAdminDate(undefined)).toBeNull();
    expect(parseSuperAdminDate('')).toBeNull();
    expect(parseSuperAdminDate('   ')).toBeNull();
    expect(parseSuperAdminDate('not a date')).toBeNull();
  });
});

describe('formatSuperAdminDate', () => {
  it('formats the short offset instead of returning Invalid Date', () => {
    expect(formatSuperAdminDate('2026-11-16T19:21:40+00')).toBe('Nov 17, 2026');
  });

  it('falls back to the default placeholder', () => {
    expect(formatSuperAdminDate(null)).toBe('-');
    expect(formatSuperAdminDate('nope')).toBe('-');
  });

  it('accepts a custom fallback', () => {
    expect(formatSuperAdminDate('nope', 'Not set')).toBe('Not set');
  });
});

describe('formatSuperAdminDateTime', () => {
  it('formats in Asia/Manila', () => {
    expect(formatSuperAdminDateTime('2026-11-16T19:21:40+00')).toBe('Nov 17, 2026, 3:21 AM');
  });
});

describe('superAdminDateParts', () => {
  it('splits a valid date', () => {
    expect(superAdminDateParts('2026-11-16T19:21:40+00')).toEqual({
      month: 'Nov',
      day: '17',
      year: '2026',
    });
  });

  it('returns null for invalid input', () => {
    expect(superAdminDateParts('nope')).toBeNull();
  });
});
