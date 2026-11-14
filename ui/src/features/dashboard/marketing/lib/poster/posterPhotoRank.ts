import {
  hammingDistance,
  type PhotoAnalysis,
} from '@/features/dashboard/marketing/lib/poster/posterPhotoAnalysis';

export type RankablePhoto = {
  url: string;
  /** Natural size of the original; 0 when unknown. */
  width: number;
  height: number;
  /** Null when the photo could not be analysed; it keeps a neutral score. */
  analysis: PhotoAnalysis | null;
};

export type PhotoNeeds = {
  /** A calm top third for a headline. */
  calmTop?: boolean;
  /** Prefers a portrait source (tall layouts). */
  portrait?: boolean;
};

/** Hosts put the best photo first, so gallery order is a prior, not a tiebreak. */
const ORDER_PRIOR = 0.12;
const NEAR_DUPLICATE_BITS = 6;
/** Below this long edge a photo looks soft once cropped for a story. */
const MIN_LONG_EDGE = 900;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** 0 to 1: how well the photo suits the target canvas and the layout's needs. */
export function scorePhoto(
  photo: RankablePhoto,
  index: number,
  total: number,
  target: { width: number; height: number } | null,
  needs: PhotoNeeds = {}
): number {
  const prior = total > 1 ? ORDER_PRIOR * (1 - index / (total - 1)) : ORDER_PRIOR;
  let score = 0.5;

  const longEdge = Math.max(photo.width, photo.height);
  if (longEdge > 0) {
    score += longEdge >= MIN_LONG_EDGE ? 0.08 : -0.2 * (1 - longEdge / MIN_LONG_EDGE);
  }

  if (photo.width > 0 && photo.height > 0 && target) {
    const photoRatio = photo.width / photo.height;
    const targetRatio = target.width / target.height;
    // Cover-cropping away more than ~40% of the photo discards the subject.
    const cropped = 1 - Math.min(photoRatio, targetRatio) / Math.max(photoRatio, targetRatio);
    score -= cropped * 0.25;
  }
  if (needs.portrait && photo.width > 0 && photo.height > 0) {
    score += photo.height >= photo.width ? 0.1 : -0.08;
  }

  const a = photo.analysis;
  if (a) {
    // Exposure: reward mid brightness, punish near-black and blown-out frames.
    score += (1 - Math.abs(a.luma - 0.5) * 2) * 0.12 - 0.12 * 0.5;
    score += Math.min(a.contrast / 0.25, 1) * 0.1 - 0.05;
    score -= a.clipped * 0.25;
    // Sharpness: featureless or blurry frames rank low; extreme noise does not help.
    score += Math.min(a.sharpness / 0.04, 1) * 0.1 - 0.05;
    if (needs.calmTop) {
      const topBusy = Math.max(a.zones[0]!.busyness, a.zones[1]!.busyness, a.zones[2]!.busyness);
      score -= topBusy * 0.2;
    }
  }
  return clamp01(score + prior);
}

/**
 * Orders photos best-first and drops near-duplicates (keeping the better-scored one).
 * Always returns at least one photo when given any: dropping everything would be worse
 * than showing a mediocre shot.
 */
export function rankPhotos(
  photos: RankablePhoto[],
  target: { width: number; height: number } | null = null,
  needs: PhotoNeeds = {}
): RankablePhoto[] {
  const scored = photos
    .map((photo, index) => ({
      photo,
      index,
      score: scorePhoto(photo, index, photos.length, target, needs),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const kept: typeof scored = [];
  for (const item of scored) {
    const hash = item.photo.analysis?.dHash;
    const duplicate =
      hash &&
      kept.some(
        (k) =>
          k.photo.analysis && hammingDistance(hash, k.photo.analysis.dHash) <= NEAR_DUPLICATE_BITS
      );
    if (!duplicate) kept.push(item);
  }
  return kept.map((item) => item.photo);
}
