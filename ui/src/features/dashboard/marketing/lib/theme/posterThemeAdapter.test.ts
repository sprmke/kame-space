import { describe, expect, it } from 'vitest';

import { POSTER_FONT_PAIRINGS } from '@/features/dashboard/marketing/lib/poster/posterFonts';
import {
  posterPaletteInputFromTheme,
  themedPosterFontPairing,
} from '@/features/dashboard/marketing/lib/theme/posterThemeAdapter';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';

const TOKENS = {
  version: 1,
  palette: {
    primary: '#e8752a',
    secondary: '#fbe3cf',
    accent: '#c2410c',
    surface: '#fbf8f3',
    ink: '#231f1c',
  },
  fonts: { display: 'Fraunces', body: 'Plus Jakarta Sans', label: 'Jost' },
  background: 'solid',
  corners: 'soft',
} as MarketingThemeTokens;

describe('posterPaletteInputFromTheme', () => {
  it('maps the theme palette onto the poster palette inputs', () => {
    expect(posterPaletteInputFromTheme(TOKENS)).toEqual({
      accent: '#e8752a',
      secondary: '#c2410c',
      field: '#fbf8f3',
    });
  });
});

describe('themedPosterFontPairing', () => {
  const pairing = POSTER_FONT_PAIRINGS['cozy-cafe'];

  it('sets the brand wordmark in the theme display face, never a fixed font', () => {
    const themed = themedPosterFontPairing(pairing, TOKENS);
    expect(themed.wordmark?.family).toBe('Fraunces');
    expect(themed.wordmark?.uppercase).toBe(true);
    expect(pairing.wordmark).toBeUndefined();
  });

  it('keeps the archetype composition and swaps in the theme faces', () => {
    const themed = themedPosterFontPairing(pairing, TOKENS);

    expect(themed.id).toBe(pairing.id);
    expect(themed.displayEffect).toBe(pairing.displayEffect);
    expect(themed.display.family).toBe('Fraunces');
    expect(themed.body.family).toBe('Plus Jakarta Sans');
    expect(themed.eyebrow.family).toBe('Jost');
    expect(themed.chip.family).toBe('Jost');
  });

  it('a sans theme leaves the display role untouched apart from the family', () => {
    const sans = {
      ...TOKENS,
      fonts: { display: 'Sora', body: 'DM Sans', label: 'Jost' },
    } as MarketingThemeTokens;
    const themed = themedPosterFontPairing(pairing, sans);
    expect(themed.display).toEqual({ ...pairing.display, family: 'Sora' });
  });

  it('a serif theme is never set in tracked capitals', () => {
    const themed = themedPosterFontPairing(pairing, TOKENS);
    expect(themed.display.uppercase).toBe(false);
    expect(themed.display.letterSpacing).toBeLessThanOrEqual(0);
    expect(themed.display.lineHeight).toBeGreaterThanOrEqual(1.05);
    expect(themed.displayEffect).not.toBe('outline-shadow');
  });

  it('leaves body weights and the script face untouched', () => {
    const themed = themedPosterFontPairing(pairing, TOKENS);

    expect(themed.body).toEqual({ ...pairing.body, family: 'Plus Jakarta Sans' });
    expect(themed.script).toBe(pairing.script);
  });
});
