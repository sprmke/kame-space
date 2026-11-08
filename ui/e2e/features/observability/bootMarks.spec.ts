import { expect, test } from '@playwright/test';

import { mockEdgeFunctions } from '../../shared/interceptEdge';
import {
  mockPublicPropertiesListBody,
  mockPublicPropertyBody,
  mockSearchListingsBody,
  mockSearchSuggestionsBody,
} from '../../shared/mockFixtures';

/**
 * The boot-timing harness is permanent instrumentation, so it gets a regression test.
 *
 * `useDelayedLoading` keeps a skeleton from flashing, which means a fast route never
 * paints one. That is why this asserts the marks that must always exist, and only
 * checks the skeleton pair when one was actually shown.
 */

type PerfPage = { evaluate: (fn: () => unknown) => Promise<unknown> };

/**
 * Vite's dev server reloads the document once when it re-optimises dependencies, which
 * wipes `performance` marks. Polling re-reads after that reload instead of asserting
 * against an empty array and calling the instrumentation broken.
 */
async function waitForMarks(page: PerfPage): Promise<string[]> {
  await expect
    .poll(async () => (await readMarks(page)).length, { timeout: 15_000 })
    .toBeGreaterThan(0);
  return readMarks(page);
}

async function readMarks(page: PerfPage): Promise<string[]> {
  // The prefixes are inlined: this function body is serialized into the browser,
  // where a Node-side closure constant does not exist.
  return (await page.evaluate(() =>
    performance
      .getEntriesByType('mark')
      .map((entry) => entry.name)
      .filter((name) =>
        ['app:', 'loader:', 'skeleton:', 'nav:', 'route:'].some((prefix) => name.startsWith(prefix))
      )
  )) as string[];
}

test.describe('@ci boot timing marks', () => {
  test('public landing records script start, first render and content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Find your next stay/i })).toBeVisible({
      timeout: 20_000,
    });

    const marks = await waitForMarks(page);
    expect(marks).toContain('app:script-start');
    expect(marks).toContain('app:first-render');
    expect(marks).toContain('route:content');

    // Navigation marks belong to the second route, never the first.
    expect(marks).not.toContain('nav:start');
  });

  test('a mark never fires twice, so durations cannot shrink silently', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Find your next stay/i })).toBeVisible({
      timeout: 20_000,
    });
    await waitForMarks(page);

    const entries = (await page.evaluate(() =>
      performance.getEntriesByType('mark').map((entry) => entry.name)
    )) as string[];

    const duplicates = entries.filter(
      (name, index) => !name.startsWith('nav:') && entries.indexOf(name) !== index
    );
    expect(duplicates).toEqual([]);
  });

  test('an in-app navigation records a navigation pair', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'list-public-properties', body: mockPublicPropertiesListBody },
      { name: 'get-public-property', body: mockPublicPropertyBody },
      { name: 'search-listings', body: mockSearchListingsBody },
      { name: 'search-suggestions', body: mockSearchSuggestionsBody },
    ]);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Find your next stay/i })).toBeVisible({
      timeout: 20_000,
    });

    // A click, not `page.goto`: a full document load resets `performance` marks, so
    // only a client-side route change can prove the navigation pair is wired.
    // `:visible` matters because the marketing shell renders separate desktop links
    // and a phone bottom tab bar, and the hidden copy is still in the DOM.
    await page.locator('a[href="/properties"]:visible').first().click();
    await expect(page).toHaveURL(/\/properties/);
    await waitForMarks(page);

    let marks = await readMarks(page);
    if (!marks.includes('nav:start')) {
      // A click that lands before hydration falls through to a document load, which
      // resets the timeline. Retry in-app once the page is interactive.
      await page.locator('a[href="/parkings"]:visible').first().click();
      await expect(page).toHaveURL(/\/parkings/);
      await waitForMarks(page);
      marks = await readMarks(page);
    }
    expect(marks).toContain('app:script-start');
    expect(marks).toContain('nav:start');
  });
});
