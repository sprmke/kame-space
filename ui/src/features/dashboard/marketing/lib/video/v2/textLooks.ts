/**
 * Text looks: one-tap styles for text and labels on a video (outline, box, glow, highlight...).
 *
 * A look is data over `VideoLayerTypography`, so it renders through the same path as every other
 * text and exports the same way. Applying a look first clears whatever the previous look set, so
 * looks never stack up into something nobody chose.
 *
 * Plan: docs/workflow/in-progress/marketing-video-editor-mobile-first-refine.md §4.6.
 */

import type { CampaignPalette } from '@/features/dashboard/marketing/lib/designBrandColors';
import type {
  VideoLayerTypography,
  VideoSceneLayer,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export type TextLookId =
  | 'classic'
  | 'bold'
  | 'outline'
  | 'boxed'
  | 'soft-box'
  | 'highlight'
  | 'neon'
  | 'pop'
  | 'elegant'
  | 'soft'
  | 'tag'
  | 'price';

export type TextLookColors = {
  /** Brand accent (campaign palette). */
  accent: string;
  /** Text colour that reads on the accent. */
  onAccent: string;
};

export const DEFAULT_LOOK_COLORS: TextLookColors = { accent: '#f59e0b', onAccent: '#1c1917' };

/** Every typography key a look may set. Applying a look removes all of these first. */
export const LOOK_KEYS = [
  'fontFamily',
  'fontWeight',
  'color',
  'letterSpacing',
  'textTransform',
  'strokeColor',
  'strokeWidth',
  'shadow',
  'boxColor',
  'boxRadius',
  'glowColor',
  'backgroundColor',
] as const satisfies ReadonlyArray<keyof VideoLayerTypography>;

type LookTypography = Partial<VideoLayerTypography>;

export type TextLook = {
  id: TextLookId;
  label: string;
  /** Builds the typography this look sets. `classic` sets nothing: the template's own style. */
  typography: (colors: TextLookColors) => LookTypography;
};

const WHITE = '#ffffff';
const INK = '#111827';

export const TEXT_LOOKS: TextLook[] = [
  { id: 'classic', label: 'Classic', typography: () => ({}) },
  {
    id: 'bold',
    label: 'Bold',
    typography: () => ({
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: 800,
      color: WHITE,
      shadow: true,
    }),
  },
  {
    id: 'outline',
    label: 'Outline',
    typography: () => ({
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: 800,
      color: WHITE,
      strokeColor: INK,
      strokeWidth: 3,
    }),
  },
  {
    id: 'boxed',
    label: 'Box',
    typography: () => ({
      fontFamily: 'DM Sans',
      fontWeight: 700,
      color: WHITE,
      boxColor: 'rgba(17,24,39,0.78)',
      boxRadius: 14,
    }),
  },
  {
    id: 'soft-box',
    label: 'Soft box',
    typography: () => ({
      fontFamily: 'DM Sans',
      fontWeight: 700,
      color: INK,
      boxColor: 'rgba(255,255,255,0.92)',
      boxRadius: 18,
    }),
  },
  {
    id: 'highlight',
    label: 'Highlight',
    typography: ({ accent, onAccent }) => ({
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: 800,
      color: onAccent,
      textTransform: 'uppercase',
      letterSpacing: 1,
      boxColor: accent,
      boxRadius: 4,
    }),
  },
  {
    id: 'neon',
    label: 'Glow',
    typography: ({ accent }) => ({
      fontFamily: 'Outfit',
      fontWeight: 700,
      color: WHITE,
      glowColor: accent,
    }),
  },
  {
    id: 'pop',
    label: 'Pop',
    typography: ({ accent }) => ({
      fontFamily: 'Outfit',
      fontWeight: 800,
      color: accent,
      strokeColor: INK,
      strokeWidth: 4,
      shadow: true,
    }),
  },
  {
    id: 'elegant',
    label: 'Elegant',
    typography: () => ({
      fontFamily: 'Playfair Display',
      fontWeight: 600,
      color: WHITE,
      letterSpacing: 1,
      shadow: true,
    }),
  },
  {
    id: 'soft',
    label: 'Soft',
    typography: () => ({ fontFamily: 'Nunito Sans', fontWeight: 700, color: WHITE, shadow: true }),
  },
  {
    id: 'tag',
    label: 'Tag',
    typography: ({ accent, onAccent }) => ({
      fontFamily: 'Figtree',
      fontWeight: 800,
      color: onAccent,
      textTransform: 'uppercase',
      letterSpacing: 3,
      boxColor: accent,
      boxRadius: 999,
    }),
  },
  {
    id: 'price',
    label: 'Price',
    typography: () => ({
      fontFamily: 'Fraunces',
      fontWeight: 700,
      color: INK,
      boxColor: '#fde68a',
      boxRadius: 10,
    }),
  },
];

export function textLookById(id: TextLookId): TextLook {
  return TEXT_LOOKS.find((look) => look.id === id) ?? TEXT_LOOKS[0]!;
}

/** The layer with a look applied. The previous look's keys are removed first. */
export function applyTextLook(
  layer: VideoSceneLayer,
  lookId: TextLookId,
  colors: TextLookColors = DEFAULT_LOOK_COLORS
): VideoSceneLayer {
  const kept: Record<string, unknown> = { ...(layer.typography ?? {}) };
  for (const key of LOOK_KEYS) delete kept[key];
  const next = {
    ...kept,
    ...textLookById(lookId).typography(colors),
  } as Partial<VideoLayerTypography>;
  const { typography: _previous, ...rest } = layer;
  void _previous;
  return Object.keys(next).length > 0
    ? { ...rest, typography: next as VideoLayerTypography }
    : { ...rest };
}

/** Which look a layer currently has, by matching the keys a look sets. */
export function detectTextLook(
  layer: VideoSceneLayer,
  colors: TextLookColors = DEFAULT_LOOK_COLORS
): TextLookId | null {
  const current = (layer.typography ?? {}) as Record<string, unknown>;
  const touched = LOOK_KEYS.filter((key) => current[key] !== undefined && current[key] !== null);
  if (touched.length === 0) return 'classic';
  for (const look of TEXT_LOOKS) {
    const expected = look.typography(colors) as Record<string, unknown>;
    const expectedKeys = Object.keys(expected);
    if (expectedKeys.length === 0 || expectedKeys.length !== touched.length) continue;
    if (expectedKeys.every((key) => current[key] === expected[key])) return look.id;
  }
  // Fonts, sizes and colours the host changed by hand: not one of the looks.
  return null;
}

/** Look colours from the project's campaign palette (brand accent), with safe defaults. */
export function lookColorsFromPalette(palette: CampaignPalette | undefined): TextLookColors {
  if (!palette) return DEFAULT_LOOK_COLORS;
  return {
    accent: palette.accent || DEFAULT_LOOK_COLORS.accent,
    onAccent: palette.accentForeground || DEFAULT_LOOK_COLORS.onAccent,
  };
}
