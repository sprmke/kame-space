/**
 * Picker browse: one group (or a text search) asked of every enabled free source, merged into one
 * list. A source that fails or is off never empties the picker; its status is reported instead.
 */

import { audiusEnabled, fetchAudiusGroup, type AudiusBrowseResult } from './audiusMusic.ts';
import {
  fetchJamendoTracks,
  isJamendoAuthFailure,
  jamendoToMusicTrack,
  type JamendoTrack,
} from './jamendoMusic.ts';
import { DEFAULT_MUSIC_GROUP, findMusicGroup, type MusicGroupDef } from './musicGroups.ts';
import { interleaveTracks, type MusicSourceStatus, type MusicTrack } from './musicTypes.ts';

export const MUSIC_PAGE_JAMENDO = 12;
export const MUSIC_PAGE_AUDIUS = 16;
export const MUSIC_MAX_PAGE = 20;

export type MusicBrowseResult = {
  tracks: MusicTrack[];
  hasMore: boolean;
  sources: { jamendo: MusicSourceStatus; audius: MusicSourceStatus };
};

export type MusicBrowseDeps = {
  jamendoClientId: string | null;
  audiusOn: boolean;
  fetchJamendo: typeof fetchJamendoTracks;
  fetchAudius: typeof fetchAudiusGroup;
};

export function defaultBrowseDeps(clientId: string | null): MusicBrowseDeps {
  return {
    jamendoClientId: clientId,
    audiusOn: audiusEnabled(),
    fetchJamendo: fetchJamendoTracks,
    fetchAudius: fetchAudiusGroup,
  };
}

export class UnknownMusicGroupError extends Error {
  constructor(slug: string) {
    super(`Unknown music group: ${slug}`);
    this.name = 'UnknownMusicGroupError';
  }
}

export function resolveGroup(slug: string | null | undefined): MusicGroupDef {
  if (!slug?.trim()) return findMusicGroup(DEFAULT_MUSIC_GROUP)!;
  const group = findMusicGroup(slug);
  if (!group) throw new UnknownMusicGroupError(slug);
  return group;
}

export async function browseMusic(
  input: { group: MusicGroupDef; search?: string; page: number },
  deps: MusicBrowseDeps
): Promise<MusicBrowseResult> {
  const page = Math.min(MUSIC_MAX_PAGE, Math.max(0, Math.floor(input.page) || 0));
  const search = input.search?.trim() || undefined;
  const { group } = input;

  const jamendoTask: Promise<{ tracks: MusicTrack[]; full: boolean } | 'off'> = deps.jamendoClientId
    ? deps
        .fetchJamendo({
          clientId: deps.jamendoClientId,
          search,
          order: search ? 'relevance' : group.jamendo.order,
          tags: search ? undefined : group.jamendo.tags,
          fuzzytags: search ? undefined : group.jamendo.fuzzytags,
          limit: MUSIC_PAGE_JAMENDO,
          offset: page * MUSIC_PAGE_JAMENDO,
        })
        .then((rows: JamendoTrack[]) => ({
          tracks: rows.map(jamendoToMusicTrack),
          full: rows.length >= MUSIC_PAGE_JAMENDO,
        }))
    : Promise.resolve('off' as const);

  const audiusTask: Promise<{ tracks: MusicTrack[]; full: boolean } | 'off'> = deps.audiusOn
    ? deps
        .fetchAudius({
          query: group.audius,
          search,
          limit: MUSIC_PAGE_AUDIUS,
          offset: page * MUSIC_PAGE_AUDIUS,
        })
        .then((result: AudiusBrowseResult) => ({
          tracks: result.tracks,
          full: result.rawCount >= MUSIC_PAGE_AUDIUS,
        }))
    : Promise.resolve('off' as const);

  const [jamendo, audius] = await Promise.allSettled([jamendoTask, audiusTask]);

  const statusOf = (
    r: PromiseSettledResult<{ tracks: MusicTrack[] } | 'off'>,
    authFailure: (error: unknown) => boolean = () => false
  ): MusicSourceStatus => {
    if (r.status === 'rejected') return authFailure(r.reason) ? 'off' : 'error';
    return r.value === 'off' ? 'off' : 'ok';
  };

  const listOf = (r: PromiseSettledResult<{ tracks: MusicTrack[] } | 'off'>): MusicTrack[] =>
    r.status === 'fulfilled' && r.value !== 'off' ? r.value.tracks : [];

  const fullOf = (r: PromiseSettledResult<{ full: boolean } | 'off'>): boolean =>
    r.status === 'fulfilled' && r.value !== 'off' && r.value.full;

  return {
    tracks: interleaveTracks([listOf(jamendo), listOf(audius)]),
    hasMore: page < MUSIC_MAX_PAGE && (fullOf(jamendo) || fullOf(audius)),
    sources: { jamendo: statusOf(jamendo, isJamendoAuthFailure), audius: statusOf(audius) },
  };
}
