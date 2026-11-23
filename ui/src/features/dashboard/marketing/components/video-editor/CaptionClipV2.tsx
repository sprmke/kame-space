import type { CSSProperties } from 'react';

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import {
  activeWordIndex,
  captionTypography,
} from '@/features/dashboard/marketing/lib/video/v2/captionStyle';
import type { TextLookColors } from '@/features/dashboard/marketing/lib/video/v2/textLooks';
import type {
  CaptionItem,
  CaptionStyle,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { typographyToCss } from '@/features/dashboard/marketing/lib/video/videoLayerTypography';
import { scaleForVideoFormat } from '@/features/dashboard/marketing/lib/video/videoTextSlotContent';

type Props = {
  item: CaptionItem;
  style: CaptionStyle;
  colors: TextLookColors;
};

/** A frame of fade on each side keeps a line from popping in and out. */
const FADE_FRAMES = 3;

/**
 * One subtitle line. The look and position come from the captions track, so every line matches.
 * With the Highlight look the word being spoken takes the brand colour.
 */
export function CaptionClipV2({ item, style, colors }: Props) {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const scale = scaleForVideoFormat(width, height);
  const typography = captionTypography(style.look, colors, style.scale);
  const css = typographyToCss(typography, scale);

  const fade = Math.min(FADE_FRAMES, Math.floor(durationInFrames / 3));
  const opacity =
    fade > 0
      ? interpolate(frame, [0, fade, durationInFrames - fade, durationInFrames], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  const ms = (frame / fps) * 1000;
  const active = style.look === 'highlight' ? activeWordIndex(item.words, ms) : -1;
  const words = item.words.length > 0 ? item.words : null;

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: '7%',
          right: '7%',
          top: `${style.y}%`,
          transform: 'translateY(-50%)',
          textAlign: 'center',
        }}
      >
        <span style={css as CSSProperties}>
          {style.look === 'highlight' && words
            ? words.map((word, index) => (
                <span
                  key={`${index}-${word.startMs}`}
                  style={{ color: index === active ? colors.accent : undefined }}
                >
                  {index > 0 ? ' ' : ''}
                  {word.text}
                </span>
              ))
            : item.text}
        </span>
      </div>
    </AbsoluteFill>
  );
}
