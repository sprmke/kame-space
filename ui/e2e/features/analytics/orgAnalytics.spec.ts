/**
 * Org Analytics — portfolio KPIs, the listings list, search, export and role/plan gates.
 * Runs against the deterministic org harness, so no database or edge function is needed.
 */

import { expect, test } from '@playwright/test';

import { installOrgAnalyticsMocks, openOrgAnalytics } from './shared/orgAnalyticsHarness';

test.describe('@ci org analytics', () => {
  test('renders portfolio KPIs and both listings', async ({ page }) => {
    await installOrgAnalyticsMocks(page);
    await openOrgAnalytics(page);

    const kpis = page.getByRole('region', { name: 'Portfolio metrics' });
    await expect(kpis.getByText('₱46,200', { exact: true })).toBeVisible();
    await expect(kpis.getByText('12', { exact: true })).toBeVisible();
    await expect(kpis.getByText('40%', { exact: true })).toBeVisible();
    await expect(kpis.getByText('of 2 listings')).toBeVisible();

    await expect(page.getByText('Monaco 2604', { exact: true })).toBeVisible();
    await expect(page.getByText('Azure Monaco - Level 2 - Slot 27')).toBeVisible();
    await expect(page.getByText('₱42,000', { exact: true })).toBeVisible();
    await expect(page.getByText('₱4,200', { exact: true })).toBeVisible();
    await expect(page.getByText('On track')).toHaveCount(2);
  });

  test('search filters the listings and explains an empty result', async ({ page }) => {
    await installOrgAnalyticsMocks(page);
    await openOrgAnalytics(page);

    const search = page.getByRole('searchbox', { name: 'Search listings' });
    await search.fill('Azure');
    await expect(page.getByText('Azure Monaco - Level 2 - Slot 27')).toBeVisible();
    await expect(page.getByText('Monaco 2604', { exact: true })).toHaveCount(0);

    await search.fill('zzzz');
    await expect(page.getByText('No listings match your filters')).toBeVisible();

    await search.fill('');
    await expect(page.getByText('Monaco 2604', { exact: true })).toBeVisible();
  });

  test('exports the portfolio as CSV', async ({ page }) => {
    await installOrgAnalyticsMocks(page);
    await openOrgAnalytics(page);

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^portfolio-analytics-.+\.csv$/);
  });

  test('free plan sends Export CSV to the upgrade dialog', async ({ page }) => {
    await installOrgAnalyticsMocks(page, { freePlan: true });
    await openOrgAnalytics(page);

    await page.getByRole('button', { name: 'Export CSV' }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: /^Upgrade to / });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Upgrade to Pro');
  });

  test('view-only members can read the portfolio but cannot export', async ({ page }) => {
    await installOrgAnalyticsMocks(page, { template: 'read_only' });
    await openOrgAnalytics(page);

    await expect(page.getByRole('region', { name: 'Portfolio metrics' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toHaveCount(0);
    await expect(page.getByText('Monaco 2604', { exact: true })).toBeVisible();
  });

  test('an org with no listings states it plainly', async ({ page }) => {
    await installOrgAnalyticsMocks(page, { empty: true });
    await openOrgAnalytics(page);

    await expect(page.getByText('No listings yet')).toBeVisible();
    const kpis = page.getByRole('region', { name: 'Portfolio metrics' });
    await expect(kpis.getByText('₱0', { exact: true })).toBeVisible();
  });
});

test.describe('@ci org analytics at 1024', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('rows stack and the portfolio money is not ellipsized', async ({ page }) => {
    await installOrgAnalyticsMocks(page);
    await openOrgAnalytics(page);

    // The seven-column table is not offered below xl; the stacked list carries the metrics.
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByText('Occupancy', { exact: true }).first()).toBeVisible();

    const kpis = page.getByRole('region', { name: 'Portfolio metrics' });
    await expect(kpis.getByText('₱46,200', { exact: true })).toBeVisible();
    const texts = await kpis.locator('p').allInnerTexts();
    expect(texts.some((text) => text.includes('...'))).toBe(false);

    await expect(page.getByText('Monaco 2604', { exact: true })).toBeVisible();
  });
});

test.describe('@ci org analytics at 1280', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a large revenue change stays readable in the row', async ({ page }) => {
    await installOrgAnalyticsMocks(page);
    await openOrgAnalytics(page);

    await expect(page.getByText('₱4,200', { exact: true })).toBeVisible();
    await expect(page.getByText('+500.0%', { exact: true })).toBeVisible();

    const cell = page.getByText('+500.0%', { exact: true });
    const box = await cell.boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.width).toBeGreaterThan(20);
  });
});
