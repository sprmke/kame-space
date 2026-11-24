/**
 * Property Analytics — deterministic module coverage.
 *
 * The harness pins the period and the AI review to the current Asia/Manila month, so the
 * header control and the review card always agree. Every assertion runs against mocks; the
 * spec must pass without a local Supabase stack.
 */

import { expect, test } from '@playwright/test';

import {
  analyticsTourPaths,
  installAnalyticsMocks,
  openAnalytics,
  openAnalyticsTab,
  priorManilaMonthRange,
} from './shared/analyticsHarness';

function currentMonthLabel(): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date());
}

function currentYear(): string {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Manila' }).format(
    new Date()
  );
}

test.describe('@ci property analytics', () => {
  test('renders the four headline KPIs with period deltas', async ({ page }) => {
    await installAnalyticsMocks(page);
    await openAnalytics(page);

    const kpis = page.getByRole('region', { name: 'Key metrics' });
    await expect(kpis.getByText('Occupancy')).toBeVisible();
    await expect(kpis.getByText('Avg nightly rate')).toBeVisible();
    await expect(kpis.getByText('Revenue per night')).toBeVisible();
    await expect(kpis.getByText('Bookings', { exact: true })).toBeVisible();

    await expect(kpis.getByText('72%')).toBeVisible();
    await expect(kpis.getByText('₱3,480', { exact: true })).toBeVisible();
    await expect(kpis.getByText('₱2,506', { exact: true })).toBeVisible();
    await expect(kpis.getByText('18', { exact: true })).toBeVisible();

    await expect(kpis.getByText('+6 pts')).toBeVisible();
    await expect(kpis.getByText('+4.1%')).toBeVisible();
  });

  test('a flat month is neutral, not a green up arrow', async ({ page }) => {
    await installAnalyticsMocks(page, { zeroDeltas: true });
    await openAnalytics(page);

    const kpis = page.getByRole('region', { name: 'Key metrics' });
    await expect(kpis.locator('.lucide-minus')).toHaveCount(4);
    await expect(kpis.locator('.lucide-trending-up')).toHaveCount(0);
    await expect(kpis.getByText('0 pts')).toBeVisible();
  });

  test('overview shows guest, channel, visits, marketing and peer cards', async ({ page }) => {
    await installAnalyticsMocks(page);
    await openAnalytics(page);

    for (const title of [
      'Guest age',
      'Party size',
      'Guest origins',
      'Where bookings come from',
      'Listing visits',
      'Marketing results',
    ]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }

    await expect(
      page.getByText('At least 96 visits and 7 booking requests from planner posts.')
    ).toBeVisible();
    await expect(page.getByText('412', { exact: true })).toBeVisible();
  });

  test('booking-source donut carries a readable per-slice summary', async ({ page }) => {
    await installAnalyticsMocks(page);
    await openAnalytics(page);

    const donut = page.getByRole('img', { name: /Airbnb 50% \(9\)/ });
    await expect(donut).toBeVisible();
    await expect(donut).toHaveAttribute('aria-label', /Direct 22% \(4\)/);
    await expect(donut).toHaveAttribute('aria-label', /bookings: 18/);

    // The legend carries the same numbers, so the ring is readable without hovering.
    const sources = page.getByRole('region', { name: 'Booking sources' });
    await expect(sources.getByText('Airbnb', { exact: true })).toBeVisible();
    await expect(sources.getByText('9 · 50%')).toBeVisible();
    await expect(sources.getByText('Direct', { exact: true })).toBeVisible();
  });

  test('switching sections swaps content and marks the tab selected', async ({ page }) => {
    await installAnalyticsMocks(page);
    await openAnalytics(page);

    await page.getByRole('tab', { name: 'Trends' }).click();
    await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByText('New bookings')).toBeVisible();
    await expect(page.getByText('Where bookings come from')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Guests' }).click();
    await expect(page.getByText('Where bookings come from')).toBeVisible();
    await expect(page.getByText('New bookings')).toHaveCount(0);
  });

  test('the section lives in the URL and survives reload and Back', async ({ page }) => {
    await installAnalyticsMocks(page);
    await page.goto(`${analyticsTourPaths.analytics}?section=trends`);
    await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByText('New bookings')).toBeVisible();

    await page.getByRole('tab', { name: 'Guests' }).click();
    await expect(page).toHaveURL(/section=guests/);
    await expect(page.getByRole('tab', { name: 'Guests' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await page.reload();
    await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('section tabs expose a tabpanel and move with arrow keys', async ({ page }) => {
    await installAnalyticsMocks(page);
    await openAnalytics(page);

    const panel = page.getByRole('tabpanel');
    await expect(panel).toHaveAttribute('aria-labelledby', 'analytics-tab-overview');

    await page.getByRole('tab', { name: 'Overview' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'analytics-tab-trends'
    );

    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'AI review' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('choosing the year preset refetches the summary for that year', async ({ page }) => {
    const calls = await installAnalyticsMocks(page);
    await openAnalytics(page);

    await page
      .getByRole('button', { name: new RegExp(currentMonthLabel()) })
      .first()
      .click();
    await page.getByRole('button', { name: /^Year/ }).click();

    const year = currentYear();
    await expect(page).toHaveURL(new RegExp(`from=${year}-01-01`));
    await expect
      .poll(() => calls.summary.at(-1) ?? '', { timeout: 10_000 })
      .toBe(`${year}-01-01..${year}-12-31`);
  });

  test('bookings pace uses bars, and a single series hides the legend', async ({ page }) => {
    await installAnalyticsMocks(page, { noLastYear: true });
    await openAnalyticsTab(page, 'Trends');

    await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
    await expect(page.locator('.recharts-area-area')).toHaveCount(0);
    await expect(page.getByText('Last year')).toHaveCount(0);
    await expect(page.getByText('This period')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Revenue', exact: true }).click();
    await expect(page.locator('.recharts-area-area').first()).toBeVisible();
  });

  test('trends renders booking pace, lead time and response bars', async ({ page }) => {
    await installAnalyticsMocks(page);
    await openAnalyticsTab(page, 'Trends');

    await expect(page.getByText('New bookings')).toBeVisible();
    await expect(page.getByText('This period')).toBeVisible();
    await expect(page.getByText('Booked this far ahead')).toBeVisible();
    await expect(page.getByText('8-14 days')).toBeVisible();
    await expect(page.getByText('Nights per stay')).toBeVisible();
    await expect(page.getByText('2-3 nights')).toBeVisible();
    await expect(page.getByText('Reviews & response')).toBeVisible();
    await expect(page.getByText('Cancellation')).toBeVisible();
    await expect(page.getByText('96%')).toBeVisible();

    // The visible labels are capitalised in CSS; the accessible names stay lowercase.
    await page.getByRole('tab', { name: 'Revenue', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Revenue', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('AI review shows the current-period review with playbook tips', async ({ page }) => {
    await installAnalyticsMocks(page);
    await openAnalyticsTab(page, 'AI review');

    await expect(page.getByText('AI Performance Review')).toBeVisible();
    await expect(
      page.getByText('Rate is holding. Two unpaid balances need attention before the weekend.')
    ).toBeVisible();
    await expect(page.getByText('Working', { exact: true })).toBeVisible();
    await expect(page.getByText('Improve', { exact: true })).toBeVisible();
    await expect(page.getByText('Avoid', { exact: true })).toBeVisible();
    await expect(page.getByText('Collect the two unpaid balances')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Go to Pricing & availability' }).first()
    ).toBeVisible();
    await expect(page.getByText('Improvement Playbook')).toBeVisible();
  });

  test('refresh posts once and confirms with a toast', async ({ page }) => {
    const calls = await installAnalyticsMocks(page);
    await openAnalyticsTab(page, 'AI review');

    await page.getByRole('button', { name: 'Refresh AI review for this month' }).click();

    await expect(page.getByText('Review updated')).toBeVisible();
    expect(calls.aiReviewPosts).toBe(1);
  });

  test('a prior period shows the current-period-only state', async ({ page }) => {
    await installAnalyticsMocks(page);
    const prior = priorManilaMonthRange();
    await page.goto(`${analyticsTourPaths.analytics}?from=${prior.from}&to=${prior.to}`);
    await page.getByRole('tab', { name: 'AI review' }).click();

    await expect(page.getByText('Current period only')).toBeVisible();
    await expect(page.getByText('Pick this week, this month, or this year.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Analyze this|Refresh AI review/ })).toHaveCount(
      0
    );
  });

  test('sparse history keeps the full layout and honest empty bodies', async ({ page }) => {
    await installAnalyticsMocks(page, { empty: true, sampleSize: 5, aiReview: 'none' });
    await openAnalytics(page);

    // The dashboard is preview-open: no "not enough history" page gate.
    await expect(page.getByRole('tab', { name: 'AI review' })).toBeVisible();
    await expect(page.getByText('Not enough booking history yet')).toHaveCount(0);

    await expect(page.getByText('No age data for this range yet')).toBeVisible();
    await expect(page.getByText('No bookings in this period')).toBeVisible();
    await expect(page.getByText('No page views in this period')).toBeVisible();
    await expect(page.getByText('No tracked planner visits in this period.')).toBeVisible();

    await page.getByRole('tab', { name: 'AI review' }).click();
    await expect(page.getByText('No review for this month')).toBeVisible();
    await expect(page.getByText('Need 10 bookings before AI review.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Analyze this/ })).toBeDisabled();
  });

  test('exporting downloads a period-named PDF', async ({ page }) => {
    await installAnalyticsMocks(page);
    await openAnalytics(page);

    // Font embedding is the slow part of the client-side PDF; give a cold machine room.
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: 'Export PDF' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /^kame-analytics_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.pdf$/
    );
    await expect(page.getByText('PDF downloaded')).toBeVisible();
  });

  test('view-only members can read the page but cannot export or refresh', async ({ page }) => {
    await installAnalyticsMocks(page, { template: 'read_only' });
    await openAnalytics(page);

    await expect(page.getByRole('region', { name: 'Key metrics' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export PDF' })).toHaveCount(0);

    await page.getByRole('tab', { name: 'AI review' }).click();
    await expect(
      page.getByText('Rate is holding. Two unpaid balances need attention before the weekend.')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Analyze this|Refresh AI review/ })).toHaveCount(
      0
    );
  });

  test('free plan sends Export to the upgrade dialog', async ({ page }) => {
    await installAnalyticsMocks(page, { freePlan: true });
    await openAnalytics(page);

    await page.getByRole('button', { name: 'Export PDF' }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: /^Upgrade to / });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Upgrade to Pro');
  });

  test('AI review feature switch replaces the card with an unavailable panel', async ({ page }) => {
    await installAnalyticsMocks(page, { aiReviewUnavailable: true });
    await openAnalyticsTab(page, 'AI review');

    await expect(
      page
        .getByText('AI review is paused while we tune it. Your last review stays available.')
        .first()
    ).toBeVisible();
    await expect(page.getByText('AI Performance Review')).toHaveCount(0);
  });
});

test.describe('@ci property analytics on phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the fourth tab is reachable and the period control opens a sheet', async ({ page }) => {
    await installAnalyticsMocks(page);
    await openAnalytics(page);

    // The tab strip overflows at 375; selecting the last tab must scroll it fully into view.
    const list = page.getByRole('tablist').first();
    expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.getByRole('tab', { name: 'AI review' }).click();
    await expect(page.getByRole('tab', { name: 'AI review' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    const listBox = await list.boundingBox();
    const tabBox = await page.getByRole('tab', { name: 'AI review' }).boundingBox();
    expect(listBox).not.toBeNull();
    expect(tabBox).not.toBeNull();
    if (listBox && tabBox) {
      expect(tabBox.x + tabBox.width).toBeLessThanOrEqual(listBox.x + listBox.width + 1);
    }
    await expect(page.getByText('AI Performance Review')).toBeVisible();

    await page
      .getByRole('button', { name: new RegExp(currentMonthLabel()) })
      .first()
      .click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByLabel('View by')).toBeVisible();
    await expect(sheet.getByRole('option', { name: /Month/ })).toBeVisible();
  });
});

test.describe('@ci property analytics on a 1024 laptop', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('KPI money stays whole and is not ellipsized', async ({ page }) => {
    await installAnalyticsMocks(page);
    await openAnalytics(page);

    const kpis = page.getByRole('region', { name: 'Key metrics' });
    await expect(kpis.getByText('₱3,480', { exact: true })).toBeVisible();
    await expect(kpis.getByText('₱2,506', { exact: true })).toBeVisible();
    await expect(kpis.getByText('₱3,480.00', { exact: true })).toHaveCount(0);

    const values = await kpis.locator('p').allInnerTexts();
    expect(values.some((text) => text.includes('...'))).toBe(false);
  });
});
