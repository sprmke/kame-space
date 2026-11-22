import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  AudiusApiError,
  audiusStreamUrl,
  fetchAudiusGroup,
  fetchAudiusTrackById,
  isAudiusStreamUrl,
  mapAudiusTrack,
} from './audiusMusic.ts';

const OK = {
  id: 'V66vyPP',
  title: 'Fragments.wav',
  duration: 212,
  genre: 'Electronic',
  mood: 'Fiery',
  is_streamable: true,
  is_available: true,
  access: { stream: true },
  artwork: { '150x150': 'https://img/150.jpg', '480x480': 'https://img/480.jpg' },
  user: { name: 'Xsetra', handle: 'xsetra' },
};

function fakeFetch(rows: unknown[], status = 200) {
  const calls: URL[] = [];
  const impl = (input: string) => {
    calls.push(new URL(input));
    return Promise.resolve(
      new Response(JSON.stringify({ data: rows }), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    );
  };
  return { impl, calls };
}

Deno.test('mapAudiusTrack: maps a normal track with a stable stream url', () => {
  const t = mapAudiusTrack(OK, 'kame-space')!;
  assertEquals(t.source, 'audius');
  assertEquals(t.title, 'Fragments');
  assertEquals(t.artist, 'Xsetra');
  assertEquals(t.imageUrl, 'https://img/150.jpg');
  assertEquals(t.exportable, true);
  assertEquals(t.streamUrl, 'https://api.audius.co/v1/tracks/V66vyPP/stream?app_name=kame-space');
});

Deno.test('mapAudiusTrack: filters tracks a marketing video cannot use', () => {
  const bad: Record<string, unknown>[] = [
    { ...OK, is_delete: true },
    { ...OK, is_unlisted: true },
    { ...OK, is_streamable: false },
    { ...OK, is_available: false },
    { ...OK, is_stream_gated: true },
    { ...OK, access: { stream: false } },
    { ...OK, parental_warning_type: 'explicit' },
    { ...OK, duration: 12 },
    { ...OK, duration: 301 },
    { ...OK, duration: 7001 },
    { ...OK, id: '' },
  ];
  for (const row of bad) assertEquals(mapAudiusTrack(row), null, JSON.stringify(row));
});

Deno.test('mapAudiusTrack: keeps tracks right at the length limits', () => {
  assertEquals(mapAudiusTrack({ ...OK, duration: 30 })?.durationSec, 30);
  assertEquals(mapAudiusTrack({ ...OK, duration: 300 })?.durationSec, 300);
});

Deno.test('mapAudiusTrack: falls back to the handle, then to a placeholder artist', () => {
  assertEquals(mapAudiusTrack({ ...OK, user: { handle: 'h' } })?.artist, 'h');
  assertEquals(mapAudiusTrack({ ...OK, user: null })?.artist, 'Unknown artist');
});

Deno.test('isAudiusStreamUrl: only the stable stream endpoint counts', () => {
  assert(isAudiusStreamUrl(audiusStreamUrl('abc')));
  assert(!isAudiusStreamUrl('https://api.audius.co/v1/tracks/trending'));
  assert(!isAudiusStreamUrl('https://evil.example/v1/tracks/abc/stream'));
  assert(!isAudiusStreamUrl('not a url'));
  assert(!isAudiusStreamUrl(null));
});

Deno.test('fetchAudiusGroup: a genre group uses the trending list', async () => {
  const { impl, calls } = fakeFetch([OK]);
  const res = await fetchAudiusGroup({
    query: { genre: 'Lo-Fi', time: 'month' },
    limit: 16,
    offset: 16,
    fetchImpl: impl,
  });
  assertEquals(calls[0]!.pathname, '/v1/tracks/trending');
  assertEquals(calls[0]!.searchParams.get('genre'), 'Lo-Fi');
  assertEquals(calls[0]!.searchParams.get('time'), 'month');
  assertEquals(calls[0]!.searchParams.get('offset'), '16');
  assert(calls[0]!.searchParams.get('app_name'));
  assertEquals(res.tracks.length, 1);
  assertEquals(res.rawCount, 1);
});

Deno.test('fetchAudiusGroup: a mood group uses search with the mood', async () => {
  const { impl, calls } = fakeFetch([OK]);
  await fetchAudiusGroup({
    query: { mood: 'Peaceful', time: 'month' },
    limit: 16,
    offset: 0,
    fetchImpl: impl,
  });
  assertEquals(calls[0]!.pathname, '/v1/tracks/search');
  assertEquals(calls[0]!.searchParams.get('mood'), 'Peaceful');
  assertEquals(calls[0]!.searchParams.get('sort_method'), 'popular');
});

Deno.test('fetchAudiusGroup: typed search ignores the group', async () => {
  const { impl, calls } = fakeFetch([OK]);
  await fetchAudiusGroup({
    query: { mood: 'Peaceful', time: 'month' },
    search: '  sunny beach ',
    limit: 16,
    offset: 0,
    fetchImpl: impl,
  });
  assertEquals(calls[0]!.searchParams.get('query'), 'sunny beach');
  assertEquals(calls[0]!.searchParams.get('mood'), null);
});

Deno.test('fetchAudiusGroup: reports raw count so paging sees filtered rows', async () => {
  const { impl } = fakeFetch([OK, { ...OK, id: 'x', parental_warning_type: 'explicit' }]);
  const res = await fetchAudiusGroup({
    query: { time: 'week' },
    limit: 2,
    offset: 0,
    fetchImpl: impl,
  });
  assertEquals(res.tracks.length, 1);
  assertEquals(res.rawCount, 2);
});

Deno.test('fetchAudiusGroup: a failed request throws a typed error', async () => {
  const { impl } = fakeFetch([], 503);
  const err = await assertRejects(
    () => fetchAudiusGroup({ query: { time: 'week' }, limit: 5, offset: 0, fetchImpl: impl }),
    AudiusApiError
  );
  assertEquals(err.status, 503);
});

Deno.test('fetchAudiusTrackById: returns the track or null', async () => {
  const found = await fetchAudiusTrackById('V66vyPP', fakeFetch([OK]).impl);
  assertEquals(found?.id, 'V66vyPP');
  assertEquals(await fetchAudiusTrackById('missing', fakeFetch([]).impl), null);
  assertEquals(
    await fetchAudiusTrackById('gone', fakeFetch([{ ...OK, is_delete: true }]).impl),
    null
  );
});
