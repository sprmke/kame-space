import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MusicPicker } from '@/features/dashboard/marketing/components/media-library/music/MusicPicker';
import type { MusicTrack } from '@/features/dashboard/marketing/lib/music/musicTypes';

vi.mock('@/features/dashboard/org/lib/adminApiScope', () => ({
  usePropertyIdParam: () => 'prop-1',
  scopedFunctionsUrl: (path: string) => `https://fn.test/${path}`,
}));
vi.mock('@/features/dashboard/org/lib/edgeClient', () => ({
  getSessionJwt: vi.fn().mockResolvedValue('jwt'),
}));
vi.mock('sonner', () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }));

function track(
  id: string,
  source: MusicTrack['source'] = 'jamendo',
  over: Partial<MusicTrack> = {}
): MusicTrack {
  return {
    id,
    source,
    title: `Song ${id}`,
    artist: 'Some Artist',
    durationSec: 151,
    imageUrl: null,
    streamUrl: `https://x/${id}.mp3`,
    exportable: source !== 'instagram',
    ...over,
  };
}

type Handler = (url: URL) => unknown;
let handler: Handler;
const requests: URL[] = [];

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const url = new URL(input);
      requests.push(url);
      const data = handler(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data }),
      });
    })
  );
}

function page(tracks: MusicTrack[], over: Record<string, unknown> = {}) {
  return {
    tracks,
    hasMore: false,
    sources: { jamendo: 'ok', audius: 'ok' },
    ...over,
  };
}

function renderPicker(props: Parameters<typeof MusicPicker>[0] = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MusicPicker {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  requests.length = 0;
  handler = () => page([]);
  mockFetch();
  const map = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MusicPicker (library)', () => {
  it('shows trending songs from both sources and the group chips', async () => {
    handler = () => page([track('1', 'jamendo'), track('a', 'audius')]);
    renderPicker({ onPick: vi.fn() });

    expect(await screen.findByText('Song 1')).toBeTruthy();
    expect(screen.getByText('Song a')).toBeTruthy();
    expect(screen.getAllByText('Some Artist · 2:31').length).toBe(2);
    const chips = screen.getByRole('group', { name: 'Music groups' });
    for (const label of ['Trending', 'Popular', 'Chill', 'Happy', 'Beach day']) {
      expect(within(chips).getByRole('button', { name: label })).toBeTruthy();
    }
    expect(
      within(chips).getByRole('button', { name: 'Trending' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(requests[0]!.searchParams.get('group')).toBe('trending');
    expect(requests[0]!.searchParams.get('page')).toBe('0');
  });

  it('asks for another group when a chip is tapped', async () => {
    handler = (url) => page([track(`${url.searchParams.get('group')}-1`)]);
    renderPicker({ onPick: vi.fn() });
    await screen.findByText('Song trending-1');

    fireEvent.click(screen.getByRole('button', { name: 'Chill' }));

    expect(await screen.findByText('Song chill-1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chill' }).getAttribute('aria-pressed')).toBe('true');
    expect(requests.at(-1)!.searchParams.get('group')).toBe('chill');
  });

  it('searches after a pause, hides the chips and can be cleared', async () => {
    handler = (url) => page([track(url.searchParams.get('q') ? 'found' : 'start')]);
    renderPicker({ onPick: vi.fn() });
    await screen.findByText('Song start');

    fireEvent.change(screen.getByLabelText('Search music'), { target: { value: 'beach' } });

    expect(await screen.findByText('Song found')).toBeTruthy();
    expect(requests.at(-1)!.searchParams.get('q')).toBe('beach');
    expect(screen.queryByRole('group', { name: 'Music groups' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByText('Song start')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Music groups' })).toBeTruthy();
  });

  it('adds a track as an audio clip payload with its source and credit', async () => {
    handler = () => page([track('a', 'audius')]);
    const onPick = vi.fn();
    renderPicker({ onPick });

    fireEvent.click(await screen.findByRole('button', { name: 'Add Song a' }));

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]![0]).toMatchObject({
      kind: 'audio',
      source: 'audius',
      trackId: 'a',
      title: 'Song a',
      artist: 'Some Artist',
      durationMs: 151000,
    });
  });

  it('loads the next page with Show more and keeps the first page', async () => {
    handler = (url) =>
      url.searchParams.get('page') === '0'
        ? page([track('1')], { hasMore: true })
        : page([track('2')]);
    renderPicker({ onPick: vi.fn() });
    await screen.findByText('Song 1');

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));

    expect(await screen.findByText('Song 2')).toBeTruthy();
    expect(screen.getByText('Song 1')).toBeTruthy();
    expect(requests.at(-1)!.searchParams.get('page')).toBe('1');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull());
  });

  it('does not list the same song twice across pages', async () => {
    handler = (url) =>
      url.searchParams.get('page') === '0'
        ? page([track('1')], { hasMore: true })
        : page([track('1'), track('2')]);
    renderPicker({ onPick: vi.fn() });
    await screen.findByText('Song 1');
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await screen.findByText('Song 2');
    expect(screen.getAllByText('Song 1')).toHaveLength(1);
  });

  it('says so, with a retry, when the music cannot load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, json: async () => ({ success: false, error: 'x' }) })
      )
    );
    renderPicker({ onPick: vi.fn() });

    // The list retries once (1 s back-off) before it gives up.
    expect(await screen.findByText('Music could not load', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('explains an empty list when every source is off', async () => {
    handler = () => page([], { sources: { jamendo: 'off', audius: 'off' } });
    renderPicker({ onPick: vi.fn() });
    expect(await screen.findByText('Music is not available right now')).toBeTruthy();
  });

  it('explains an empty search', async () => {
    handler = (url) => page(url.searchParams.get('q') ? [] : [track('1')]);
    renderPicker({ onPick: vi.fn() });
    await screen.findByText('Song 1');
    fireEvent.change(screen.getByLabelText('Search music'), { target: { value: 'zzzz' } });
    expect(await screen.findByText('No songs found. Try another word.')).toBeTruthy();
  });

  it('saves a track and lists it under Saved without another request', async () => {
    handler = () => page([track('1')]);
    renderPicker({ onPick: vi.fn() });
    fireEvent.click(await screen.findByRole('button', { name: 'Save Song 1' }));
    expect(screen.getByRole('button', { name: 'Remove Song 1 from saved' })).toBeTruthy();

    const before = requests.length;
    fireEvent.click(screen.getByRole('button', { name: /^Saved/ }));

    expect(screen.getByRole('list', { name: 'Saved music' })).toBeTruthy();
    expect(screen.getByText('Song 1')).toBeTruthy();
    expect(requests.length).toBe(before);
  });

  it('shows how saving works when nothing is saved yet', async () => {
    renderPicker({ onPick: vi.fn() });
    fireEvent.click(await screen.findByRole('button', { name: /^Saved/ }));
    expect(screen.getByText('Tap the bookmark on a song to save it here')).toBeTruthy();
  });

  it('has no Instagram tab unless the editor turns it on', async () => {
    renderPicker({ onPick: vi.fn() });
    await screen.findByRole('group', { name: 'Music groups' });
    expect(screen.queryByRole('group', { name: 'Music source' })).toBeNull();
  });

  it('plays a preview when a row is tapped', async () => {
    const instances: Array<{ src: string }> = [];
    class FakeAudio {
      src: string;
      preload = '';
      constructor(src: string) {
        this.src = src;
        instances.push(this);
      }
      addEventListener() {}
      removeAttribute() {}
      load() {}
      pause() {}
      play() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal('Audio', FakeAudio);
    handler = () => page([track('1')]);
    renderPicker({ onPick: vi.fn() });

    fireEvent.click(await screen.findByRole('button', { name: 'Play Song 1' }));

    expect(instances.map((i) => i.src)).toEqual(['https://x/1.mp3']);
  });
});

describe('MusicPicker (Instagram tab)', () => {
  const config = {
    selectedAudioId: null as string | null,
    onPick: vi.fn(),
    connectHref: '/org/o/property/p/inbox',
  };

  function instagramHandler(body: unknown) {
    handler = (url) => (url.searchParams.get('source') === 'instagram' ? body : page([track('1')]));
  }

  beforeEach(() => {
    config.onPick.mockReset();
    config.selectedAudioId = null;
  });

  it('switches to Instagram music and picks a song', async () => {
    instagramHandler({
      tracks: [track('ig1', 'instagram', { title: 'Golden Hour' })],
      instagram: { status: 'ok' },
    });
    renderPicker({ onPick: vi.fn(), instagram: config });
    await screen.findByText('Song 1');

    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));

    expect(await screen.findByText('Golden Hour')).toBeTruthy();
    expect(
      screen.getByText(
        'Instagram adds the song when you post a Reel. It is not in a downloaded video.'
      )
    ).toBeTruthy();
    // The free-music chips do not apply here.
    expect(screen.queryByRole('group', { name: 'Music groups' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use Golden Hour' }));
    expect(config.onPick).toHaveBeenCalledTimes(1);
    expect(config.onPick.mock.calls[0]![0]).toMatchObject({ id: 'ig1', source: 'instagram' });
  });

  it('marks the song already chosen', async () => {
    config.selectedAudioId = 'ig1';
    instagramHandler({
      tracks: [track('ig1', 'instagram', { title: 'Golden Hour' })],
      instagram: { status: 'ok' },
    });
    renderPicker({ onPick: vi.fn(), instagram: config });
    fireEvent.click(await screen.findByRole('button', { name: 'Instagram' }));
    expect(await screen.findByRole('button', { name: 'Golden Hour is selected' })).toBeTruthy();
  });

  it('searches Instagram music with the typed words', async () => {
    instagramHandler({ tracks: [], instagram: { status: 'ok' } });
    renderPicker({ onPick: vi.fn(), instagram: config });
    fireEvent.click(await screen.findByRole('button', { name: 'Instagram' }));
    fireEvent.change(screen.getByLabelText('Search Instagram music'), {
      target: { value: 'golden' },
    });
    await waitFor(() =>
      expect(
        requests.some(
          (r) =>
            r.searchParams.get('source') === 'instagram' && r.searchParams.get('q') === 'golden'
        )
      ).toBe(true)
    );
    expect(await screen.findByText('No songs found')).toBeTruthy();
  });

  it.each([
    ['not_connected', 'Connect Instagram to browse its music', 'Connect Instagram'],
    ['reconnect', 'Reconnect Instagram to browse its music', 'Reconnect'],
  ])('%s shows a link to the inbox', async (status, message, action) => {
    instagramHandler({ tracks: [], instagram: { status } });
    renderPicker({ onPick: vi.fn(), instagram: config });
    fireEvent.click(await screen.findByRole('button', { name: 'Instagram' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByRole('link', { name: action }).getAttribute('href')).toBe(
      config.connectHref
    );
  });

  it('says plainly when the account has no access', async () => {
    instagramHandler({ tracks: [], instagram: { status: 'no_access' } });
    renderPicker({ onPick: vi.fn(), instagram: config });
    fireEvent.click(await screen.findByRole('button', { name: 'Instagram' }));
    expect(
      await screen.findByText(
        'Instagram music is not available for this account. Pick a song from Music instead.'
      )
    ).toBeTruthy();
  });

  it('offers a retry when Instagram music fails to load', async () => {
    instagramHandler({ tracks: [], instagram: { status: 'error' } });
    renderPicker({ onPick: vi.fn(), instagram: config });
    fireEvent.click(await screen.findByRole('button', { name: 'Instagram' }));
    expect(await screen.findByText('Instagram music could not load')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
