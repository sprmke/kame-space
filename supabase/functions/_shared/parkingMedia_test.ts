import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  MAX_PARKING_IMAGES,
  normalizeParkingMediaItems,
  parkingMediaItemsFromSettings,
  parkingMediaSettingsPatch,
} from './parkingMedia.ts';

Deno.test('legacy parking settings resolve the single cover as the primary photo', () => {
  const media = parkingMediaItemsFromSettings({
    coverImage: 'https://cdn.test/cover.jpg',
    coverImageStoragePath: 'parking/p1/cover.jpg',
  });

  assertEquals(media.length, 1);
  assertEquals(media[0]?.url, 'https://cdn.test/cover.jpg');
  assertEquals(media[0]?.storagePath, 'parking/p1/cover.jpg');
  assertEquals(media[0]?.isPrimary, true);
});

Deno.test('legacy cover and images merge without duplicates and cap at three', () => {
  const media = parkingMediaItemsFromSettings({
    coverImage: 'https://cdn.test/a.jpg',
    images: [
      'https://cdn.test/a.jpg',
      'https://cdn.test/b.jpg',
      'https://cdn.test/c.jpg',
      'https://cdn.test/d.jpg',
    ],
  });

  assertEquals(media.length, MAX_PARKING_IMAGES);
  assertEquals(
    media.map((item) => item.url),
    ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg', 'https://cdn.test/c.jpg']
  );
});

Deno.test('parking media normalization keeps exactly one primary', () => {
  const media = normalizeParkingMediaItems([
    { id: 'a', url: 'https://cdn.test/a.jpg', type: 'image', order: 0 },
    { id: 'b', url: 'https://cdn.test/b.jpg', type: 'image', order: 1, isPrimary: true },
    { id: 'c', url: 'https://cdn.test/c.jpg', type: 'image', order: 2 },
    { id: 'd', url: 'https://cdn.test/d.jpg', type: 'image', order: 3 },
  ]);

  assertEquals(media.length, MAX_PARKING_IMAGES);
  assertEquals(media.filter((item) => item.isPrimary).length, 1);
  assertEquals(media.find((item) => item.isPrimary)?.id, 'b');
});

Deno.test('parking settings patch keeps media, images, and cover in sync', () => {
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

  assertEquals(patch.images, ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg']);
  assertEquals(patch.coverImage, 'https://cdn.test/b.jpg');
  assertEquals(patch.coverImageStoragePath, 'parking/p1/b.jpg');
});
