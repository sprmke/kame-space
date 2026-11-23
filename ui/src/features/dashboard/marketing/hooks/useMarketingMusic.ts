import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  DEFAULT_MUSIC_GROUP,
  type InstagramMusicStatus,
  type JamendoTrack,
  type MusicSourceStatus,
  type MusicTrack,
} from '@/features/dashboard/marketing/lib/music/musicTypes';
import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type { JamendoTrack } from '@/features/dashboard/marketing/lib/music/musicTypes';

export type ImportedMarketingMusic = {
  url: string;
  title?: string;
  artist?: string;
  source: 'jamendo' | 'audius' | 'upload' | 'url';
  trackId?: string;
};

export const MARKETING_MUSIC_QUERY_KEY = ['marketing-music'] as const;

async function parseEdgeJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { success?: boolean; error?: string; data?: T };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json.data as T;
}

function marketingMusicGetUrl(propertyId: string | null, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  const path = qs ? `marketing-music?${qs}` : 'marketing-music';
  return scopedFunctionsUrl(path, propertyId);
}

/**
 * Jamendo only. The default-music resolver and the older scene editor ask for a Jamendo track id,
 * so they must never see Audius results.
 */
export function useMarketingMusicBrowse(
  propertyId: string | null,
  options: { q?: string; order?: string; enabled?: boolean } = {}
) {
  const { q, order = 'popularity_week', enabled = true } = options;
  const group = order === 'popularity_total' ? 'popular' : DEFAULT_MUSIC_GROUP;
  return useQuery({
    queryKey: [...MARKETING_MUSIC_QUERY_KEY, 'browse', propertyId, q ?? '', group],
    queryFn: async () => {
      const jwt = await getSessionJwt();
      const params: Record<string, string> = { only: 'jamendo', group };
      if (q?.trim()) params.q = q.trim();
      const res = await fetch(marketingMusicGetUrl(propertyId, params), {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      return parseEdgeJson<{ tracks: JamendoTrack[]; jamendoConfigured: boolean }>(res);
    },
    enabled: Boolean(propertyId) && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export type MusicBrowsePage = {
  tracks: MusicTrack[];
  hasMore: boolean;
  sources: { jamendo: MusicSourceStatus; audius: MusicSourceStatus };
};

/** One group (or a typed search) from every free source, a page at a time. */
export function useMusicBrowse(
  propertyId: string | null,
  options: { group: string; q?: string; enabled?: boolean }
) {
  const { group, q, enabled = true } = options;
  const search = q?.trim() ?? '';
  return useInfiniteQuery({
    queryKey: [
      ...MARKETING_MUSIC_QUERY_KEY,
      'groups',
      propertyId,
      search ? 'search' : group,
      search,
    ],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<MusicBrowsePage> => {
      const jwt = await getSessionJwt();
      const params: Record<string, string> = { group, page: String(pageParam) };
      if (search) params.q = search;
      const res = await fetch(marketingMusicGetUrl(propertyId, params), {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      return parseEdgeJson<MusicBrowsePage>(res);
    },
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: Boolean(propertyId) && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export type InstagramMusicResult = {
  tracks: MusicTrack[];
  instagram: { status: InstagramMusicStatus; message?: string };
};

/** Instagram's own music for Reels: trending when `q` is empty, a search otherwise. */
export function useInstagramMusic(
  propertyId: string | null,
  options: { q?: string; enabled?: boolean } = {}
) {
  const search = options.q?.trim() ?? '';
  return useQuery({
    queryKey: [...MARKETING_MUSIC_QUERY_KEY, 'instagram', propertyId, search],
    queryFn: async (): Promise<InstagramMusicResult> => {
      const jwt = await getSessionJwt();
      const params: Record<string, string> = { source: 'instagram' };
      if (search) params.q = search;
      const res = await fetch(marketingMusicGetUrl(propertyId, params), {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      return parseEdgeJson<InstagramMusicResult>(res);
    },
    enabled: Boolean(propertyId) && (options.enabled ?? true),
    // Preview links Instagram hands out expire after about a day and a half.
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: false,
  });
}

/** One Instagram song with a fresh preview link (saved projects keep only the id). */
export async function fetchInstagramSong(
  propertyId: string | null,
  audioId: string
): Promise<MusicTrack> {
  const jwt = await getSessionJwt();
  const res = await fetch(marketingMusicGetUrl(propertyId, { source: 'instagram', audioId }), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const data = await parseEdgeJson<{ track: MusicTrack }>(res);
  return data.track;
}

async function postMarketingMusicJson(
  propertyId: string | null,
  body: Record<string, unknown>
): Promise<ImportedMarketingMusic> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('marketing-music', propertyId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return parseEdgeJson<ImportedMarketingMusic>(res);
}

export function useImportJamendoTrack(propertyId: string | null) {
  return useMutation({
    mutationFn: (trackId: string) =>
      postMarketingMusicJson(propertyId, { action: 'import-jamendo', trackId }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not import track');
    },
  });
}

export function useImportMusicUrl(propertyId: string | null) {
  return useMutation({
    mutationFn: (url: string) => postMarketingMusicJson(propertyId, { action: 'import-url', url }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not import URL');
    },
  });
}

export function useUploadMarketingMusic(propertyId: string | null) {
  return useMutation({
    mutationFn: async (input: File | { file: File; fileKey?: string }) => {
      const file = input instanceof File ? input : input.file;
      const fileKey = input instanceof File ? undefined : input.fileKey;
      const jwt = await getSessionJwt();
      const formData = new FormData();
      formData.append('file', file);
      if (fileKey) formData.append('fileKey', fileKey);
      const res = await fetch(scopedFunctionsUrl('marketing-music', propertyId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData,
      });
      return parseEdgeJson<ImportedMarketingMusic>(res);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    },
  });
}

function sanitizeFileStem(value: string): string {
  const stem = value
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return stem.slice(0, 48) || 'track';
}

/** Jamendo stream URLs are browser-only; fetch client-side then upload to Storage. */
export async function fetchJamendoStreamAsFile(track: JamendoTrack): Promise<File> {
  if (!track.streamUrl) throw new Error('This track has no audio to fetch');
  const res = await fetch(track.streamUrl);
  if (!res.ok) {
    throw new Error(`Could not fetch audio (${res.status})`);
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error('Audio file is empty');
  }

  const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'audio/mpeg';
  const name = `${sanitizeFileStem(track.title)}.mp3`;
  return new File([blob], name, { type });
}

export async function fetchUrlAsAudioFile(url: string): Promise<File> {
  const trimmed = url.trim();
  const res = await fetch(trimmed);
  if (!res.ok) {
    throw new Error(`Could not fetch audio (${res.status})`);
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error('Audio file is empty');
  }

  const pathName = trimmed.split('/').pop()?.split('?')[0] ?? 'audio.mp3';
  const hasExt = /\.(mp3|m4a|wav|ogg|aac|webm)$/i.test(pathName);
  const name = hasExt ? pathName : `${pathName}.mp3`;
  const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'audio/mpeg';
  return new File([blob], name, { type });
}
