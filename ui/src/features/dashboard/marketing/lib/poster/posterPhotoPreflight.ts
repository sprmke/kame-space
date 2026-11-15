import type { PhotoSizeMap } from '@/features/dashboard/marketing/lib/poster/posterCompiler';
import {
  analyzeBitmap,
  type PhotoAnalysis,
} from '@/features/dashboard/marketing/lib/poster/posterPhotoAnalysis';
import {
  rankPhotos,
  type PhotoNeeds,
} from '@/features/dashboard/marketing/lib/poster/posterPhotoRank';

/**
 * Photo preflight (browser only). Every poster photo is fetched once with CORS,
 * decoded and downscaled to a 1600px long edge before Polotno draws it. Renders use the
 * small blob; saved documents keep the real URL (`restorePhotoUrls`). A photo that
 * cannot be fetched or decoded is reported as `ok: false` so callers drop it before
 * photo indexes are resolved, instead of exporting a broken frame.
 */

export const PREFLIGHT_LONG_EDGE = 1600;
const TIMEOUT_MS = 12_000;
const ANALYSIS_LONG_EDGE = 64;

export type PhotoPreflight = {
  url: string;
  /** Downscaled `blob:` copy for rendering; null when the photo could not be prepared. */
  blobUrl: string | null;
  /** Natural size of the original, used for cover cropping. */
  width: number;
  height: number;
  ok: boolean;
  /** Pixel analysis of a 64px copy; null when it could not be computed. */
  analysis?: PhotoAnalysis | null;
};

export type PhotoPreflightMap = Record<string, PhotoPreflight>;

/** Scale so the long edge is at most `max`; never upscales. */
export function fitWithin(
  width: number,
  height: number,
  max = PREFLIGHT_LONG_EDGE
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const scale = max / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Only network photos are preflighted; data and blob URLs are already local. */
export function isRemotePhotoUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function mapImageSrcs(document: unknown, lookup: (src: string) => string | undefined): unknown {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== 'object') return node;
    const record = node as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) next[key] = visit(value);
    if (
      (record.type === 'image' || record.type === 'video') &&
      typeof record.src === 'string' &&
      lookup(record.src)
    ) {
      next.src = lookup(record.src);
    }
    return next;
  };
  return visit(document);
}

/** Swaps real URLs for their prepared blob copies (render only; never save this). */
export function applyPhotoBlobs<T>(document: T, preflight: PhotoPreflightMap): T {
  return mapImageSrcs(document, (src) => {
    const item = preflight[src];
    return item?.ok && item.blobUrl ? item.blobUrl : undefined;
  }) as T;
}

/** Swaps blob copies back to the real URLs, so saved documents never hold a `blob:`. */
export function restorePhotoUrls<T>(document: T, preflight: PhotoPreflightMap): T {
  const reverse = new Map<string, string>();
  for (const item of Object.values(preflight)) {
    if (item.blobUrl) reverse.set(item.blobUrl, item.url);
  }
  if (reverse.size === 0) return document;
  return mapImageSrcs(document, (src) => reverse.get(src)) as T;
}

export function photoSizesFromPreflight(preflight: PhotoPreflightMap): PhotoSizeMap {
  return Object.fromEntries(
    Object.values(preflight).map((item) => [
      item.url,
      item.ok && item.width > 0 ? { width: item.width, height: item.height } : undefined,
    ])
  );
}

/** Analysis must never fail a render: any error just means "no analysis". */
function analyzeCanvas(source: HTMLCanvasElement): PhotoAnalysis | null {
  try {
    const small = fitWithin(source.width, source.height, ANALYSIS_LONG_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(3, small.width);
    canvas.height = Math.max(3, small.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return analyzeBitmap(context.getImageData(0, 0, canvas.width, canvas.height));
  } catch {
    return null;
  }
}

export function photoAnalysisFromPreflight(
  preflight: PhotoPreflightMap
): Record<string, PhotoAnalysis | null> {
  return Object.fromEntries(
    Object.values(preflight).map((item) => [item.url, item.ok ? (item.analysis ?? null) : null])
  );
}

const cache = new Map<string, Promise<PhotoPreflight>>();

async function prepare(url: string): Promise<PhotoPreflight> {
  const failed: PhotoPreflight = { url, blobUrl: null, width: 0, height: 0, ok: false };
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // `no-cache` revalidates, so a cached response from a non-CORS request is not reused.
    const response = await fetch(url, {
      mode: 'cors',
      cache: 'no-cache',
      signal: controller.signal,
    });
    if (!response.ok) return failed;
    const source = await response.blob();
    if (!source.type.startsWith('image/')) return failed;
    const bitmap = await createImageBitmap(source);
    try {
      const target = fitWithin(bitmap.width, bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;
      const context = canvas.getContext('2d');
      if (!context) return failed;
      context.drawImage(bitmap, 0, 0, target.width, target.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9)
      );
      if (!blob || blob.size === 0) return failed;
      return {
        analysis: analyzeCanvas(canvas),
        url,
        blobUrl: URL.createObjectURL(blob),
        width: bitmap.width,
        height: bitmap.height,
        ok: true,
      };
    } finally {
      bitmap.close();
    }
  } catch {
    return failed;
  } finally {
    window.clearTimeout(timer);
  }
}

function preflightOne(url: string): Promise<PhotoPreflight> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = prepare(url).then((result) => {
    // A failure is not remembered, so a later attempt can succeed.
    if (!result.ok) cache.delete(url);
    return result;
  });
  cache.set(url, pending);
  return pending;
}

/** Prepares every remote photo once; local URLs pass through as ok. */
export async function preflightPosterPhotos(urls: string[]): Promise<PhotoPreflightMap> {
  const unique = [...new Set(urls.filter(Boolean))];
  const results = await Promise.all(
    unique.map((url) =>
      isRemotePhotoUrl(url)
        ? preflightOne(url)
        : Promise.resolve<PhotoPreflight>({ url, blobUrl: null, width: 0, height: 0, ok: true })
    )
  );
  return Object.fromEntries(results.map((item) => [item.url, item]));
}

/** Keeps the photos that can be drawn. If none can, returns the input so the caller's guard decides. */
export function usablePhotoUrls(urls: string[], preflight: PhotoPreflightMap): string[] {
  const good = urls.filter((url) => preflight[url]?.ok !== false);
  return good.length > 0 ? good : urls;
}

/**
 * Best photo first, near-duplicates dropped. Photos with no analysis keep their gallery
 * position. Anything past the analysed head is appended unchanged.
 */
export function rankPreflightedPhotos(
  urls: string[],
  preflight: PhotoPreflightMap,
  target: { width: number; height: number } | null = null,
  needs: PhotoNeeds = {}
): string[] {
  if (urls.length < 2) return urls;
  const ranked = rankPhotos(
    urls.map((url) => ({
      url,
      width: preflight[url]?.width ?? 0,
      height: preflight[url]?.height ?? 0,
      analysis: preflight[url]?.analysis ?? null,
    })),
    target,
    needs
  );
  return ranked.map((photo) => photo.url);
}
