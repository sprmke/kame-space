import { expect, test } from '@playwright/test';

import { installSuperAdminConsoleMocks } from './shared/superAdminConsoleHarness';
import {
  expectNoPageHorizontalOverflow,
  expectNoUnnamedInteractiveControls,
} from '../../shared/layoutAssertions';

/**
 * Phone shell for the super admin console: summary cards, list rows and the More sheet.
 * Runs in the @smoke lane so the 375px project covers it on every PR.
 */
test.describe('@smoke super admin mobile shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('support list shows summary, ticket cards and no sideways scroll', async ({ page }) => {
    await installSuperAdminConsoleMocks(page);
    await page.goto('/admin/support');

    await expect(page.getByRole('heading', { name: 'Support tickets' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Total tickets')).toBeVisible();
    await expect(page.getByText('Calendar shows a blocked date twice')).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
    await expectNoUnnamedInteractiveControls(page);
  });

  test('More sheet reaches a destination that is not in the tab bar', async ({ page }) => {
    await installSuperAdminConsoleMocks(page);
    await page.goto('/admin/orgs');

    await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible({
      timeout: 20_000,
    });

    const tabBar = page.locator('nav[aria-label="Admin"]');
    await tabBar.getByRole('button', { name: 'More' }).click();

    const destination = page.getByRole('link', { name: 'Platform settings' }).first();
    await expect(destination).toBeVisible({ timeout: 10_000 });
    await destination.click();

    await expect(page).toHaveURL(/\/admin\/platform-settings$/);
    await expect(page.getByRole('heading', { name: 'Platform settings' })).toBeVisible({
      timeout: 20_000,
    });
    await expectNoPageHorizontalOverflow(page);
  });
});
