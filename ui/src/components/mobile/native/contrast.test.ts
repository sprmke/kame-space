import { describe, expect, it } from 'vitest';

import { contrastRatio, meetsAa } from '@/components/mobile/native/contrast';
import {
  APPBAR_TONE_TOKENS,
  PILL_TONES,
  PILL_TONE_TOKENS,
  TINT_TONE_TOKENS,
} from '@/components/mobile/native/pillTone';

describe('native v3 token contrast (WCAG AA)', () => {
  it('app bar title text meets AA in light and dark', () => {
    expect(meetsAa(APPBAR_TONE_TOKENS.light.fg, APPBAR_TONE_TOKENS.light.bg)).toBe(true);
    expect(meetsAa(APPBAR_TONE_TOKENS.dark.fg, APPBAR_TONE_TOKENS.dark.bg)).toBe(true);
  });

  it('app bar muted text meets AA for large/secondary use', () => {
    // Parent line is 13px muted on band: require ≥ 3:1 (large-text AA floor).
    expect(
      contrastRatio(APPBAR_TONE_TOKENS.light.muted, APPBAR_TONE_TOKENS.light.bg)
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(APPBAR_TONE_TOKENS.dark.muted, APPBAR_TONE_TOKENS.dark.bg)
    ).toBeGreaterThanOrEqual(3);
  });

  it('tint foreground meets AA on tint', () => {
    expect(meetsAa(TINT_TONE_TOKENS.light.fg, TINT_TONE_TOKENS.light.bg)).toBe(true);
    expect(meetsAa(TINT_TONE_TOKENS.dark.fg, TINT_TONE_TOKENS.dark.bg)).toBe(true);
  });

  it.each(PILL_TONES)('pill tone %s meets AA in light and dark', (tone) => {
    const pair = PILL_TONE_TOKENS[tone];
    expect(meetsAa(pair.light.fg, pair.light.bg)).toBe(true);
    expect(meetsAa(pair.dark.fg, pair.dark.bg)).toBe(true);
  });
});
