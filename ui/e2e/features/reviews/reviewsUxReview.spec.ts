import { expect, test, type Page } from '@playwright/test';

import { installReviewsUxMocks, reviewsPaths } from './shared/reviewsUxHarness';
import { expectNoPageHorizontalOverflow } from '../../shared/layoutAssertions';

/**
 * Org & Property Reviews — module regression suite.
 *
 * Covers the behaviours a future refactor is most likely to break: the two scopes read
 * the same component, so every assertion here is about the contract the route guide
 * promises (tabs, URL state, per-listing permissions, the sheets, and the empty/error
 * states) rather than about pixel layout.
 */

async function openReviews(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Reviews', level: 1 })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('@ci reviews module', () => {
  test('property feed, KPIs and detail sheet', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.property);

    // KPI cards read the summary block.
    await expect(page.getByText('Average rating')).toBeVisible();
    await expect(page.getByText('3.8')).toBeVisible();
    await expect(page.getByText('44%')).toBeVisible();

    // Five fixture rows, each with the guest name.
    await expect(page.getByRole('button', { name: /Maria Santos/ }).first()).toBeVisible();
    await expect(page.getByText('Kim Ha-neul')).toBeVisible();

    // Opening a row shows the full review plus the host-only note and the public response.
    await page
      .getByRole('button', { name: /Maria Santos/ })
      .first()
      .click();
    const sheet = page.getByRole('dialog', { name: /review$/ });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(sheet.getByText('Private note')).toBeVisible();
    await expect(sheet.getByText('Your response')).toBeVisible();
    await expect(sheet.getByText('Rating breakdown')).toBeVisible();
    await expect(sheet.getByRole('link', { name: /Open booking/ })).toBeVisible();
  });

  test('respond saves and refreshes the list', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.property);

    await page.getByRole('button', { name: 'Respond', exact: true }).first().click();
    const sheet = page.getByRole('dialog', { name: /Respond to/ });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await sheet.getByLabel('Public response').fill('Thank you for staying with us.');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Response saved')).toBeVisible({ timeout: 10_000 });
  });

  test('report needs a reason and 30 characters of detail', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.property);

    await page.locator('.admin-overflow-trigger').first().click();
    await page.getByRole('menuitem', { name: 'Report' }).click();
    const sheet = page.getByRole('dialog', { name: 'Report review' });
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    await sheet.getByRole('button', { name: 'Submit report' }).click();
    await expect(page.getByText('Pick a reason')).toBeVisible();

    await sheet.getByRole('button', { name: 'Not a real stay' }).click();
    await sheet.getByLabel('Details').fill('Too short');
    await sheet.getByRole('button', { name: 'Submit report' }).click();
    await expect(page.getByText('Add at least 30 characters of detail')).toBeVisible();

    await sheet
      .getByLabel('Details')
      .fill('The guest never checked in at this property and the booking was cancelled.');
    await sheet.getByRole('button', { name: 'Submit report' }).click();
    await expect(page.getByText('Report submitted')).toBeVisible({ timeout: 10_000 });
  });

  test('to write shows the window and opens the guest review sheet', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.propertyToWrite);

    await expect(page.getByText('2 days left')).toBeVisible();
    await expect(page.getByText('11 days left')).toBeVisible();

    await page
      .getByRole('button', { name: /Write review for/ })
      .first()
      .click();
    const sheet = page.getByRole('dialog', { name: /Review Josefina/ });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(sheet.getByText('Would host again')).toBeVisible();
    await expect(sheet.getByText('Team note (optional)')).toBeVisible();
  });

  test('about guests marks unpublished reviews', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.propertyWritten);

    // The table shows the short Yes / No badge; the long label lives in the sheet.
    await expect(page.getByText('Hidden until publish')).toBeVisible();
    await expect(page.getByRole('cell', { name: /No/ }).first()).toBeVisible();

    await page
      .getByRole('button', { name: /Andrei Popescu/ })
      .first()
      .click();
    const sheet = page.getByRole('dialog', { name: /Your review of Andrei Popescu/ });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(sheet.getByText('Would not host again')).toBeVisible();
  });

  test('the removed By property tab falls back to From guests', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.orgLegacyProperties);

    // Legacy bookmarks used `?tab=properties`; the three-tab layout lands on From guests.
    await expect(page.getByRole('tab', { name: /From guests/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByRole('tab', { name: /By property/ })).toHaveCount(0);
    await expect(page.getByText('Maria Santos').first()).toBeVisible();

    // The listing filter still narrows the feed to one property.
    await page.getByRole('button', { name: /All listings/ }).click();
    await page.getByRole('option', { name: 'Solea Mactan' }).click();
    await expect(page).toHaveURL(/properties=/);
  });

  test('list state lives in the URL', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(
      page,
      `${reviewsPaths.property}?q=maria&ratings=3&responded=no&sort=rating:asc`
    );

    await expect(page).toHaveURL(/q=maria/);
    await expect(page).toHaveURL(/ratings=3/);
    await expect(page).toHaveURL(/responded=no/);
    await expect(page.getByRole('searchbox', { name: 'Search reviews' })).toHaveValue('maria');
    await expect(page.getByRole('button', { name: /3 stars/ })).toBeVisible();

    // Switching tab keeps the scope controls out of the other tab's query.
    await page.getByRole('tab', { name: /To write/ }).click();
    await expect(page).toHaveURL(/tab=to_write/);
    await expect(page).not.toHaveURL(/ratings=3/);
  });

  test('view toggle switches table and card layouts', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.property);

    await expect(page.getByRole('table')).toBeVisible();
    await page.getByRole('button', { name: /Choose reviews view/ }).click();
    await page.getByRole('option', { name: 'Card' }).click();
    await expect(page).toHaveURL(/view=card/);
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('read only member cannot respond or write', async ({ page }) => {
    await installReviewsUxMocks(page, { readOnly: true });
    await openReviews(page, reviewsPaths.property);
    await expect(page.getByRole('button', { name: 'Respond', exact: true })).toHaveCount(0);

    await openReviews(page, reviewsPaths.propertyToWrite);
    await expect(page.getByRole('button', { name: /^Write review for/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Open booking for/ }).first()).toBeVisible();
  });

  test('auto-review sheet opens and guards unsaved changes', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.property);

    await page.getByRole('button', { name: 'Auto-review' }).first().click();
    const sheet = page.getByRole('dialog').filter({ hasText: 'Review guests automatically' });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled();

    await sheet.getByRole('button', { name: 'More days' }).click();
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled();
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Auto-review saved')).toBeVisible({ timeout: 10_000 });

    await sheet.getByRole('button', { name: 'More days' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText(/unsaved/i).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Discard' }).click();
  });

  test('error state recovers through Try again', async ({ page }) => {
    await installReviewsUxMocks(page, { failList: true });
    await openReviews(page, reviewsPaths.property);
    await expect(page.getByRole('alert')).toContainText('Reviews did not load');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('no horizontal overflow at any admin width', async ({ page }) => {
    // Eight full navigations (four widths x two scopes) do not fit the default 45s.
    test.setTimeout(120_000);
    await installReviewsUxMocks(page);
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await openReviews(page, reviewsPaths.property);
      await expectNoPageHorizontalOverflow(page);
      await openReviews(page, reviewsPaths.org);
      await expectNoPageHorizontalOverflow(page);
    }
  });
  test('laptop table keeps the review readable and the stay date', async ({ page }) => {
    await installReviewsUxMocks(page);
    await page.setViewportSize({ width: 1024, height: 800 });
    await openReviews(page, reviewsPaths.property);
    // The skeleton mirrors the table columns; measure the real rows.
    await expect(page.getByText('Maria Santos').first()).toBeVisible();

    const layout = await page.evaluate(() => {
      const table = document.querySelector('table');
      const headers = Array.from(table?.querySelectorAll('thead th') ?? []).map((th) => ({
        label: (th.textContent ?? '').trim(),
        width: Math.round(th.getBoundingClientRect().width),
      }));
      const excerpt = document.querySelector('table tbody tr td p.line-clamp-2');
      return {
        headers,
        excerptWidth: excerpt ? Math.round(excerpt.getBoundingClientRect().width) : 0,
        bodyText: document.body.innerText,
      };
    });

    // Response moved to the sheet below xl, which frees the width the review needs.
    expect(layout.headers.some((h) => h.label === 'Response' && h.width > 0)).toBe(false);
    expect(layout.excerptWidth).toBeGreaterThanOrEqual(200);
    // The stay date is still on the row, under the guest name.
    expect(layout.bodyText).toContain('Nov 1-5, 2026');
  });

  test('phone cards reply without opening the overflow menu', async ({ page }) => {
    await installReviewsUxMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openReviews(page, reviewsPaths.property);

    await expect(page.getByRole('button', { name: 'Reply', exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Edit reply', exact: true }).first()
    ).toBeVisible();
  });

  test('the whole phone card opens the review, not just the name', async ({ page }) => {
    await installReviewsUxMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openReviews(page, reviewsPaths.property);

    // Tap the review body, away from the name and the action buttons.
    const body = await page.getByText('Everything was ready when we arrived').first().boundingBox();
    await page.mouse.click(body!.x + 16, body!.y + 6);
    await expect(page.getByRole('dialog', { name: /Maria Santos's review/ })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('read only member has no reply button or auto-review', async ({ page }) => {
    await installReviewsUxMocks(page, { readOnly: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await openReviews(page, reviewsPaths.property);

    await expect(page.getByRole('button', { name: /^(Reply|Edit reply)$/ })).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openReviews(page, reviewsPaths.property);
    await expect(page.getByRole('button', { name: 'Auto-review' })).toHaveCount(0);
  });

  test('respond sheet shows the review and only saves real text', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.property);

    await page.getByRole('button', { name: 'Respond', exact: true }).first().click();
    const sheet = page.getByRole('dialog', { name: /Respond to Josefina/ });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    // The review being answered is in the sheet.
    await expect(sheet.getByText(/We stayed four nights/)).toBeVisible();
    // Nothing typed, nothing to save.
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled();
    await sheet.getByLabel('Public response').fill('Thanks for the detailed notes.');
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  test('removing a response asks first', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.property);

    await page.getByRole('button', { name: 'Edit response' }).first().click();
    const sheet = page.getByRole('dialog', { name: /Respond to Maria/ });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await sheet.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Remove your response?');
    await page.getByRole('button', { name: 'Keep response' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('fractional averages do not round up in stars', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.property);

    await page
      .getByRole('button', { name: /Average rating/ })
      .first()
      .click();
    const sheet = page.getByRole('dialog', { name: 'Rating breakdown' });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(sheet.getByRole('img', { name: '3.8 out of 5 stars' })).toBeVisible();
  });

  test('to write refine sheet has no empty filters section', async ({ page }) => {
    await installReviewsUxMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openReviews(page, reviewsPaths.propertyToWrite);

    await page.getByRole('button', { name: /Refine reviews/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Refine' });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(sheet.getByText('Sort', { exact: true })).toBeVisible();
    await expect(sheet.getByText('Filters', { exact: true })).toHaveCount(0);
  });

  test('sort control has an accessible name', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.property);
    await expect(page.getByRole('button', { name: /^Sort reviews: / })).toBeVisible();
  });

  test('org cards follow the listing filter', async ({ page }) => {
    await installReviewsUxMocks(page);
    await openReviews(page, reviewsPaths.orgSingleListing);

    // Solea Mactan alone: 5 reviews at 3.6, not the org-wide 9 at 3.8.
    await expect(page.getByText('3.6', { exact: true })).toBeVisible();
    await expect(page.getByText('3.8', { exact: true })).toHaveCount(0);
    // The distribution sheet is org-wide, so a filtered card must not open it.
    await expect(page.getByRole('button', { name: /Average rating/ })).toHaveCount(0);
  });
});
