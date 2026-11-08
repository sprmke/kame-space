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
 * What it measures: how long the first full-screen loader window was visible, how long the
 * route skeleton was visible, and the time from entry script to the dashboard's primary
 * data being on screen (`route:content`).
 *
 * Two things to keep in mind when reading the numbers:
 *
 * - `route:content` fires when the data is ready, but the loader hides ~220 ms later
 *   (`HIDE_BRIDGE_MS`), so add that bridge to get what the user actually saw.
 * - `AppLoader` is ref-counted and can cycle more than once during a boot. `loaderMs` is
 *   the **first** show-to-hide window; the absolute hide time is not meaningful.
 * - Timings come from a dev server on the local machine. Clear `ui/node_modules/.vite`
 *   before a comparison run: a cache built while the tree was stashed will serve a stale
 *   module graph and quietly invalidate the measurement.
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

/** The loader host is the real "screen is usable" signal, so wait for it to leave. */
async function waitForLoaderGone(page: Parameters<typeof test>[0]['page']) {
  await expect
    .poll(async () => page.evaluate(() => document.getElementById('app-loader-host') === null), {
      timeout: 20_000,
    })
    .toBe(true);
}

test.describe('@live host dashboard cold open', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('reports loader, skeleton and content timings', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}`);

    // The dashboard's own heading is the signal that content is on screen, not "loading
    // stopped": a skeleton also counts as loading having stopped.
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: 30_000,
    });
    // Wait for the mark itself, not a wall-clock guess: the heading can be a shell title
    // that paints before the page's own data resolves.
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            performance.getEntriesByType('mark').some((entry) => entry.name === 'route:content')
          ),
        { timeout: 30_000 }
      )
      .toBe(true);

    await waitForLoaderGone(page);
    const timeline = await readTimeline(page);
    // One machine-readable line so two runs can be diffed with grep.
    console.log(`[boot-timeline] ${JSON.stringify(timeline)}`);

    // Shape only. Exact numbers are the report, not a gate.
    expect(timeline.routeContentMs).not.toBeNull();
    expect(timeline.routeContentMs!).toBeGreaterThanOrEqual(0);
  });

  /**
   * Same measurement at 4x CPU throttle, which is the closest a desktop runner gets to a
   * mid-range phone. Comparing the two runs is the point: if the loader grows with CPU but
   * not with network, the cold open is main-thread work and a bootstrap endpoint cannot fix
   * it. If it barely moves, the cost is network and the waterfall is the target.
   */
  test('reports the same timings at 4x CPU throttle', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}`);

    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            performance.getEntriesByType('mark').some((entry) => entry.name === 'route:content')
          ),
        { timeout: 60_000 }
      )
      .toBe(true);

    await waitForLoaderGone(page);
    const timeline = await readTimeline(page);
    console.log(`[boot-timeline-4x] ${JSON.stringify(timeline)}`);

    expect(timeline.routeContentMs).not.toBeNull();
  });

  /**
   * Warm repeat open, which is what a host actually experiences most of the time.
   *
   * Two loads in the same browser context: the first populates the persisted query cache,
   * the second is measured. `performance` marks reset on reload, so the second boot is a
   * clean measurement of a returning viewer.
   */
  test('reports the warm repeat open after the query cache is warm', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    const url = `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}`;

    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            performance.getEntriesByType('mark').some((entry) => entry.name === 'route:content')
          ),
        { timeout: 30_000 }
      )
      .toBe(true);
    // Wait for the persister to actually create its IndexedDB store instead of guessing
    // at a delay: a fixed timeout either wastes time or reloads before the write lands,
    // which would silently measure a cold open twice.
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            if (typeof indexedDB === 'undefined' || !indexedDB.databases) return false;
            const databases = await indexedDB.databases();
            return databases.some((database) => Boolean(database.name));
          }),
        { timeout: 15_000 }
      )
      .toBe(true);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            performance.getEntriesByType('mark').some((entry) => entry.name === 'route:content')
          ),
        { timeout: 30_000 }
      )
      .toBe(true);

    await waitForLoaderGone(page);
    const timeline = await readTimeline(page);
    console.log(`[boot-timeline-warm] ${JSON.stringify(timeline)}`);

    expect(timeline.routeContentMs).not.toBeNull();
  });
});
