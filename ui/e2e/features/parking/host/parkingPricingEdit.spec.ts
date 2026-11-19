import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  installParkingFlowMocks,
  parkingFlowPaths,
} from '../shared/parkingFlowHarness';
import { setParkingScreenSuite } from '../shared/parkingScreenCapture';

test.describe('parking pricing edit @ci', () => {
  test('shows the matching explainer and guards unsaved rate edits', async ({ page }) => {
    setParkingScreenSuite('parking-pricing-edit');
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await page.goto(parkingFlowPaths.hostPricing);
    await expect(page.getByRole('heading', { name: 'Pricing & availability' })).toBeVisible();
    await expect(page.getByText(/platform rate/i)).toHaveCount(0);

    const weekday = page.getByLabel('Weekday / night');
    await weekday.fill('275');
    await expect(weekday).toHaveValue('275');
    // Leaving with unsaved edits must prompt, not silently drop the change.
    await page.getByRole('link', { name: 'Bookings' }).first().click();
    await expect(page.getByText('Save your changes?')).toBeVisible({ timeout: 10_000 });
  });

  test('blocks rates under ₱100, allows clearing, and has no maximum', async ({ page }) => {
    setParkingScreenSuite('parking-pricing-min-rate');
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await page.goto(parkingFlowPaths.hostPricing);
    const weekday = page.getByLabel('Weekday / night');
    await expect(weekday).toBeVisible();

    // Preview: guests see the host rate, the host receives rate minus the 10% fee.
    await weekday.fill('350');
    const weekdayPreview = page.locator('#parking-weekday-rate-help');
    await expect(weekdayPreview.getByText('₱315 / night')).toBeVisible();
    await expect(weekdayPreview.getByText('Guests see')).toBeVisible();
    await expect(weekdayPreview.getByText('Platform fee (10%)')).toBeVisible();
    await expect(weekdayPreview.getByText('You receive')).toBeVisible();
    await expect(weekdayPreview.getByText('₱350 / night').first()).toBeVisible();
    await expect(weekdayPreview.getByText('-₱35')).toBeVisible();
    await expect(
      page.getByText(/service fee at checkout \(5% \+ ₱15 per booking\)/i)
    ).toBeVisible();

    // Under the minimum: error shown and Save is disabled.
    await weekday.fill('99');
    await expect(weekdayPreview.getByText('Enter at least ₱100.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    // A cleared field stays empty (not snapped back) and cannot be saved.
    await weekday.fill('');
    await expect(weekday).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    // No maximum.
    await weekday.fill('5000');
    await expect(weekdayPreview.getByText('₱4,500 / night')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  for (const width of [375, 768, 1024]) {
    test(`rates form fits without sideways scroll at ${width}px`, async ({ page }) => {
      setParkingScreenSuite(`parking-pricing-rates-${width}`);
      const state = createParkingFlowState();
      await installParkingFlowMocks(page, state);
      await page.setViewportSize({ width, height: 900 });

      await page.goto(parkingFlowPaths.hostPricing);
      const weekday = page.getByLabel('Weekday / night');
      await expect(weekday).toBeVisible();
      await weekday.fill('350');

      const preview = page.locator('#parking-weekday-rate-help');
      await expect(preview.getByText('You receive')).toBeVisible();

      const save = page.getByRole('button', { name: 'Save' });
      await expect(save).toBeVisible();
      const box = await save.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
