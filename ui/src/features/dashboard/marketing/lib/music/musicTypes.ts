/**
 * Music picker types shared by the hooks and components. The server twin is
 * `supabase/functions/_shared/musicTypes.ts`; `musicGroupsParity.test.ts` keeps the group list in
 * step with `_shared/musicGroups.ts`.
 */

export type MusicSource = 'jamendo' | 'audius' | 'instagram';

export type MusicTrack = {
  /** Id inside its own source. Unique only together with `source`. */
  id: string;
  source: MusicSource;
  title: string;
  artist: string;
  durationSec: number;
  imageUrl: string | null;
  /** Playable URL for previews. Null when the source gave none (some Instagram songs). */
  streamUrl: string | null;
  /** False for Instagram songs: Instagram adds them when a Reel is posted. */
  exportable: boolean;
  genre?: string | null;
  mood?: string | null;
};

/** Older name, kept so Jamendo-only code keeps reading naturally. */
export type JamendoTrack = MusicTrack;

export type MusicSourceStatus = 'ok' | 'off' | 'error';

export type MusicGroupKind = 'trending' | 'genre' | 'mood' | 'collection';

export type MusicGroup = { slug: string; label: string; kind: MusicGroupKind };

/** Order is the order of the chips. Slugs must match the server list. */
export const MUSIC_GROUPS: readonly MusicGroup[] = [
  { slug: 'trending', label: 'Trending', kind: 'trending' },
  { slug: 'popular', label: 'Popular', kind: 'trending' },
  { slug: 'chill', label: 'Chill', kind: 'genre' },
  { slug: 'pop', label: 'Pop', kind: 'genre' },
  { slug: 'acoustic', label: 'Acoustic', kind: 'genre' },
  { slug: 'electronic', label: 'Electronic', kind: 'genre' },
  { slug: 'hip-hop', label: 'Hip-hop', kind: 'genre' },
  { slug: 'jazz', label: 'Jazz', kind: 'genre' },
  { slug: 'cinematic', label: 'Cinematic', kind: 'genre' },
  { slug: 'happy', label: 'Happy', kind: 'mood' },
  { slug: 'calm', label: 'Calm', kind: 'mood' },
  { slug: 'romantic', label: 'Romantic', kind: 'mood' },
  { slug: 'energetic', label: 'Energetic', kind: 'mood' },
  { slug: 'beach-day', label: 'Beach day', kind: 'collection' },
  { slug: 'city-nights', label: 'City nights', kind: 'collection' },
  { slug: 'cozy-weekend', label: 'Cozy weekend', kind: 'collection' },
  { slug: 'family-trip', label: 'Family trip', kind: 'collection' },
] as const;

export const DEFAULT_MUSIC_GROUP = 'trending';

export type InstagramMusicStatus = 'ok' | 'not_connected' | 'no_access' | 'reconnect' | 'error';

/** Stable key for lists, previews and saved tracks. */
export function musicTrackKey(track: Pick<MusicTrack, 'source' | 'id'>): string {
  return `${track.source}:${track.id}`;
}

/** `m:ss`. Zero or invalid becomes an empty string, so a row never shows `0:00`. */
export function formatTrackDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
