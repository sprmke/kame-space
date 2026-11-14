import type { ReelRecipeId } from '@/features/dashboard/marketing/lib/video/reelBuilder';

/** What the AI reel director returns, already mapped to the host's photo URLs. */
export type ReelDirection = {
  recipe: ReelRecipeId;
  /** Photos in playing order, best opening shot first. */
  photoUrls: string[];
  copy: { headline: string; subheadline: string; ctaLine: string };
};

type RawReelDirection = {
  recipe?: unknown;
  photoIndexes?: unknown;
  copy?: Record<string, unknown> | null;
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Validates the director response against the photos it saw. Returns null when it has
 * no usable photo, so the caller keeps the deterministic reel.
 */
export function normalizeReelDirection(
  raw: RawReelDirection | null | undefined,
  photoUrls: string[],
  recipes: readonly ReelRecipeId[]
): ReelDirection | null {
  if (!raw || typeof raw !== 'object') return null;
  const indexes = Array.isArray(raw.photoIndexes) ? raw.photoIndexes : [];
  const seen = new Set<string>();
  const ordered = indexes
    .map((index) => (Number.isInteger(index) ? photoUrls[index as number] : undefined))
    .filter((url): url is string => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  if (ordered.length === 0) return null;
  const recipe = recipes.find((id) => id === raw.recipe) ?? recipes[0]!;
  return {
    recipe,
    photoUrls: ordered,
    copy: {
      headline: text(raw.copy?.headline),
      subheadline: text(raw.copy?.subheadline),
      ctaLine: text(raw.copy?.ctaLine),
    },
  };
}
