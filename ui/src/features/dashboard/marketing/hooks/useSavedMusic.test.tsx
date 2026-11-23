import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readSavedMusic, useSavedMusic } from '@/features/dashboard/marketing/hooks/useSavedMusic';
import type { MusicTrack } from '@/features/dashboard/marketing/lib/music/musicTypes';

function track(id: string, over: Partial<MusicTrack> = {}): MusicTrack {
  return {
    id,
    source: 'jamendo',
    title: `Song ${id}`,
    artist: 'Artist',
    durationSec: 120,
    imageUrl: null,
    streamUrl: `https://x/${id}.mp3`,
    exportable: true,
    ...over,
  };
}

/** happy-dom here has no localStorage, so every test gets a small in-memory one. */
function installStorage() {
  const map = new Map<string, string>();
  const fake = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, String(value)),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  };
  Object.defineProperty(window, 'localStorage', { value: fake, configurable: true });
  return fake;
}

describe('useSavedMusic', () => {
  let storage: ReturnType<typeof installStorage>;

  beforeEach(() => {
    storage = installStorage();
  });

  it('saves and removes a track and remembers it for the next visit', () => {
    const { result, unmount } = renderHook(() => useSavedMusic('prop-1'));
    act(() => result.current.toggle(track('1')));
    expect(result.current.isSaved(track('1'))).toBe(true);
    unmount();

    const again = renderHook(() => useSavedMusic('prop-1'));
    expect(again.result.current.tracks.map((t) => t.id)).toEqual(['1']);

    act(() => again.result.current.toggle(track('1')));
    expect(again.result.current.tracks).toEqual([]);
    expect(readSavedMusic('prop-1')).toEqual([]);
  });

  it('puts the newest first and keeps properties apart', () => {
    const a = renderHook(() => useSavedMusic('prop-1'));
    act(() => a.result.current.toggle(track('1')));
    act(() => a.result.current.toggle(track('2')));
    expect(a.result.current.tracks.map((t) => t.id)).toEqual(['2', '1']);

    const b = renderHook(() => useSavedMusic('prop-2'));
    expect(b.result.current.tracks).toEqual([]);
  });

  it('keeps the same id from two sources apart', () => {
    const { result } = renderHook(() => useSavedMusic('prop-1'));
    act(() => result.current.toggle(track('1')));
    expect(result.current.isSaved(track('1', { source: 'audius' }))).toBe(false);
  });

  it('refuses Instagram songs and tracks that cannot be exported', () => {
    const { result } = renderHook(() => useSavedMusic('prop-1'));
    act(() => result.current.toggle(track('1', { source: 'instagram', exportable: false })));
    act(() => result.current.toggle(track('2', { streamUrl: null })));
    expect(result.current.tracks).toEqual([]);
  });

  it('caps the list at 50', () => {
    const { result } = renderHook(() => useSavedMusic('prop-1'));
    for (let i = 0; i < 55; i += 1) act(() => result.current.toggle(track(String(i))));
    expect(result.current.tracks).toHaveLength(50);
    expect(result.current.tracks[0]!.id).toBe('54');
  });

  it('ignores damaged storage instead of throwing', () => {
    storage.setItem('kame:marketing-music-saved:prop-1', '{not json');
    expect(readSavedMusic('prop-1')).toEqual([]);
    storage.setItem(
      'kame:marketing-music-saved:prop-1',
      JSON.stringify([{ id: 1 }, null, track('ok')])
    );
    expect(readSavedMusic('prop-1').map((t) => t.id)).toEqual(['ok']);
  });

  it('still works in memory when storage refuses writes', () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useSavedMusic('prop-1'));
    act(() => result.current.toggle(track('1')));
    expect(result.current.isSaved(track('1'))).toBe(true);
  });
});
