import type { MediaDragPayload } from '@/features/dashboard/marketing/lib/media/mediaDrag';
import type { MusicTrack } from '@/features/dashboard/marketing/lib/music/musicTypes';

/**
 * A free-catalog track (Jamendo or Audius) as a clip the editor can place. The stream plays in
 * preview; export caches it. Instagram songs and tracks with no stream are not clips: Instagram
 * adds its songs when a Reel is posted (see `InstagramSong`).
 */
export function payloadFromTrack(track: MusicTrack): MediaDragPayload | null {
  if (!track.exportable || !track.streamUrl) return null;
  if (track.source !== 'jamendo' && track.source !== 'audius') return null;
  return {
    kind: 'audio',
    url: track.streamUrl,
    assetId: null,
    source: track.source,
    width: null,
    height: null,
    durationMs: track.durationSec > 0 ? Math.round(track.durationSec * 1000) : null,
    posterUrl: null,
    title: track.title,
    artist: track.artist,
    trackId: track.id,
  };
}
