import type { CSSProperties } from 'react';

import {
  TEXT_LOOKS,
  type TextLook,
  type TextLookColors,
  type TextLookId,
} from '@/features/dashboard/marketing/lib/video/v2/textLooks';
import { typographyToCss } from '@/features/dashboard/marketing/lib/video/videoLayerTypography';
import type { VideoLayerTypography } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

import { cn } from '@/lib/utils';

const SAMPLE_BASE: VideoLayerTypography = {
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 52,
  fontWeight: 600,
  color: '#ffffff',
};

/** Photo-like backdrop so light and dark looks both read, as they will on a real video. */
const SWATCH_BACKDROP: CSSProperties = {
  backgroundImage: 'linear-gradient(135deg, #0f766e 0%, #1e293b 55%, #7c2d12 100%)',
};

export function lookPreviewStyle(
  look: TextLook,
  colors: TextLookColors,
  scale = 0.5
): CSSProperties {
  return typographyToCss({ ...SAMPLE_BASE, ...look.typography(colors) }, scale);
}

type Props = {
  value: TextLookId | null;
  colors: TextLookColors;
  onChange: (id: TextLookId) => void;
  /** Sample word shown in every swatch. */
  sample?: string;
};

/** Looks as live previews, not names: one tap restyles the text. */
export function TextLookGallery({ value, colors, onChange, sample = 'Aa' }: Props) {
  return (
    <div role="radiogroup" aria-label="Text style" className="space-y-1.5">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TEXT_LOOKS.map((look) => {
          const selected = look.id === value;
          return (
            <button
              key={look.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={look.label}
              onClick={() => onChange(look.id)}
              className="flex shrink-0 touch-manipulation flex-col items-center gap-1"
            >
              <span
                className={cn(
                  'flex h-16 w-20 items-center justify-center overflow-hidden rounded-lg border-2 max-lg:h-12 max-lg:w-14',
                  selected ? 'border-primary' : 'border-transparent'
                )}
                style={SWATCH_BACKDROP}
              >
                <span style={lookPreviewStyle(look, colors)}>{sample}</span>
              </span>
              <span
                className={cn('text-[11px]', selected ? 'text-primary' : 'text-muted-foreground')}
              >
                {look.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
