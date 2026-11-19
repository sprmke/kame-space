/**
 * Nested modal stacking: each open Dialog / Sheet / AlertDialog gets a layer
 * so its scrim sits *above* the parent modal content (not underneath it).
 *
 * Layer 0 → overlay 100 / content 101
 * Layer 1 → overlay 110 / content 111
 * …
 *
 * Depth resets when every registered modal has closed.
 */

export const MODAL_LAYER_BASE = 100;
export const MODAL_LAYER_STEP = 10;

type AcquiredLayer = {
  id: number;
  overlayZ: number;
  contentZ: number;
};

let nextId = 0;
let stackDepth = 0;
const openLayers = new Set<number>();

export function acquireModalLayer(): AcquiredLayer {
  const id = ++nextId;
  const index = stackDepth;
  stackDepth += 1;
  openLayers.add(id);
  const overlayZ = MODAL_LAYER_BASE + index * MODAL_LAYER_STEP;
  return { id, overlayZ, contentZ: overlayZ + 1 };
}

export function releaseModalLayer(id: number): void {
  if (!openLayers.delete(id)) return;
  if (openLayers.size === 0) {
    stackDepth = 0;
  }
}

/** Vitest only — clear stack between cases. */
export function resetModalLayerStackForTests(): void {
  openLayers.clear();
  stackDepth = 0;
}

/** Parse `z-[N]` from a Tailwind class string (first match). */
export function parseTailwindZIndex(className?: string | null): number | null {
  if (!className) return null;
  const match = className.match(/(?:^|\s)z-\[(\d+)\](?:\s|$)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/**
 * Prefer the auto stack layer, but never go below an explicit `z-[N]` floor
 * from callers (command palette, lightbox, workflow confirms, etc.).
 */
export function resolveModalLayerZ(opts: {
  autoOverlayZ: number;
  autoContentZ: number;
  overlayClassName?: string | null;
  contentClassName?: string | null;
}): { overlayZ: number; contentZ: number } {
  const explicitOverlay = parseTailwindZIndex(opts.overlayClassName);
  const explicitContent = parseTailwindZIndex(opts.contentClassName);
  const overlayZ = Math.max(opts.autoOverlayZ, explicitOverlay ?? 0);
  const contentZ = Math.max(opts.autoContentZ, explicitContent ?? 0, overlayZ + 1);
  return { overlayZ, contentZ };
}
