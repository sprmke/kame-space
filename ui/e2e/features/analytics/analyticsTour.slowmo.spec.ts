import { expect, test } from '@playwright/test';

import {
  analyticsTourPaths,
  demoPause,
  dismissConsent,
  demoScroll,
  installAnalyticsMocks,
  openAnalytics,
  openAnalyticsTab,
} from './shared/analyticsHarness';

/**
 * Slow-motion walkthrough of the property Analytics module. @demo — headed, never CI.
 *
 * One scenario per flow so each recorded video is watchable on its own:
 *   bun run test:e2e:analytics:tour:video
 * Videos land in `test-results/playwright/<scenario>/video.webm`.
 *
 * A demo pause that cannot find its target must not eat the whole recording, so hover /
 * optional interactions are guarded: the tour keeps playing, the video still shows the flow.
 */

async function bestEffort(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch {
    /* demo only: a missed hover is not a failure */
  }
}

test.describe('analytics tour @demo', () => {
  test.use({ viewport: { width: 1440, height: 960 }, actionTimeout: 12_000 });

  test('01 overview, metrics and period control', async ({ page }) => {
    test.setTimeout(180_000);
    await installAnalyticsMocks(page);
    await openAnalytics(page);
    await demoPause(page, 1.2);

    await page.getByRole('button', { name: 'About Occupancy' }).click();
    await demoPause(page, 1.6);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);

    await demoScroll(page, { step: 340, steps: 5 });
    await demoPause(page, 0.8);

    const dateTrigger = page.getByRole('button', { name: /^[A-Z][a-z]{2,8} \d/ }).first();
    await dateTrigger.click();
    await demoPause(page, 1.2);
    await page.getByRole('button', { name: /^Week/ }).click();
    await demoPause(page, 1.2);
    await dateTrigger.click();
    await demoPause(page, 0.8);
    await page.getByRole('button', { name: /^Month/ }).click();
    await demoPause(page, 1.2);
  });

  test('02 trends and distributions', async ({ page }) => {
    test.setTimeout(180_000);
    await installAnalyticsMocks(page);
    await openAnalyticsTab(page, 'Trends');
    await demoPause(page, 1.4);

    await page.getByRole('tab', { name: 'Revenue', exact: true }).click();
    await demoPause(page, 1.6);
    await bestEffort(async () => {
      await page.locator('.recharts-area-area').first().hover({ force: true, timeout: 6000 });
    });
    await demoPause(page, 1.2);

    await demoScroll(page, { step: 330, steps: 5 });
    await demoPause(page, 0.8);

    await page.getByRole('tab', { name: 'Bookings', exact: true }).click();
    await demoPause(page, 1.2);
  });

  test('03 guests and booking sources', async ({ page }) => {
    test.setTimeout(180_000);
    await installAnalyticsMocks(page);
    await openAnalyticsTab(page, 'Guests');
    await demoPause(page, 1.4);

    const slice = page.locator('.recharts-pie-sector').first();
    await bestEffort(async () => {
      await slice.hover({ force: true, timeout: 8000 });
    });
    await demoPause(page, 1.6);

    await bestEffort(async () => {
      await page.locator('.recharts-pie-sector').nth(1).hover({ force: true, timeout: 5000 });
    });
    await demoPause(page, 1.4);

    await demoScroll(page, { step: 320, steps: 6 });
    await demoPause(page, 0.8);
  });

  test('04 AI review and improvement playbook', async ({ page }) => {
    test.setTimeout(200_000);
    await installAnalyticsMocks(page);
    await openAnalyticsTab(page, 'AI review');
    await demoPause(page, 1.6);

    await demoScroll(page, { step: 300, steps: 3, back: false });
    await demoPause(page, 1);

    await page.getByRole('button', { name: 'Refresh AI review for this month' }).click();
    await expect(page.getByText('Review updated')).toBeVisible();
    await demoPause(page, 1.6);

    await bestEffort(async () => {
      const playbookTip = page
        .getByRole('button', { name: /Playbook: Follow up on unpaid balances/ })
        .first();
      await playbookTip.scrollIntoViewIfNeeded();
      await demoPause(page, 0.6);
      await playbookTip.click({ timeout: 8000 });
    });
    await demoPause(page, 1.8);

    await bestEffort(async () => {
      await page
        .getByRole('link', { name: 'Go to Pricing & availability' })
        .first()
        .hover({ force: true, timeout: 6000 });
    });
    await demoPause(page, 1);
  });

  test('05 export the PDF report', async ({ page }) => {
    test.setTimeout(180_000);
    await installAnalyticsMocks(page);
    await openAnalytics(page);
    await demoPause(page, 1.2);

    const download = page.waitForEvent('download', { timeout: 40_000 });
    await page.getByRole('button', { name: 'Export PDF' }).click();
    await demoPause(page, 1.4);
    await download;
    await expect(page.getByText('PDF downloaded')).toBeVisible();
    await demoPause(page, 1.6);
  });
});

test.describe('analytics tour phone @demo', () => {
  test.use({ viewport: { width: 375, height: 812 }, actionTimeout: 12_000 });

  test('06 phone layout, sheets and touch tooltips', async ({ page }) => {
    test.setTimeout(200_000);
    await installAnalyticsMocks(page);
    await page.goto(analyticsTourPaths.analytics);
    await dismissConsent(page);
    await expect(page.getByRole('region', { name: 'Key metrics' })).toBeVisible({
      timeout: 25_000,
    });
    await demoPause(page, 1.4);

    await demoScroll(page, { step: 300, steps: 4 });
    await demoPause(page, 0.8);

    // Return to the top so the hero does not cover the tab row.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await demoPause(page, 0.8);

    // Fourth tab is off-screen at 375; force so the recording shows the clipped strip working.
    await bestEffort(async () => {
      await page.getByRole('tab', { name: 'AI review' }).click({ force: true, timeout: 8000 });
    });
    await demoPause(page, 1.6);
    await bestEffort(async () => {
      await page.getByRole('tab', { name: 'Guests' }).click({ force: true, timeout: 8000 });
    });
    await demoPause(page, 1.4);

    await bestEffort(async () => {
      await page.locator('.recharts-pie-sector').first().click({ force: true, timeout: 8000 });
    });
    await demoPause(page, 1.6);

    await bestEffort(async () => {
      await page
        .getByRole('button', { name: /^[A-Z][a-z]{2,8} \d/ })
        .first()
        .click({ timeout: 8000 });
    });
    await demoPause(page, 1.6);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.8);
  });
});
