/**
 * Permanent boot and navigation timing marks.
 *
 * The complaint this exists for is "the app sits on the loader, then a skeleton".
 * Guessing at that is how you end up optimizing the wrong phase, so every boot and
 * every in-app navigation records the same fixed set of marks. The values are cheap
 * (one `performance.mark` each) and are read later by the perf report and by Sentry
 * as custom measurements on the route transaction.
 *
 * Rules:
 * - Nothing here may throw. Analytics that can break boot is worse than no analytics.
 * - `performance` is optional (SSR, old browser, a test that stubs it away).
 * - A mark is first-wins, because boot only happens once and a later re-mark would
 *   silently shrink the measured duration. Navigation marks are the exception: each
 *   tap is its own pair, so they overwrite with the most recent value.
 *
 * Names stay stable so a dashboard built today keeps working tomorrow:
 *
 *   app:script-start → app:first-render        entry script parsed to first paint
 *   loader:show → loader:hide                  the full-screen `AppLoader` window
 *   skeleton:show → skeleton:hide              a route skeleton window
 *   nav:start → nav:content                    a tap to content-bearing paint
 *   app:script-start → route:content           cold open to real content
 */

export type BootMarkName =
  | 'app:script-start'
  | 'app:first-render'
  | 'loader:show'
  | 'loader:hide'
  | 'skeleton:show'
  | 'skeleton:hide'
  | 'route:content'
  | 'nav:start'
  | 'nav:content';

/** Navigation marks describe one gesture each, so a repeat replaces the last one. */
const REPLACING_MARKS: ReadonlySet<BootMarkName> = new Set(['nav:start', 'nav:content']);

const marks = new Map<BootMarkName, number>();

function now(): number | null {
  const perf = typeof performance !== 'undefined' ? performance : undefined;
  if (!perf || typeof perf.now !== 'function') return null;
  const value = perf.now();
  return Number.isFinite(value) ? value : null;
}

/**
 * Record a mark. Safe to call before React mounts, during render, and in a test
 * environment with no DOM. Returns the recorded timestamp (ms since time origin),
 * or `null` when timing is unavailable.
 */
export function markBoot(name: BootMarkName): number | null {
  const at = now();
  if (at === null) return null;

  const exists = marks.has(name);
  if (exists && !REPLACING_MARKS.has(name)) return marks.get(name) ?? null;

  marks.set(name, at);

  // Also emit a real PerformanceEntry so DevTools, a Playwright trace, and the
  // browser's own timeline show the same points without extra wiring.
  try {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(name);
    }
  } catch {
    // A duplicate or disallowed mark must never interrupt a render.
  }

  return at;
}

/** All marks recorded so far, in ms since the time origin. */
export function readBootMarks(): Partial<Record<BootMarkName, number>> {
  const out: Partial<Record<BootMarkName, number>> = {};
  for (const [name, at] of marks) out[name] = at;
  return out;
}

function span(
  from: Partial<Record<BootMarkName, number>>,
  start: BootMarkName,
  end: BootMarkName
): number | null {
  const a = from[start];
  const b = from[end];
  if (a === undefined || b === undefined) return null;
  const delta = b - a;
  return delta >= 0 ? Math.round(delta) : null;
}

export type BootTimeline = {
  /** Time until the first meaningful paint of the app shell. */
  firstRenderMs: number | null;
  /** How long the full-screen loader was visible. */
  loaderMs: number | null;
  /** How long a route skeleton was visible. */
  skeletonMs: number | null;
  /** Cold open: entry script start to first page with primary data. */
  routeContentMs: number | null;
  /** Most recent tap to content-bearing paint. */
  navContentMs: number | null;
};

/** Derived durations. Any mark that never fired reports `null`, never zero. */
export function readBootTimeline(): BootTimeline {
  const recorded = readBootMarks();
  return {
    firstRenderMs: span(recorded, 'app:script-start', 'app:first-render'),
    loaderMs: span(recorded, 'loader:show', 'loader:hide'),
    skeletonMs: span(recorded, 'skeleton:show', 'skeleton:hide'),
    routeContentMs: span(recorded, 'app:script-start', 'route:content'),
    navContentMs: span(recorded, 'nav:start', 'nav:content'),
  };
}

/** @internal Test seam. Never called by app code. */
export function resetBootMarksForTests(): void {
  marks.clear();
}
