/**
 * Parking gallery media — pure validation + settings serialization.
 * Mirrors the property gallery shape (see `propertyMedia.ts`) capped at 3 photos.
 * Keep limits in sync with `ui/src/features/dashboard/parking/lib/parkingMedia.ts`.
 */

import { normalizePropertyMediaItems, type PropertyMediaRecord } from './propertyMedia.ts';

export const MAX_PARKING_IMAGES = 3;

export type ParkingMediaRecord = PropertyMediaRecord;

/** Cap at 3 images, force a single primary, and re-sequence `order`. */
export function normalizeParkingMediaItems(raw: unknown): ParkingMediaRecord[] {
  const images = normalizePropertyMediaItems(raw)
    .filter((item) => item.type === 'image')
    .slice(0, MAX_PARKING_IMAGES);
  const primaryId = images.find((item) => item.isPrimary)?.id ?? images[0]?.id ?? '';

  return images.map((item, index) => ({
    ...item,
    type: 'image',
    order: index,
    isPrimary: item.id === primaryId,
  }));
}

/** Pre-gallery rows kept the cover in `coverImage` / `images` only. */
function legacyParkingMedia(settings: Record<string, unknown>): ParkingMediaRecord[] {
  const urls: string[] = [];
  const coverImage = typeof settings.coverImage === 'string' ? settings.coverImage.trim() : '';
  if (coverImage) urls.push(coverImage);

  const images = Array.isArray(settings.images) ? settings.images : [];
  for (const value of images) {
    if (typeof value !== 'string') continue;
    const url = value.trim();
    if (!url || urls.includes(url)) continue;
    urls.push(url);
  }

  const coverImageStoragePath =
    typeof settings.coverImageStoragePath === 'string' ? settings.coverImageStoragePath.trim() : '';

  return urls.slice(0, MAX_PARKING_IMAGES).map((url, index) => ({
    id: `legacy-${index}`,
    url,
    storagePath: index === 0 && coverImageStoragePath ? coverImageStoragePath : undefined,
    type: 'image',
    isPrimary: index === 0,
    order: index,
  }));
}

/** Canonical gallery: `settings.media` when present, else the legacy single cover. */
export function parkingMediaItemsFromSettings(
  settings: Record<string, unknown> | null | undefined
): ParkingMediaRecord[] {
  if (!settings) return [];
  const media = normalizeParkingMediaItems(settings.media);
  if (media.length > 0) return media;
  return legacyParkingMedia(settings);
}

/** Settings patch that keeps `media`, `images`, and `coverImage` in sync. */
export function parkingMediaSettingsPatch(items: ParkingMediaRecord[]): Record<string, unknown> {
  const media = normalizeParkingMediaItems(items);
  const primary = media.find((item) => item.isPrimary) ?? media[0] ?? null;

  return {
    media,
    images: media.map((item) => item.url),
    coverImage: primary?.url ?? null,
    coverImageStoragePath: primary?.storagePath ?? null,
  };
}
