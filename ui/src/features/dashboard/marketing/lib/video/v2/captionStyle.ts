/**
 * How caption lines look. A style belongs to the captions track, so every line matches.
 * Pure data and helpers; the composition and the editor both read it from here.
 */

import {
  textLookById,
  type TextLookColors,
  type TextLookId,
} from '@/features/dashboard/marketing/lib/video/v2/textLooks';
import {
  DEFAULT_CAPTION_STYLE,
  type CaptionLookId,
  type CaptionStyle,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import type { VideoLayerTypography } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export const CAPTION_LOOKS: Array<{ id: CaptionLookId; label: string }> = [
  { id: 'highlight', label: 'Highlight' },
  { id: 'clean', label: 'Clean' },
  { id: 'outline', label: 'Outline' },
  { id: 'box', label: 'Box' },
];

export const CAPTION_SCALE_MIN = 0.7;
export const CAPTION_SCALE_MAX = 1.6;

export function clampCaptionStyle(style: Partial<CaptionStyle> | undefined): CaptionStyle {
  const look = CAPTION_LOOKS.some((entry) => entry.id === style?.look)
    ? (style!.look as CaptionLookId)
    : DEFAULT_CAPTION_STYLE.look;
  const y =
    typeof style?.y === 'number' && Number.isFinite(style.y) ? style.y : DEFAULT_CAPTION_STYLE.y;
  const scale =
    typeof style?.scale === 'number' && Number.isFinite(style.scale)
      ? style.scale
      : DEFAULT_CAPTION_STYLE.scale;
  return {
    look,
    y: Math.min(95, Math.max(5, y)),
    scale: Math.min(CAPTION_SCALE_MAX, Math.max(CAPTION_SCALE_MIN, scale)),
  };
}

export function captionStyleOf(project: VideoProjectV2): CaptionStyle {
  const track = project.tracks.find((candidate) => candidate.kind === 'captions');
  return clampCaptionStyle(track?.captionStyle);
}

/** The project with every captions track set to `style`. */
export function withCaptionStyle(
  project: VideoProjectV2,
  style: Partial<CaptionStyle>
): VideoProjectV2 {
  const next = clampCaptionStyle({ ...captionStyleOf(project), ...style });
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.kind === 'captions' ? { ...track, captionStyle: next } : track
    ),
  };
}

/** Captions use the same looks as text, so a caption and a label can match. */
const LOOK_FOR_CAPTION: Record<CaptionLookId, TextLookId> = {
  highlight: 'bold',
  clean: 'bold',
  outline: 'outline',
  box: 'boxed',
};

/** Caption text at the size of a 1080 wide frame, before the frame scale. */
export const CAPTION_BASE_FONT_SIZE = 56;

export function captionTypography(
  look: CaptionLookId,
  colors: TextLookColors,
  scale = 1
): VideoLayerTypography {
  return {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: Math.round(CAPTION_BASE_FONT_SIZE * scale),
    fontWeight: 800,
    color: '#ffffff',
    lineHeight: 1.2,
    ...textLookById(LOOK_FOR_CAPTION[look]).typography(colors),
  };
}

/** Index of the word being spoken at `ms` into the line: the last one that has started. */
export function activeWordIndex(words: ReadonlyArray<{ startMs: number }>, ms: number): number {
  let active = -1;
  for (let i = 0; i < words.length; i += 1) {
    if (words[i]!.startMs <= ms) active = i;
    else break;
  }
  return active;
}
