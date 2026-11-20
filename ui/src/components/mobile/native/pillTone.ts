/**
 * Five phone-kit pill tones (design-system §2). Status maps live in
 * `statusToneColors.ts`; this module owns the tone vocabulary and AA helpers.
 */

export const PILL_TONES = ['positive', 'attention', 'critical', 'info', 'neutral'] as const;

export type PillTone = (typeof PILL_TONES)[number];

export const PILL_TONE_CLASS: Record<PillTone, string> = {
  positive: 'bg-pill-positive text-pill-positive-foreground',
  attention: 'bg-pill-attention text-pill-attention-foreground',
  critical: 'bg-pill-critical text-pill-critical-foreground',
  info: 'bg-pill-info text-pill-info-foreground',
  neutral: 'bg-pill-neutral text-pill-neutral-foreground',
};

/** Token pairs used for contrast checks (H S% L% without hsl()). */
export const PILL_TONE_TOKENS: Record<
  PillTone,
  { light: { bg: string; fg: string }; dark: { bg: string; fg: string } }
> = {
  positive: {
    light: { bg: '158 40% 90%', fg: '168 70% 22%' },
    dark: { bg: '165 30% 18%', fg: '158 45% 78%' },
  },
  attention: {
    light: { bg: '43 90% 90%', fg: '32 80% 28%' },
    dark: { bg: '40 50% 18%', fg: '43 90% 72%' },
  },
  critical: {
    light: { bg: '0 70% 94%', fg: '0 65% 38%' },
    dark: { bg: '0 40% 18%', fg: '0 80% 78%' },
  },
  info: {
    light: { bg: '200 70% 92%', fg: '200 70% 28%' },
    dark: { bg: '200 40% 18%', fg: '200 70% 78%' },
  },
  neutral: {
    light: { bg: '160 8% 92%', fg: '160 10% 32%' },
    dark: { bg: '160 6% 18%', fg: '160 8% 78%' },
  },
};

export const APPBAR_TONE_TOKENS = {
  light: { bg: '168 70% 22%', fg: '0 0% 100%', muted: '165 35% 84%' },
  dark: { bg: '165 18% 12%', fg: '160 20% 96%', muted: '160 10% 70%' },
} as const;

export const TINT_TONE_TOKENS = {
  light: { bg: '158 45% 94%', fg: '168 70% 22%' },
  dark: { bg: '165 30% 16%', fg: '158 45% 80%' },
} as const;
