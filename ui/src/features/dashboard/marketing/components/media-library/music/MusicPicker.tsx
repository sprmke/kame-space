import { useEffect, useMemo, useState } from 'react';

import { Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  InstagramMusicPanel,
  type InstagramPickerConfig,
} from '@/features/dashboard/marketing/components/media-library/music/InstagramMusicPanel';
import {
  MusicGroupChips,
  SAVED_GROUP,
} from '@/features/dashboard/marketing/components/media-library/music/MusicGroupChips';
import { MusicTrackRow } from '@/features/dashboard/marketing/components/media-library/music/MusicTrackRow';
import { useAudioPreview } from '@/features/dashboard/marketing/hooks/useAudioPreview';
import { useMusicBrowse } from '@/features/dashboard/marketing/hooks/useMarketingMusic';
import { useSavedMusic } from '@/features/dashboard/marketing/hooks/useSavedMusic';
import type { MediaDragPayload } from '@/features/dashboard/marketing/lib/media/mediaDrag';
import { payloadFromTrack } from '@/features/dashboard/marketing/lib/media/musicPayload';
import {
  DEFAULT_MUSIC_GROUP,
  musicTrackKey,
  type MusicTrack,
} from '@/features/dashboard/marketing/lib/music/musicTypes';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Scope = 'library' | 'instagram';

type Props = {
  /** Adds a free track to the timeline. */
  onPick?: (payload: MediaDragPayload) => void;
  /** Turns on the Instagram tab (video editor only). */
  instagram?: InstagramPickerConfig | null;
  className?: string;
};

const SEARCH_DEBOUNCE_MS = 350;

function ScopeSwitch({ value, onChange }: { value: Scope; onChange: (next: Scope) => void }) {
  const items: Array<{ id: Scope; label: string }> = [
    { id: 'library', label: 'In video' },
    { id: 'instagram', label: 'Instagram' },
  ];
  return (
    <div
      role="group"
      aria-label="Music source"
      className="bg-muted grid grid-cols-2 gap-1 rounded-full p-1"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            'min-h-[40px] touch-manipulation rounded-full text-sm font-medium transition-colors',
            value === item.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Music for a video: trending and popular songs, genres, moods and "for stays" collections from
 * the free catalogs (these go into the exported file), plus Instagram's own music for Reels.
 */
export function MusicPicker({ onPick, instagram = null, className }: Props) {
  const propertyId = usePropertyIdParam();
  const [scope, setScope] = useState<Scope>('library');
  const [group, setGroup] = useState<string>(DEFAULT_MUSIC_GROUP);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const preview = useAudioPreview();
  const saved = useSavedMusic(propertyId);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // A new list means the clip that was playing is no longer on screen.
  const { stop } = preview;
  useEffect(() => {
    stop();
  }, [scope, group, debounced, stop]);

  const searching = debounced.length > 0;
  const showingSaved = scope === 'library' && group === SAVED_GROUP && !searching;
  const browse = useMusicBrowse(propertyId, {
    group: group === SAVED_GROUP ? DEFAULT_MUSIC_GROUP : group,
    q: debounced,
    enabled: scope === 'library' && !showingSaved,
  });

  const tracks = useMemo<MusicTrack[]>(() => {
    if (showingSaved) return saved.tracks;
    const seen = new Set<string>();
    const out: MusicTrack[] = [];
    for (const page of browse.data?.pages ?? []) {
      for (const track of page.tracks) {
        const key = musicTrackKey(track);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(track);
      }
    }
    return out;
  }, [showingSaved, saved.tracks, browse.data]);

  const handleAdd = (track: MusicTrack) => {
    const payload = payloadFromTrack(track);
    if (!payload || !onPick) {
      toast.message('This track cannot be added to a video');
      return;
    }
    preview.stop();
    onPick(payload);
  };

  const sourcesOff =
    browse.data?.pages[0]?.sources.jamendo !== 'ok' &&
    browse.data?.pages[0]?.sources.audius !== 'ok';

  const body = (() => {
    if (scope === 'instagram' && instagram) {
      return (
        <InstagramMusicPanel
          propertyId={propertyId}
          query={debounced}
          config={instagram}
          preview={preview}
        />
      );
    }

    if (!showingSaved && browse.isPending) {
      return (
        <div className="space-y-2" aria-busy aria-label="Loading music">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[60px] rounded-xl" />
          ))}
        </div>
      );
    }

    if (!showingSaved && browse.isError) {
      return (
        <div className="space-y-3 py-8 text-center" role="status">
          <p className="text-muted-foreground text-sm">Music could not load</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void browse.refetch()}>
            Try again
          </Button>
        </div>
      );
    }

    if (tracks.length === 0) {
      return (
        <p className="text-muted-foreground py-8 text-center text-sm" role="status">
          {showingSaved
            ? 'Tap the bookmark on a song to save it here'
            : sourcesOff
              ? 'Music is not available right now'
              : searching
                ? 'No songs found. Try another word.'
                : 'No songs here yet'}
        </p>
      );
    }

    return (
      <div className="space-y-3">
        <ul className="space-y-2" aria-label={showingSaved ? 'Saved music' : 'Music'}>
          {tracks.map((track) => {
            const key = musicTrackKey(track);
            return (
              <MusicTrackRow
                key={key}
                track={track}
                playing={preview.playingKey === key}
                loading={preview.loadingKey === key}
                progress={preview.progressKey === key ? preview.progress : 0}
                onPreview={() => preview.toggle(key, track.streamUrl)}
                onAdd={onPick ? () => handleAdd(track) : undefined}
                saved={saved.isSaved(track)}
                onToggleSave={() => saved.toggle(track)}
              />
            );
          })}
        </ul>
        {!showingSaved && browse.hasNextPage ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            disabled={browse.isFetchingNextPage}
            onClick={() => void browse.fetchNextPage()}
          >
            {browse.isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Show more
          </Button>
        ) : null}
      </div>
    );
  })();

  return (
    <div className={cn('space-y-3', className)}>
      {instagram ? <ScopeSwitch value={scope} onChange={setScope} /> : null}

      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={scope === 'instagram' ? 'Search Instagram music' : 'Search music'}
          aria-label={scope === 'instagram' ? 'Search Instagram music' : 'Search music'}
          className="h-11 pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {scope === 'library' && !searching ? (
        <MusicGroupChips value={group} onChange={setGroup} savedCount={saved.tracks.length} />
      ) : null}

      {body}
    </div>
  );
}
