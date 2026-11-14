import { onLoadError } from 'openpolotno/config';

import { collectDocumentImageUrls } from '@/features/dashboard/marketing/lib/polotno/documentImages';

/**
 * OpenPolotno draws a failed image as a red "Can not load the image..." block and
 * still exports it. This guard records every load failure it reports so a render can
 * refuse to ship a broken frame. Failure labels look like
 * `image with id <id> url: <first 200 chars of src>`.
 */

export class PosterRenderError extends Error {
  readonly failedUrls: string[];

  constructor(failedUrls: string[]) {
    super(
      failedUrls.length === 1
        ? 'A photo could not be loaded, so the post was not drawn.'
        : 'Some photos could not be loaded, so the post was not drawn.'
    );
    this.name = 'PosterRenderError';
    this.failedUrls = failedUrls;
  }
}

type LoadFailure = { label: string; at: number };

const MAX_KEPT = 200;
const LABEL_URL_CHARS = 200;
let failures: LoadFailure[] = [];
let listening = false;

function ensureListening(): void {
  if (listening) return;
  listening = true;
  onLoadError((label: unknown) => {
    failures.push({ label: String(label ?? ''), at: Date.now() });
    if (failures.length > MAX_KEPT) failures = failures.slice(-MAX_KEPT);
  });
}

/** Which of `urls` appear in the recorded failure labels (labels cut each src at 200 chars). */
export function matchFailedUrls(labels: string[], urls: string[]): string[] {
  if (labels.length === 0) return [];
  return urls.filter((url) => {
    const short = url.slice(0, LABEL_URL_CHARS);
    return labels.some((label) => label.includes(short));
  });
}

export type LoadGuard = {
  /** Photos of this document that failed to load since the guard started. */
  failed: () => string[];
  /** Forget failures so far (call before a retry). */
  reset: () => void;
  /** Throws `PosterRenderError` when any photo failed. */
  assertClean: () => void;
};

/** Starts watching one document's photos. Cheap; safe to run concurrently. */
export function startLoadGuard(document: unknown): LoadGuard {
  ensureListening();
  const urls = collectDocumentImageUrls(document);
  let since = Date.now();
  // Same-millisecond failures must still count, so compare with >=.
  const failed = () =>
    matchFailedUrls(
      failures.filter((item) => item.at >= since).map((item) => item.label),
      urls
    );
  return {
    failed,
    reset: () => {
      since = Date.now() + 1;
    },
    assertClean: () => {
      const bad = failed();
      if (bad.length > 0) throw new PosterRenderError(bad);
    },
  };
}

/** Test seam: drop recorded failures. */
export function resetLoadFailuresForTests(): void {
  failures = [];
}

/** Test seam: record a failure without OpenPolotno. */
export function recordLoadFailureForTests(label: string): void {
  failures.push({ label, at: Date.now() });
}
