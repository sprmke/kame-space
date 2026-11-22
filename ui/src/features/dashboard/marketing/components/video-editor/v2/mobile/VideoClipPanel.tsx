import { Check } from 'lucide-react';

import { NumberSlider } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/NumberSlider';
import type { InspectorActions } from '@/features/dashboard/marketing/components/video-editor/v2/inspector/InspectorShared';
import { ChoiceChips } from '@/features/dashboard/marketing/components/video-editor/v2/mobile/ChoiceChips';
import { TextLookGallery } from '@/features/dashboard/marketing/components/video-editor/v2/TextLookGallery';
import { VideoTextStyleControls } from '@/features/dashboard/marketing/components/video-editor/VideoTextStyleControls';
import type { PhoneToolAction } from '@/features/dashboard/marketing/lib/video/v2/phoneTools';
import {
  applyTextLook,
  detectTextLook,
} from '@/features/dashboard/marketing/lib/video/v2/textLooks';
import {
  isAudioItem,
  isLayerItem,
  isMediaItem,
  VIDEO_PLAYBACK_RATES,
  type LayerItem,
  type MediaItem,
  type TextAnimation,
  type VideoItem,
  type VideoPlaybackRate,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { VIDEO_MOTION_OVERRIDES } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import type { VideoSceneLayer } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const PANEL_TITLES: Partial<Record<PhoneToolAction, string>> = {
  'clip-speed': 'Speed',
  'clip-volume': 'Volume',
  'clip-fade': 'Fade',
  'clip-duration': 'Duration',
  'clip-fit': 'Fit',
  'clip-motion': 'Motion',
  'clip-adjust': 'Adjust',
  'clip-animation': 'Animation',
  'clip-edit': 'Edit text',
  'clip-style': 'Text style',
};

/** Tools that open a panel above the strip. Every other tool just runs. */
export const PANEL_ACTIONS: ReadonlySet<PhoneToolAction> = new Set(
  Object.keys(PANEL_TITLES) as PhoneToolAction[]
);

const ENTRANCES: Array<{ value: TextAnimation; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'rise', label: 'Rise' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'pop', label: 'Pop' },
  { value: 'typewriter', label: 'Typing' },
];
const EXITS = ENTRANCES.filter((option) => option.value !== 'typewriter');

const MOTIONS = [{ value: 'template', label: 'Auto' }, ...VIDEO_MOTION_OVERRIDES];

type Props = {
  action: PhoneToolAction;
  item: VideoItem;
  actions: InspectorActions;
  onClose: () => void;
};

/**
 * One small panel above the tool strip, for the tool that was just tapped. It stays short so
 * the preview remains visible while a value changes (the old Edit sheet covered it).
 */
export function VideoClipPanel({ action, item, actions, onClose }: Props) {
  const title = PANEL_TITLES[action] ?? 'Edit';
  return (
    <section
      aria-label={title}
      className="border-border bg-card max-h-[40dvh] shrink-0 overflow-y-auto overscroll-contain border-t px-4 pb-3 pt-2"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Close panel"
          onClick={onClose}
        >
          <Check className="size-5" aria-hidden />
        </Button>
      </div>
      <div className="space-y-4">
        <PanelBody action={action} item={item} actions={actions} />
      </div>
    </section>
  );
}

function PanelBody({ action, item, actions }: Omit<Props, 'onClose'>) {
  const { fps } = actions.project;
  const toSeconds = (frames: number) => Math.round((frames / fps) * 10) / 10;
  const patch = (changes: Partial<VideoItem>) =>
    actions.update(item.id, (current) => ({ ...current, ...changes }) as VideoItem);

  switch (action) {
    case 'clip-speed': {
      if (item.type !== 'video') return null;
      return (
        <ChoiceChips<string>
          label="How fast it plays"
          value={String(item.playbackRate ?? 1)}
          options={VIDEO_PLAYBACK_RATES.map((rate) => ({ value: String(rate), label: `${rate}x` }))}
          onChange={(value) => actions.setRate(item.id, Number(value) as VideoPlaybackRate)}
        />
      );
    }
    case 'clip-volume': {
      if (!isMediaItem(item) && !isAudioItem(item)) return null;
      const volume = (item as MediaItem).volume ?? 1;
      return (
        <>
          <NumberSlider
            label="Volume"
            unit="%"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            onChange={(value) => patch({ volume: value / 100 } as Partial<VideoItem>)}
          />
          {item.type === 'video' ? (
            <div className="flex min-h-[44px] items-center justify-between">
              <span className="text-sm">Sound off</span>
              <Switch
                aria-label="Sound off"
                checked={item.muted === true}
                onCheckedChange={(checked) => patch({ muted: checked } as Partial<VideoItem>)}
              />
            </div>
          ) : null}
        </>
      );
    }
    case 'clip-fade': {
      if (!isAudioItem(item)) return null;
      const max = toSeconds(item.durationInFrames);
      return (
        <>
          <NumberSlider
            label="Fade in"
            unit="s"
            min={0}
            max={max}
            step={0.1}
            value={toSeconds(item.fadeInFrames ?? 0)}
            onChange={(value) =>
              patch({ fadeInFrames: Math.round(value * fps) } as Partial<VideoItem>)
            }
          />
          <NumberSlider
            label="Fade out"
            unit="s"
            min={0}
            max={max}
            step={0.1}
            value={toSeconds(item.fadeOutFrames ?? 0)}
            onChange={(value) =>
              patch({ fadeOutFrames: Math.round(value * fps) } as Partial<VideoItem>)
            }
          />
        </>
      );
    }
    case 'clip-duration':
      return (
        <NumberSlider
          label="Seconds on screen"
          unit="s"
          min={0.1}
          max={60}
          step={0.1}
          value={toSeconds(item.durationInFrames)}
          onChange={(value) => actions.trim(item.id, 'end', item.from + Math.round(value * fps))}
        />
      );
    case 'clip-fit': {
      if (!isMediaItem(item)) return null;
      return (
        <ChoiceChips<MediaItem['fit']>
          label="How it sits in the frame"
          value={item.fit}
          options={[
            { value: 'cover', label: 'Fill' },
            { value: 'contain', label: 'Fit' },
          ]}
          onChange={(fit) => patch({ fit } as Partial<VideoItem>)}
        />
      );
    }
    case 'clip-motion': {
      if (item.type !== 'image') return null;
      return (
        <ChoiceChips<string>
          label="Camera movement"
          value={item.motion ?? 'template'}
          options={MOTIONS}
          onChange={(value) =>
            patch({ motion: value === 'template' ? undefined : value } as Partial<VideoItem>)
          }
        />
      );
    }
    case 'clip-adjust': {
      if (!isMediaItem(item)) return null;
      const adjust = item.adjust ?? { brightness: 1, contrast: 1, saturation: 1 };
      const set = (key: keyof typeof adjust, value: number) =>
        patch({ adjust: { ...adjust, [key]: value / 100 } } as Partial<VideoItem>);
      return (
        <>
          <NumberSlider
            label="Brightness"
            unit="%"
            min={0}
            max={200}
            value={Math.round(adjust.brightness * 100)}
            onChange={(value) => set('brightness', value)}
          />
          <NumberSlider
            label="Contrast"
            unit="%"
            min={0}
            max={200}
            value={Math.round(adjust.contrast * 100)}
            onChange={(value) => set('contrast', value)}
          />
          <NumberSlider
            label="Color"
            unit="%"
            min={0}
            max={200}
            value={Math.round(adjust.saturation * 100)}
            onChange={(value) => set('saturation', value)}
          />
        </>
      );
    }
    case 'clip-animation': {
      if (!isLayerItem(item)) return null;
      const setAnimation = (key: 'animationIn' | 'animationOut', type: TextAnimation) =>
        actions.update(item.id, (current) => {
          const base = { ...(current as LayerItem) };
          const duration = (base[key]?.durationInFrames ?? 12) || 12;
          if (type === 'none') delete base[key];
          else base[key] = { type, durationInFrames: duration };
          return base;
        });
      return (
        <>
          <ChoiceChips<TextAnimation>
            label="Comes in"
            value={item.animationIn?.type ?? 'none'}
            options={ENTRANCES}
            onChange={(type) => setAnimation('animationIn', type)}
          />
          <ChoiceChips<TextAnimation>
            label="Goes out"
            value={item.animationOut?.type ?? 'none'}
            options={EXITS}
            onChange={(type) => setAnimation('animationOut', type)}
          />
        </>
      );
    }
    case 'clip-edit': {
      if (!isLayerItem(item)) return null;
      const layer = item.layer;
      return (
        <Textarea
          aria-label="Text"
          value={layer.text ?? ''}
          rows={3}
          maxLength={500}
          autoFocus
          onChange={(event) =>
            actions.update(item.id, (current) => ({
              ...(current as LayerItem),
              layer: { ...(current as LayerItem).layer, text: event.target.value },
            }))
          }
        />
      );
    }
    case 'clip-style': {
      if (!isLayerItem(item)) return null;
      return (
        <>
          <TextLookGallery
            value={detectTextLook(item.layer, actions.lookColors)}
            colors={actions.lookColors}
            onChange={(look) =>
              actions.update(item.id, (current) => ({
                ...(current as LayerItem),
                layer: applyTextLook((current as LayerItem).layer, look, actions.lookColors),
              }))
            }
          />
          <details className="group">
            <summary className="text-primary flex min-h-[44px] cursor-pointer list-none items-center text-sm font-medium">
              More options
            </summary>
            <div className="pt-2">
              <VideoTextStyleControls
                showTextInput={false}
                layer={item.layer}
                templateTypography={actions.typography}
                onChange={(changes: Partial<VideoSceneLayer>) =>
                  actions.update(item.id, (current) => ({
                    ...(current as LayerItem),
                    layer: { ...(current as LayerItem).layer, ...changes },
                  }))
                }
              />
            </div>
          </details>
        </>
      );
    }
    default:
      return null;
  }
}
