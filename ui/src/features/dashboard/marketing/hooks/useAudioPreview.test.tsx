import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAudioPreview } from '@/features/dashboard/marketing/hooks/useAudioPreview';

const toastMessage = vi.fn();
vi.mock('sonner', () => ({ toast: { message: (...args: unknown[]) => toastMessage(...args) } }));

class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  preload = '';
  paused = true;
  currentTime = 0;
  duration = 100;
  playMock = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  listeners = new Map<string, Array<() => void>>();
  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  emit(type: string) {
    (this.listeners.get(type) ?? []).forEach((fn) => fn());
  }
  play() {
    return this.playMock();
  }
  pause() {
    this.paused = true;
  }
  removeAttribute() {}
  load() {}
}

describe('useAudioPreview', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    toastMessage.mockReset();
    vi.stubGlobal('Audio', FakeAudio);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads, then plays, and reports progress', () => {
    const { result } = renderHook(() => useAudioPreview());

    act(() => result.current.toggle('a', 'https://x/a.mp3'));
    expect(result.current.loadingKey).toBe('a');
    expect(result.current.playingKey).toBeNull();

    act(() => FakeAudio.instances[0]!.emit('playing'));
    expect(result.current.playingKey).toBe('a');
    expect(result.current.loadingKey).toBeNull();

    act(() => {
      FakeAudio.instances[0]!.currentTime = 25;
      FakeAudio.instances[0]!.emit('timeupdate');
    });
    expect(result.current.progress).toBeCloseTo(0.25);
  });

  it('tapping the same track again stops it', () => {
    const { result } = renderHook(() => useAudioPreview());
    act(() => result.current.toggle('a', 'https://x/a.mp3'));
    act(() => FakeAudio.instances[0]!.emit('playing'));

    act(() => result.current.toggle('a', 'https://x/a.mp3'));

    expect(result.current.playingKey).toBeNull();
    expect(result.current.loadingKey).toBeNull();
    expect(FakeAudio.instances[0]!.paused).toBe(true);
  });

  it('starting another track stops the first and ignores its late events', () => {
    const { result } = renderHook(() => useAudioPreview());
    act(() => result.current.toggle('a', 'https://x/a.mp3'));
    act(() => result.current.toggle('b', 'https://x/b.mp3'));

    expect(FakeAudio.instances[0]!.paused).toBe(true);
    // The first clip finishes loading after it was replaced.
    act(() => FakeAudio.instances[0]!.emit('playing'));
    expect(result.current.playingKey).toBeNull();
    expect(result.current.loadingKey).toBe('b');

    act(() => FakeAudio.instances[1]!.emit('playing'));
    expect(result.current.playingKey).toBe('b');
  });

  it('a track with no url does nothing', () => {
    const { result } = renderHook(() => useAudioPreview());
    act(() => result.current.toggle('a', null));
    expect(FakeAudio.instances).toHaveLength(0);
    expect(result.current.loadingKey).toBeNull();
  });

  it('an element error resets and tells the host', () => {
    const { result } = renderHook(() => useAudioPreview());
    act(() => result.current.toggle('a', 'https://x/a.mp3'));
    act(() => FakeAudio.instances[0]!.emit('error'));

    expect(result.current.loadingKey).toBeNull();
    expect(toastMessage).toHaveBeenCalledWith('Could not play this preview');
  });

  it('a blocked play() resets and tells the host', async () => {
    const { result } = renderHook(() => useAudioPreview());
    vi.spyOn(FakeAudio.prototype, 'play').mockRejectedValueOnce(new Error('blocked'));

    await act(async () => result.current.toggle('a', 'https://x/a.mp3'));

    expect(result.current.loadingKey).toBeNull();
    expect(toastMessage).toHaveBeenCalledWith('Could not play this preview');
  });

  it('finishing a clip returns to idle', () => {
    const { result } = renderHook(() => useAudioPreview());
    act(() => result.current.toggle('a', 'https://x/a.mp3'));
    act(() => FakeAudio.instances[0]!.emit('playing'));
    act(() => FakeAudio.instances[0]!.emit('ended'));
    expect(result.current.playingKey).toBeNull();
  });

  it('stops when the screen unmounts', () => {
    const { result, unmount } = renderHook(() => useAudioPreview());
    act(() => result.current.toggle('a', 'https://x/a.mp3'));
    unmount();
    expect(FakeAudio.instances[0]!.paused).toBe(true);
  });
});
