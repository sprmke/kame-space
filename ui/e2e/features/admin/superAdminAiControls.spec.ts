import { expect, test } from '@playwright/test';

import { installAiControlsMocks } from './shared/aiControlsHarness';
import { expectNoPageHorizontalOverflow } from '../../shared/layoutAssertions';

test.describe('@ci super admin ai controls', () => {
  test('number fields save once when the operator leaves the field', async ({ page }) => {
    const patches: Array<Record<string, unknown>> = [];
    await installAiControlsMocks(page, patches);

    const daily = page.locator('#ai-daily-calls');
    await daily.fill('');
    await daily.pressSequentially('123');
    expect(patches).toHaveLength(0);

    await page.getByText('Platform AI', { exact: true }).click();
    await expect.poll(() => patches.length).toBe(1);
    expect(patches[0]).toEqual({ defaultDailyCallLimit: 123 });
    await expect(page.getByText('AI platform settings updated')).toBeVisible();
  });

  test('invalid numbers revert and explain the range', async ({ page }) => {
    const patches: Array<Record<string, unknown>> = [];
    await installAiControlsMocks(page, patches);

    const daily = page.locator('#ai-daily-calls');
    await daily.fill('0');
    await page.getByText('Platform AI', { exact: true }).click();

    await expect(page.getByText('Enter 1 or more.')).toBeVisible();
    await expect(daily).toHaveValue('200');
    expect(patches).toHaveLength(0);
  });

  test('the tab row scrolls on phone and keeps the active tab in view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const patches: Array<Record<string, unknown>> = [];
    await installAiControlsMocks(page, patches);

    const nav = page.getByRole('navigation', { name: 'AI sections' });
    const row = nav.locator('div').first();
    const widths = await row.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(widths.scrollWidth).toBeGreaterThan(widths.clientWidth);

    const controls = page.getByRole('link', { name: 'Controls' });
    const navBox = await nav.boundingBox();
    const pillBox = await controls.boundingBox();
    expect(navBox).not.toBeNull();
    expect(pillBox).not.toBeNull();
    expect(pillBox!.x).toBeGreaterThanOrEqual(navBox!.x - 1);
    expect(pillBox!.x + pillBox!.width).toBeLessThanOrEqual(navBox!.x + navBox!.width + 1);
    await expectNoPageHorizontalOverflow(page);
  });
});
