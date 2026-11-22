/**
 * Instagram Audio API: search the music Instagram licenses for Reels and attach it at publish.
 * Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing/audio-api/
 *
 * Meta adds the song on its own servers, so these tracks are never baked into our export. With no
 * search text the API returns trending music. Catalog and access can differ from the Instagram
 * app: a call can fail for an app or account without access, which callers show as "unavailable".
 */

import { META_GRAPH_BASE } from './metaInboxConfig.ts';
import type { MusicTrack } from './musicTypes.ts';
import { cleanTrackTitle } from './musicTypes.ts';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type IgAudioRaw = {
  audio_id?: string | number;
  id?: string | number;
  title?: string;
  display_artist?: string;
  duration_in_ms?: number;
  cover_artwork_thumbnail_uri?: string | null;
  cover_artwork_thumbnail_url?: string | null;
  download_url?: string | null;
  on_platform_audio_preview_link?: string | null;
  audio_type?: string | number;
};

export type InstagramAudioFailure = 'no_access' | 'token' | 'error';

export class InstagramAudioError extends Error {
  readonly reason: InstagramAudioFailure;
  readonly code?: number;
  constructor(message: string, reason: InstagramAudioFailure, code?: number) {
    super(message);
    this.name = 'InstagramAudioError';
    this.reason = reason;
    this.code = code;
  }
}

export const IG_AUDIO_VOLUME_MIN = 1;
export const IG_AUDIO_VOLUME_MAX = 100;

export function clampIgVolume(value: unknown, fallback = 100): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(IG_AUDIO_VOLUME_MAX, Math.max(IG_AUDIO_VOLUME_MIN, n));
}

/** `audio_configuration` value for a Reels container. Volumes are whole numbers 1 to 100. */
export function buildAudioConfiguration(input: {
  audioId: string;
  audioVolume?: number;
  videoVolume?: number;
}): string {
  return JSON.stringify({
    audio_id: input.audioId,
    audio_volume: clampIgVolume(input.audioVolume),
    video_volume: clampIgVolume(input.videoVolume),
  });
}

export type InstagramAudioRequest =
  | { ok: true; audio: { audioId: string; audioVolume: number } | null }
  | { ok: false; error: string };

/**
 * Reads and checks the `instagramAudio` field of a publish request. No song is fine. A song is
 * accepted only on a video posted as an Instagram Reel that is not scheduled for later, because
 * Meta mixes it in at publish time.
 */
export function parseInstagramAudioRequest(
  raw: unknown,
  ctx: { publishType: string; mediaType: 'image' | 'video'; scheduled: boolean }
): InstagramAudioRequest {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const audioId = typeof rec?.audioId === 'string' ? rec.audioId.trim() : '';
  if (!audioId) return { ok: true, audio: null };
  if (ctx.publishType !== 'instagram_reel' || ctx.mediaType !== 'video') {
    return { ok: false, error: 'Instagram songs can only be added to a video posted as a Reel' };
  }
  if (ctx.scheduled) {
    return { ok: false, error: 'Reels with an Instagram song cannot be scheduled yet' };
  }
  return { ok: true, audio: { audioId, audioVolume: clampIgVolume(rec?.audioVolume) } };
}

export function mapInstagramAudio(raw: IgAudioRaw): MusicTrack | null {
  const id = String(raw.audio_id ?? raw.id ?? '').trim();
  if (!id) return null;
  const type = String(raw.audio_type ?? 'music').toLowerCase();
  if (type !== 'music' && type !== '1') return null;

  const ms = typeof raw.duration_in_ms === 'number' ? raw.duration_in_ms : 0;
  return {
    id,
    source: 'instagram',
    title: cleanTrackTitle(raw.title ?? ''),
    artist: raw.display_artist?.trim() || 'Instagram music',
    durationSec: Math.max(0, Math.round(ms / 1000)),
    imageUrl: raw.cover_artwork_thumbnail_uri ?? raw.cover_artwork_thumbnail_url ?? null,
    streamUrl: raw.download_url || raw.on_platform_audio_preview_link || null,
    exportable: false,
  };
}

function classifyFailure(json: unknown, status: number): InstagramAudioError {
  const err = (json as { error?: { message?: string; code?: number } } | null)?.error;
  const message = err?.message ?? `Instagram music request failed (${status})`;
  const code = err?.code;
  // 200 = permission error for an app without the Audio API. 10 = permission denied.
  if (code === 200 || code === 10 || code === 3)
    return new InstagramAudioError(message, 'no_access', code);
  if (code === 190 || status === 401) return new InstagramAudioError(message, 'token', code);
  return new InstagramAudioError(message, 'error', code);
}

async function graphGet(
  path: string,
  params: Record<string, string | undefined>,
  fetchImpl: FetchLike
): Promise<unknown> {
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const res = await fetchImpl(url.toString());
  const json = await res.json().catch(() => null);
  if (!res.ok) throw classifyFailure(json, res.status);
  return json;
}

/** Trending Instagram music, or a text search when `query` is set. */
export async function searchInstagramAudio(params: {
  igUserId: string;
  accessToken: string;
  query?: string;
  limit?: number;
  fetchImpl?: FetchLike;
}): Promise<MusicTrack[]> {
  const json = (await graphGet(
    '/ig_audio',
    {
      audio_type: 'music',
      user_id: params.igUserId,
      access_token: params.accessToken,
      search_query: params.query?.trim() || undefined,
      limit: String(Math.min(50, Math.max(1, params.limit ?? 30))),
    },
    params.fetchImpl ?? fetch
  )) as { data?: IgAudioRaw[]; results?: IgAudioRaw[] } | IgAudioRaw[] | null;

  const rows = Array.isArray(json) ? json : (json?.data ?? json?.results ?? []);
  return rows.map(mapInstagramAudio).filter((t): t is MusicTrack => t !== null);
}

/** One song, with a fresh preview URL (they expire after about a day and a half). */
export async function fetchInstagramAudioById(params: {
  audioId: string;
  igUserId: string;
  accessToken: string;
  fetchImpl?: FetchLike;
}): Promise<MusicTrack | null> {
  const json = (await graphGet(
    `/${encodeURIComponent(params.audioId)}`,
    { user_id: params.igUserId, access_token: params.accessToken },
    params.fetchImpl ?? fetch
  )) as IgAudioRaw | { data?: IgAudioRaw[] } | null;

  if (!json) return null;
  const raw = 'data' in json && Array.isArray(json.data) ? json.data[0] : (json as IgAudioRaw);
  return raw ? mapInstagramAudio({ audio_id: params.audioId, ...raw }) : null;
}
