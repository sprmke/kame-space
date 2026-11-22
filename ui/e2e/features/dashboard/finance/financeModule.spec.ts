import { expect, test, type Page } from '@playwright/test';

import { financePath, installFinanceMocks } from './shared/financeHarness';

/**
 * Finance module — the property money surface.
 *
 * Covers the reporting shell, the unified ledger (stays + operating transactions),
 * the four-step transaction wizard, recurring series, and the phone layout.
 * All money and booking data is mocked, so the assertions are about behavior, not seed.
 */

async function openFinance(page: Page, extra = '') {
  await page.goto(financePath(extra));
  await expect(page.getByRole('heading', { name: 'Finance', exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
}

test.describe('@ci finance module', () => {
  test('summary, charts, and both ledger sources render for the period', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page, 'view=table');

    // Period label in the header.
    await expect(page.getByText('March 2026')).toBeVisible();

    // KPI cards: 3,500 operating income + 5,000 completed + 7,000 pipeline.
    await expect(page.getByText('Net Profit')).toBeVisible();
    await expect(page.getByText(/15,500\.00/).first()).toBeVisible();
    await expect(page.getByText(/4,400\.00/).first()).toBeVisible();

    // Charts render; the cash-flow card has data (not the empty state).
    await expect(page.getByText('Cash flow')).toBeVisible();
    await expect(page.getByText('No cash flow in this period')).toHaveCount(0);
    await expect(page.getByText('Breakdown')).toBeVisible();

    // Unified ledger: a stay row and an operating transaction in the same table.
    await expect(page.getByRole('cell', { name: /Maria Santos: Stay/ }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Electricity bill' }).first()).toBeVisible();
  });

  test('period comparison deltas are labelled against the previous period', async ({ page }) => {
    const calls = await installFinanceMocks(page);
    await openFinance(page);

    await expect(page.getByText('+55.0%')).toBeVisible();
    await expect(page.getByText('vs last period').first()).toBeVisible();
    // Current and previous summaries were both requested for the period.
    expect(calls.summaryRequests.length).toBeGreaterThanOrEqual(2);
  });

  test('type and status filters narrow the ledger without losing the header', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page, 'view=table');

    // Filters popover → Type = Income.
    await page.getByRole('button', { name: 'More transaction filters' }).click();
    await page.getByRole('button', { name: 'All Types' }).click();
    await page.getByRole('option', { name: 'Income' }).click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await expect(page.getByRole('cell', { name: 'Guest booking payment' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Electricity bill' })).toHaveCount(0);
    await expect(page.getByText('Net Profit')).toBeVisible();
  });

  test('search filters the ledger and shows an explicit empty state', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page, 'view=table');

    const search = page.getByRole('searchbox', { name: 'Search transactions' }).first();
    await search.fill('no such transaction');

    await expect(page.getByText('No transactions found')).toBeVisible();
    await expect(page.getByRole('cell', { name: /Maria Santos: Stay/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear search' }).first().click();
    await expect(page.getByRole('cell', { name: /Maria Santos: Stay/ }).first()).toBeVisible();
  });

  test('view menu switches to card and calendar, and a calendar day shows its entries', async ({
    page,
  }) => {
    await installFinanceMocks(page);
    await openFinance(page, 'view=table');

    await page.getByRole('button', { name: /Choose stays view/ }).click();
    await page.getByRole('option', { name: 'Calendar' }).click();

    await page.getByRole('button', { name: /^March 1, 2026/ }).click();
    await expect(page.getByText('SUNDAY, MARCH 1, 2026')).toBeVisible();
    await expect(page.getByText('Maria Santos: Stay')).toBeVisible();

    await page.getByRole('button', { name: /Choose stays view/ }).click();
    await page.getByRole('option', { name: 'Card' }).click();
    await expect(page.getByRole('button', { name: /Electricity bill/ }).first()).toBeVisible();
  });

  test('stay row opens the read-only finance breakdown', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page, 'view=table');

    await page.getByRole('button', { name: 'Open stay details' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Estimated breakdown')).toBeVisible();
    await expect(dialog.getByRole('link', { name: /Open booking/ })).toBeVisible();
    await dialog.getByRole('button', { name: /close/i }).click();
  });

  test('adds a one-off transaction through the four-step wizard', async ({ page }) => {
    const calls = await installFinanceMocks(page);
    await openFinance(page);

    await page.getByRole('button', { name: 'Add Transaction' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'New transaction' })).toBeVisible();

    await dialog.getByPlaceholder('e.g. Monthly rent').fill('Building insurance');
    await dialog.locator('input[type="number"]').fill('1250');
    await dialog.getByRole('combobox', { name: 'Category' }).click();
    await dialog.getByRole('option', { name: 'Rent', exact: true }).click();

    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByRole('heading', { name: 'Repeat' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByRole('heading', { name: 'Reminders' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByRole('heading', { name: 'Preview' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Add transaction' }).click();
    await expect(page.getByText('Transaction saved')).toBeVisible();
    expect(calls.lineItemPosts).toBe(1);
  });

  test('editing a one-off transaction skips the repeat step and saves', async ({ page }) => {
    const calls = await installFinanceMocks(page);
    await openFinance(page, 'view=table');

    await page
      .locator('tbody tr', { hasText: 'Electricity bill' })
      .getByRole('button', { name: 'Edit transaction' })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Edit transaction' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByRole('heading', { name: 'Reminders' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByRole('heading', { name: 'Activity' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Transaction updated')).toBeVisible();
    expect(calls.lineItemPatches).toBe(1);
  });

  test('deleting a transaction asks for confirmation first', async ({ page }) => {
    const calls = await installFinanceMocks(page);
    await openFinance(page, 'view=table');

    await page
      .locator('tbody tr', { hasText: 'Electricity bill' })
      .getByRole('button', { name: 'Delete transaction' })
      .click();
    const confirm = page.getByRole('dialog');
    await expect(confirm.getByText('Delete transaction')).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('Transaction deleted')).toBeVisible();
    expect(calls.lineItemDeletes).toBe(1);
  });

  test('recurring transaction opens its series with every occurrence', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page, 'view=table');

    await page
      .locator('tbody tr', { hasText: 'Internet plan' })
      .getByRole('button', { name: 'View recurring series' })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Internet plan' })).toBeVisible();
    await expect(dialog.getByText('3 total')).toBeVisible();
    await expect(dialog.getByText('Apr 10, 2026').first()).toBeVisible();
    await expect(dialog.getByText('May 10, 2026').first()).toBeVisible();
  });

  test('export menu offers the four report sections', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page);

    await page.getByRole('button', { name: 'Export report' }).click();
    for (const label of ['Full report', 'Overview summary', 'Stays ledger', 'Transactions']) {
      await expect(page.getByRole('menuitem', { name: label })).toBeVisible();
    }
  });
});

test.describe('@ci finance module mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('phone layout defaults to cards and keeps actions in the refine and item sheets', async ({
    page,
  }) => {
    await installFinanceMocks(page);
    await openFinance(page);

    // Cards are the phone default even when the URL asked for a table.
    await expect(page.getByText('Electricity bill').first()).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(0);

    // Refine sheet owns filters, sort and per-page.
    await page.getByRole('button', { name: 'Refine transactions' }).click();
    await expect(page.getByRole('heading', { name: 'Refine' })).toBeVisible();
    await expect(page.getByText('PER PAGE')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Refine' })).toBeHidden();

    // Per-item overflow sheet exposes edit and delete.
    await page
      .locator('button.admin-overflow-trigger[aria-label="Actions for Guest booking payment"]')
      .click();
    await expect(page.getByRole('heading', { name: 'Transaction' })).toBeVisible();
    await expect(page.locator('[role="option"]', { hasText: 'Edit' })).toBeVisible();
    await expect(page.locator('[role="option"]', { hasText: 'Delete' })).toBeVisible();
  });

  test('hero actions sheet carries add transaction and the report exports', async ({ page }) => {
    await installFinanceMocks(page);
    await openFinance(page);

    await page.getByRole('button', { name: 'Finance actions' }).click();
    await expect(page.getByRole('heading', { name: 'Finance actions' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Add transaction' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Full report' })).toBeVisible();
  });
});
