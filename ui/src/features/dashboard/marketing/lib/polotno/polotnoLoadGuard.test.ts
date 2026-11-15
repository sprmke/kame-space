import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('openpolotno/config', () => ({ onLoadError: vi.fn() }));

import { collectDocumentImageUrls } from '@/features/dashboard/marketing/lib/polotno/documentImages';
import {
  matchFailedUrls,
  PosterRenderError,
  recordLoadFailureForTests,
  resetLoadFailuresForTests,
  startLoadGuard,
} from '@/features/dashboard/marketing/lib/polotno/polotnoLoadGuard';

const doc = {
  pages: [
    {
      children: [
        { type: 'image', src: 'https://cdn.test/a.jpg' },
        { type: 'text', text: 'hi' },
        { type: 'image', src: 'https://cdn.test/b.jpg' },
        { type: 'image', src: 'https://cdn.test/a.jpg' },
      ],
    },
  ],
};

describe('collectDocumentImageUrls', () => {
  it('returns each image src once', () => {
    expect(collectDocumentImageUrls(doc)).toEqual([
      'https://cdn.test/a.jpg',
      'https://cdn.test/b.jpg',
    ]);
  });

  it('tolerates junk input', () => {
    expect(collectDocumentImageUrls(null)).toEqual([]);
    expect(collectDocumentImageUrls('x')).toEqual([]);
  });
});

describe('matchFailedUrls', () => {
  it('matches labels that carry the url', () => {
    const labels = ['image with id 7 url: https://cdn.test/b.jpg'];
    expect(matchFailedUrls(labels, ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'])).toEqual([
      'https://cdn.test/b.jpg',
    ]);
  });

  it('matches long urls that the label cut at 200 characters', () => {
    const long = `https://cdn.test/${'x'.repeat(300)}.jpg`;
    expect(matchFailedUrls([`image with id 1 url: ${long.slice(0, 200)}`], [long])).toEqual([long]);
  });

  it('returns nothing without failures', () => {
    expect(matchFailedUrls([], ['https://cdn.test/a.jpg'])).toEqual([]);
  });
});

describe('startLoadGuard', () => {
  beforeEach(() => resetLoadFailuresForTests());

  it('passes when nothing failed', () => {
    expect(() => startLoadGuard(doc).assertClean()).not.toThrow();
  });

  it('throws a typed error naming the failed photo', () => {
    const guard = startLoadGuard(doc);
    recordLoadFailureForTests('image with id 3 url: https://cdn.test/b.jpg');
    expect(() => guard.assertClean()).toThrow(PosterRenderError);
    expect(guard.failed()).toEqual(['https://cdn.test/b.jpg']);
  });

  it('ignores failures for photos that are not in this document', () => {
    const guard = startLoadGuard(doc);
    recordLoadFailureForTests('image with id 9 url: https://other.test/z.jpg');
    expect(() => guard.assertClean()).not.toThrow();
  });

  it('ignores failures from before the guard started and after reset', () => {
    recordLoadFailureForTests('image with id 3 url: https://cdn.test/b.jpg');
    const guard = startLoadGuard(doc);
    expect(guard.failed()).toEqual(['https://cdn.test/b.jpg']);
    guard.reset();
    expect(guard.failed()).toEqual([]);
  });
});
