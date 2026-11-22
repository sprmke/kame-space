import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  cleanTrackTitle,
  interleaveTracks,
  trackFingerprint,
  type MusicTrack,
} from './musicTypes.ts';

function track(id: string, source: MusicTrack['source'], title = id, artist = 'A'): MusicTrack {
  return {
    id,
    source,
    title,
    artist,
    durationSec: 100,
    imageUrl: null,
    streamUrl: 'u',
    exportable: true,
  };
}

Deno.test('cleanTrackTitle: drops file extensions and extra spaces', () => {
  assertEquals(cleanTrackTitle('visions - akuf.wav'), 'visions - akuf');
  assertEquals(cleanTrackTitle('  Slow   Morning.MP3 '), 'Slow Morning');
  assertEquals(cleanTrackTitle('Track.v2'), 'Track.v2');
  assertEquals(cleanTrackTitle('   '), 'Untitled');
});

Deno.test('trackFingerprint: matches the same song across punctuation and case', () => {
  assertEquals(
    trackFingerprint({ title: 'Sunny Beach!', artist: 'DJ Foo' }),
    trackFingerprint({ title: 'sunny   beach', artist: 'dj-foo' })
  );
});

Deno.test('interleaveTracks: alternates sources and keeps order inside each', () => {
  const out = interleaveTracks([
    [track('j1', 'jamendo'), track('j2', 'jamendo'), track('j3', 'jamendo')],
    [track('a1', 'audius')],
  ]);
  assertEquals(
    out.map((t) => t.id),
    ['j1', 'a1', 'j2', 'j3']
  );
});

Deno.test('interleaveTracks: drops a repeat of the same song from a second source', () => {
  const out = interleaveTracks([
    [track('j1', 'jamendo', 'Lofi Chill', 'Joystock')],
    [track('a1', 'audius', 'Lofi chill', 'JOYSTOCK'), track('a2', 'audius', 'Other', 'B')],
  ]);
  assertEquals(
    out.map((t) => t.id),
    ['j1', 'a2']
  );
});

Deno.test('interleaveTracks: handles empty input', () => {
  assertEquals(interleaveTracks([]), []);
  assertEquals(interleaveTracks([[], []]), []);
});
