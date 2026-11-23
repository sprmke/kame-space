import { Check } from 'lucide-react';

import { TextPresetGrid } from '@/features/dashboard/marketing/components/video-editor/v2/TextPresetGrid';
import type { TextPreset, TextPresetId } from '@/features/dashboard/marketing/lib/video/v2/editorCommands';
import type { TextLookColors } from '@/features/dashboard/marketing/lib/video/v2/textLooks';

import { Button } from '@/components/ui/button';

type Props = {
  presets: TextPreset[];
  colors: TextLookColors;
  disabled?: boolean;
  onPick: (id: TextPresetId) => void;
  onClose: () => void;
};

/**
 * Docked "pick a text look" panel. Keeps the preview visible (unlike the old media rail sheet)
 * so the host can choose Headline / Price / Location before anything is placed.
 */
export function VideoTextPickPanel({ presets, colors, disabled, onPick, onClose }: Props) {
  return (
    <section
      aria-label="Add text"
      className="border-border bg-card max-h-[min(220px,28dvh)] shrink-0 overflow-y-auto overscroll-contain border-t px-3 pb-2 pt-1.5"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Add text</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="admin-overflow-trigger"
          aria-label="Close panel"
          onClick={onClose}
        >
          <Check className="size-4" aria-hidden />
        </Button>
      </div>
      <TextPresetGrid presets={presets} colors={colors} disabled={disabled} onPick={onPick} />
    </section>
  );
}
