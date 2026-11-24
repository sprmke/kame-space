import { expect, test } from '@playwright/test';

import {
  demoPause,
  installTemplatesReviewMocks,
  openTemplates,
  TEMPLATES_E2E_PATH,
} from './shared/templatesHarness';

/**
 * Slow-motion walkthrough of the property Templates module. @demo — headed, never CI.
 *
 *   bun run test:e2e:templates:tour:video
 *
 * One scenario per flow so each recorded video stands on its own. Videos land in
 * `test-results/playwright/<scenario>/video.webm`.
 */

test.describe('templates tour @demo', () => {
  // A wrong selector must fail loudly instead of waiting out the whole test budget.
  test.use({ viewport: { width: 1440, height: 960 }, actionTimeout: 5_000 });

  test('01 library, search, filter and organise', async ({ page }) => {
    test.setTimeout(240_000);
    await installTemplatesReviewMocks(page);
    await openTemplates(page);
    await demoPause(page, 1.6);

    const rail = page.getByRole('complementary', { name: 'Templates' });

    // Walk the groups so each one gets screen time.
    for (const group of [
      'Stay guide',
      'Guest messages',
      'Guest emails',
      'Building admin',
      'Team alerts',
      'Arrival pack',
      'Upsells',
      'Archive',
      'Custom',
    ]) {
      const heading = rail.getByText(group, { exact: true }).first();
      if ((await heading.count()) === 0) continue;
      await heading.scrollIntoViewIfNeeded();
      await demoPause(page, 0.5);
    }

    // Open a guide section, then an automated email.
    await rail.getByRole('button', { name: /^House rules/ }).click();
    await demoPause(page, 1.2);
    await rail.getByRole('button', { name: /^Booking confirmation/ }).click();
    await demoPause(page, 1.2);

    // Preview an email.
    const pane = page.getByRole('region', { name: 'Template editor' });
    await pane.getByRole('tab', { name: 'Preview' }).click();
    await expect(pane.locator('iframe')).toBeVisible();
    await demoPause(page, 1.6);
    await pane.getByRole('tab', { name: 'Edit' }).click();
    await demoPause(page, 0.6);

    // Search.
    const search = page.getByRole('searchbox', { name: 'Search templates' });
    await search.fill('check');
    await demoPause(page, 1);
    await search.fill('zzzz');
    await demoPause(page, 0.8);
    await page.getByRole('button', { name: 'Clear search' }).first().click();
    await demoPause(page, 0.6);

    // Type filter.
    await page.getByRole('button', { name: 'Filter template type' }).click();
    await demoPause(page, 0.6);
    await page.getByRole('option', { name: 'Custom', exact: true }).click();
    await demoPause(page, 1);
    await page.getByRole('button', { name: 'Filter template type' }).click();
    await page.getByRole('option', { name: 'All types', exact: true }).click();
    await demoPause(page, 0.6);

    // Organise a host-owned template.
    await rail.getByRole('button', { name: /^Airport transfer/ }).hover();
    await demoPause(page, 0.5);
    await rail.getByRole('button', { name: 'Template actions for Airport transfer' }).click();
    await demoPause(page, 0.9);
    await page.getByRole('menuitem', { name: 'Move' }).click();
    await demoPause(page, 1);
    await page.getByRole('button', { name: 'Upsells' }).click();
    await demoPause(page, 1);
  });

  test('02 edit, unsaved guard, verify and save', async ({ page }) => {
    test.setTimeout(240_000);
    await installTemplatesReviewMocks(page);
    await openTemplates(page);
    await demoPause(page, 1.2);

    const pane = page.getByRole('region', { name: 'Template editor' });
    const rail = page.getByRole('complementary', { name: 'Templates' });

    // Toggle guest visibility, then leave without saving.
    await pane.getByRole('switch', { name: 'Show to guests' }).click();
    await demoPause(page, 1);
    await expect(pane.getByText('Unsaved')).toBeVisible();
    await rail.getByRole('button', { name: /^Booking confirmation/ }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await demoPause(page, 1.4);
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await demoPause(page, 1);

    // Edit the subject and start the verified save.
    await pane.getByLabel('Subject', { exact: true }).fill('Your confirmed stay at Solea Mactan');
    await demoPause(page, 0.8);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await demoPause(page, 2);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.8);

    // Reset a built-in section.
    await rail.getByRole('button', { name: /^Using the unit/ }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await demoPause(page, 1);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await demoPause(page, 1.4);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await demoPause(page, 0.6);
  });

  test('03 create a custom template and send it to a guest', async ({ page }) => {
    test.setTimeout(240_000);
    const state = await installTemplatesReviewMocks(page);
    await openTemplates(page);
    await demoPause(page, 1.2);

    const rail = page.getByRole('complementary', { name: 'Templates' });

    // Create flow.
    await page.getByRole('button', { name: 'New template' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await demoPause(page, 1.4);
    const createDialog = page.getByRole('dialog');
    await createDialog.getByLabel('Name', { exact: true }).fill('Early check-in offer');
    await demoPause(page, 0.6);
    await createDialog.getByLabel('Group', { exact: true }).click();
    await demoPause(page, 0.8);
    await page.getByRole('option', { name: 'Upsells' }).click();
    await demoPause(page, 0.6);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await demoPause(page, 1.8);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);
    // Verification cancelled on purpose; reload so the create draft does not block the tour.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 0.8);

    // Send a saved custom template to a guest.
    await rail.getByRole('button', { name: /^Arrival instructions/ }).click();
    const pane = page.getByRole('region', { name: 'Template editor' });
    await expect(pane.getByRole('heading', { name: 'Arrival instructions' })).toBeVisible();
    await demoPause(page, 1);
    await pane.getByRole('button', { name: 'Actions for Arrival instructions' }).click();
    await demoPause(page, 0.9);
    await page.getByRole('menuitem', { name: 'Send to guest' }).click();
    await demoPause(page, 1.6);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);

    expect(state.requests.length).toBeGreaterThanOrEqual(0);
  });

  test('04 phone: list, editor and preview', async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
      storageState: './ui/e2e/shared/consentStorageState.json',
      timezoneId: 'Asia/Manila',
      locale: 'en-PH',
      // `test.use({ video })` does not reach a manually created context.
      ...(process.env.PLAYWRIGHT_RECORD_VIDEO === '1'
        ? { recordVideo: { dir: 'test-results/templates-ux-tour/phone-video' } }
        : {}),
    });
    const page = await context.newPage();
    await installTemplatesReviewMocks(page);
    await page.goto(TEMPLATES_E2E_PATH);
    await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 1.4);

    // Scroll the list.
    const rail = page.getByRole('complementary', { name: 'Templates' });
    await rail.getByText('GUEST MESSAGES', { exact: false }).first().scrollIntoViewIfNeeded();
    await demoPause(page, 1);
    await rail.getByText('Custom', { exact: true }).first().scrollIntoViewIfNeeded();
    await demoPause(page, 1);

    // Filter sheet.
    await page.getByRole('button', { name: 'Filter template type' }).click();
    await demoPause(page, 1);
    await page.getByRole('option', { name: 'All types', exact: true }).click();
    await demoPause(page, 0.8);

    // Hero actions.
    await page.getByRole('button', { name: 'Template actions', exact: true }).click();
    await demoPause(page, 1.2);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.8);

    // Open an editor, then preview.
    await page.getByRole('searchbox', { name: 'Search templates' }).fill('airport');
    await demoPause(page, 0.8);
    await rail.getByRole('button', { name: /^Airport transfer/ }).click();
    const pane = page.getByRole('region', { name: 'Template editor' });
    await expect(pane.getByRole('heading', { name: 'Airport transfer' })).toBeVisible();
    await demoPause(page, 1.4);
    await pane.getByRole('tab', { name: 'Preview' }).click();
    await expect(pane.locator('iframe')).toBeVisible();
    await demoPause(page, 2);
    await pane.getByRole('button', { name: 'All templates' }).click();
    await demoPause(page, 1);
    await context.close();
  });
});
