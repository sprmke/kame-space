import { describe, expect, it } from 'vitest';

import {
  BUILTIN_PROPERTY_COLORS_THEME_KEY,
  parseMarketingThemeKey,
  starterThemeKey,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeKeys';

describe('starterThemeKey', () => {
  it('prefixes the starter id', () => {
    expect(starterThemeKey('quiet-coast')).toBe('starter:quiet-coast');
  });
});

describe('parseMarketingThemeKey', () => {
  it('treats a missing key as property colors (rows made before themes)', () => {
    expect(parseMarketingThemeKey(null)).toEqual({ kind: 'property-colors' });
    expect(parseMarketingThemeKey(undefined)).toEqual({ kind: 'property-colors' });
    expect(parseMarketingThemeKey('')).toEqual({ kind: 'property-colors' });
  });

  it('recognises the built-in property colors key', () => {
    expect(parseMarketingThemeKey(BUILTIN_PROPERTY_COLORS_THEME_KEY)).toEqual({
      kind: 'property-colors',
    });
  });

  it('reads a starter key back to its id', () => {
    expect(parseMarketingThemeKey(starterThemeKey('quiet-coast'))).toEqual({
      kind: 'starter',
      starterId: 'quiet-coast',
    });
  });

  it('rejects an empty starter key', () => {
    expect(parseMarketingThemeKey('starter:')).toBeNull();
  });

  it('recognises a saved theme UUID', () => {
    const id = '3f2b8c1e-9a4d-4c7e-8b21-5d6f7a8b9c0d';
    expect(parseMarketingThemeKey(id)).toEqual({ kind: 'custom', id });
  });

  it('rejects anything else', () => {
    expect(parseMarketingThemeKey('theme-1')).toBeNull();
    expect(parseMarketingThemeKey('3f2b8c1e')).toBeNull();
  });
});
