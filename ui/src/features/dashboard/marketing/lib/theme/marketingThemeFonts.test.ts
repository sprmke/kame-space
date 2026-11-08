import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MARKETING_THEME_FONTS,
  MARKETING_FONT_PAIRINGS,
  MARKETING_THEME_FONT_FAMILIES,
  PRELOADED_MARKETING_FONT_FAMILIES,
  findMarketingFontPairing,
  isMarketingThemeFontFamily,
  marketingThemeFontList,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';

describe('marketing theme fonts', () => {
  it('has no duplicate families', () => {
    expect(new Set(MARKETING_THEME_FONT_FAMILIES).size).toBe(MARKETING_THEME_FONT_FAMILIES.length);
  });

  it('narrows family names', () => {
    expect(isMarketingThemeFontFamily('Fraunces')).toBe(true);
    expect(isMarketingThemeFontFamily('Comic Sans MS')).toBe(false);
    expect(isMarketingThemeFontFamily(null)).toBe(false);
  });

  it('only preloads families it also allows', () => {
    for (const family of PRELOADED_MARKETING_FONT_FAMILIES) {
      expect(isMarketingThemeFontFamily(family)).toBe(true);
    }
  });
});

describe('MARKETING_FONT_PAIRINGS', () => {
  it('has unique ids and labels', () => {
    const ids = MARKETING_FONT_PAIRINGS.map((pairing) => pairing.id);
    const labels = MARKETING_FONT_PAIRINGS.map((pairing) => pairing.label);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('only pairs families every editor can draw', () => {
    for (const pairing of MARKETING_FONT_PAIRINGS) {
      for (const family of [
        pairing.fonts.display,
        pairing.fonts.body,
        pairing.fonts.label,
      ]) {
        expect(isMarketingThemeFontFamily(family)).toBe(true);
      }
    }
  });
});

describe('findMarketingFontPairing', () => {
  it('matches a pairing exactly, ignoring order of the roles', () => {
    const pairing = MARKETING_FONT_PAIRINGS[1]!;

    expect(findMarketingFontPairing({ ...pairing.fonts })).toBe(pairing);
  });

  it('returns null for a mixed set', () => {
    expect(
      findMarketingFontPairing({ display: 'Fraunces', body: 'Lora', label: 'Jost' })
    ).toBeNull();
  });
});

describe('DEFAULT_MARKETING_THEME_FONTS', () => {
  it('is the first curated pairing', () => {
    expect(DEFAULT_MARKETING_THEME_FONTS).toBe(MARKETING_FONT_PAIRINGS[0]!.fonts);
  });
});

describe('marketingThemeFontList', () => {
  it('de-duplicates the three roles for preloading', () => {
    expect(
      marketingThemeFontList({ display: 'Fraunces', body: 'Plus Jakarta Sans', label: 'Jost' })
    ).toEqual(['Fraunces', 'Plus Jakarta Sans', 'Jost']);

    expect(
      marketingThemeFontList({ display: 'Poppins', body: 'Poppins', label: 'Poppins' })
    ).toEqual(['Poppins']);
  });
});
