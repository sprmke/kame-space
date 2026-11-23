import type { Page, Route } from '@playwright/test';

/** Mocks for the music picker. The backend is mocked; audio files are real tiny WAVs. */

export type MockTrack = {
  id: string;
  source: 'jamendo' | 'audius' | 'instagram';
  title: string;
  artist: string;
  durationSec: number;
  imageUrl: string | null;
  streamUrl: string | null;
  exportable: boolean;
};

export function mockTrack(
  id: string,
  source: MockTrack['source'] = 'jamendo',
  over: Partial<MockTrack> = {}
): MockTrack {
  return {
    id,
    source,
    title: `Song ${id}`,
    artist: `Artist ${id}`,
    durationSec: 151,
    imageUrl: null,
    streamUrl: `https://music.test/mock-audio/${source}-${id}.wav`,
    exportable: source !== 'instagram',
    ...over,
  };
}

/** A real 16-bit mono WAV of silence, so the browser decodes and "plays" it for real. */
export function silentWav(seconds = 3, sampleRate = 8000): Buffer {
  const samples = Math.round(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}

export type MusicMockOptions = {
  /** Songs per group slug. Anything not listed gets a single `<group>-1` song. */
  groups?: Record<string, MockTrack[]>;
  instagram?: {
    status?: 'ok' | 'not_connected' | 'no_access' | 'reconnect' | 'error';
    tracks?: MockTrack[];
  };
};

export type MusicMock = {
  /** Every GET the picker made, in order. */
  requests: URL[];
  /** Every JSON POST (imports for export), in order. */
  posts: Array<Record<string, unknown>>;
};

export async function installMusicMocks(page: Page, options: MusicMockOptions = {}) {
  const mock: MusicMock = { requests: [], posts: [] };

  await page.route('**/mock-audio/**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() })
  );
  await page.route('**/functions/v1/marketing-music**', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
      mock.posts.push(body);
      // An import for export: hand back a same-origin style copy of the track.
      const data =
        body.action === 'import-track' || body.action === 'import-jamendo'
          ? {
              url: `https://music.test/mock-audio/cached-${String(body.trackId)}.wav`,
              source: body.source ?? 'jamendo',
              trackId: body.trackId,
              title: `Song ${String(body.trackId)}`,
            }
          : {};
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data }),
      });
    }
    const url = new URL(route.request().url());
    mock.requests.push(url);

    let data: unknown;
    if (url.searchParams.get('source') === 'instagram') {
      const ig = options.instagram ?? { status: 'ok', tracks: [] };
      const audioId = url.searchParams.get('audioId');
      data = audioId
        ? { track: ig.tracks?.find((t) => t.id === audioId) ?? null, instagram: { status: 'ok' } }
        : { tracks: ig.tracks ?? [], instagram: { status: ig.status ?? 'ok' } };
    } else {
      const group = url.searchParams.get('group') ?? 'trending';
      const q = url.searchParams.get('q');
      const tracks = q
        ? [mockTrack(`found-${q}`, 'audius')]
        : (options.groups?.[group] ?? [mockTrack(`${group}-1`)]);
      data = { tracks, hasMore: false, sources: { jamendo: 'ok', audius: 'ok' } };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
  return mock;
}
