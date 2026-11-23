import { Check } from 'lucide-react';

import type { InspectorActions } from '@/features/dashboard/marketing/components/video-editor/v2/inspector/InspectorShared';
import { ChoiceChips } from '@/features/dashboard/marketing/components/video-editor/v2/mobile/ChoiceChips';
import { PanelSlider } from '@/features/dashboard/marketing/components/video-editor/v2/mobile/PanelSlider';
import { TextLookGallery } from '@/features/dashboard/marketing/components/video-editor/v2/TextLookGallery';
import { VideoTextStyleControls } from '@/features/dashboard/marketing/components/video-editor/VideoTextStyleControls';
import { withCaptionText } from '@/features/dashboard/marketing/lib/video/v2/captionLines';
import {
  CAPTION_LOOKS,
  CAPTION_SCALE_MAX,
  CAPTION_SCALE_MIN,
} from '@/features/dashboard/marketing/lib/video/v2/captionStyle';
import type { PhoneToolAction } from '@/features/dashboard/marketing/lib/video/v2/phoneTools';
import {
  applyTextLook,
  detectTextLook,
} from '@/features/dashboard/marketing/lib/video/v2/textLooks';
import {
  isAudioItem,
  isCaptionItem,
  isLayerItem,
  isMediaItem,
  VIDEO_PLAYBACK_RATES,
  type CaptionItem,
  type CaptionLookId,
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
  'clip-duck': 'Lower for voice',
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
  { value: 'typewriter', label: 'Typewriter' },
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
      className="border-border bg-card max-h-[min(220px,28dvh)] shrink-0 overflow-y-auto overscroll-contain border-t px-3 pb-2 pt-1.5"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
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
      <div className="space-y-3">
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
          <PanelSlider
            label="Volume"
            unit="%"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            onChange={(value) => patch({ volume: value / 100 } as Partial<VideoItem>)}
          />
          {item.type === 'video' ? (
            <div className="flex h-9 min-h-0 items-center justify-between">
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
          <PanelSlider
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
          <PanelSlider
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
    case 'clip-duck': {
      if (!isAudioItem(item)) return null;
      return (
        <div className="flex h-9 min-h-0 items-center justify-between gap-3">
          <span className="text-sm">Lower this when someone talks</span>
          <Switch
            aria-label="Lower this when someone talks"
            checked={item.duckUnderVoice !== false}
            onCheckedChange={(checked) =>
              patch({ duckUnderVoice: checked ? undefined : false } as Partial<VideoItem>)
            }
          />
        </div>
      );
    }
    case 'clip-duration':
      return (
        <PanelSlider
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
          <PanelSlider
            label="Brightness"
            unit="%"
            min={0}
            max={200}
            value={Math.round(adjust.brightness * 100)}
            onChange={(value) => set('brightness', value)}
          />
          <PanelSlider
            label="Contrast"
            unit="%"
            min={0}
            max={200}
            value={Math.round(adjust.contrast * 100)}
            onChange={(value) => set('contrast', value)}
          />
          <PanelSlider
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
      if (isCaptionItem(item)) {
        return (
          <Textarea
            aria-label="Caption"
            value={item.text}
            rows={2}
            maxLength={200}
            autoFocus
            onChange={(event) =>
              actions.update(item.id, (current) =>
                withCaptionText(current as CaptionItem, event.target.value, actions.project.fps)
              )
            }
          />
        );
      }
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
      if (isCaptionItem(item)) {
        const { captionStyle } = actions;
        return (
          <>
            <ChoiceChips<CaptionLookId>
              label="Look for every caption"
              value={captionStyle.look}
              options={CAPTION_LOOKS.map((look) => ({ value: look.id, label: look.label }))}
              onChange={(look) => actions.setCaptionStyle({ look })}
            />
            <PanelSlider
              label="Size"
              unit="%"
              min={Math.round(CAPTION_SCALE_MIN * 100)}
              max={Math.round(CAPTION_SCALE_MAX * 100)}
              step={5}
              value={Math.round(captionStyle.scale * 100)}
              onChange={(value) => actions.setCaptionStyle({ scale: value / 100 })}
            />
            <PanelSlider
              label="Height on screen"
              unit="%"
              min={5}
              max={95}
              value={Math.round(captionStyle.y)}
              onChange={(value) => actions.setCaptionStyle({ y: value })}
            />
          </>
        );
      }
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
            <summary className="text-primary flex h-9 min-h-0 cursor-pointer list-none items-center text-sm font-medium">
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
