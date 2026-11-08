import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadPosterPhotoSizes } from '@/features/dashboard/marketing/lib/poster/posterPhotoSizes';

class ImageStub {
  static behaviour: 'load' | 'error' | 'never' = 'load';
  static naturalWidth = 800;
  static naturalHeight = 600;

  crossOrigin = '';
  naturalWidth = ImageStub.naturalWidth;
  naturalHeight = ImageStub.naturalHeight;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private source = '';

  set src(value: string) {
    this.source = value;
    const behaviour = ImageStub.behaviour;
    if (behaviour === 'load') queueMicrotask(() => this.onload?.());
    if (behaviour === 'error') queueMicrotask(() => this.onerror?.());
  }

  get src(): string {
    return this.source;
  }
}

vi.stubGlobal('Image', ImageStub);
// Delegate dynamically so fake timers can drive the 8 s guard.
vi.stubGlobal('window', {
  setTimeout: (callback: () => void, ms?: number) => setTimeout(callback, ms),
  clearTimeout: (handle: ReturnType<typeof setTimeout> | undefined) => clearTimeout(handle),
});

beforeEach(() => {
  ImageStub.behaviour = 'load';
  ImageStub.naturalWidth = 800;
  ImageStub.naturalHeight = 600;
});

afterEach(() => {
  ImageStub.behaviour = 'load';
  ImageStub.naturalWidth = 800;
  ImageStub.naturalHeight = 600;
});

describe('loadPosterPhotoSizes', () => {
  it('reports the natural size for each unique url', async () => {
    const sizes = await loadPosterPhotoSizes([
      'https://img.test/a.jpg',
      'https://img.test/a.jpg',
      'https://img.test/b.jpg',
    ]);

    expect(Object.keys(sizes)).toEqual(['https://img.test/a.jpg', 'https://img.test/b.jpg']);
    expect(sizes['https://img.test/a.jpg']).toEqual({ width: 800, height: 600 });
  });

  it('treats a zero-dimension image as unknown', async () => {
    ImageStub.naturalWidth = 0;

    const sizes = await loadPosterPhotoSizes(['https://img.test/zero.jpg']);

    expect(sizes['https://img.test/zero.jpg']).toBeUndefined();
  });

  it('drops blank urls', async () => {
    await expect(loadPosterPhotoSizes(['', ''])).resolves.toEqual({});
  });

  it('returns an undefined size for a broken image instead of blocking generation', async () => {
    ImageStub.behaviour = 'error';

    const sizes = await loadPosterPhotoSizes(['https://img.test/broken.jpg']);

    expect(sizes['https://img.test/broken.jpg']).toBeUndefined();
  });

  it('gives up on an image that never settles', async () => {
    vi.useFakeTimers();
    try {
      ImageStub.behaviour = 'never';

      const pending = loadPosterPhotoSizes(['https://img.test/slow.jpg']);
      await vi.advanceTimersByTimeAsync(8_001);

      await expect(pending).resolves.toEqual({ 'https://img.test/slow.jpg': undefined });
    } finally {
      vi.useRealTimers();
    }
  });
});
