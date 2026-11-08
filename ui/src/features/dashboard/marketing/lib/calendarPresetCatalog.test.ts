import { describe, expect, it } from 'vitest';

import {
  CALENDAR_DESIGNER_PRESET_IDS,
  CALENDAR_PRESET_CATEGORIES,
} from '@/features/dashboard/marketing/lib/calendarPresetCatalog';

describe('CALENDAR_PRESET_CATEGORIES', () => {
  it('names every category and gives it at least one preset', () => {
    expect(CALENDAR_PRESET_CATEGORIES.length).toBeGreaterThan(0);

    for (const category of CALENDAR_PRESET_CATEGORIES) {
      expect(category.label.trim()).not.toBe('');
      expect(category.presets.length).toBeGreaterThan(0);
    }
  });

  it('gives each preset a unique id, a label, a description and swatches', () => {
    const all = CALENDAR_PRESET_CATEGORIES.flatMap((category) => category.presets);
    const ids = all.map((preset) => preset.value);

    expect(new Set(ids).size).toBe(ids.length);

    for (const preset of all) {
      expect(preset.label.trim()).not.toBe('');
      expect(preset.description.trim()).not.toBe('');
      expect(preset.color).toMatch(/^#[0-9a-f]{6}$/i);
      if (preset.secondary !== undefined) {
        expect(preset.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('uses unique labels within a category', () => {
    for (const category of CALENDAR_PRESET_CATEGORIES) {
      const labels = category.presets.map((preset) => preset.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe('CALENDAR_DESIGNER_PRESET_IDS', () => {
  it('flattens every preset id in picker order', () => {
    const expected = CALENDAR_PRESET_CATEGORIES.flatMap((category) =>
      category.presets.map((preset) => preset.value)
    );

    expect(CALENDAR_DESIGNER_PRESET_IDS).toEqual(expected);
  });
});
