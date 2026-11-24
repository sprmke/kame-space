/* eslint-disable no-console -- capture/measure spec: console is its output channel. */
import { expect, test, type Page } from '@playwright/test';

import { installReviewsUxMocks, reviewsPaths } from './shared/reviewsUxHarness';

/**
 * Org & Property Reviews — review captures. @demo — never CI.
 *
 *   PLAYWRIGHT_CAPTURE_SCREENS=1 bunx playwright test \
 *     ui/e2e/features/reviews/reviewsUxAudit.spec.ts --project=chromium
 *
 * Writes stills to `docs/workflow/in-progress/reviews-ux-review/screenshots/` and prints
 * layout measurements + page errors used by the review document.
 */

/**
 * `REVIEWS_CAPTURE_PHASE=before|after` picks the output folder, so the same spec
 * produces a matched pair (`before/` on `origin/main`, `after/` with the fixes).
 */
const PHASE = process.env.REVIEWS_CAPTURE_PHASE === 'before' ? 'before' : 'after';
const REVIEW_DIR = `docs/workflow/in-progress/reviews-ux-review/${PHASE}`;

function hold(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  if (process.env.PLAYWRIGHT_CAPTURE_SCREENS !== '1') return;
  await page
    .locator('[data-admin-mobile-page], main')
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => undefined);
  await hold(250);
  await page.screenshot({
    path: `${REVIEW_DIR}/screenshots/${name}.png`,
    fullPage,
    animations: 'disabled',
  });
}

function watchConsole(page: Page, label: string): void {
  page.on('pageerror', (error) => console.log(`[${label}] PAGEERROR: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error')
      console.log(`[${label}] CONSOLE: ${message.text().slice(0, 240)}`);
  });
}

async function measureLayout(page: Page, label: string): Promise<void> {
  const data = await page.evaluate(() => {
    const doc = document.documentElement;
    const wide = Array.from(document.querySelectorAll<HTMLElement>('main *')).filter(
      (el) => el.getBoundingClientRect().right > window.innerWidth + 1
    );
    const small = Array.from(
      document.querySelectorAll<HTMLElement>('main button, main a[href]')
    ).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.height < 44 || rect.width < 44);
    });
    return {
      viewport: window.innerWidth,
      docScrollWidth: doc.scrollWidth,
      docClientWidth: doc.clientWidth,
      overflowing: wide.slice(0, 10).map((el) => ({
        tag: el.tagName.toLowerCase(),
        cls: el.className.toString().slice(0, 120),
        right: Math.round(el.getBoundingClientRect().right),
      })),
      subFortyFour: small.slice(0, 14).map((el) => ({
        tag: el.tagName.toLowerCase(),
        label:
          el.getAttribute('aria-label') ??
          el.textContent?.trim().slice(0, 40) ??
          el.className.toString().slice(0, 60),
        h: Math.round(el.getBoundingClientRect().height),
        w: Math.round(el.getBoundingClientRect().width),
      })),
    };
  });
  console.log(`\n[layout ${label}]`, JSON.stringify(data, null, 2));
}

async function ready(page: Page, heading = 'Reviews'): Promise<void> {
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  // The heading mounts before the feed does; a cold dev server can still be on skeletons.
  await page
    .locator('.animate-pulse')
    .first()
    .waitFor({ state: 'detached', timeout: 20_000 })
    .catch(() => undefined);
  await hold(400);
}

test.describe('reviews ux audit @demo', () => {
  test.setTimeout(600_000);

  test('desktop surfaces', async ({ page }) => {
    watchConsole(page, 'desktop');
    await installReviewsUxMocks(page);
    await page.setViewportSize({ width: 1440, height: 960 });

    // Property · From guests
    await page.goto(reviewsPaths.property);
    await ready(page);
    await shot(page, '01-desktop-property-received');
    await measureLayout(page, 'desktop-1440-received');

    // Detail sheet with photos, tags, private note, response
    await page
      .getByRole('button', { name: /Maria Santos/ })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: /review$/ })).toBeVisible({
      timeout: 10_000,
    });
    await hold(500);
    await shot(page, '02-desktop-review-detail');
    await page.keyboard.press('Escape');
    await hold(300);

    // Respond sheet
    await page.getByRole('button', { name: 'Respond', exact: true }).first().click();
    await expect(page.getByRole('dialog', { name: /Respond to/ })).toBeVisible({ timeout: 10_000 });
    await hold(400);
    await shot(page, '03-desktop-respond');
    await page.keyboard.press('Escape');
    await hold(300);

    // Rating breakdown
    await page
      .getByRole('button', { name: /Average rating/ })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: 'Rating breakdown' })).toBeVisible({
      timeout: 10_000,
    });
    await hold(500);
    await shot(page, '04-desktop-rating-breakdown');
    await page.keyboard.press('Escape');
    await hold(300);

    // To write
    await page.goto(reviewsPaths.propertyToWrite);
    await ready(page);
    await shot(page, '05-desktop-property-to-write');

    // About guests
    await page.goto(reviewsPaths.propertyWritten);
    await ready(page);
    await shot(page, '06-desktop-property-written');

    // Auto-review sheet
    await page.goto(reviewsPaths.property);
    await ready(page);
    await page.getByRole('button', { name: 'Auto-review' }).first().click();
    // The sheet title is JSX, so the dialog exposes no accessible name (finding A-1).
    await expect(
      page.getByRole('dialog').filter({ hasText: 'Review guests automatically' })
    ).toBeVisible({ timeout: 10_000 });
    await hold(600);
    await shot(page, '07-desktop-auto-review');
    await page.keyboard.press('Escape');
    await hold(300);

    // Card view
    await page.goto(reviewsPaths.propertyCardView);
    await ready(page);
    await shot(page, '08-desktop-property-cards');

    // Filtered + empty
    await page.goto(reviewsPaths.propertyFiltered);
    await ready(page);
    await shot(page, '09-desktop-property-filtered');
    await page.goto(reviewsPaths.propertyEmpty);
    await ready(page);
    await shot(page, '10-desktop-property-empty');

    // Org rollup
    await page.goto(reviewsPaths.org);
    await ready(page);
    await shot(page, '11-desktop-org-received');
    await page.goto(reviewsPaths.orgLegacyProperties);
    await ready(page);
    await shot(page, '12-desktop-org-legacy-tab');
    await page.goto(reviewsPaths.orgCardView);
    await ready(page);
    await shot(page, '13-desktop-org-cards');
    await page.goto(reviewsPaths.orgSingleListing);
    await ready(page);
    await shot(page, '14-desktop-org-single-listing');
  });

  test('phone surfaces', async ({ page }) => {
    watchConsole(page, 'phone');
    await installReviewsUxMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(reviewsPaths.property);
    await ready(page);
    await shot(page, '20-phone-property-received');
    await measureLayout(page, 'phone-390-received');

    // Card overflow menu (the ⋯ trigger; the card itself is a role=button, so target the class)
    await page.locator('.admin-overflow-trigger').first().click();
    await hold(500);
    await shot(page, '21-phone-card-actions');
    await page.keyboard.press('Escape');
    await hold(300);

    // Review detail
    await page
      .getByRole('button', { name: /Maria Santos/ })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: /review$/ })).toBeVisible({
      timeout: 10_000,
    });
    await hold(500);
    await shot(page, '22-phone-review-detail');
    await page.keyboard.press('Escape');
    await hold(300);

    // Refine sheet (received)
    await page.getByRole('button', { name: /Refine reviews/ }).click();
    await hold(600);
    await shot(page, '23-phone-refine');
    await page.keyboard.press('Escape');
    await hold(300);

    // To write + its refine sheet (the empty Filters case)
    await page.goto(reviewsPaths.propertyToWrite);
    await ready(page);
    await shot(page, '24-phone-to-write');
    await page.getByRole('button', { name: /Refine reviews/ }).click();
    await hold(600);
    await shot(page, '25-phone-refine-to-write');
    await page.keyboard.press('Escape');
    await hold(300);

    // Write guest review sheet
    await page
      .getByRole('button', { name: /^Write review$/ })
      .first()
      .click();
    await hold(900);
    await shot(page, '26-phone-write-guest-review');
    await page.keyboard.press('Escape');
    await hold(300);

    // About guests
    await page.goto(reviewsPaths.propertyWritten);
    await ready(page);
    await shot(page, '27-phone-written');

    // Auto-review sheet
    await page.goto(reviewsPaths.property);
    await ready(page);
    await page.getByRole('button', { name: 'Auto-review' }).click();
    await expect(
      page.getByRole('dialog').filter({ hasText: 'Review guests automatically' })
    ).toBeVisible({ timeout: 10_000 });
    await hold(600);
    await shot(page, '28-phone-auto-review');
    await page.keyboard.press('Escape');
    await hold(300);

    // Org rollup on phone
    await page.goto(reviewsPaths.org);
    await ready(page);
    await shot(page, '29-phone-org-received');
    await measureLayout(page, 'phone-390-org');
    await page.goto(reviewsPaths.orgLegacyProperties);
    await ready(page);
    await shot(page, '30-phone-org-legacy-tab');
  });

  test('tablet, laptop and dark', async ({ page }) => {
    watchConsole(page, 'tablet-dark');
    await installReviewsUxMocks(page);

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(reviewsPaths.property);
    await ready(page);
    await shot(page, '31-tablet-property-received');
    await measureLayout(page, 'tablet-768-received');

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(reviewsPaths.property);
    await ready(page);
    await shot(page, '32-laptop1024-property-received');
    await measureLayout(page, 'laptop-1024-received');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(reviewsPaths.org);
    await ready(page);
    await shot(page, '33-laptop1280-org');

    // Dark mode. The desktop sidebar toggle moved to Quick Access / Profile, so seed the
    // stored preference instead of driving a control that no longer exists on this surface.
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.addInitScript(() => window.localStorage.setItem('kame-ui-theme', 'dark'));
    await page.goto(reviewsPaths.property);
    await ready(page);
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 10_000 });
    await hold(600);
    await shot(page, '34-desktop-dark-received');
    await page
      .getByRole('button', { name: /Average rating/ })
      .first()
      .click();
    await hold(600);
    await shot(page, '35-desktop-dark-rating-breakdown');
    await page.keyboard.press('Escape');
    await page.addInitScript(() => window.localStorage.setItem('kame-ui-theme', 'light'));
  });

  test('read only member', async ({ page }) => {
    watchConsole(page, 'read-only');
    await installReviewsUxMocks(page, { readOnly: true });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(reviewsPaths.property);
    await ready(page);
    await shot(page, '40-desktop-read-only-received');
    console.log(
      '\n[read-only] respond buttons:',
      await page.getByRole('button', { name: 'Respond', exact: true }).count()
    );
    await page.goto(reviewsPaths.propertyToWrite);
    await ready(page);
    await shot(page, '41-desktop-read-only-to-write');
  });

  test('pagination and auto-review save', async ({ page }) => {
    watchConsole(page, 'paging');
    await installReviewsUxMocks(page, { paged: true });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(reviewsPaths.property);
    await ready(page);
    await shot(page, '15-desktop-paged-first');
    await page.getByRole('button', { name: 'Go to page 2' }).click();
    await hold(900);
    await shot(page, '16-desktop-paged-second');
  });

  test('auto-review enabled and dirty', async ({ page }) => {
    watchConsole(page, 'auto');
    await installReviewsUxMocks(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(reviewsPaths.property);
    await ready(page);
    await page.getByRole('button', { name: 'Auto-review' }).first().click();
    const sheet = page.getByRole('dialog').filter({ hasText: 'Review guests automatically' });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await hold(400);
    await sheet.getByRole('button', { name: 'More days' }).click();
    await hold(300);
    await shot(page, '17-desktop-auto-review-dirty');
    // The template preview sits above the first template; bring it into view.
    await sheet.getByText('Preview', { exact: true }).scrollIntoViewIfNeeded();
    await hold(500);
    await shot(page, '18-desktop-auto-review-templates');
  });

  test('error and empty states', async ({ page }) => {
    watchConsole(page, 'states');
    await installReviewsUxMocks(page, { failList: true });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(reviewsPaths.property);
    // useQuery retries three times before it reports the failure.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 30_000 });
    await hold(400);
    await shot(page, '42-desktop-load-error');

    await installReviewsUxMocks(page, { empty: true });
    await page.goto(reviewsPaths.property);
    await ready(page);
    await shot(page, '43-desktop-empty-received');
    await page.goto(reviewsPaths.propertyToWrite);
    await ready(page);
    await shot(page, '44-desktop-empty-to-write');
  });
});
