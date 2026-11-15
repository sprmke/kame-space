export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Smooth 0→1 ramp between edges (Airbnb-style UI fades). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - clamp01(t)) ** 3;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest morph the search bar may use, so a tiny scroll range still eases. */
export const MIN_MORPH_TRAVEL = 24;

/**
 * Scroll distance (px) over which the hero search docks into the header. A page too
 * short to scroll the full distance docks over what it can scroll, so the bar never
 * gets stuck half-way over the logo. `reachable` is how far past the header the hero
 * anchor can travel at max scroll; zero or less means the page cannot morph at all.
 */
export function morphTravelDistance(reachable: number, full: number): number {
  if (!Number.isFinite(reachable) || reachable <= 0 || reachable >= full) return full;
  return Math.max(reachable, MIN_MORPH_TRAVEL);
}
