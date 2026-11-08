import { describe, expect, it } from 'vitest';

import type { ResolvedMarketingTheme } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { themeSurfaceBackground } from '@/features/dashboard/marketing/lib/theme/marketingThemeCss';

function theme(
  background: ResolvedMarketingTheme['tokens']['background'],
  surface = '#fbf8f3',
  primary = '#e8752a'
): ResolvedMarketingTheme {
  return {
    primary,
    secondary: '#fbe3cf',
    accent: '#c2410c',
    surface,
    ink: '#231f1c',
    tokens: { background },
    onPrimary: '#ffffff',
    onSecondary: '#231f1c',
    onAccent: '#ffffff',
  } as unknown as ResolvedMarketingTheme;
}

describe('themeSurfaceBackground', () => {
  it('is the plain surface for a solid theme', () => {
    expect(themeSurfaceBackground(theme('solid'))).toBe('#fbf8f3');
  });

  it('builds a soft gradient between the surface and a washed primary', () => {
    const css = themeSurfaceBackground(theme('soft-gradient'));

    expect(css).toMatch(/^linear-gradient\(165deg, #fbf8f3 0%, #[0-9a-f]{6} 100%\)$/);
  });

  it('builds a dot pattern tinted by the primary', () => {
    const css = themeSurfaceBackground(theme('pattern'));

    expect(css).toContain('radial-gradient(');
    expect(css).toContain('10px 10px');
    expect(css.endsWith('#fbf8f3')).toBe(true);
  });

  it('washes a photo theme from a tinted primary into the surface', () => {
    const css = themeSurfaceBackground(theme('photo-wash'));

    expect(css).toMatch(/^linear-gradient\(160deg, #[0-9a-f]{6} 0%, #fbf8f3 70%\)$/);
  });
});
