import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { installMaintenanceMocks } from './maintenance/shared/maintenanceHarness';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/*
 * Property Maintenance workspace — reminders list, statuses, filters, wizard CRUD, quick
 * complete, export, RBAC and the error/empty states.
 *
 * The shared RBAC harness answers `maintenance-items` with an empty list, so this spec
 * installs the module's stateful data mocks on top of it (they win: Playwright matches the
 * most recently registered route first). Fixture dates are relative to today so the
 * overdue/pending split is deterministic whenever CI runs.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function openMaintenance(page: Page) {
  await installPropertyTeamRbacMocks(page, 'full_access');
  await installMaintenanceMocks(page);
  await page.goto(teamRbacPaths.maintenance);
  await expect(page.getByRole('heading', { name: 'Maintenance', exact: true }).first()).toBeVisible(
    { timeout: 20_000 }
  );
}

async function openStatusFilter(page: Page) {
  await page.getByRole('button', { name: 'All statuses' }).click();
}

async function openDateRange(page: Page) {
  await page
    .getByRole('button', { name: 'Previous period' })
    .locator('xpath=following-sibling::button[1]')
    .click();
}

test.describe('@ci maintenance workspace', () => {
  test('shows totals and per-row Done, Pending and Overdue state', async ({ page }) => {
    await openMaintenance(page);

    for (const [title, value] of [
      ['Total', '3'],
      ['Overdue', '1'],
      ['Pending', '1'],
      ['Completed', '1'],
    ]) {
      await expect(page.locator('.surface-card', { hasText: title }).first()).toContainText(value);
    }

    await expect(page.getByText('Aircon filter service')).toBeVisible();
    await expect(page.getByText('Pool pump inspection')).toBeVisible();
    await expect(page.getByText('Deep clean kitchen')).toBeVisible();

    await expect(
      page.locator('tr', { hasText: 'Deep clean kitchen' }).getByText('Overdue')
    ).toBeVisible();
    await expect(
      page.locator('tr', { hasText: 'Aircon filter service' }).getByText('Pending')
    ).toBeVisible();
    await expect(
      page.locator('tr', { hasText: 'Pool pump inspection' }).getByText('Done')
    ).toBeVisible();

    // Status does not depend on Telegram, which stays a separate indicator.
    await expect(page.locator('svg[aria-label="Telegram reminder on"]')).toHaveCount(2);
  });

  test('filters to completed reminders', async ({ page }) => {
    await openMaintenance(page);

    await openStatusFilter(page);
    await page.getByRole('option', { name: 'Completed' }).click();
    await expect(page.getByText('Pool pump inspection')).toBeVisible();
    await expect(page.getByText('Aircon filter service')).toHaveCount(0);
    await expect(page.getByText('Deep clean kitchen')).toHaveCount(0);
  });

  test('filters to overdue reminders', async ({ page }) => {
    await openMaintenance(page);

    await openStatusFilter(page);
    await page.getByRole('option', { name: 'Overdue' }).click();
    await expect(page.getByText('Deep clean kitchen')).toBeVisible();
    await expect(page.getByText('Pool pump inspection')).toHaveCount(0);
    await expect(page.getByText('Aircon filter service')).toHaveCount(0);
  });

  test('shows Overdue even when Telegram reminders are off', async ({ page }) => {
    await openMaintenance(page);

    await expect(
      page.locator('tr', { hasText: 'Deep clean kitchen' }).getByText('Overdue')
    ).toBeVisible();
    await expect(
      page.locator('tr', { hasText: 'Deep clean kitchen' }).getByRole('button', {
        name: /Mark Deep clean kitchen done/,
      })
    ).toBeVisible();
  });

  test('keeps Next disabled until required fields are filled, then saves in two steps', async ({
    page,
  }) => {
    await openMaintenance(page);

    await page
      .getByRole('button', { name: /Add reminder/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Add reminder' })).toBeVisible();
    await expect(dialog.getByRole('progressbar', { name: 'Reminder steps' })).toBeVisible();
    await expect(dialog.getByText('Label is required')).toHaveCount(0);

    const next = dialog.getByRole('button', { name: 'Next' });
    await expect(next).toBeDisabled();

    await dialog.getByLabel('Label').fill('Replace balcony drain');
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Plumbing', exact: true }).click();
    await expect(next).toBeEnabled();

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
    await expect(page.getByText('Reminder added')).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Replace balcony drain' })).toBeVisible();
  });

  test('marks a reminder done from the list and can undo it', async ({ page }) => {
    await openMaintenance(page);

    const row = page.locator('tr', { hasText: 'Deep clean kitchen' });
    const doneRequest = page.waitForRequest(
      (req) => req.url().includes('/maintenance-items') && req.method() === 'PATCH'
    );
    await row.getByRole('button', { name: 'Mark Deep clean kitchen done' }).click();
    const doneBody = JSON.parse((await doneRequest).postData() ?? '{}');
    expect(doneBody).toMatchObject({ id: 'rem-3', marked_complete: true });

    await expect(row.getByText('Done')).toBeVisible();
    await expect(page.getByText('Marked done')).toBeVisible();

    const undo = page.getByRole('button', { name: 'Undo' });
    const undoRequest = page.waitForRequest(
      (req) => req.url().includes('/maintenance-items') && req.method() === 'PATCH'
    );
    await undo.click();
    const undoBody = JSON.parse((await undoRequest).postData() ?? '{}');
    expect(undoBody).toMatchObject({ id: 'rem-3', marked_complete: false });
    await expect(row.getByText('Overdue')).toBeVisible();
  });

  test('edits an existing reminder and persists the done state', async ({ page }) => {
    await openMaintenance(page);

    await page
      .locator('tr', { hasText: 'Deep clean kitchen' })
      .getByRole('button', { name: 'Edit' })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Mark done is available without turning Telegram reminders on.
    await expect(dialog.getByText('Mark as done')).toBeVisible();
    await dialog.getByText('Mark as done').click();
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByRole('heading', { name: 'Activity' })).toBeVisible();

    const patchRequest = page.waitForRequest(
      (req) => req.url().includes('/maintenance-items') && req.method() === 'PATCH'
    );
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    const body = JSON.parse((await patchRequest).postData() ?? '{}');

    expect(body).toMatchObject({
      id: 'rem-3',
      label: 'Deep clean kitchen',
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

  test('a recurring reminder can delete the whole series and resets the scope next time', async ({
    page,
  }) => {
    await openMaintenance(page);

    const openDelete = () =>
      page
        .locator('tr', { hasText: 'Deep clean kitchen' })
        .getByRole('button', { name: 'Delete' })
        .click();

    // Cancel after picking All: the next open must default back to one occurrence.
    await openDelete();
    await expect(page.getByText('This occurrence only')).toBeVisible();
    await page.getByText('All occurrences').click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await openDelete();
    await expect(page.getByRole('radio', { name: /This occurrence only/ })).toBeChecked();
    await page.getByText('All occurrences').click();

    const deleteRequest = page.waitForRequest(
      (req) => req.url().includes('/maintenance-items') && req.method() === 'DELETE'
    );
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const url = new URL((await deleteRequest).url());
    expect(url.searchParams.get('scope')).toBe('all');
  });

  test('read-only members see no add, edit, delete, complete or export actions', async ({
    page,
  }) => {
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
    await expect(page.getByRole('button', { name: /Mark .* done/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Export report/i })).toHaveCount(0);

    // Calendar is not a back door to the same actions.
    await page.getByRole('button', { name: /Choose reminders view/ }).click();
    await page.getByRole('option', { name: 'Calendar', exact: true }).click();
    const dayWithItems = page.getByRole('button', { name: /reminder/ }).first();
    if (await dayWithItems.count()) {
      await dayWithItems.click();
      await expect(page.getByRole('button', { name: /^Edit$/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Delete$/ })).toHaveCount(0);
    }
  });

  test('empty period points at All dates, and All dates persists across filters', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installMaintenanceMocks(page, { items: [] });
    await page.goto(teamRbacPaths.maintenance);

    await expect(page.getByText('No reminders in this period')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'View all dates' }).click();

    await expect(page.getByText('No reminders yet')).toBeVisible();
    await expect(page).toHaveURL(/preset=all/);
    await expect(page).not.toHaveURL(/from=/);

    await page.getByRole('button', { name: 'Due soonest' }).click();
    await page.getByRole('option', { name: 'Newest scheduled' }).click();
    await expect(page).toHaveURL(/preset=all/);
    await expect(page).not.toHaveURL(/from=/);
  });

  test('clear date filter moves to All dates instead of snapping back', async ({ page }) => {
    await openMaintenance(page);

    await openDateRange(page);
    await page.getByRole('button', { name: /Clear date filter/ }).click();

    await expect(page).toHaveURL(/preset=all/);
    await expect(page).not.toHaveURL(/from=/);
    await expect(page.getByText('Deep clean kitchen')).toBeVisible();
  });

  test('shows a retry surface when the list request fails', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installMaintenanceMocks(page);
    await page.route('**/functions/v1/maintenance-items**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'boom' }),
      })
    );
    await page.goto(teamRbacPaths.maintenance);

    await expect(page.getByText('Could not load reminders')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('phone width switches the table to cards with status visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMaintenance(page);

    await expect(
      page.getByRole('button', { name: 'Edit reminder Aircon filter service' })
    ).toBeVisible();
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Calendar', exact: true })).toBeVisible();
    await expect(page.getByText('Overdue').first()).toBeVisible();
  });

  test('create dialog has no serious or critical WCAG violations', async ({ page }) => {
    await openMaintenance(page);
    await page
      .getByRole('button', { name: /Add reminder/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(WCAG_TAGS)
      .analyze();
    const serious = results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    );
    expect(
      serious.map(
        (violation) =>
          `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`
      )
    ).toEqual([]);
  });
});

test.describe('@ci maintenance export', () => {
  test('exports the filtered PDF report for the period', async ({ page }) => {
    test.setTimeout(120_000);
    await openMaintenance(page);

    await openStatusFilter(page);
    await page.getByRole('option', { name: 'Completed' }).click();
    await page.getByRole('heading', { name: 'Maintenance', exact: true }).first().click();

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
