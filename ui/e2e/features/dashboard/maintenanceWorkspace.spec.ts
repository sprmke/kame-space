import { expect, test, type Page } from '@playwright/test';

import { installMaintenanceMocks } from './maintenance/shared/maintenanceHarness';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/*
 * Property Maintenance workspace — reminders list, filters, wizard CRUD, export, RBAC.
 *
 * The shared RBAC harness answers `maintenance-items` with an empty list, so this spec
 * installs the module's stateful data mocks on top of it (they win: Playwright matches the
 * most recently registered route first). Dates are fixed; the mocked list ignores the
 * period params, so rows render regardless of when CI runs.
 */

async function openMaintenance(page: Page) {
  await installPropertyTeamRbacMocks(page, 'full_access');
  await installMaintenanceMocks(page);
  await page.goto(teamRbacPaths.maintenance);
  await expect(page.getByRole('heading', { name: 'Maintenance', exact: true }).first()).toBeVisible(
    { timeout: 20_000 }
  );
}

test.describe('@ci maintenance workspace', () => {
  test('shows KPI totals, reminders and their Done/Pending state', async ({ page }) => {
    await openMaintenance(page);

    await expect(page.getByText('Total', { exact: true })).toBeVisible();
    await expect(page.getByText('Telegram enabled', { exact: true })).toBeVisible();
    await expect(page.locator('.surface-card', { hasText: 'Total' }).first()).toContainText('3');
    await expect(page.locator('.surface-card', { hasText: 'Completed' }).first()).toContainText(
      '1'
    );
    await expect(page.locator('.surface-card', { hasText: 'Pending' }).first()).toContainText('2');

    await expect(page.getByText('Aircon filter service')).toBeVisible();
    await expect(page.getByText('Pool pump inspection')).toBeVisible();
    await expect(page.getByText('Deep clean kitchen')).toBeVisible();

    // Status column renders only for Telegram-enabled rows today. Assert the two that do.
    const doneRow = page.locator('tr', { hasText: 'Pool pump inspection' });
    await expect(doneRow.getByText('Done').last()).toBeVisible();
    const pendingRow = page.locator('tr', { hasText: 'Deep clean kitchen' });
    await expect(pendingRow.getByText('Pending').last()).toBeVisible();
  });

  test('filters to completed reminders only', async ({ page }) => {
    await openMaintenance(page);

    await page.getByRole('button', { name: 'All Status' }).click();
    await page.getByRole('option', { name: 'Completed' }).click();

    await expect(page.getByText('Pool pump inspection')).toBeVisible();
    await expect(page.getByText('Aircon filter service')).toHaveCount(0);
    await expect(page.getByText('Deep clean kitchen')).toHaveCount(0);
  });

  test('keeps Next disabled until the required fields are filled, then saves', async ({ page }) => {
    await openMaintenance(page);

    await page
      .getByRole('button', { name: /Add reminder/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const next = dialog.getByRole('button', { name: 'Next' });
    await expect(next).toBeDisabled();

    await dialog.locator('input[name="label"]').fill('Replace balcony drain');
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Plumbing', exact: true }).click();
    await expect(next).toBeEnabled();

    await next.click();
    await next.click();
    await expect(dialog.getByText('Replace balcony drain')).toBeVisible();

    const createRequest = page.waitForRequest(
      (req) => req.url().includes('/maintenance-items') && req.method() === 'POST'
    );
    await dialog.getByRole('button', { name: 'Add reminder' }).click();
    const body = JSON.parse((await createRequest).postData() ?? '{}');

    expect(body).toMatchObject({
      label: 'Replace balcony drain',
      category: 'Plumbing',
      telegram_reminder_enabled: false,
    });
    await expect(page.getByText('Reminder saved')).toBeVisible();
  });

  test('edits an existing reminder and persists the done state', async ({ page }) => {
    await openMaintenance(page);

    await page
      .locator('tr', { hasText: 'Pool pump inspection' })
      .getByRole('button', { name: 'Edit' })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByText('Mark as done')).toBeVisible();
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByRole('heading', { name: 'Activity' })).toBeVisible();

    const patchRequest = page.waitForRequest(
      (req) => req.url().includes('/maintenance-items') && req.method() === 'PATCH'
    );
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    const body = JSON.parse((await patchRequest).postData() ?? '{}');

    expect(body).toMatchObject({
      id: 'rem-2',
      label: 'Pool pump inspection',
      marked_complete: true,
      telegram_reminder_enabled: true,
    });
    await expect(page.getByText('Reminder updated')).toBeVisible();
  });

  test('deletes one occurrence with the current scope', async ({ page }) => {
    await openMaintenance(page);

    await page
      .locator('tr', { hasText: 'Aircon filter service' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(page.getByRole('heading', { name: 'Delete reminder' })).toBeVisible();
    await expect(page.getByText('Delete Aircon filter service?')).toBeVisible();

    const deleteRequest = page.waitForRequest(
      (req) => req.url().includes('/maintenance-items') && req.method() === 'DELETE'
    );
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const url = new URL((await deleteRequest).url());

    expect(url.searchParams.get('id')).toBe('rem-1');
    expect(url.searchParams.get('scope')).toBe('this');
  });

  test('a recurring reminder can delete the whole series', async ({ page }) => {
    await openMaintenance(page);

    await page
      .locator('tr', { hasText: 'Deep clean kitchen' })
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect(page.getByText('This occurrence only')).toBeVisible();
    await page.getByText('All occurrences').click();

    const deleteRequest = page.waitForRequest(
      (req) => req.url().includes('/maintenance-items') && req.method() === 'DELETE'
    );
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const url = new URL((await deleteRequest).url());
    expect(url.searchParams.get('scope')).toBe('all');
  });

  test('read-only members see no add, edit, delete or export actions', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', {
      omitPermissions: [
        'maintenance.reminders:add',
        'maintenance.reminders:edit',
        'maintenance.reminders:delete',
        'maintenance.export:view',
      ],
    });
    await installMaintenanceMocks(page);
    await page.goto(teamRbacPaths.maintenance);
    await expect(
      page.getByRole('heading', { name: 'Maintenance', exact: true }).first()
    ).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText('Pool pump inspection')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add reminder/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Export report/i })).toHaveCount(0);
  });

  test('empty period shows the first-reminder prompt', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installMaintenanceMocks(page, { items: [] });
    await page.goto(teamRbacPaths.maintenance);

    await expect(page.getByText('No reminders yet')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Add reminder' }).last()).toBeVisible();
  });

  test('phone width switches the table to reminder cards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMaintenance(page);

    await expect(
      page.getByRole('button', { name: 'Edit reminder Aircon filter service' })
    ).toBeVisible();
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Calendar', exact: true })).toBeVisible();
  });
});

test.describe('@ci maintenance export', () => {
  test('exports the full PDF report for the period', async ({ page }) => {
    await openMaintenance(page);

    const download = page.waitForEvent('download', { timeout: 60_000 });
    await page
      .getByRole('button', { name: /Export report/i })
      .first()
      .click();
    await page.getByRole('menuitem', { name: /Full report/i }).click();

    const file = await download;
    expect(file.suggestedFilename().toLowerCase()).toContain('kame-maintenance-report');
    expect(file.suggestedFilename().toLowerCase()).toContain('.pdf');
  });
});
