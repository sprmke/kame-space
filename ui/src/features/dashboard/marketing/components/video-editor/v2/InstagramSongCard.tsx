import { useState } from 'react';

import { Loader2, Pause, Play, X } from 'lucide-react';
import { toast } from 'sonner';

import { NumberSlider } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/NumberSlider';
import { useAudioPreview } from '@/features/dashboard/marketing/hooks/useAudioPreview';
import { fetchInstagramSong } from '@/features/dashboard/marketing/hooks/useMarketingMusic';
import { formatTrackDuration } from '@/features/dashboard/marketing/lib/music/musicTypes';
import type { InstagramSong } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  song: InstagramSong;
  propertyId: string | null;
  readOnly?: boolean;
  onRemove: () => void;
  /** Present in the inspector: shows the volume slider and the one-line explanation. */
  onVolumeChange?: (volume: number) => void;
  className?: string;
};

/**
 * The song Instagram will add when this video is posted as a Reel. Preview links expire, so each
 * play asks for a fresh one; the saved project keeps only the song's id.
 */
export function InstagramSongCard({
  song,
  propertyId,
  readOnly = false,
  onRemove,
  onVolumeChange,
  className,
}: Props) {
  const preview = useAudioPreview();
  const [fetching, setFetching] = useState(false);
  const key = `instagram:${song.audioId}`;
  const playing = preview.playingKey === key;
  const loading = fetching || preview.loadingKey === key;
  const duration = formatTrackDuration(song.durationSec);
  // The bar over the timeline stays slim; the inspector gets the full card with the slider.
  const compact = !onVolumeChange;

  const handlePlay = async () => {
    if (playing || preview.loadingKey === key) {
      preview.stop();
      return;
    }
    setFetching(true);
    try {
      const fresh = await fetchInstagramSong(propertyId, song.audioId);
      if (!fresh.streamUrl) {
        toast.message('Instagram has no preview for this song');
        return;
      }
      preview.toggle(key, fresh.streamUrl);
    } catch {
      toast.message('Could not load the preview');
    } finally {
      setFetching(false);
    }
  };

  return (
    <section
      aria-label="Instagram song"
      className={cn(
        'border-border bg-card rounded-xl border',
        compact ? 'p-1.5' : 'space-y-3 p-2',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handlePlay()}
          aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
          className={cn(
            'bg-muted text-muted-foreground relative flex shrink-0 touch-manipulation items-center justify-center overflow-hidden rounded-lg',
            compact ? 'size-11' : 'size-12'
          )}
        >
          {song.imageUrl ? (
            <img src={song.imageUrl} alt="" className="size-full object-cover" />
          ) : null}
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              song.imageUrl ? 'bg-black/35 text-white' : 'text-foreground'
            )}
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : playing ? (
              <Pause className="size-5 fill-current" aria-hidden />
            ) : (
              <Play className="size-5 fill-current" aria-hidden />
            )}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{song.title}</p>
          <p className="text-muted-foreground truncate text-xs">
            {['Instagram', song.artist, duration].filter(Boolean).join(' · ')}
          </p>
        </div>
        {readOnly ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Remove Instagram song"
            onClick={() => {
              preview.stop();
              onRemove();
            }}
          >
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </div>

      {onVolumeChange ? (
        <>
          <NumberSlider
            label="Song volume"
            unit="%"
            min={1}
            max={100}
            step={1}
            value={song.volume}
            onChange={onVolumeChange}
          />
          <p className="text-muted-foreground text-xs">
            Instagram adds this song when you post as a Reel. It is not in a downloaded video.
          </p>
        </>
      ) : null}
    </section>
  );
}
