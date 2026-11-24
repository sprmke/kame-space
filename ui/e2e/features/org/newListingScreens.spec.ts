import { expect, test, type Page } from '@playwright/test';

import {
  installNewListingMocks,
  NEW_LISTING_PATHS,
  openNewListingDialog,
} from './shared/newListingHarness';

/**
 * Fixed-corpus captures for the New listing flow. `@demo` — never CI.
 *
 * Run the same file against two commits to produce before/after pairs:
 *   NEW_LISTING_SHOTS_DIR=.../screenshots/before playwright test ... --project=chromium
 */

const OUT = process.env.NEW_LISTING_SHOTS_DIR ?? 'test-results/new-listing-shots';

async function dismissConsent(page: Page): Promise<void> {
  for (const name of ['Essential only', 'Necessary only', 'Accept all']) {
    const button = page.getByRole('button', { name });
    if (await button.isVisible().catch(() => false)) {
      await button.first().click();
      return;
    }
  }
}

async function settle(page: Page): Promise<void> {
  // Two frames: layout commit plus the open animation's first painted frame.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    fullPage,
    animations: 'disabled',
  });
}

async function waitForInventory(page: Page, empty = false) {
  await expect(page.getByRole('heading', { name: 'Properties', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    empty ? page.getByText('No properties yet') : page.getByText('Solea Mactan').first()
  ).toBeVisible({ timeout: 30_000 });
  await dismissConsent(page);
  await settle(page);
}

async function openProperties(page: Page, opts?: Parameters<typeof installNewListingMocks>[1]) {
  await installNewListingMocks(page, opts);
  await page.goto(NEW_LISTING_PATHS.properties);
  await waitForInventory(page, opts?.empty);
}

async function fillPropertyForm(page: Page, unit = '1204') {
  await page.getByLabel('Tower').click();
  await page.getByRole('option', { name: 'Monaco', exact: true }).click();
  await page.getByLabel('Unit').fill(unit);
  await page.getByLabel('Unit').blur();
  await expect(page.getByLabel('Unit')).toHaveValue(unit);
}

test.describe('new listing screens @demo', () => {
  test.setTimeout(180_000);

  test('properties inventory at every width', async ({ page }) => {
    await installNewListingMocks(page);
    for (const [name, width, height] of [
      ['1440', 1440, 960],
      ['1024', 1024, 768],
      ['768', 768, 1024],
      ['390', 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(NEW_LISTING_PATHS.properties);
      await waitForInventory(page);
      await dismissConsent(page);
      await shot(page, `properties-${name}`);
    }
  });

  test('new property dialog at every width', async ({ page }) => {
    await installNewListingMocks(page);
    for (const [name, width, height] of [
      ['1440', 1440, 960],
      ['1024', 1024, 768],
      ['768', 768, 1024],
      ['390', 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(NEW_LISTING_PATHS.properties);
      await waitForInventory(page);
      await openNewListingDialog(page);
      await expect(page.getByRole('dialog')).toBeVisible();
      await settle(page);
      await shot(page, `new-property-${name}`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });

  test('new property dialog filled, with the plan quote', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await openProperties(page);
    await openNewListingDialog(page);
    await fillPropertyForm(page);
    await expect(page.getByRole('note')).toContainText('Business');
    await settle(page);
    await shot(page, 'new-property-filled-1440');
  });

  test('new property validation state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await openProperties(page);
    await openNewListingDialog(page);
    await fillPropertyForm(page, '12');
    await expect(page.getByText('Enter a 4-digit unit number')).toBeVisible();
    await settle(page);
    await shot(page, 'new-property-invalid-1440');
  });

  test('new property on a free plan', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await openProperties(page, { billing: 'free' });
    await openNewListingDialog(page);
    await fillPropertyForm(page);
    await expect(page.getByRole('note')).toHaveCount(0);
    await settle(page);
    await shot(page, 'new-property-free-1440');
  });

  test('new property with an overdue plan', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await openProperties(page, { billing: 'overdue' });
    await openNewListingDialog(page);
    await fillPropertyForm(page);
    await expect(page.getByRole('note')).toContainText('overdue');
    await settle(page);
    await shot(page, 'new-property-overdue-1440');
  });

  test('new property when the quote fails', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await openProperties(page, { billing: 'error' });
    await openNewListingDialog(page);
    await fillPropertyForm(page);
    await settle(page);
    await shot(page, 'new-property-quote-error-1440');
  });

  test('new parking dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installNewListingMocks(page);
    await page.goto(NEW_LISTING_PATHS.parkings);
    await page.getByRole('heading', { name: 'Parkings', exact: true }).waitFor({ timeout: 30_000 });
    await openNewListingDialog(page, 'parking');
    await expect(page.getByRole('dialog')).toBeVisible();
    await settle(page);
    await shot(page, 'new-parking-1440');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(NEW_LISTING_PATHS.parkings);
    await expect(page.getByRole('heading', { name: 'Parkings', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('No parkings yet')).toBeVisible({ timeout: 30_000 });
    await dismissConsent(page);
    await openNewListingDialog(page, 'parking');
    await expect(page.getByRole('dialog')).toBeVisible();
    await settle(page);
    await shot(page, 'new-parking-390');
  });

  test('inventory without create permission', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await openProperties(page, { canCreate: false });
    await expect(page.getByRole('button', { name: 'Add property' })).toHaveCount(0);
    await shot(page, 'properties-read-only-1440');
  });

  test('empty inventory', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await openProperties(page, { empty: true });
    await expect(page.getByText('No properties yet')).toBeVisible();
    await shot(page, 'properties-empty-1440');

    await page.setViewportSize({ width: 390, height: 844 });
    await openProperties(page, { empty: true });
    await expect(page.getByText('No properties yet')).toBeVisible();
    await shot(page, 'properties-empty-390');
  });
});
