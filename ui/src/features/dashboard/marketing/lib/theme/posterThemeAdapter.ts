import type { PosterFontPairing } from '@/features/dashboard/marketing/lib/poster/posterFonts';
import { marketingFontClass } from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';

/**
 * AI Post inside a theme: the archetype keeps its composition craft and the AI's
 * script accent; palette and the headline / body / label faces come from the theme.
 */

export function posterPaletteInputFromTheme(theme: MarketingThemeTokens) {
  return {
    accent: theme.palette.primary,
    secondary: theme.palette.accent,
    field: theme.palette.surface,
  };
}

/**
 * The pairing with the theme's faces in the headline, body and label roles.
 * Sizes, tracking and effects stay; text fitting re-measures with real fonts.
 */
export function themedPosterFontPairing(
  pairing: PosterFontPairing,
  theme: MarketingThemeTokens
): PosterFontPairing {
  const fontClass = marketingFontClass(theme.fonts.display);
  // Each class keeps what suits it: a serif or display face is never tracked or set in
  // capitals the way the Flyer sans is, and the outlined look belongs to rounded faces.
  const display =
    fontClass === 'serif' || fontClass === 'display'
      ? {
          ...pairing.display,
          family: theme.fonts.display,
          uppercase: false,
          letterSpacing: Math.min(0, pairing.display.letterSpacing),
          lineHeight: Math.max(1.05, pairing.display.lineHeight),
        }
      : { ...pairing.display, family: theme.fonts.display };
  const displayEffect =
    pairing.displayEffect === 'outline-shadow' && fontClass !== 'rounded'
      ? 'soft-shadow'
      : pairing.displayEffect;
  return {
    ...pairing,
    displayEffect,
    display,
    body: { ...pairing.body, family: theme.fonts.body },
    eyebrow: { ...pairing.eyebrow, family: theme.fonts.label },
    chip: { ...pairing.chip, family: theme.fonts.label },
    // The brand line is set in the theme's display face, not a fixed Fredoka.
    wordmark: { ...display, uppercase: true },
  };
}
