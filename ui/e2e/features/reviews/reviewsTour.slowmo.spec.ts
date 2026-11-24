import { expect, test, type Page } from '@playwright/test';

import { demoHold, installReviewsUxMocks, reviewsPaths } from './shared/reviewsUxHarness';

/**
 * Slow-motion walkthrough of Org & Property Reviews. @demo — headed, never CI.
 *
 *   bun run test:e2e:reviews:tour:video
 *
 * One scenario per flow so each recorded video is watchable on its own. Videos land in
 * `test-results/playwright/<scenario>/video.webm` and are copied to
 * `docs/workflow/in-progress/reviews-ux-review/recordings/`.
 */

async function ready(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Reviews', level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await demoHold(page, 900);
}

test.describe('reviews tour @demo', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('01 property reviews: KPIs, feed and tabs', async ({ page }) => {
    test.setTimeout(240_000);
    await installReviewsUxMocks(page);
    await page.goto(reviewsPaths.property);
    await ready(page);

    // KPI row, then the feed
    await page.mouse.wheel(0, 260);
    await demoHold(page, 1200);
    await page.mouse.wheel(0, -260);
    await demoHold(page, 600);

    // Tabs, one by one
    for (const tab of ['To write', 'About guests', 'From guests'] as const) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      await demoHold(page, 1400);
    }

    // Card view, to show the second layout
    await page.getByRole('button', { name: /Choose reviews view/ }).click();
    await demoHold(page, 800);
    await page.getByRole('option', { name: 'Card' }).click();
    await demoHold(page, 1600);
    await page.getByRole('button', { name: /Choose reviews view/ }).click();
    await demoHold(page, 600);
    await page.getByRole('option', { name: 'Table' }).click();
    await demoHold(page, 800);
  });

  test('02 read a review and respond', async ({ page }) => {
    test.setTimeout(240_000);
    await installReviewsUxMocks(page);
    await page.goto(reviewsPaths.property);
    await ready(page);

    await page
      .getByRole('button', { name: /Maria Santos/ })
      .first()
      .click();
    const detail = page.getByRole('dialog', { name: /review$/ });
    await expect(detail).toBeVisible({ timeout: 10_000 });
    await demoHold(page, 2200);
    await detail.getByRole('button', { name: /Edit response/ }).click();
    await demoHold(page, 1200);

    const respond = page.getByRole('dialog', { name: /Respond to/ });
    await expect(respond).toBeVisible({ timeout: 10_000 });
    await respond.getByLabel('Public response').fill('');
    await demoHold(page, 700);
    await respond
      .getByLabel('Public response')
      .fill(
        'Thank you for staying with us. We are glad the unit was quiet for your family and hope to host you again.'
      );
    await demoHold(page, 1400);
    await respond.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Response saved')).toBeVisible({ timeout: 10_000 });
    await demoHold(page, 1200);
  });

  test('03 rating breakdown', async ({ page }) => {
    test.setTimeout(240_000);
    await installReviewsUxMocks(page);
    await page.goto(reviewsPaths.property);
    await ready(page);

    await page
      .getByRole('button', { name: /Average rating/ })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: 'Rating breakdown' })).toBeVisible({
      timeout: 10_000,
    });
    await demoHold(page, 2600);
    await page.keyboard.press('Escape');
    await demoHold(page, 600);
  });

  test('04 to write: window, write a guest review', async ({ page }) => {
    test.setTimeout(240_000);
    await installReviewsUxMocks(page);
    await page.goto(reviewsPaths.propertyToWrite);
    await ready(page);
    await demoHold(page, 1000);

    await page
      .getByRole('button', { name: /Write review for/ })
      .first()
      .click();
    const sheet = page.getByRole('dialog', { name: /Review Josefina/ });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await demoHold(page, 1600);

    // Fill the ratings the way a host would
    const stars = sheet.getByRole('radio');
    if ((await stars.count()) > 0) {
      await stars.nth(4).click();
      await demoHold(page, 500);
    }
    await sheet.evaluate(() => {
      const scroller = document.querySelector('[role="dialog"] .overflow-y-auto');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    await demoHold(page, 1800);
  });

  test('05 auto-review sheet', async ({ page }) => {
    test.setTimeout(240_000);
    await installReviewsUxMocks(page);
    await page.goto(reviewsPaths.property);
    await ready(page);

    await page.getByRole('button', { name: 'Auto-review' }).first().click();
    const sheet = page.getByRole('dialog').filter({ hasText: 'Review guests automatically' });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await demoHold(page, 1600);

    await sheet.getByRole('button', { name: 'More days' }).click();
    await demoHold(page, 500);
    await sheet.getByRole('button', { name: 'More days' }).click();
    await demoHold(page, 900);

    await sheet.evaluate(() => {
      const scroller = document.querySelector('[role="dialog"] .overflow-y-auto');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    await demoHold(page, 2200);

    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Auto-review saved')).toBeVisible({ timeout: 10_000 });
    await demoHold(page, 1200);
  });

  test('06 org rollup and listing filter', async ({ page }) => {
    test.setTimeout(240_000);
    await installReviewsUxMocks(page);
    await page.goto(reviewsPaths.org);
    await ready(page);
    await demoHold(page, 1200);

    // Three tabs only: the By property rollup is gone.
    await page.getByRole('tab', { name: /To write/ }).click();
    await demoHold(page, 1600);
    await page.getByRole('tab', { name: /From guests/ }).click();
    await demoHold(page, 1000);

    // Narrow the feed to one listing.
    await page.getByRole('button', { name: /All listings/ }).click();
    await demoHold(page, 900);
    await page.getByRole('option', { name: 'Solea Mactan' }).click();
    await demoHold(page, 2400);
  });

  test('07 phone: feed, actions, detail and refine', async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await installReviewsUxMocks(page);
    await page.goto(reviewsPaths.property);
    await ready(page);
    await demoHold(page, 1200);

    await page.mouse.wheel(0, 420);
    await demoHold(page, 1200);
    await page.mouse.wheel(0, -420);
    await demoHold(page, 600);

    await page.locator('.admin-overflow-trigger').first().click();
    await demoHold(page, 1800);
    await page.keyboard.press('Escape');
    await demoHold(page, 700);

    await page
      .getByRole('button', { name: /Maria Santos/ })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: /review$/ })).toBeVisible({
      timeout: 10_000,
    });
    await demoHold(page, 2400);
    await page.keyboard.press('Escape');
    await demoHold(page, 700);

    await page.getByRole('button', { name: /Refine reviews/ }).click();
    await demoHold(page, 2000);
    await page.keyboard.press('Escape');
    await demoHold(page, 600);
  });

  test('08 phone: org tabs', async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await installReviewsUxMocks(page);
    await page.goto(reviewsPaths.org);
    await ready(page);
    await demoHold(page, 1200);

    for (const tab of ['To write', 'About guests', 'From guests'] as const) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      await demoHold(page, 1600);
    }

    await page.mouse.wheel(0, 380);
    await demoHold(page, 1400);
  });
});
