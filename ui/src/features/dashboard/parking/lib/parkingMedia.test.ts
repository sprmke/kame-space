import { describe, expect, it } from 'vitest';

import {
  MAX_PARKING_IMAGES,
  normalizeParkingMediaDraft,
  parkingMediaCoverImage,
  parkingMediaFromSettings,
  parkingMediaSettingsPatch,
  sequencedParkingMedia,
  type ParkingMediaItem,
} from '@/features/dashboard/parking/lib/parkingMedia';

describe('parkingMediaFromSettings', () => {
  it('reads the legacy single cover', () => {
    const media = parkingMediaFromSettings({
      coverImage: ' https://cdn.test/cover.jpg ',
      coverImageStoragePath: 'parking/p1/cover.jpg',
    });

    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({
      url: 'https://cdn.test/cover.jpg',
      storagePath: 'parking/p1/cover.jpg',
      isPrimary: true,
      order: 0,
    });
  });

  it('merges legacy cover and images without duplicates and caps at the limit', () => {
    const media = parkingMediaFromSettings({
      coverImage: 'https://cdn.test/a.jpg',
      images: [
        'https://cdn.test/a.jpg',
        'https://cdn.test/b.jpg',
        'https://cdn.test/c.jpg',
        'https://cdn.test/d.jpg',
      ],
    });

    expect(media).toHaveLength(MAX_PARKING_IMAGES);
    expect(media.map((item) => item.url)).toEqual([
      'https://cdn.test/a.jpg',
      'https://cdn.test/b.jpg',
      'https://cdn.test/c.jpg',
    ]);
  });

  it('prefers the media array when present', () => {
    const media = parkingMediaFromSettings({
      coverImage: 'https://cdn.test/legacy.jpg',
      media: [
        { id: 'b', url: 'https://cdn.test/b.jpg', order: 1 },
        { id: 'a', url: 'https://cdn.test/a.jpg', order: 0, isPrimary: true },
      ],
    });

    expect(media.map((item) => item.id)).toEqual(['a', 'b']);
    expect(media[0]?.isPrimary).toBe(true);
  });
});

describe('normalizeParkingMediaDraft', () => {
  it('caps the gallery and keeps exactly one primary', () => {
    const items = Array.from({ length: 4 }, (_, index) => ({
      id: `p${index}`,
      url: `https://cdn.test/${index}.jpg`,
      type: 'image' as const,
      isPrimary: index === 2,
      order: index,
    }));

    const normalized = normalizeParkingMediaDraft(items);

    expect(normalized).toHaveLength(MAX_PARKING_IMAGES);
    expect(normalized.filter((item) => item.isPrimary)).toHaveLength(1);
    expect(normalized.find((item) => item.isPrimary)?.id).toBe('p2');
  });

  it('re-sequences order after a drag', () => {
    const images = [
      { id: 'a', url: 'https://cdn.test/a.jpg', type: 'image' as const, order: 0 },
      { id: 'b', url: 'https://cdn.test/b.jpg', type: 'image' as const, order: 1 },
    ];

    const reordered = sequencedParkingMedia([images[1]!, images[0]!]);

    expect(reordered.map((item) => [item.id, item.order])).toEqual([
      ['b', 0],
      ['a', 1],
    ]);
    expect(reordered[0]?.isPrimary).toBe(true);
  });
});

describe('parkingMediaSettingsPatch', () => {
  it('keeps media, images, and cover fields in sync', () => {
    const patch = parkingMediaSettingsPatch([
      { id: 'a', url: 'https://cdn.test/a.jpg', type: 'image', order: 0 },
      {
        id: 'b',
        url: 'https://cdn.test/b.jpg',
        storagePath: 'parking/p1/b.jpg',
        type: 'image',
        order: 1,
        isPrimary: true,
      },
    ]);

    expect(patch.images).toEqual(['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg']);
    expect(patch.coverImage).toBe('https://cdn.test/b.jpg');
    expect(patch.coverImageStoragePath).toBe('parking/p1/b.jpg');
    expect(parkingMediaCoverImage(patch.media as ParkingMediaItem[])).toBe(
      'https://cdn.test/b.jpg'
    );
  });

  it('clears the cover when the gallery is empty', () => {
    const patch = parkingMediaSettingsPatch([]);

    expect(patch).toMatchObject({ media: [], images: [], coverImage: null });
  });
});
