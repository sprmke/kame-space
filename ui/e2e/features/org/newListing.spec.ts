import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  installNewListingMocks,
  NEW_LISTING_PATHS,
  openNewListingDialog,
} from './shared/newListingHarness';

/**
 * New listing end to end: org inventory -> dialog -> create -> property settings.
 * Covers both asset kinds, the plan quote states, permissions and the phone sheet.
 */

async function openProperties(page: Page) {
  await page.goto(NEW_LISTING_PATHS.properties);
  await expect(page.getByText('Solea Mactan').first()).toBeVisible({ timeout: 30_000 });
}

async function openDialog(page: Page, kind: 'property' | 'parking' = 'property') {
  await openNewListingDialog(page, kind);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillProperty(page: Page, dialog: Locator, unit = '1204') {
  await dialog.getByLabel('Tower').click();
  await page.getByRole('option', { name: 'Monaco', exact: true }).click();
  await dialog.getByLabel('Unit').fill(unit);
  await dialog.getByLabel('Unit').blur();
}

function submitButton(dialog: Locator, label: string) {
  return dialog.getByRole('button', { name: label, exact: true });
}

test.describe('@ci new listing flow', () => {
  test('an owner adds a property, sees the quote and lands on its settings', async ({ page }) => {
    const state = await installNewListingMocks(page);
    await openProperties(page);
    const dialog = await openDialog(page);

    // The dialog is named after what the host clicked, not the umbrella "listing".
    await expect(dialog).toHaveAccessibleName('Add property');
    await expect(dialog.getByRole('heading', { name: 'Add property' })).toBeVisible();

    await fillProperty(page, dialog);
    await expect(dialog.getByRole('note')).toContainText('Business');
    await expect(dialog.getByRole('note')).toContainText('₱399');
    await expect(submitButton(dialog, 'Add property')).toBeEnabled({ timeout: 10_000 });
    await submitButton(dialog, 'Add property').click();

    await expect(page.getByText('Property added to your plan')).toBeVisible();
    await page.waitForURL(/\/property\/monaco-1204\/settings$/);
    expect(state.createdProperties[0]).toMatchObject({
      name: 'Monaco 1204',
      tower: 'Monaco',
      unitNumber: '1204',
      residenceName: 'Azure North Residences',
    });
  });

  test('a free plan adds a property without a plan note', async ({ page }) => {
    const state = await installNewListingMocks(page, { billing: 'free' });
    await openProperties(page);
    const dialog = await openDialog(page);

    await fillProperty(page, dialog);
    await expect(dialog.getByRole('note')).toHaveCount(0);
    await expect(submitButton(dialog, 'Add property')).toBeEnabled({ timeout: 10_000 });
    await submitButton(dialog, 'Add property').click();

    await page.waitForURL(/\/property\/monaco-1204\/settings$/);
    expect(state.createdProperties).toHaveLength(1);
  });

  test('an overdue plan says the property stays on Free', async ({ page }) => {
    await installNewListingMocks(page, { billing: 'overdue' });
    await openProperties(page);
    const dialog = await openDialog(page);

    await fillProperty(page, dialog);
    await expect(dialog.getByRole('note')).toContainText('stays on Free');
    await expect(submitButton(dialog, 'Add property')).toBeEnabled({ timeout: 10_000 });
    await submitButton(dialog, 'Add property').click();

    await expect(
      page.getByText('Pay your overdue plan to turn paid features on for this property')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay now' })).toBeVisible();
  });

  test('a failed quote is visible and can be retried', async ({ page }) => {
    const state = await installNewListingMocks(page, { billing: 'error' });
    await openProperties(page);
    const dialog = await openDialog(page);

    await fillProperty(page, dialog);
    await expect(dialog.getByRole('alert')).toContainText('Could not load the plan price.');

    state.previewShouldFail = false;
    await dialog.getByRole('button', { name: 'Retry' }).click();
    await expect(dialog.getByRole('note')).toContainText('Business');
  });

  test('submit waits for the name availability check', async ({ page }) => {
    await installNewListingMocks(page);
    // Hold the check so the in-flight state is observable, then let it pass.
    await page.route(/\/check-property-name(\?.*)?$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { available: true, message: null } }),
      });
    });
    await openProperties(page);
    const dialog = await openDialog(page);

    await fillProperty(page, dialog);
    await expect(submitButton(dialog, 'Add property')).toBeDisabled();
    await expect(submitButton(dialog, 'Add property')).toBeEnabled({ timeout: 15_000 });
  });

  test('a member without create permission cannot start the flow', async ({ page }) => {
    await installNewListingMocks(page, { canCreate: false });
    await openProperties(page);

    await expect(page.getByRole('button', { name: 'Add property' })).toHaveCount(0);
    await expect(page.getByText('Solea Mactan').first()).toBeVisible();
  });

  test('an owner adds a parking slot with its generated code and name', async ({ page }) => {
    const state = await installNewListingMocks(page);
    await page.goto(NEW_LISTING_PATHS.parkings);
    await expect(page.getByText('No parkings yet')).toBeVisible({ timeout: 30_000 });

    const dialog = await openDialog(page, 'parking');
    await expect(dialog).toHaveAccessibleName('Add parking');
    await expect(dialog.getByRole('heading', { name: 'Add parking' })).toBeVisible();
    await dialog.getByLabel('Slot number').fill('27');
    await expect(dialog.getByLabel('Display name')).toHaveValue('Monaco - Level 1 - Slot 27');

    await submitButton(dialog, 'Add parking').click();
    await page.waitForURL(/\/parking\/monaco-level-1-slot-27\/settings$/);
    expect(state.createdParkings[0]).toMatchObject({
      name: 'Monaco - Level 1 - Slot 27',
      slotLabel: '27',
      tower: 'Monaco',
      level: 'Level 1',
    });
  });

  test('the phone flow is a bottom sheet with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installNewListingMocks(page);
    await openProperties(page);

    const dialog = await openDialog(page);
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(submitButton(dialog, 'Add property')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });
});
