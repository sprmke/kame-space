import { Link } from 'react-router-dom';

import { Loader2 } from 'lucide-react';

import { MusicTrackRow } from '@/features/dashboard/marketing/components/media-library/music/MusicTrackRow';
import { useInstagramMusic } from '@/features/dashboard/marketing/hooks/useMarketingMusic';
import {
  musicTrackKey,
  type MusicTrack,
} from '@/features/dashboard/marketing/lib/music/musicTypes';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export type InstagramPickerConfig = {
  /** The song already chosen for this video, if any. */
  selectedAudioId: string | null;
  onPick: (track: MusicTrack) => void;
  /** Where to connect Instagram when no account is linked. */
  connectHref: string;
};

type Preview = {
  playingKey: string | null;
  loadingKey: string | null;
  progressKey: string | null;
  progress: number;
  toggle: (key: string, url: string | null | undefined) => void;
};

type Props = {
  propertyId: string | null;
  query: string;
  config: InstagramPickerConfig;
  preview: Preview;
};

function Notice({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="space-y-3 py-8 text-center" role="status">
      <p className="text-muted-foreground text-sm">{title}</p>
      {action}
    </div>
  );
}

/** Trending Instagram music for Reels, or a search. Instagram mixes the song in when posting. */
export function InstagramMusicPanel({ propertyId, query, config, preview }: Props) {
  const music = useInstagramMusic(propertyId, { q: query });
  const status = music.data?.instagram.status;
  const tracks = music.data?.tracks ?? [];

  if (music.isPending) {
    return (
      <div className="space-y-2" aria-busy aria-label="Loading Instagram music">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[60px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (music.isError || status === 'error') {
    return (
      <Notice
        title="Instagram music could not load"
        action={
          <Button type="button" size="sm" variant="outline" onClick={() => void music.refetch()}>
            {music.isFetching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Try again
          </Button>
        }
      />
    );
  }

  if (status === 'not_connected') {
    return (
      <Notice
        title="Connect Instagram to browse its music"
        action={
          <Button asChild size="sm" variant="outline">
            <Link to={config.connectHref}>Connect Instagram</Link>
          </Button>
        }
      />
    );
  }

  if (status === 'reconnect') {
    return (
      <Notice
        title="Reconnect Instagram to browse its music"
        action={
          <Button asChild size="sm" variant="outline">
            <Link to={config.connectHref}>Reconnect</Link>
          </Button>
        }
      />
    );
  }

  if (status === 'no_access') {
    return (
      <Notice title="Instagram music is not available for this account. Pick a song from Music instead." />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Instagram adds the song when you post a Reel. It is not in a downloaded video.
      </p>
      {tracks.length === 0 ? (
        <Notice title="No songs found" />
      ) : (
        <ul className="space-y-2" aria-label="Instagram music">
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
                onAdd={() => config.onPick(track)}
                addLabel="Use"
                selected={config.selectedAudioId === track.id}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
