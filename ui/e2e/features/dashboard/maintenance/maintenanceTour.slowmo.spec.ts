import { expect, test } from '@playwright/test';

import { demoPause, dismissConsent, installMaintenanceMocks } from './shared/maintenanceHarness';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../../team/shared/propertyTeamRbacHarness';

/**
 * Slow-motion walkthrough of the property Maintenance workspace. @demo — headed, never CI.
 *
 * One scenario per flow so each recorded video stands on its own:
 *
 *   PLAYWRIGHT_SLOW_MO=600 PLAYWRIGHT_DEMO_PAUSE_MS=800 \
 *     node_modules/.bin/playwright test ui/e2e/features/dashboard/maintenance/maintenanceTour.slowmo.spec.ts \
 *     --project=chromium
 *
 * Add PLAYWRIGHT_RECORD_VIDEO=1 to record. Videos land in
 * `test-results/playwright/<scenario>/video.webm`.
 *
 * Scenarios: list + filters + views (desktop), create/edit/delete (desktop), export (desktop),
 * and the phone/tablet sheet layouts.
 */

test.describe('maintenance tour @demo', () => {
  test.use({ viewport: { width: 1440, height: 960 }, actionTimeout: 10_000 });

  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installMaintenanceMocks(page);
  });

  test('01 overview, filters and views', async ({ page }) => {
    test.setTimeout(240_000);

    await page.goto(teamRbacPaths.maintenance);
    await dismissConsent(page);
    await expect(
      page.getByRole('heading', { name: 'Maintenance', exact: true }).first()
    ).toBeVisible({ timeout: 20_000 });
    await demoPause(page, 1.8);

    // KPI row and its help hints.
    for (const title of ['Total', 'Completed', 'Pending', 'Telegram enabled']) {
      await page.getByText(title, { exact: true }).first().hover();
      await demoPause(page, 0.45);
    }
    await page.getByRole('button', { name: /About Pending/i }).hover();
    await demoPause(page, 1.4);
    await page.mouse.move(700, 420);
    await demoPause(page, 0.6);

    // Date range presets.
    await page
      .getByRole('button', { name: /November 2026/ })
      .first()
      .click();
    await demoPause(page, 1.4);
    await page.getByRole('button', { name: /^Week/ }).hover();
    await demoPause(page, 1.2);
    await page.getByRole('button', { name: /^Month/ }).click();
    await demoPause(page, 1.2);

    // More filters (category + Telegram).
    await page
      .getByRole('button', { name: /More reminder filters/i })
      .first()
      .click();
    await demoPause(page, 1.2);
    await page.getByRole('button', { name: /All Categories/i }).hover();
    await demoPause(page, 1);
    await page.getByRole('heading', { name: 'Maintenance', exact: true }).first().click();
    await demoPause(page, 0.6);

    // Status multi-select. The trigger's accessible name differs between builds, so drive
    // the visible label and assert through the list instead.
    await page.getByRole('button', { name: /^(All Status|Status filter:)/ }).click();
    await demoPause(page, 1.1);
    await page.getByRole('option', { name: 'Completed' }).hover();
    await demoPause(page, 0.5);
    await page.getByRole('option', { name: 'Completed' }).click();
    await expect(page.getByText('Aircon filter service')).toHaveCount(0);
    await demoPause(page, 1.6);
    await page.getByRole('option', { name: 'Completed' }).click();
    await expect(page.getByText('Aircon filter service')).toBeVisible();
    await demoPause(page, 0.8);
    await page.getByRole('heading', { name: 'Maintenance', exact: true }).first().click();
    await demoPause(page, 0.6);

    // Sort order.
    await page.getByRole('button', { name: /Newest scheduled/i }).click();
    await demoPause(page, 1);
    await page.getByRole('option', { name: /Oldest scheduled/i }).hover();
    await demoPause(page, 0.5);
    await page.getByRole('option', { name: /Oldest scheduled/i }).click();
    await demoPause(page, 1.2);
    await page.getByRole('button', { name: /Oldest scheduled/i }).click();
    await page.getByRole('option', { name: /Newest scheduled/i }).click();
    await demoPause(page, 0.8);

    // Calendar, one day's detail, then cards.
    await page.getByRole('button', { name: /Choose reminders view/i }).click();
    await demoPause(page, 0.9);
    await page.getByRole('option', { name: 'Calendar', exact: true }).click();
    await expect(
      page.getByRole('button', { name: /Choose reminders view: Calendar/ })
    ).toBeVisible();
    await demoPause(page, 1.8);
    await page.getByRole('button', { name: /November 28, 2026/ }).click();
    await demoPause(page, 1.8);
    await page.getByRole('button', { name: /Choose reminders view/i }).click();
    await page.getByRole('option', { name: 'Card', exact: true }).click();
    await expect(page.getByRole('button', { name: /Choose reminders view: Card/ })).toBeVisible();
    await demoPause(page, 1.6);
    const firstCard = page.getByRole('button', { name: 'Edit reminder Aircon filter service' });
    await firstCard.hover();
    await demoPause(page, 1.2);
    await expect(firstCard).toBeVisible();
    await demoPause(page, 1);
  });

  test('02 create, edit and delete a reminder', async ({ page }) => {
    test.setTimeout(240_000);

    await page.goto(teamRbacPaths.maintenance);
    await dismissConsent(page);
    await expect(
      page.getByRole('heading', { name: 'Maintenance', exact: true }).first()
    ).toBeVisible({ timeout: 20_000 });
    await demoPause(page, 1.2);

    // Create through the three-step wizard.
    await page
      .getByRole('button', { name: /Add reminder/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await demoPause(page, 1.2);

    await dialog.locator('input[name="label"]').fill('Replace balcony drain');
    await demoPause(page, 0.6);
    await dialog.getByRole('combobox').first().click();
    await demoPause(page, 0.8);
    await page.getByRole('option', { name: 'Plumbing', exact: true }).click();
    await demoPause(page, 0.6);
    await dialog.locator('textarea').first().fill('Water pools near the drain after rain.');
    await demoPause(page, 0.8);

    await dialog.getByRole('button', { name: 'Next' }).click();
    await demoPause(page, 1);
    await dialog.getByRole('button', { name: 'Next' }).click();
    await demoPause(page, 1.2);
    await dialog.getByRole('button', { name: 'Add reminder' }).click();
    await demoPause(page, 1.6);

    // Edit the row that was just created and mark it done.
    const row = page.locator('tr', { hasText: 'Replace balcony drain' });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(dialog).toBeVisible();
    await demoPause(page, 1);
    await dialog.getByRole('button', { name: 'Next' }).click();
    await demoPause(page, 1);
    await dialog.getByText('Send reminders').click();
    await demoPause(page, 0.9);
    await dialog.getByText('Mark as done').click();
    await demoPause(page, 0.9);
    await dialog.getByRole('button', { name: 'Next' }).click();
    await demoPause(page, 1.4);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await demoPause(page, 1.6);

    // Delete it again.
    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: 'Delete reminder' })).toBeVisible();
    await demoPause(page, 1.4);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await demoPause(page, 1.4);
  });

  test('03 export the maintenance report', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto(teamRbacPaths.maintenance);
    await dismissConsent(page);
    await expect(
      page.getByRole('heading', { name: 'Maintenance', exact: true }).first()
    ).toBeVisible({ timeout: 20_000 });
    await demoPause(page, 1.2);

    await page
      .getByRole('button', { name: /Export report/i })
      .first()
      .click();
    await demoPause(page, 1.3);
    await page.getByRole('menuitem', { name: /Overview summary/i }).hover();
    await demoPause(page, 0.6);
    const download = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('menuitem', { name: /Overview summary/i }).click();
    expect((await download).suggestedFilename()).toContain('.pdf');
    await demoPause(page, 1.6);
  });

  test('04 phone and tablet sheet layouts', async ({ page }) => {
    test.setTimeout(300_000);

    // Phone: hero, cards, refine sheet, card actions, create wizard.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(teamRbacPaths.maintenance);
    await dismissConsent(page);
    await expect(
      page.getByRole('heading', { name: 'Maintenance', exact: true }).first()
    ).toBeVisible({ timeout: 20_000 });
    await demoPause(page, 1.8);

    await page.getByRole('button', { name: /Refine reminders/i }).click();
    await demoPause(page, 1.8);
    await page.getByRole('button', { name: /Done/i }).click();
    await demoPause(page, 0.8);

    const recurringCard = page.getByRole('button', { name: 'Actions for Deep clean kitchen' });
    await recurringCard.click();
    await demoPause(page, 1.5);
    await page.getByRole('option', { name: /View series/i }).click();
    await demoPause(page, 2);
    await page.keyboard.press('Escape');
    await demoPause(page, 1);

    await page.getByRole('button', { name: /Maintenance actions/i }).click();
    await demoPause(page, 1.2);
    await page.getByRole('option', { name: /Add reminder/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await demoPause(page, 1.2);
    await dialog.locator('input[name="label"]').fill('Phone walkthrough reminder');
    await demoPause(page, 0.6);
    await dialog.getByRole('combobox').first().click();
    await demoPause(page, 0.8);
    await page.getByRole('option', { name: 'Aircon', exact: true }).click();
    await demoPause(page, 0.6);
    await dialog.getByRole('button', { name: 'Next' }).click();
    await demoPause(page, 1);
    await dialog.getByText('Send reminders').click();
    await demoPause(page, 1);
    await dialog.getByRole('button', { name: 'Next' }).click();
    await demoPause(page, 1.6);
    await page.keyboard.press('Escape');
    await demoPause(page, 1.2);
    await page.getByRole('button', { name: /Discard/i }).click();
    await demoPause(page, 0.8);

    // Tablet: the same list as cards with the floating toolbar.
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(teamRbacPaths.maintenance);
    await demoPause(page, 2);
    await page.getByRole('button', { name: /Refine reminders/i }).click();
    await demoPause(page, 1.6);
    await page.getByRole('button', { name: /Done/i }).click();
    await demoPause(page, 1.4);
  });
});
