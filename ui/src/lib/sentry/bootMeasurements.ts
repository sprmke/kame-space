import * as Sentry from '@sentry/react';

import { readBootTimeline, type BootTimeline } from '@/lib/perf/bootMarks';

import { isSentrySdkEnabled } from './init';

/**
 * Sends the Phase 0 boot timeline to Sentry as custom measurements on the active
 * route transaction. Sentry owns performance; PostHog stays outcome-only, so this
 * deliberately has no PostHog counterpart.
 *
 * `setMeasurement` attaches to the currently active span. When no transaction is
 * active (Sentry disabled, or a navigation outside the router integration) the call
 * is a harmless no-op.
 */

/** Measurement name → timeline key. Stable names, because dashboards pin them. */
const MEASUREMENT_MAP: ReadonlyArray<readonly [string, keyof BootTimeline]> = [
  ['boot.first_render', 'firstRenderMs'],
  ['boot.loader', 'loaderMs'],
  ['boot.skeleton', 'skeletonMs'],
  ['boot.route_content', 'routeContentMs'],
  ['boot.nav_content', 'navContentMs'],
];

/** Reports once per call; only defined (measured) values are sent. */
export function reportBootMeasurements(timeline: BootTimeline = readBootTimeline()): void {
  if (!isSentrySdkEnabled) return;

  try {
    for (const [name, key] of MEASUREMENT_MAP) {
      const value = timeline[key];
      if (value === null) continue;
      Sentry.setMeasurement(name, value, 'millisecond');
    }
  } catch {
    // Telemetry must never turn a working page into a failing one.
  }
}
