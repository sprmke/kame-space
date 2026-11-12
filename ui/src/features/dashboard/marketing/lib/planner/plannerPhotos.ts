/**
 * Suggested photos for a plan item.
 *
 * The listing gallery is the only source. Photos no other item has used come first, in gallery
 * order, so a week of posts does not lead with the same five shots. Already-used photos stay in
 * the list, after the fresh ones, because the host may still want them.
 */

export const DEFAULT_PHOTO_SUGGESTIONS = 8;

/** Normalize a gallery into a deduped list of non-empty URLs. */
export function normalizeGallery(images: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const image of images) {
    const url = typeof image === 'string' ? image.trim() : '';
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * Rank gallery photos for one item. `usedUrls` is what the plan already references; those move
 * behind the unused ones. Stable within each group, so the order never jumps between renders.
 */
export function suggestPlannerPhotos(
  gallery: readonly (string | null | undefined)[],
  usedUrls: ReadonlySet<string> = new Set(),
  limit: number = DEFAULT_PHOTO_SUGGESTIONS
): string[] {
  const photos = normalizeGallery(gallery);
  const fresh: string[] = [];
  const used: string[] = [];
  for (const url of photos) {
    if (usedUrls.has(url)) used.push(url);
    else fresh.push(url);
  }
  return [...fresh, ...used].slice(0, Math.max(0, limit));
}

/** Toggle a photo URL in a selection, preserving order and capping at the given limit. */
export function togglePhotoSelection(
  selected: readonly string[],
  url: string,
  limit: number
): string[] {
  if (selected.includes(url)) return selected.filter((item) => item !== url);
  if (selected.length >= limit) return [...selected];
  return [...selected, url];
}

/** Only URLs the gallery actually has survive a save. */
export function sanitizeSelectedPhotos(
  selected: readonly unknown[],
  gallery: readonly string[]
): string[] {
  const allowed = new Set(gallery);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of selected) {
    if (typeof value !== 'string') continue;
    if (!allowed.has(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
