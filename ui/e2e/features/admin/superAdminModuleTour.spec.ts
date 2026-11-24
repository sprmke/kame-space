import { expect, test } from '@playwright/test';

import {
  installSuperAdminConsoleMocks,
  superAdminOrgRow,
} from './shared/superAdminConsoleHarness';
import {
  expectNoPageHorizontalOverflow,
  expectNoUnnamedInteractiveControls,
} from '../../shared/layoutAssertions';

/**
 * Operator journeys across the super admin console. Companion to
 * `adminConsoleAuditFixes.spec.ts` (palette, 404, capability errors) — this covers the
 * data path and the writes an operator actually performs: finding an organization,
 * answering a ticket, blocking an identity and saving platform settings.
 */
test.describe('@ci super admin module tour', () => {
  test('every console destination renders its page header', async ({ page }) => {
    await installSuperAdminConsoleMocks(page);

    const destinations = [
      { path: '/admin/orgs', heading: 'Organizations' },
      { path: '/admin/support', heading: 'Support tickets' },
      { path: '/admin/audit', heading: 'Audit log' },
      { path: '/admin/rate-limits', heading: 'Rate limits' },
      { path: '/admin/platform-settings', heading: 'Platform settings' },
    ];

    for (const destination of destinations) {
      await page.goto(destination.path);
      await expect(page.getByRole('heading', { name: destination.heading, exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expectNoPageHorizontalOverflow(page);
    }

    await expectNoUnnamedInteractiveControls(page);
  });

  test('organizations list opens the org hub with its live counts', async ({ page }) => {
    await installSuperAdminConsoleMocks(page);
    await page.goto('/admin/orgs');

    const row = page.getByRole('link', { name: superAdminOrgRow.name, exact: true });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('₱1,799').first()).toBeVisible();

    await row.click();
    await expect(page).toHaveURL(/\/admin\/orgs\/kame-homes$/);
    await expect(page.getByRole('heading', { name: 'Kame Space', exact: true })).toBeVisible();

    // Overview stat cards read from `get-organization-admin`, not the list payload.
    await expect(page.getByText('Team members').first()).toBeVisible();
    await expect(page.getByText('5', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Subscription/ }).first()).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test('org hub defers below-the-fold sections until they are near the viewport', async ({
    page,
  }) => {
    await installSuperAdminConsoleMocks(page);
    const calls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/functions/v1/')) calls.push(request.url());
    });

    await page.goto('/admin/orgs/kame-homes');
    await expect(page.getByRole('heading', { name: 'Kame Space', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Team members').first()).toBeVisible();

    // Below-the-fold sections render a deferred placeholder instead of mounting, so
    // their queries are never issued until the operator scrolls near them.
    const activitySection = page.locator('#section-activity');
    await expect(activitySection.locator('[data-section-deferred]')).toBeVisible();

    const activityCalls = () => calls.filter((url) => url.includes('list-super-admin-audit'));
    expect(activityCalls()).toHaveLength(0);

    await activitySection.scrollIntoViewIfNeeded();
    await expect(activitySection.locator('[data-section-deferred]')).toHaveCount(0);
    await expect.poll(activityCalls, { timeout: 10_000 }).not.toHaveLength(0);
  });

  test('support ticket detail changes status through the admin endpoint', async ({ page }) => {
    let statusBody: Record<string, unknown> | null = null;
    await installSuperAdminConsoleMocks(page, {
      onTicketStatus: (body) => {
        statusBody = body;
      },
    });
    await page.goto('/admin/support');

    await page.getByText('Calendar shows a blocked date twice').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Calendar shows a blocked date twice')).toBeVisible({
      timeout: 20_000,
    });

    await dialog.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'In progress' }).click();

    await expect.poll(() => statusBody).not.toBeNull();
    expect(statusBody).toMatchObject({ status: 'in_progress' });
  });

  test('rate limits only allow a block once the identity is valid', async ({ page }) => {
    let blockBody: Record<string, unknown> | null = null;
    await installSuperAdminConsoleMocks(page, {
      onBlockIdentity: (body) => {
        blockBody = body;
      },
    });
    await page.goto('/admin/rate-limits');

    const block = page.getByRole('button', { name: 'Block', exact: true });
    await expect(block).toBeDisabled();

    const identity = page.getByRole('textbox', { name: 'User id or IP address to block' });
    await identity.fill('user-123');
    await expect(block).toBeEnabled();

    await block.click();
    await expect.poll(() => blockBody).not.toBeNull();
    expect(blockBody).toMatchObject({ action: 'block', identity: 'u:user-123' });
  });

  test('platform settings saves the maintenance message', async ({ page }) => {
    let saved: Record<string, unknown> | null = null;
    await installSuperAdminConsoleMocks(page, {
      onSettingsSave: (body) => {
        saved = body;
      },
    });
    await page.goto('/admin/platform-settings');

    const message = page.getByLabel('Maintenance message');
    await expect(message).toBeVisible({ timeout: 20_000 });
    await message.fill('Back at 4:00 AM Asia/Manila.');

    await page.locator('form').first().getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => saved).not.toBeNull();
    expect(saved).toMatchObject({ maintenanceMessage: 'Back at 4:00 AM Asia/Manila.' });
  });
});
