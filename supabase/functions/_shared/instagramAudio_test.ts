import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildAudioConfiguration,
  clampIgVolume,
  fetchInstagramAudioById,
  InstagramAudioError,
  mapInstagramAudio,
  searchInstagramAudio,
} from './instagramAudio.ts';

const SONG = {
  audio_id: '1234',
  audio_type: 'music',
  title: 'Golden Hour',
  display_artist: 'JVKE',
  duration_in_ms: 209000,
  cover_artwork_thumbnail_uri: 'https://cdn/art.jpg',
  download_url: 'https://cdn/preview.mp3',
};

function fakeFetch(body: unknown, status = 200) {
  const calls: URL[] = [];
  const impl = (input: string) => {
    calls.push(new URL(input));
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  return { impl, calls };
}

Deno.test('clampIgVolume: whole numbers from 1 to 100, with a default', () => {
  assertEquals(clampIgVolume(0), 1);
  assertEquals(clampIgVolume(250), 100);
  assertEquals(clampIgVolume(55.6), 56);
  assertEquals(clampIgVolume(undefined), 100);
  assertEquals(clampIgVolume('80'), 100);
  assertEquals(clampIgVolume(NaN, 40), 40);
});

Deno.test('buildAudioConfiguration: the JSON Meta expects, volumes clamped', () => {
  assertEquals(
    JSON.parse(buildAudioConfiguration({ audioId: '9', audioVolume: 70, videoVolume: 0 })),
    { audio_id: '9', audio_volume: 70, video_volume: 1 }
  );
  assertEquals(JSON.parse(buildAudioConfiguration({ audioId: '9' })).audio_volume, 100);
});

Deno.test('mapInstagramAudio: maps music and marks it not exportable', () => {
  const t = mapInstagramAudio(SONG)!;
  assertEquals(t.source, 'instagram');
  assertEquals(t.id, '1234');
  assertEquals(t.artist, 'JVKE');
  assertEquals(t.durationSec, 209);
  assertEquals(t.streamUrl, 'https://cdn/preview.mp3');
  assertEquals(t.exportable, false);
});

Deno.test('mapInstagramAudio: a missing preview is null, original sounds are skipped', () => {
  assertEquals(mapInstagramAudio({ ...SONG, download_url: null })?.streamUrl, null);
  assertEquals(mapInstagramAudio({ ...SONG, audio_type: 'original_sound' }), null);
  assertEquals(mapInstagramAudio({ title: 'x' }), null);
});

Deno.test('searchInstagramAudio: no text asks for trending music', async () => {
  const { impl, calls } = fakeFetch({ data: [SONG] });
  const tracks = await searchInstagramAudio({
    igUserId: '17841',
    accessToken: 'TOKEN',
    fetchImpl: impl,
  });
  assertEquals(tracks.length, 1);
  const url = calls[0]!;
  assert(url.pathname.endsWith('/ig_audio'));
  assertEquals(url.searchParams.get('audio_type'), 'music');
  assertEquals(url.searchParams.get('user_id'), '17841');
  assertEquals(url.searchParams.get('search_query'), null);
});

Deno.test('searchInstagramAudio: sends the search text', async () => {
  const { impl, calls } = fakeFetch([SONG]);
  await searchInstagramAudio({
    igUserId: '1',
    accessToken: 'T',
    query: ' golden ',
    fetchImpl: impl,
  });
  assertEquals(calls[0]!.searchParams.get('search_query'), 'golden');
});

Deno.test('searchInstagramAudio: Meta permission errors become no_access', async () => {
  const { impl } = fakeFetch({ error: { message: 'Permissions error', code: 200 } }, 403);
  const err = await assertRejects(
    () => searchInstagramAudio({ igUserId: '1', accessToken: 'T', fetchImpl: impl }),
    InstagramAudioError
  );
  assertEquals(err.reason, 'no_access');
});

Deno.test('searchInstagramAudio: an expired token becomes token, anything else error', async () => {
  const expired = await assertRejects(
    () =>
      searchInstagramAudio({
        igUserId: '1',
        accessToken: 'T',
        fetchImpl: fakeFetch({ error: { message: 'Expired', code: 190 } }, 400).impl,
      }),
    InstagramAudioError
  );
  assertEquals(expired.reason, 'token');
  const other = await assertRejects(
    () =>
      searchInstagramAudio({
        igUserId: '1',
        accessToken: 'T',
        fetchImpl: fakeFetch({}, 500).impl,
      }),
    InstagramAudioError
  );
  assertEquals(other.reason, 'error');
});

Deno.test('fetchInstagramAudioById: returns one song with the requested id', async () => {
  const { impl, calls } = fakeFetch({ ...SONG, audio_id: undefined });
  const track = await fetchInstagramAudioById({
    audioId: '1234',
    igUserId: '17841',
    accessToken: 'T',
    fetchImpl: impl,
  });
  assertEquals(track?.id, '1234');
  assert(calls[0]!.pathname.endsWith('/1234'));
});
