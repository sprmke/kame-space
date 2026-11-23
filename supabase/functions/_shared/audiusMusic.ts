/**
 * Audius public API v1: trending and search for full-length tracks, no key needed.
 * Docs: https://docs.audius.org/developers/api/get-trending-tracks
 *
 * Tracks are filtered to ones a marketing video can use: streamable, not explicit, not a
 * multi-hour mix. Stream URLs use the stable `/tracks/{id}/stream` endpoint (it redirects to a
 * content node), never the signed URL in the track payload, which expires.
 */

import { cleanTrackTitle, type MusicTrack } from './musicTypes.ts';
import type { AudiusGroupQuery } from './musicGroups.ts';

const AUDIUS_API = 'https://api.audius.co/v1';
const DEFAULT_APP_NAME = 'kame-space';

export const AUDIUS_MIN_DURATION_SEC = 30;
// 5 min at 320 kbps is about 12 MB, inside the 15 MB audio import limit.
export const AUDIUS_MAX_DURATION_SEC = 300;

export class AudiusApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AudiusApiError';
    this.status = status;
  }
}

type AudiusRawTrack = {
  id?: string;
  title?: string;
  duration?: number;
  genre?: string | null;
  mood?: string | null;
  is_delete?: boolean;
  is_unlisted?: boolean;
  is_streamable?: boolean;
  is_available?: boolean;
  is_stream_gated?: boolean;
  access?: { stream?: boolean };
  parental_warning_type?: string | null;
  artwork?: Record<string, string> | null;
  user?: { name?: string; handle?: string } | null;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** `AUDIUS_MUSIC_ENABLED=0` switches the source off without a deploy of code. */
export function audiusEnabled(): boolean {
  const flag = Deno.env.get('AUDIUS_MUSIC_ENABLED')?.trim().toLowerCase();
  return flag !== '0' && flag !== 'false' && flag !== 'off';
}

export function audiusAppName(): string {
  return Deno.env.get('AUDIUS_APP_NAME')?.trim() || DEFAULT_APP_NAME;
}

/** Stable, unsigned stream URL. Plays in an `<audio>` element and follows redirects. */
export function audiusStreamUrl(trackId: string, appName = audiusAppName()): string {
  return `${AUDIUS_API}/tracks/${encodeURIComponent(trackId)}/stream?app_name=${encodeURIComponent(appName)}`;
}

export function isAudiusStreamUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'api.audius.co' && /\/v1\/tracks\/[^/]+\/stream$/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export function mapAudiusTrack(raw: AudiusRawTrack, appName = audiusAppName()): MusicTrack | null {
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;
  if (raw.is_delete || raw.is_unlisted) return null;
  if (raw.is_streamable === false || raw.is_available === false) return null;
  if (raw.is_stream_gated || raw.access?.stream === false) return null;
  // `parental_warning_type` is set for explicit tracks. Posts go out under a host's own name.
  if (raw.parental_warning_type) return null;

  const duration = typeof raw.duration === 'number' ? Math.round(raw.duration) : 0;
  if (duration < AUDIUS_MIN_DURATION_SEC || duration > AUDIUS_MAX_DURATION_SEC) return null;

  const artist = raw.user?.name?.trim() || raw.user?.handle?.trim() || 'Unknown artist';
  const art = raw.artwork;
  return {
    id,
    source: 'audius',
    title: cleanTrackTitle(raw.title ?? ''),
    artist,
    durationSec: duration,
    imageUrl: art?.['150x150'] ?? art?.['480x480'] ?? null,
    streamUrl: audiusStreamUrl(id, appName),
    exportable: true,
    genre: raw.genre?.trim() || null,
    mood: raw.mood?.trim() || null,
  };
}

async function audiusGet(
  path: string,
  params: Record<string, string | number | undefined>,
  fetchImpl: FetchLike
): Promise<AudiusRawTrack[]> {
  const url = new URL(`${AUDIUS_API}${path}`);
  url.searchParams.set('app_name', audiusAppName());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const res = await fetchImpl(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new AudiusApiError(`Audius request failed (${res.status})`, res.status);
  }
  const json = (await res.json()) as { data?: AudiusRawTrack[] | AudiusRawTrack };
  const data = json.data;
  if (Array.isArray(data)) return data;
  return data ? [data] : [];
}

function mapAll(rows: AudiusRawTrack[]): MusicTrack[] {
  return rows.map((row) => mapAudiusTrack(row)).filter((t): t is MusicTrack => t !== null);
}

export type AudiusBrowseResult = {
  tracks: MusicTrack[];
  /** Raw rows the API returned before filtering. A full window means another page may exist. */
  rawCount: number;
};

/**
 * One page of a picker group. Trending list when the group is genre-only, search when it has a
 * mood or free text.
 */
export async function fetchAudiusGroup(params: {
  query: AudiusGroupQuery;
  /** Free text the host typed. Switches to relevance search and ignores the group. */
  search?: string;
  limit: number;
  offset: number;
  fetchImpl?: FetchLike;
}): Promise<AudiusBrowseResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const { query, search, limit, offset } = params;

  let rows: AudiusRawTrack[];
  if (search?.trim()) {
    rows = await audiusGet(
      '/tracks/search',
      { query: search.trim(), sort_method: 'popular', limit, offset },
      fetchImpl
    );
  } else if (query.mood || query.query) {
    rows = await audiusGet(
      '/tracks/search',
      {
        query: query.query ?? '',
        mood: query.mood,
        genre: query.genre,
        sort_method: 'popular',
        limit,
        offset,
      },
      fetchImpl
    );
  } else {
    rows = await audiusGet(
      '/tracks/trending',
      { time: query.time, genre: query.genre, limit, offset },
      fetchImpl
    );
  }
  return { tracks: mapAll(rows), rawCount: rows.length };
}

export async function fetchAudiusTrackById(
  trackId: string,
  fetchImpl: FetchLike = fetch
): Promise<MusicTrack | null> {
  const rows = await audiusGet(`/tracks/${encodeURIComponent(trackId)}`, {}, fetchImpl);
  const row = rows[0];
  return row ? mapAudiusTrack(row) : null;
}
