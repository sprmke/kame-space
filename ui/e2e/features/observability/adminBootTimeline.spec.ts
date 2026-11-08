import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Lab measurement of the host dashboard cold open, read from the Phase 0.1 boot marks.
 *
 * `@perf` and never part of `@smoke` / `@ci`: it reports numbers instead of asserting a
 * threshold, because a timing threshold on a shared CI runner is a flaky gate. Run it
 * directly to compare two builds:
 *
 *   npx playwright test ui/e2e/features/observability/adminBootTimeline.spec.ts \
 *     --project=chromium-ci --reporter=list
 *
 * What it measures, in order: how long the full-screen loader was visible, how long the
 * route skeleton was visible, and the time from entry script to the dashboard's primary
 * data being on screen (`route:content`).
 */

type Mark = { name: string; startTime: number };

async function readTimeline(page: Parameters<typeof test>[0]['page']) {
  const marks = (await page.evaluate(() =>
    performance
      .getEntriesByType('mark')
      .map((entry) => ({ name: entry.name, startTime: entry.startTime }))
      .filter((entry) =>
        ['app:', 'loader:', 'skeleton:', 'route:', 'nav:'].some((prefix) =>
          entry.name.startsWith(prefix)
        )
      )
  )) as Mark[];

  const at = (name: string) => marks.find((mark) => mark.name === name)?.startTime ?? null;
  const span = (from: string, to: string) => {
    const a = at(from);
    const b = at(to);
    return a === null || b === null ? null : Math.round(b - a);
  };

  return {
    loaderMs: span('loader:show', 'loader:hide'),
    skeletonMs: span('skeleton:show', 'skeleton:hide'),
    routeContentMs: span('app:script-start', 'route:content'),
    firstRenderMs: span('app:script-start', 'app:first-render'),
    sawLoader: at('loader:show') !== null,
    sawSkeleton: at('skeleton:show') !== null,
  };
}

test.describe('@perf host dashboard cold open', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('reports loader, skeleton and content timings', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}`);

    // The dashboard's own heading is the signal that content is on screen, not "loading
    // stopped": a skeleton also counts as loading having stopped.
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(500);

    const timeline = await readTimeline(page);
    // One machine-readable line so two runs can be diffed with grep.
    console.log(`[boot-timeline] ${JSON.stringify(timeline)}`);

    // Shape only. Exact numbers are the report, not a gate.
    expect(timeline.routeContentMs).not.toBeNull();
    expect(timeline.routeContentMs!).toBeGreaterThanOrEqual(0);
  });
});
