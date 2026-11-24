import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cacheCatalogAudioForExport,
  catalogStreamClips,
  remapAudioUrls,
} from '@/features/dashboard/marketing/lib/video/v2/exportAudio';
import { audioItems } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  photo,
  project,
  song,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

vi.mock('@/features/dashboard/org/lib/edgeClient', () => ({
  getSessionJwt: vi.fn().mockResolvedValue('jwt'),
}));

const stream = 'https://prod-1.storage.jamendo.com/?trackid=1&format=mp31';
const audiusStream = 'https://api.audius.co/v1/tracks/V66vyPP/stream?app_name=kame-space';

describe('exportAudio', () => {
  const a = song(0, 60, 30, { media: { url: stream, source: 'jamendo' } });
  const b = song(60, 60, 30, { media: { url: 'https://x/own.mp3', source: 'library' } });
  const p = project([track('main', [photo(150)]), track('audio', [a, b])]);

  it('finds only catalog stream clips', () => {
    expect(catalogStreamClips(p).map((c) => c.id)).toEqual([a.id]);
  });

  it('finds Audius stream clips too', () => {
    const c = song(0, 60, 30, {
      media: { url: audiusStream, source: 'audius' },
      trackId: 'V66vyPP',
    });
    const withAudius = project([track('main', [photo(150)]), track('audio', [a, b, c])]);
    expect(catalogStreamClips(withAudius).map((clip) => clip.id)).toEqual([a.id, c.id]);
  });

  it('swaps and drops clips by id', () => {
    const next = remapAudioUrls(p, new Map<string, string | null>([[a.id, 'https://cdn/a.mp3']]));
    expect(audioItems(next).find((c) => c.id === a.id)?.media.url).toBe('https://cdn/a.mp3');
    const dropped = remapAudioUrls(p, new Map<string, string | null>([[a.id, null]]));
    expect(audioItems(dropped).map((c) => c.id)).toEqual([b.id]);
  });

  it('returns the same project when nothing changes', () => {
    expect(remapAudioUrls(p, new Map())).toBe(p);
  });
});

describe('cacheCatalogAudioForExport', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  function ok(data: Record<string, unknown>) {
    return Promise.resolve({ ok: true, json: async () => ({ success: true, data }) });
  }

  it('asks the server to cache each stream with its own source', async () => {
    const jam = song(0, 60, 30, { media: { url: stream, source: 'jamendo' }, trackId: '77' });
    const aud = song(60, 60, 30, {
      media: { url: audiusStream, source: 'audius' },
      trackId: 'V66vyPP',
    });
    const p = project([track('main', [photo(150)]), track('audio', [jam, aud])]);
    fetchMock.mockImplementation((_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { source: string; trackId: string };
      return ok({ url: `https://cdn/${body.source}-${body.trackId}.mp3`, source: body.source });
    });

    const result = await cacheCatalogAudioForExport(p, 'prop-1');

    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as { body: string }).body));
    expect(bodies).toEqual([
      { action: 'import-track', source: 'jamendo', trackId: '77' },
      { action: 'import-track', source: 'audius', trackId: 'V66vyPP' },
    ]);
    expect(result.dropped).toBe(0);
    expect(result.cached.get(jam.id)).toBe('https://cdn/jamendo-77.mp3');
    expect(audioItems(result.project).map((c) => c.media.url)).toEqual([
      'https://cdn/jamendo-77.mp3',
      'https://cdn/audius-V66vyPP.mp3',
    ]);
  });

  it('drops a clip that cannot be cached instead of failing the export', async () => {
    const aud = song(0, 60, 30, {
      media: { url: audiusStream, source: 'audius' },
      trackId: 'gone',
    });
    const keep = song(60, 60, 30, { media: { url: 'https://x/own.mp3', source: 'library' } });
    const p = project([track('main', [photo(150)]), track('audio', [aud, keep])]);
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: 'Track not found' }),
    });

    const result = await cacheCatalogAudioForExport(p, 'prop-1');

    expect(result.dropped).toBe(1);
    expect(audioItems(result.project).map((c) => c.id)).toEqual([keep.id]);
  });

  it('drops a stream clip with no track id (nothing to ask the server for)', async () => {
    const aud = song(0, 60, 30, { media: { url: audiusStream, source: 'audius' } });
    const p = project([track('main', [photo(150)]), track('audio', [aud])]);

    const result = await cacheCatalogAudioForExport(p, 'prop-1');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.dropped).toBe(1);
  });

  it('leaves a project without catalog streams untouched', async () => {
    const own = song(0, 60, 30, { media: { url: 'https://x/own.mp3', source: 'library' } });
    const p = project([track('main', [photo(150)]), track('audio', [own])]);

    const result = await cacheCatalogAudioForExport(p, 'prop-1');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.project).toBe(p);
    expect(result.dropped).toBe(0);
  });
});
