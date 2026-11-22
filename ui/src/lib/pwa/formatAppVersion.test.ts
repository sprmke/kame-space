import { describe, expect, it } from 'vitest';

import { formatAppVersionLabel, formatMarketingSemver } from './formatAppVersion';

describe('formatMarketingSemver', () => {
  it('shortens patch-zero versions to major.minor', () => {
    expect(formatMarketingSemver('1.0.0')).toBe('1.0');
    expect(formatMarketingSemver('2.1.0')).toBe('2.1');
    expect(formatMarketingSemver('v2.0.0')).toBe('2.0');
  });

  it('keeps a non-zero patch', () => {
    expect(formatMarketingSemver('1.2.3')).toBe('1.2.3');
  });

  it('accepts major.minor only', () => {
    expect(formatMarketingSemver('1.3')).toBe('1.3');
  });
});

describe('formatAppVersionLabel', () => {
  it('maps local builds to Development', () => {
    expect(formatAppVersionLabel('local')).toBe('Development');
    expect(formatAppVersionLabel('dev')).toBe('Development');
    expect(formatAppVersionLabel('local', '1.0.0')).toBe('Development');
  });

  it('prefers the marketing package version over a git SHA release', () => {
    expect(
      formatAppVersionLabel('d731a360969035d086a30b409be86dd95b3de27b', '1.0.0')
    ).toBe('1.0');
    expect(formatAppVersionLabel('a30b409', '2.1.0')).toBe('2.1');
  });

  it('formats a semver release when marketing is missing', () => {
    expect(formatAppVersionLabel('1.0.0')).toBe('1.0');
    expect(formatAppVersionLabel('v1.2.3')).toBe('1.2.3');
  });

  it('returns Unknown when nothing usable is available', () => {
    expect(formatAppVersionLabel(undefined)).toBe('Unknown');
    expect(formatAppVersionLabel('')).toBe('Unknown');
    expect(formatAppVersionLabel('d731a360969035d086a30b409be86dd95b3de27b')).toBe('Unknown');
  });
});
