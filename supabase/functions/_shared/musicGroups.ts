/**
 * Music picker groups (Trending, genres, moods, "For stays" collections).
 *
 * Pure data, no imports: the UI keeps a label mirror and `musicGroupsParity.test.ts` fails if the
 * two drift. Each group says how to ask each free source for it. Jamendo takes tags; Audius takes
 * a genre (trending) or a search with a mood.
 */

export type MusicGroupKind = 'trending' | 'genre' | 'mood' | 'collection';

export type JamendoGroupQuery = {
  order: 'popularity_week' | 'popularity_month' | 'popularity_total';
  /** Space separated. A track must carry every tag. */
  tags?: string;
  /** Space separated. A track may carry any tag; the best match comes first. */
  fuzzytags?: string;
};

export type AudiusGroupQuery = {
  /** Audius genre name. Without a query this uses the trending list. */
  genre?: string;
  /** Audius mood name. Needs the search endpoint. */
  mood?: string;
  /** Free text. Needs the search endpoint. */
  query?: string;
  /** Window for the trending list. */
  time: 'week' | 'month' | 'allTime';
};

export type MusicGroupDef = {
  slug: string;
  label: string;
  kind: MusicGroupKind;
  jamendo: JamendoGroupQuery;
  audius: AudiusGroupQuery;
};

export const MUSIC_GROUPS: readonly MusicGroupDef[] = [
  {
    slug: 'trending',
    label: 'Trending',
    kind: 'trending',
    jamendo: { order: 'popularity_week' },
    audius: { time: 'week' },
  },
  {
    slug: 'popular',
    label: 'Popular',
    kind: 'trending',
    jamendo: { order: 'popularity_month' },
    audius: { time: 'month' },
  },
  {
    slug: 'chill',
    label: 'Chill',
    kind: 'genre',
    jamendo: { order: 'popularity_month', fuzzytags: 'lofi chillout downtempo' },
    audius: { genre: 'Lo-Fi', time: 'month' },
  },
  {
    slug: 'pop',
    label: 'Pop',
    kind: 'genre',
    jamendo: { order: 'popularity_month', tags: 'pop' },
    audius: { genre: 'Pop', time: 'month' },
  },
  {
    slug: 'acoustic',
    label: 'Acoustic',
    kind: 'genre',
    jamendo: { order: 'popularity_month', tags: 'acoustic' },
    audius: { genre: 'Acoustic', time: 'month' },
  },
  {
    slug: 'electronic',
    label: 'Electronic',
    kind: 'genre',
    jamendo: { order: 'popularity_month', tags: 'electronic' },
    audius: { genre: 'Electronic', time: 'month' },
  },
  {
    slug: 'hip-hop',
    label: 'Hip-hop',
    kind: 'genre',
    jamendo: { order: 'popularity_month', tags: 'hiphop' },
    audius: { genre: 'Hip-Hop/Rap', time: 'month' },
  },
  {
    slug: 'jazz',
    label: 'Jazz',
    kind: 'genre',
    jamendo: { order: 'popularity_month', tags: 'jazz' },
    audius: { genre: 'Jazz', time: 'month' },
  },
  {
    slug: 'cinematic',
    label: 'Cinematic',
    kind: 'genre',
    jamendo: { order: 'popularity_month', fuzzytags: 'cinematic soundtrack epic' },
    audius: { genre: 'Soundtrack', time: 'month' },
  },
  {
    slug: 'happy',
    label: 'Happy',
    kind: 'mood',
    jamendo: { order: 'popularity_month', fuzzytags: 'happy upbeat positive' },
    audius: { mood: 'Upbeat', time: 'month' },
  },
  {
    slug: 'calm',
    label: 'Calm',
    kind: 'mood',
    jamendo: { order: 'popularity_month', fuzzytags: 'calm relaxing peaceful' },
    audius: { mood: 'Peaceful', time: 'month' },
  },
  {
    slug: 'romantic',
    label: 'Romantic',
    kind: 'mood',
    jamendo: { order: 'popularity_month', fuzzytags: 'romantic love' },
    audius: { mood: 'Romantic', time: 'month' },
  },
  {
    slug: 'energetic',
    label: 'Energetic',
    kind: 'mood',
    jamendo: { order: 'popularity_month', fuzzytags: 'energetic dance party' },
    audius: { mood: 'Energizing', time: 'month' },
  },
  {
    slug: 'beach-day',
    label: 'Beach day',
    kind: 'collection',
    jamendo: { order: 'popularity_month', fuzzytags: 'summer beach tropical reggae' },
    audius: { query: 'beach summer', time: 'month' },
  },
  {
    slug: 'city-nights',
    label: 'City nights',
    kind: 'collection',
    jamendo: { order: 'popularity_month', fuzzytags: 'night city deephouse lounge' },
    audius: { query: 'night city', time: 'month' },
  },
  {
    slug: 'cozy-weekend',
    label: 'Cozy weekend',
    kind: 'collection',
    jamendo: { order: 'popularity_month', fuzzytags: 'cozy acoustic coffee' },
    audius: { query: 'cozy sunday', time: 'month' },
  },
  {
    slug: 'family-trip',
    label: 'Family trip',
    kind: 'collection',
    jamendo: { order: 'popularity_month', fuzzytags: 'fun happy kids family' },
    audius: { query: 'happy fun', time: 'month' },
  },
] as const;

export const DEFAULT_MUSIC_GROUP = 'trending';

export function findMusicGroup(slug: string | null | undefined): MusicGroupDef | null {
  const needle = slug?.trim().toLowerCase();
  if (!needle) return null;
  return MUSIC_GROUPS.find((group) => group.slug === needle) ?? null;
}

export function isMusicGroupSlug(slug: string | null | undefined): boolean {
  return findMusicGroup(slug) !== null;
}
