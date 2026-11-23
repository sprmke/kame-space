import { expect, test, type Page } from '@playwright/test';

import { demoPause, demoScroll, financePath, installFinanceMocks } from './shared/financeHarness';

/**
 * Finance module — slow-motion visual tour.
 *
 * Every step holds long enough for a person to read the screen, so this runs headed with
 * video. It walks the same flows the mocked module suite asserts, in the order a host would use them.
 *
 *   bun run test:e2e:finance:tour        # headed, no recording
 *   bun run test:e2e:finance:tour:video  # headed + .webm under test-results/playwright
 *
 * Nothing here is a CI gate: the tag is `@demo`.
 */

test.describe.configure({ mode: 'serial', timeout: 300_000 });

async function openFinance(page: Page, extra = '') {
  await page.goto(financePath(extra));
  await expect(page.getByRole('heading', { name: 'Finance', exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
  await demoPause(page);
}

/** Close a wizard, answering the unsaved-changes guard only when it appears. */
async function closeWizard(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await demoPause(page, 1.2);
  const discard = page.getByRole('button', { name: 'Discard' });
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
  }
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
  await demoPause(page);
}

async function walkWizardToPreview(page: Page) {
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('e.g. Monthly rent').fill('Building insurance');
  await demoPause(page, 0.5);
  await dialog.locator('input[type="number"]').fill('1250');
  await demoPause(page, 0.5);
  await dialog.getByRole('combobox', { name: 'Category' }).click();
  await demoPause(page, 0.5);
  await dialog.getByRole('option', { name: 'Rent', exact: true }).click();
  await demoPause(page, 0.5);

  await dialog.getByRole('button', { name: 'Next' }).click();
  await demoPause(page);
  await dialog.getByRole('button', { name: 'Next' }).click();
  await demoPause(page);
  await dialog.getByRole('button', { name: 'Next' }).click();
  await demoPause(page);
  return dialog;
}

test.describe('finance tour — reporting shell @demo', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('overview: KPIs, charts, ledger, period picker, filters', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page, 'view=table');

    // 1. Hero, summary cards and both charts.
    await demoPause(page, 1.5);
    await page.getByRole('button', { name: 'About Net Profit' }).hover();
    await demoPause(page, 1.5);

    // 2. Slow scroll through the whole reporting surface and back.
    await demoScroll(page, 'main', { steps: 5 });
    await demoPause(page);

    // 3. Period presets.
    await page.getByRole('button', { name: /March 2026/ }).click();
    await demoPause(page, 2);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.5);

    // 4. Status filter and the nested filter popover.
    await page.getByRole('button', { name: 'All Status' }).click();
    await demoPause(page, 1.2);
    await page.getByRole('option', { name: 'Pending' }).click();
    await demoPause(page, 2);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.5);

    // 5. Search narrows the ledger, then clears.
    const search = page.getByRole('searchbox', { name: 'Search transactions' }).first();
    await search.fill('no such transaction');
    await demoPause(page, 1.5);
    await expect(page.getByText('No transactions found')).toBeVisible();
    await demoPause(page);
    await page.getByRole('button', { name: 'Clear search' }).first().click();
    await demoPause(page);
  });

  test('ledger views: card, calendar with day detail, stay breakdown', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page, 'view=table');

    await page.getByRole('button', { name: /Choose ledger view/ }).click();
    await demoPause(page, 1.2);
    await page.getByRole('option', { name: 'Card' }).click();
    await demoPause(page, 1.5);
    await demoScroll(page, 'main', { steps: 3 });
    await demoPause(page);

    await page.getByRole('button', { name: /Choose ledger view/ }).click();
    await page.getByRole('option', { name: 'Calendar' }).click();
    await demoPause(page, 1.5);
    await page.getByRole('button', { name: /^March 1, 2026/ }).click();
    await demoPause(page, 2);

    await page.getByRole('button', { name: 'Open stay details' }).first().click();
    await demoPause(page, 2);
    await page.getByRole('dialog').getByRole('button', { name: /close/i }).click();
    await demoPause(page);
  });

  test('transaction lifecycle: create, edit, delete', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page);

    // Create
    await page.getByRole('button', { name: 'Add transaction' }).click();
    await demoPause(page, 1.5);
    const dialog = await walkWizardToPreview(page);
    await dialog.getByRole('button', { name: 'Add transaction' }).click();
    await expect(page.getByText('Transaction saved')).toBeVisible();
    await demoPause(page, 1.8);

    // Edit
    await page
      .locator('tbody tr', { hasText: 'Electricity bill' })
      .getByRole('button', { name: 'Edit transaction' })
      .click();
    await demoPause(page, 1.5);
    await dialog.getByRole('button', { name: 'Next' }).click();
    await demoPause(page, 1.2);
    await dialog.getByRole('button', { name: 'Next' }).click();
    await demoPause(page, 1.5);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Transaction updated')).toBeVisible();
    await demoPause(page, 1.5);

    // Delete
    await page
      .locator('tbody tr', { hasText: 'Electricity bill' })
      .getByRole('button', { name: 'Delete transaction' })
      .click();
    await demoPause(page, 1.8);
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Transaction deleted')).toBeVisible();
    await demoPause(page, 1.5);
  });

  test('recurring series: open occurrences, edit scope, delete scope', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page, 'view=table');

    await page
      .locator('tbody tr', { hasText: 'Internet plan' })
      .getByRole('button', { name: 'View recurring series' })
      .click();
    await demoPause(page, 2);
    await page.getByRole('dialog').getByRole('button', { name: /close/i }).click();
    await demoPause(page);

    await page
      .locator('tbody tr', { hasText: 'Internet plan' })
      .getByRole('button', { name: 'Edit transaction' })
      .click();
    await demoPause(page, 1.5);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await demoPause(page, 2);
    await closeWizard(page);

    await page
      .locator('tbody tr', { hasText: 'Internet plan' })
      .getByRole('button', { name: 'Delete transaction' })
      .click();
    await demoPause(page, 2);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await demoPause(page);
  });

  test('export menu lists the report sections', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page);

    await page.getByRole('button', { name: 'Export report' }).click();
    await demoPause(page, 2);
    await page.keyboard.press('Escape');
    await demoPause(page);
  });
});

test.describe('finance tour — phone @demo', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('phone: cards, refine sheet, item sheet, wizard, hero actions', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page);

    await demoPause(page, 1.5);
    await demoScroll(page, 'main', { steps: 4 });

    await page.getByRole('button', { name: 'Refine transactions' }).click();
    await demoPause(page, 1.8);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Refine' })).toBeHidden();
    await demoPause(page);

    await page
      .locator('button.admin-overflow-trigger[aria-label="Actions for Guest booking payment"]')
      .click();
    await demoPause(page, 1.8);
    await page.locator('[role="option"]', { hasText: 'Edit' }).click();
    await demoPause(page, 1.5);
    await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click();
    await demoPause(page, 1.2);
    await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click();
    await demoPause(page, 1.5);
    await closeWizard(page);

    await page.locator('button[aria-label="Finance actions"]:visible').first().click();
    await demoPause(page, 1.8);
  });
});
