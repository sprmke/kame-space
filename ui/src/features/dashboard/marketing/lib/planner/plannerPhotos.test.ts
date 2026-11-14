import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PHOTO_SUGGESTIONS,
  normalizeGallery,
  sanitizeSelectedPhotos,
  suggestPlannerPhotos,
  togglePhotoSelection,
} from '@/features/dashboard/marketing/lib/planner/plannerPhotos';

const GALLERY = ['https://cdn/a.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg'];

describe('normalizeGallery', () => {
  it('drops blanks and duplicates, keeps order', () => {
    expect(normalizeGallery(['https://cdn/a.jpg', null, '  ', 'https://cdn/a.jpg', 'https://cdn/b.jpg']))
      .toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
  });
});

describe('suggestPlannerPhotos', () => {
  it('puts unused photos first, then used ones', () => {
    expect(suggestPlannerPhotos(GALLERY, new Set(['https://cdn/a.jpg']))).toEqual([
      'https://cdn/b.jpg',
      'https://cdn/c.jpg',
      'https://cdn/a.jpg',
    ]);
  });

  it('caps the list', () => {
    expect(suggestPlannerPhotos(GALLERY, new Set(), 2)).toHaveLength(2);
  });

  it('never returns more than the gallery has', () => {
    expect(suggestPlannerPhotos([], new Set())).toEqual([]);
  });

  it('uses a sane default limit', () => {
    const many = Array.from({ length: 20 }, (_, index) => `https://cdn/${index}.jpg`);
    expect(suggestPlannerPhotos(many)).toHaveLength(DEFAULT_PHOTO_SUGGESTIONS);
  });
});

describe('togglePhotoSelection', () => {
  it('adds, removes and caps', () => {
    expect(togglePhotoSelection([], 'a', 2)).toEqual(['a']);
    expect(togglePhotoSelection(['a'], 'a', 2)).toEqual([]);
    expect(togglePhotoSelection(['a', 'b'], 'c', 2)).toEqual(['a', 'b']);
  });
});

describe('sanitizeSelectedPhotos', () => {
  it('keeps only gallery URLs, deduped and in order', () => {
    expect(
      sanitizeSelectedPhotos(['https://cdn/b.jpg', 'https://evil/x.jpg', 3, 'https://cdn/b.jpg'], GALLERY)
    ).toEqual(['https://cdn/b.jpg']);
  });
});
