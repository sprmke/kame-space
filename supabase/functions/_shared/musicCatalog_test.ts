import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { AudiusApiError } from './audiusMusic.ts';
import { JamendoApiError, type JamendoTrack } from './jamendoMusic.ts';
import {
  browseMusic,
  MUSIC_PAGE_AUDIUS,
  MUSIC_PAGE_JAMENDO,
  resolveGroup,
  UnknownMusicGroupError,
  type MusicBrowseDeps,
} from './musicCatalog.ts';
import { findMusicGroup } from './musicGroups.ts';
import type { MusicTrack } from './musicTypes.ts';

function jam(id: string): JamendoTrack {
  return {
    id,
    title: `Jam ${id}`,
    artist: 'J',
    durationSec: 120,
    imageUrl: null,
    streamUrl: `https://jamendo/${id}`,
    downloadUrl: '',
  };
}

function aud(id: string): MusicTrack {
  return {
    id,
    source: 'audius',
    title: `Aud ${id}`,
    artist: 'A',
    durationSec: 120,
    imageUrl: null,
    streamUrl: `https://audius/${id}`,
    exportable: true,
  };
}

function deps(overrides: Partial<MusicBrowseDeps> = {}) {
  const jamendoCalls: Record<string, unknown>[] = [];
  const audiusCalls: Record<string, unknown>[] = [];
  const base: MusicBrowseDeps = {
    jamendoClientId: 'client',
    audiusOn: true,
    fetchJamendo: (p) => {
      jamendoCalls.push(p as unknown as Record<string, unknown>);
      return Promise.resolve([jam('1'), jam('2')]);
    },
    fetchAudius: (p) => {
      audiusCalls.push(p as unknown as Record<string, unknown>);
      return Promise.resolve({ tracks: [aud('a'), aud('b')], rawCount: 2 });
    },
  };
  return { deps: { ...base, ...overrides }, jamendoCalls, audiusCalls };
}

const TRENDING = findMusicGroup('trending')!;
const CHILL = findMusicGroup('chill')!;

Deno.test('browseMusic: merges both sources, alternating', async () => {
  const { deps: d } = deps();
  const res = await browseMusic({ group: TRENDING, page: 0 }, d);
  assertEquals(
    res.tracks.map((t) => `${t.source}:${t.id}`),
    ['jamendo:1', 'audius:a', 'jamendo:2', 'audius:b']
  );
  assertEquals(res.sources, { jamendo: 'ok', audius: 'ok' });
  assertEquals(res.hasMore, false);
});

Deno.test('browseMusic: passes the group tags to Jamendo and the group to Audius', async () => {
  const { deps: d, jamendoCalls, audiusCalls } = deps();
  await browseMusic({ group: CHILL, page: 2 }, d);
  assertEquals(jamendoCalls[0]!.fuzzytags, CHILL.jamendo.fuzzytags);
  assertEquals(jamendoCalls[0]!.order, 'popularity_month');
  assertEquals(jamendoCalls[0]!.offset, 2 * MUSIC_PAGE_JAMENDO);
  assertEquals(audiusCalls[0]!.query, CHILL.audius);
  assertEquals(audiusCalls[0]!.offset, 2 * MUSIC_PAGE_AUDIUS);
});

Deno.test('browseMusic: a typed search overrides the group for both sources', async () => {
  const { deps: d, jamendoCalls, audiusCalls } = deps();
  await browseMusic({ group: CHILL, search: ' beach ', page: 0 }, d);
  assertEquals(jamendoCalls[0]!.search, 'beach');
  assertEquals(jamendoCalls[0]!.order, 'relevance');
  assertEquals(jamendoCalls[0]!.tags, undefined);
  assertEquals(jamendoCalls[0]!.fuzzytags, undefined);
  assertEquals(audiusCalls[0]!.search, 'beach');
});

Deno.test('browseMusic: one failing source still returns the other, flagged', async () => {
  const { deps: d } = deps({
    fetchAudius: () => Promise.reject(new AudiusApiError('down', 503)),
  });
  const res = await browseMusic({ group: TRENDING, page: 0 }, d);
  assertEquals(res.sources, { jamendo: 'ok', audius: 'error' });
  assertEquals(res.tracks.length, 2);
});

Deno.test('browseMusic: no Jamendo client id means off, not an error', async () => {
  const { deps: d, jamendoCalls } = deps({ jamendoClientId: null });
  const res = await browseMusic({ group: TRENDING, page: 0 }, d);
  assertEquals(res.sources.jamendo, 'off');
  assertEquals(jamendoCalls.length, 0);
  assert(res.tracks.every((t) => t.source === 'audius'));
});

Deno.test('browseMusic: a Jamendo auth failure counts as off', async () => {
  const { deps: d } = deps({
    fetchJamendo: () => Promise.reject(new JamendoApiError('Suspended Application', 5)),
  });
  assertEquals((await browseMusic({ group: TRENDING, page: 0 }, d)).sources.jamendo, 'off');
});

Deno.test('browseMusic: Audius switched off leaves only Jamendo', async () => {
  const { deps: d, audiusCalls } = deps({ audiusOn: false });
  const res = await browseMusic({ group: TRENDING, page: 0 }, d);
  assertEquals(res.sources.audius, 'off');
  assertEquals(audiusCalls.length, 0);
});

Deno.test('browseMusic: both sources down returns an empty list with both flagged', async () => {
  const { deps: d } = deps({
    fetchJamendo: () => Promise.reject(new Error('x')),
    fetchAudius: () => Promise.reject(new Error('y')),
  });
  const res = await browseMusic({ group: TRENDING, page: 0 }, d);
  assertEquals(res.tracks, []);
  assertEquals(res.sources, { jamendo: 'error', audius: 'error' });
  assertEquals(res.hasMore, false);
});

Deno.test('browseMusic: hasMore turns on when a source filled its window', async () => {
  const full = Array.from({ length: MUSIC_PAGE_JAMENDO }, (_, i) => jam(String(i)));
  const { deps: d } = deps({ fetchJamendo: () => Promise.resolve(full) });
  assertEquals((await browseMusic({ group: TRENDING, page: 0 }, d)).hasMore, true);
});

Deno.test('browseMusic: audius filtered rows still count toward the window', async () => {
  const { deps: d } = deps({
    fetchAudius: () => Promise.resolve({ tracks: [aud('a')], rawCount: MUSIC_PAGE_AUDIUS }),
    fetchJamendo: () => Promise.resolve([]),
  });
  assertEquals((await browseMusic({ group: TRENDING, page: 0 }, d)).hasMore, true);
});

Deno.test('browseMusic: page is clamped', async () => {
  const { deps: d, jamendoCalls } = deps();
  await browseMusic({ group: TRENDING, page: -4 }, d);
  await browseMusic({ group: TRENDING, page: 9999 }, d);
  assertEquals(jamendoCalls[0]!.offset, 0);
  assertEquals(jamendoCalls[1]!.offset, 20 * MUSIC_PAGE_JAMENDO);
});

Deno.test('resolveGroup: defaults to trending and rejects unknown slugs', () => {
  assertEquals(resolveGroup(null).slug, 'trending');
  assertEquals(resolveGroup('').slug, 'trending');
  assertEquals(resolveGroup('jazz').slug, 'jazz');
  assertThrows(() => resolveGroup('bogus'), UnknownMusicGroupError);
});
