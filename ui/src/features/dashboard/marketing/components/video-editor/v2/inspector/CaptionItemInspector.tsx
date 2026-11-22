import { Trash2 } from 'lucide-react';

import { NumberSlider } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/NumberSlider';
import type { InspectorActions } from '@/features/dashboard/marketing/components/video-editor/v2/inspector/InspectorShared';
import { TimingFields } from '@/features/dashboard/marketing/components/video-editor/v2/inspector/InspectorShared';
import { ChoiceChips } from '@/features/dashboard/marketing/components/video-editor/v2/mobile/ChoiceChips';
import { withCaptionText } from '@/features/dashboard/marketing/lib/video/v2/captionLines';
import {
  CAPTION_LOOKS,
  CAPTION_SCALE_MAX,
  CAPTION_SCALE_MIN,
} from '@/features/dashboard/marketing/lib/video/v2/captionStyle';
import type {
  CaptionItem,
  CaptionLookId,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Props = { item: CaptionItem; actions: InspectorActions };

/** One caption line, and the look shared by every line. */
export function CaptionItemInspector({ item, actions }: Props) {
  const { captionStyle } = actions;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Delete caption"
          onClick={() => actions.remove(item.id)}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`caption-${item.id}`} className="text-xs">
          Caption
        </Label>
        <Textarea
          id={`caption-${item.id}`}
          value={item.text}
          rows={3}
          maxLength={200}
          onChange={(event) =>
            actions.update(item.id, (current) =>
              withCaptionText(current as CaptionItem, event.target.value, actions.project.fps)
            )
          }
        />
      </div>

      <TimingFields item={item} actions={actions} />

      <section className="space-y-3" aria-label="Caption style">
        <p className="text-muted-foreground text-xs">These apply to every caption.</p>
        <ChoiceChips<CaptionLookId>
          label="Look"
          value={captionStyle.look}
          options={CAPTION_LOOKS.map((look) => ({ value: look.id, label: look.label }))}
          onChange={(look) => actions.setCaptionStyle({ look })}
        />
        <NumberSlider
          label="Size"
          unit="%"
          min={Math.round(CAPTION_SCALE_MIN * 100)}
          max={Math.round(CAPTION_SCALE_MAX * 100)}
          step={5}
          value={Math.round(captionStyle.scale * 100)}
          onChange={(value) => actions.setCaptionStyle({ scale: value / 100 })}
        />
        <NumberSlider
          label="Height on screen"
          unit="%"
          min={5}
          max={95}
          step={1}
          value={Math.round(captionStyle.y)}
          onChange={(value) => actions.setCaptionStyle({ y: value })}
        />
      </section>
    </div>
  );
}
