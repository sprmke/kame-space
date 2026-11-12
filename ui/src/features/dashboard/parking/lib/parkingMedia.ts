/**
 * Parking gallery media — client mirror of edge `_shared/parkingMedia.ts`.
 * A parking listing holds up to 3 photos; one is the cover.
 */

import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';

export const MAX_PARKING_IMAGES = 3;

export type ParkingMediaItem = PropertyMediaItem;

/** Cap at 3 images, force a single primary, and re-sequence `order`. */
export function normalizeParkingMediaDraft(items: ParkingMediaItem[]): ParkingMediaItem[] {
  const images = items
    .filter((item) => item.type !== 'video')
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_PARKING_IMAGES);

  const primaryId = images.find((item) => item.isPrimary)?.id ?? images[0]?.id ?? '';

  return images.map((item, index) => ({
    ...item,
    type: 'image',
    order: index,
    isPrimary: item.id === primaryId,
  }));
}

/** Apply array order to `order` before normalize (drag reorder / primary toggle). */
export function sequencedParkingMedia(
  items: ParkingMediaItem[],
  primaryImageId?: string
): ParkingMediaItem[] {
  return normalizeParkingMediaDraft(
    items.map((item, index) => ({
      ...item,
      order: index,
      ...(primaryImageId !== undefined ? { isPrimary: item.id === primaryImageId } : {}),
    }))
  );
}

function readParkingMediaItems(raw: unknown): ParkingMediaItem[] {
  if (!Array.isArray(raw)) return [];

  const parsed: ParkingMediaItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    if (!id || !url) continue;

    parsed.push({
      id,
      url,
      storagePath:
        typeof row.storagePath === 'string' ? row.storagePath.trim() || undefined : undefined,
      type: 'image',
      isPrimary: row.isPrimary === true,
      order:
        typeof row.order === 'number' && Number.isFinite(row.order)
          ? Math.max(0, Math.round(row.order))
          : parsed.length,
    });
  }
  return parsed;
}

function legacyParkingMedia(settings: Record<string, unknown>): ParkingMediaItem[] {
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
export function parkingMediaFromSettings(
  settings: Record<string, unknown> | null | undefined
): ParkingMediaItem[] {
  if (!settings) return [];
  const media = normalizeParkingMediaDraft(readParkingMediaItems(settings.media));
  if (media.length > 0) return media;
  return legacyParkingMedia(settings);
}

export function parkingMediaCoverImage(items: ParkingMediaItem[]): string {
  const primary = items.find((item) => item.isPrimary) ?? items[0];
  return primary?.url?.trim() ?? '';
}

/** Cover first, then the rest in gallery order. */
export function parkingMediaGalleryUrls(items: ParkingMediaItem[]): string[] {
  const primary = items.find((item) => item.isPrimary) ?? items[0];
  const rest = items.filter((item) => item !== primary);
  return [...(primary ? [primary] : []), ...rest].map((item) => item.url).filter(Boolean);
}

/** Settings patch that keeps `media`, `images`, and `coverImage` in sync. */
export function parkingMediaSettingsPatch(items: ParkingMediaItem[]): Record<string, unknown> {
  const media = normalizeParkingMediaDraft(items);
  const primary = media.find((item) => item.isPrimary) ?? media[0] ?? null;

  return {
    media,
    images: media.map((item) => item.url),
    coverImage: primary?.url ?? null,
    coverImageStoragePath: primary?.storagePath ?? null,
  };
}
