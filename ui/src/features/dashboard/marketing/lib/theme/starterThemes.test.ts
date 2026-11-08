import { describe, expect, it } from 'vitest';

import { CALENDAR_PRESET_CATEGORIES } from '@/features/dashboard/marketing/lib/calendarPresets';
import { DEFAULT_MARKETING_THEME_TOKENS } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { contrastRatio } from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';
import {
  BLANK_CALENDAR_LAYOUT_ID,
  QUIET_COAST_STARTER,
  QUIET_COAST_STARTER_ID,
  buildPropertyColorsThemeTokens,
  calendarLayoutSourceTokens,
  findStarterTheme,
  listStarterThemes,
} from '@/features/dashboard/marketing/lib/theme/starterThemes';

const PRESET_COUNT = CALENDAR_PRESET_CATEGORIES.reduce(
  (total, category) => total + category.presets.length,
  0
);

describe('starter themes', () => {
  it('lists Quiet Coast first, then one per calendar preset', () => {
    const starters = listStarterThemes();

    expect(starters[0]).toBe(QUIET_COAST_STARTER);
    expect(starters).toHaveLength(PRESET_COUNT + 1);
    expect(new Set(starters.map((starter) => starter.id)).size).toBe(starters.length);
  });

  it('gives every starter a label, a group and versioned tokens', () => {
    for (const starter of listStarterThemes()) {
      expect(starter.label.trim()).not.toBe('');
      expect(starter.group.trim()).not.toBe('');
      expect(starter.tokens.version).toBe(DEFAULT_MARKETING_THEME_TOKENS.version);
    }
  });

  it('finds the built-in starter by id', () => {
    expect(findStarterTheme(QUIET_COAST_STARTER_ID)).toBe(QUIET_COAST_STARTER);
  });

  it('finds a calendar-derived starter by its layout id', () => {
    const firstPreset = CALENDAR_PRESET_CATEGORIES[0]!.presets[0]!;
    const starter = findStarterTheme(firstPreset.value);

    expect(starter).not.toBeNull();
    expect(starter!.calendarLayoutId).toBe(firstPreset.value);
  });

  it('returns null for an unknown starter', () => {
    expect(findStarterTheme('not-a-theme')).toBeNull();
  });

  it('resolves the blank calendar layout to a real palette', () => {
    const tokens = calendarLayoutSourceTokens(BLANK_CALENDAR_LAYOUT_ID);

    expect(tokens.version).toBe(DEFAULT_MARKETING_THEME_TOKENS.version);
    expect(tokens.palette.surface).toMatch(/^#[0-9a-f]{6}$/);
    expect(tokens.palette.ink).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('buildPropertyColorsThemeTokens', () => {
  it('builds a readable palette from the property photo colours', () => {
    const tokens = buildPropertyColorsThemeTokens({
      accent: '#b86a2c',
      primary: '#f5e2cf',
      secondary: '#fbf8f3',
    });

    expect(tokens.palette.primary).toBe('#b86a2c');
    expect(tokens.palette.surface).toBe('#fbf8f3');
    expect(tokens.background).toBe('solid');
    expect(tokens.corners).toBe('soft');
    expect(tokens.fonts).toBe(DEFAULT_MARKETING_THEME_TOKENS.fonts);
    // Ink is forced to AAA on the surface, whatever colour the photo produced.
    expect(contrastRatio(tokens.palette.ink, tokens.palette.surface)).toBeGreaterThanOrEqual(6.99);
  });

  it('keeps a highlight hue near the brand rather than repeating it', () => {
    const tokens = buildPropertyColorsThemeTokens({
      accent: '#b86a2c',
      primary: '#f5e2cf',
      secondary: '#fbf8f3',
    });

    expect(tokens.palette.accent).not.toBe(tokens.palette.primary);
  });

  it('honours an explicit ink colour', () => {
    const tokens = buildPropertyColorsThemeTokens(
      { accent: '#b86a2c', primary: '#f5e2cf', secondary: '#fbf8f3' },
      '#111111'
    );

    expect(tokens.palette.ink).toBe('#111111');
  });

  it('falls back to the default brand when the palette is unusable', () => {
    const tokens = buildPropertyColorsThemeTokens({
      accent: 'not-a-colour',
      primary: '',
      secondary: '',
    });

    expect(tokens.palette.primary).toBe(DEFAULT_MARKETING_THEME_TOKENS.palette.primary);
    expect(tokens.palette.surface).toBe('#fbf8f3');
  });
});
