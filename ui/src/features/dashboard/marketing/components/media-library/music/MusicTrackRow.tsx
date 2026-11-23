import { useState } from 'react';

import { Bookmark, Check, Loader2, Pause, Play, Plus } from 'lucide-react';

import {
  formatTrackDuration,
  type MusicTrack,
} from '@/features/dashboard/marketing/lib/music/musicTypes';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  track: MusicTrack;
  playing: boolean;
  loading: boolean;
  /** 0 to 1 while this row is the one playing. */
  progress: number;
  onPreview: () => void;
  /** Absent for a row that cannot be added (the library is read only here). */
  onAdd?: () => void;
  /** The song is already in use (an Instagram song picked for the video). */
  selected?: boolean;
  addLabel?: string;
  saved?: boolean;
  onToggleSave?: () => void;
};

function Cover({ track, playing, loading }: Pick<Props, 'track' | 'playing' | 'loading'>) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(track.imageUrl) && !broken;
  return (
    <span className="bg-muted text-foreground relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg">
      {showImage ? (
        <img
          src={track.imageUrl ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : null}
      {/* Always visible: a phone has no hover, so the glyph is what says "tap to hear it". */}
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          showImage || playing || loading ? 'bg-black/35 text-white' : 'text-foreground'
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
    </span>
  );
}

/** One song: tap the cover or title to hear it, bookmark it, or add it. */
export function MusicTrackRow({
  track,
  playing,
  loading,
  progress,
  onPreview,
  onAdd,
  selected = false,
  addLabel = 'Add',
  saved = false,
  onToggleSave,
}: Props) {
  const duration = formatTrackDuration(track.durationSec);
  const canPreview = Boolean(track.streamUrl);
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    if (!onAdd) return;
    onAdd();
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <li
      className={cn(
        'border-border relative flex items-center gap-2 overflow-hidden rounded-xl border p-1.5 pr-1',
        selected && 'border-primary bg-primary/5'
      )}
    >
      <button
        type="button"
        disabled={!canPreview}
        onClick={onPreview}
        aria-label={
          loading
            ? `Loading ${track.title}`
            : playing
              ? `Pause ${track.title}`
              : canPreview
                ? `Play ${track.title}`
                : track.title
        }
        aria-pressed={playing}
        className="group flex min-h-[48px] min-w-0 flex-1 touch-manipulation items-center gap-3 rounded-lg text-left disabled:cursor-default"
      >
        <Cover track={track} playing={playing} loading={loading} />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words text-sm font-medium leading-snug">
            {track.title}
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {[track.artist, duration].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>

      {onToggleSave ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label={saved ? `Remove ${track.title} from saved` : `Save ${track.title}`}
          aria-pressed={saved}
          onClick={onToggleSave}
        >
          <Bookmark className={cn('size-4', saved && 'fill-current')} aria-hidden />
        </Button>
      ) : null}

      {onAdd ? (
        <Button
          type="button"
          variant={selected || justAdded ? 'default' : 'outline'}
          size="icon"
          className="size-11 shrink-0"
          aria-label={selected ? `${track.title} is selected` : `${addLabel} ${track.title}`}
          onClick={handleAdd}
        >
          {selected || justAdded ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
        </Button>
      ) : null}

      {playing ? (
        <span
          aria-hidden
          className="bg-primary absolute bottom-0 left-0 h-0.5 transition-[width] duration-300 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      ) : null}
    </li>
  );
}
