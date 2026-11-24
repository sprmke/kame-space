import { expect, test, type Browser, type Page } from '@playwright/test';

import {
  installTemplatesReviewMocks,
  openTemplates,
  TEMPLATES_E2E_PATH,
} from './shared/templatesHarness';

/**
 * Property Templates: the behaviours the UX review changed.
 *
 * The workbench contract lives in `propertyTemplatesWorkbench.spec.ts`; this file guards the
 * decisions made in `docs/workflow/in-progress/templates-ux-review/README.md`.
 */

async function phonePage(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    storageState: './ui/e2e/shared/consentStorageState.json',
    timezoneId: 'Asia/Manila',
    locale: 'en-PH',
  });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

test.describe('@ci templates review decisions', () => {
  test('read-only member gets a preview-only pane with no editable body', async ({ page }) => {
    await installTemplatesReviewMocks(page, { readOnly: true });
    await openTemplates(page);

    const pane = page.getByRole('region', { name: 'Template editor' });
    await expect(pane.getByRole('heading', { name: 'Welcome note' })).toBeVisible();
    await expect(pane.getByRole('tab', { name: 'Edit' })).toHaveCount(0);
    await expect(pane.locator('[contenteditable="true"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New template' })).toHaveCount(0);
  });

  test('new template defaults to Custom and the group stays selectable', async ({ page }) => {
    await installTemplatesReviewMocks(page);
    await openTemplates(page);

    await page.getByRole('button', { name: 'New template' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Group', { exact: true })).toContainText('Custom');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);

    // Adding from a built-in section still preselects that section.
    const rail = page.getByRole('complementary', { name: 'Templates' });
    await rail.getByRole('button', { name: 'Group actions for Stay guide' }).click();
    await page.getByRole('menuitem', { name: 'Add template' }).click();
    await expect(dialog.getByLabel('Group', { exact: true })).toContainText('Stay guide');
  });

  test('a folder template can move back to Custom', async ({ page }) => {
    await installTemplatesReviewMocks(page);
    await openTemplates(page);

    const rail = page.getByRole('complementary', { name: 'Templates' });
    await rail.getByRole('button', { name: /^Arrival instructions/ }).hover();
    await rail.getByRole('button', { name: 'Template actions for Arrival instructions' }).click();
    await page.getByRole('menuitem', { name: 'Move' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Custom', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Arrival pack' })).toBeVisible();
  });

  test('group and template menus are distinguishable by name', async ({ page }) => {
    await installTemplatesReviewMocks(page);
    await openTemplates(page);

    const rail = page.getByRole('complementary', { name: 'Templates' });
    await expect(rail.getByRole('button', { name: 'Group actions for Arrival pack' })).toBeVisible();
    await expect(
      rail.getByRole('button', { name: 'Template actions for Arrival instructions' })
    ).toBeVisible();
  });

  test('the send dialog names the guest address and confirms the choice', async ({ page }) => {
    await installTemplatesReviewMocks(page);
    await openTemplates(page);

    const rail = page.getByRole('complementary', { name: 'Templates' });
    await rail.getByRole('button', { name: /^Arrival instructions/ }).click();
    const pane = page.getByRole('region', { name: 'Template editor' });
    await pane.getByRole('button', { name: 'Actions for Arrival instructions' }).click();
    await page.getByRole('menuitem', { name: 'Send to guest' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('jane.guest@example.com')).toBeVisible();
    await dialog.getByRole('option').first().click();
    await expect(dialog.getByText('Selected')).toBeAttached();
  });

  test('empty library is an empty state, not an error', async ({ page }) => {
    await installTemplatesReviewMocks(page, { emptyLibrary: true });
    await openTemplates(page);

    await expect(page.getByText('No templates yet').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add template' })).toBeVisible();
  });

  test('phone list clears the floating hub and preview sits above the dock', async ({ browser }) => {
    const { page, close } = await phonePage(browser);
    await installTemplatesReviewMocks(page);
    await page.goto(TEMPLATES_E2E_PATH);
    await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    const rail = page.getByRole('complementary', { name: 'Templates' });
    await expect(rail).toBeVisible();
    await expect(page.locator('[data-template-rail-scroll]')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const scrollport = document.querySelector<HTMLElement>('[data-template-rail-scroll]');
      const hub = document.querySelector<HTMLElement>('.admin-quick-access-hub');
      const dock = document.querySelector<HTMLElement>('.mobile-bottom-bar');
      return {
        railPaddingBottom: scrollport
          ? Number.parseFloat(getComputedStyle(scrollport).paddingBottom)
          : 0,
        hubHeight: hub ? hub.getBoundingClientRect().height : 0,
        dockVisible: Boolean(dock),
      };
    });
    expect(geometry.dockVisible).toBe(true);
    expect(geometry.railPaddingBottom).toBeGreaterThanOrEqual(geometry.hubHeight + 8);

    // Open a template and check the preview iframe never runs under the dock.
    await page.getByRole('searchbox', { name: 'Search templates' }).fill('airport');
    await rail.getByRole('button', { name: /^Airport transfer/ }).click();
    const pane = page.getByRole('region', { name: 'Template editor' });
    await pane.getByRole('tab', { name: 'Preview' }).click();
    await expect(pane.locator('iframe')).toBeVisible();

    const overlap = await page.evaluate(() => {
      const iframe = document.querySelector<HTMLElement>('[aria-label="Template editor"] iframe');
      const dock = document.querySelector<HTMLElement>('.mobile-bottom-bar');
      if (!iframe || !dock) return null;
      return {
        iframeBottom: Math.round(iframe.getBoundingClientRect().bottom),
        dockTop: Math.round(dock.getBoundingClientRect().top),
      };
    });
    expect(overlap).not.toBeNull();
    expect(overlap!.iframeBottom).toBeLessThanOrEqual(overlap!.dockTop + 1);

    await close();
  });
});
