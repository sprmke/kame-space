import { lookPreviewStyle } from '@/features/dashboard/marketing/components/video-editor/v2/TextLookGallery';
import type { TextPreset } from '@/features/dashboard/marketing/lib/video/v2/editorCommands';
import {
  textLookById,
  type TextLookColors,
} from '@/features/dashboard/marketing/lib/video/v2/textLooks';

type Props = {
  presets: TextPreset[];
  colors: TextLookColors;
  disabled?: boolean;
  onPick: (id: TextPreset['id']) => void;
};

/** Add text as a picture of what you get, not a list of names. */
export function TextPresetGrid({ presets, colors, disabled, onPick }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {presets.map((preset) => {
        const style =
          preset.kind === 'cta'
            ? {
                ...lookPreviewStyle(textLookById('classic'), colors, 0.45),
                backgroundColor: colors.accent,
                color: colors.onAccent,
                borderRadius: 999,
                padding: '6px 18px',
                display: 'inline-block',
              }
            : lookPreviewStyle(textLookById(preset.look ?? 'classic'), colors, 0.45);
        return (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(preset.id)}
            className="border-border hover:bg-muted/50 flex min-h-[88px] touch-manipulation flex-col items-center justify-between gap-2 rounded-xl border p-2 text-left disabled:opacity-50"
          >
            <span
              className="flex h-14 w-full items-center justify-center overflow-hidden rounded-lg"
              style={{
                backgroundImage: 'linear-gradient(135deg, #0f766e 0%, #1e293b 55%, #7c2d12 100%)',
              }}
            >
              <span style={style} className="max-w-full truncate">
                {preset.kind === 'cta' ? preset.text : 'Aa'}
              </span>
            </span>
            <span className="text-xs font-medium">{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}
