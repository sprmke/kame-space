import { describe, expect, it } from 'vitest';

import {
  applyPhotoBlobs,
  fitWithin,
  isRemotePhotoUrl,
  photoSizesFromPreflight,
  restorePhotoUrls,
  usablePhotoUrls,
  type PhotoPreflightMap,
} from '@/features/dashboard/marketing/lib/poster/posterPhotoPreflight';

const preflight: PhotoPreflightMap = {
  'https://cdn.test/a.jpg': {
    url: 'https://cdn.test/a.jpg',
    blobUrl: 'blob:http://app/aaa',
    width: 4000,
    height: 3000,
    ok: true,
  },
  'https://cdn.test/bad.jpg': {
    url: 'https://cdn.test/bad.jpg',
    blobUrl: null,
    width: 0,
    height: 0,
    ok: false,
  },
};

const document = {
  pages: [
    {
      children: [
        { type: 'image', src: 'https://cdn.test/a.jpg' },
        { type: 'image', src: 'https://cdn.test/bad.jpg' },
        { type: 'text', text: 'https://cdn.test/a.jpg' },
      ],
    },
  ],
};

describe('fitWithin', () => {
  it('downscales the long edge and keeps the ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
  it('never upscales', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe('isRemotePhotoUrl', () => {
  it('treats only http(s) as remote', () => {
    expect(isRemotePhotoUrl('https://a/b.jpg')).toBe(true);
    expect(isRemotePhotoUrl('http://127.0.0.1:54321/x.jpg')).toBe(true);
    expect(isRemotePhotoUrl('data:image/png;base64,AA')).toBe(false);
    expect(isRemotePhotoUrl('blob:http://app/1')).toBe(false);
  });
});

describe('blob swap', () => {
  it('uses the blob for a prepared photo and keeps unprepared ones', () => {
    const swapped = applyPhotoBlobs(document, preflight);
    const children = swapped.pages[0]!.children;
    expect(children[0]!.src).toBe('blob:http://app/aaa');
    expect(children[1]!.src).toBe('https://cdn.test/bad.jpg');
    expect(children[2]!.text).toBe('https://cdn.test/a.jpg');
  });

  it('never leaves a blob: URL once restored', () => {
    const restored = restorePhotoUrls(applyPhotoBlobs(document, preflight), preflight);
    expect(JSON.stringify(restored)).not.toContain('blob:');
    expect(restored).toEqual(document);
  });

  it('does not mutate the input', () => {
    applyPhotoBlobs(document, preflight);
    expect(document.pages[0]!.children[0]!.src).toBe('https://cdn.test/a.jpg');
  });
});

describe('usablePhotoUrls', () => {
  it('drops photos that failed preflight', () => {
    expect(
      usablePhotoUrls(['https://cdn.test/a.jpg', 'https://cdn.test/bad.jpg'], preflight)
    ).toEqual(['https://cdn.test/a.jpg']);
  });
  it('keeps the list when every photo failed so the render guard decides', () => {
    expect(usablePhotoUrls(['https://cdn.test/bad.jpg'], preflight)).toEqual([
      'https://cdn.test/bad.jpg',
    ]);
  });
  it('keeps urls it has no result for', () => {
    expect(usablePhotoUrls(['https://cdn.test/new.jpg'], preflight)).toEqual([
      'https://cdn.test/new.jpg',
    ]);
  });
});

describe('photoSizesFromPreflight', () => {
  it('reports sizes for ok photos only', () => {
    expect(photoSizesFromPreflight(preflight)).toEqual({
      'https://cdn.test/a.jpg': { width: 4000, height: 3000 },
      'https://cdn.test/bad.jpg': undefined,
    });
  });
});
