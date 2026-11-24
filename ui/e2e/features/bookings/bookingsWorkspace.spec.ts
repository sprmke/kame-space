import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  BOOKINGS_PRIMARY_ID,
  BOOKING_ROW_IDS,
  bookingsPaths,
  dismissCookieConsent,
  installBookingsWorkspaceMocks,
} from './shared/bookingsWorkspaceHarness';
import {
  expectNoHorizontalOverflow,
  expectNoPageHorizontalOverflow,
  expectNoUnnamedInteractiveControls,
} from '../../shared/layoutAssertions';

/**
 * Bookings workspace — list + detail regression coverage.
 *
 *   bun run test:e2e:bookings
 *
 * Fixtures mirror the real `list-bookings` contract, so filters, sorting and stage
 * counts are exercised for real rather than asserted against a static array.
 */

const STAGE_COUNTS = {
  'Action Required': 5,
  'Pending Docs': 4,
  'Confirmed Stays': 1,
  History: 2,
} as const;

/** The desktop and mobile toolbars both mount; only one is visible per breakpoint. */
const visibleSearch = (page: Page) =>
  page.locator('input[type="search"]:visible').first();

async function openList(page: Page) {
  await installBookingsWorkspaceMocks(page);
  await page.goto(bookingsPaths.list);
  await dismissCookieConsent(page);
  await expect(page.getByRole('heading', { name: 'Bookings', level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  // Wait for the real cards, not the skeleton that renders the same titles.
  await expect(
    page.getByRole('button', { name: 'Action Required: 5', exact: true })
  ).toBeVisible({ timeout: 20_000 });
}

async function openDetail(page: Page, id: string = BOOKINGS_PRIMARY_ID) {
  await page.goto(bookingsPaths.detail(id));
  await dismissCookieConsent(page);
}

test.describe('bookings list @ci', () => {
  test.use({ viewport: { width: 1440, height: 960 } });
  test.setTimeout(90_000);

  test('summary stages, counts and stage filtering', async ({ page }) => {
    await openList(page);

    for (const [label, count] of Object.entries(STAGE_COUNTS)) {
      await expect(
        page.getByRole('button', { name: `${label}: ${count}`, exact: true })
      ).toBeVisible();
    }

    // Pending Docs: 2 PENDING_DOCUMENTS + 1 parking request + 1 pet request.
    await page.getByRole('button', { name: 'Pending Docs: 4', exact: true }).click();
    await expect(page).toHaveURL(/stage=pending_docs/);
    await expect(page.locator('tbody tr')).toHaveCount(4);

    await page.getByRole('button', { name: 'Pending Docs: 4', exact: true }).click();
    await expect(page).not.toHaveURL(/stage=/);
  });

  test('search and status filter drive the URL and the rows', async ({ page }) => {
    await openList(page);
    const rowsBefore = await page.locator('tbody tr').count();
    expect(rowsBefore).toBeGreaterThan(5);

    const search = visibleSearch(page);
    await search.fill('Liam');
    await expect(page).toHaveURL(/q=Liam/);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByText('Liam Tan')).toBeVisible();

    await search.fill('');
    await expect(page.locator('tbody tr')).toHaveCount(rowsBefore);

    await page.getByRole('button', { name: 'Filter by status' }).click();
    await page.getByRole('checkbox', { name: /Pending Review/i }).first().click();
    await expect(page).toHaveURL(/status=PENDING_REVIEW/);
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Filter by status' }).click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('tbody tr')).toHaveCount(rowsBefore);
  });

  test('table hides completed and cancelled by default, History stage shows them', async ({
    page,
  }) => {
    await openList(page);
    await expect(page.getByText('Chloe Reyes')).toHaveCount(0);
    await expect(page.getByText('Daniel Padilla')).toHaveCount(0);

    await page.getByRole('button', { name: 'History: 2', exact: true }).click();
    await expect(page).toHaveURL(/stage=history/);
    await expect(page.getByText('Chloe Reyes')).toBeVisible();
    await expect(page.getByText('Daniel Padilla')).toBeVisible();
  });

  test('every row opens its own booking detail', async ({ page }) => {
    await openList(page);
    await page.getByRole('button', { name: 'Open booking for Ana Villanueva' }).click();
    await expect(page.getByRole('heading', { name: 'Ana Villanueva' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(new RegExp(BOOKING_ROW_IDS.pendingReview));
  });

  test('kanban and calendar views render without sideways scroll', async ({ page }) => {
    test.setTimeout(180_000);
    await openList(page);

    await page.goto(bookingsPaths.listView('kanban'));
    await expect(page.getByText('Maria Santos').first()).toBeVisible({ timeout: 75_000 });
    await expectNoPageHorizontalOverflow(page);

    await page.goto(bookingsPaths.listView('calendar'));
    await expect(page.getByText('Day details')).toBeVisible({ timeout: 75_000 });
    await expect(page.getByText('Select a day')).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test('list chrome has no unnamed controls and no overflow', async ({ page }) => {
    await openList(page);
    await expectNoPageHorizontalOverflow(page);
    await expectNoUnnamedInteractiveControls(page);
  });

  test('a failed list request surfaces an error state with the reason', async ({ page }) => {
    await installBookingsWorkspaceMocks(page, {
      listFailure: { status: 500, message: 'Bookings service unavailable' },
    });
    // The property scope silently falls back to PostgREST; fail that too so the
    // user-visible error path is what gets asserted.
    await page.route('**/rest/v1/guest_submissions**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await page.goto(bookingsPaths.list);
    await dismissCookieConsent(page);
    await expect(page.getByText('Could not load bookings').first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe('booking detail @ci', () => {
  test.use({ viewport: { width: 1440, height: 960 } });
  test.setTimeout(90_000);

  test('header, tabs and every panel render', async ({ page }) => {
    await installBookingsWorkspaceMocks(page);
    await openDetail(page);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Pending Documents').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to Bookings/ })).toBeVisible();

    const tabs = page.getByRole('tablist', { name: 'Booking detail sections' });
    for (const tab of ['Stay', 'Guests', 'Pricing', 'Files', 'Activity']) {
      await expect(tabs.getByRole('tab', { name: tab, exact: true })).toBeVisible();
    }

    for (const [tab, marker] of [
      ['Guests', /Primary guest/i],
      ['Pricing', /Rate|Total|Balance/i],
      ['Files', /GAF|Valid ID|Document/i],
      ['Activity', /Activity|Booking ID/i],
    ] as const) {
      await tabs.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.getByText(marker).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('the workflow rail fits its column and keeps the primary action readable', async ({
    page,
  }) => {
    await installBookingsWorkspaceMocks(page);
    await openDetail(page);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 30_000,
    });

    const rail = page.locator('[data-booking-detail-workflow]').first();
    await expect(rail).toBeVisible();
    await expectNoHorizontalOverflow(rail, 'workflow rail');
    await expectNoPageHorizontalOverflow(page);

    const cta = rail.getByRole('button', { name: /Mark GAF as complete/i }).first();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.x + box.width <= viewport.width - 8).toBeTruthy();
  });

  test('detail chrome has no unnamed controls', async ({ page }) => {
    await installBookingsWorkspaceMocks(page);
    await openDetail(page);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByRole('tablist', { name: 'Booking detail sections' })
      .getByRole('tab', { name: 'Activity', exact: true })
      .click();
    await expectNoUnnamedInteractiveControls(page);
  });

  test('PENDING_REVIEW cannot proceed until the review acknowledgement is ticked', async ({
    page,
  }) => {
    await installBookingsWorkspaceMocks(page, { primaryStatus: 'PENDING_REVIEW' });
    await openDetail(page);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: /^Proceed to Pending Documents/i })).toHaveCount(
      0
    );
    await page
      .getByRole('checkbox', { name: /I manually reviewed and confirmed/i })
      .check({ force: true });
    await expect(
      page.getByRole('button', { name: /^Proceed to Pending Documents/i })
    ).toBeVisible();
  });
});

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * The existing axe sweep covers the bookings *list* but not a booking *detail* page.
 * Detail is the denser surface (workflow rail, nested doc groups, forms), so it gets
 * its own serious/critical gate here.
 */
test.describe('booking detail — accessibility @ci', () => {
  test.use({ viewport: { width: 1440, height: 960 } });
  test.setTimeout(90_000);

  test('no serious or critical axe violations', async ({ page }) => {
    await installBookingsWorkspaceMocks(page);
    await openDetail(page);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 30_000,
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    /**
     * Two known defects are tracked in
     * `docs/workflow/in-progress/bookings-ux-review/README.md` and excluded so that any
     * *new* serious violation still fails this gate:
     *  - `color-contrast`: Cancel booking tinted button is 4.12:1 (needs 4.5:1)
     *  - `label-content-name-mismatch`: aria-label "Return to Pending Review" vs visible
     *    text "Return to Review"
     */
    const KNOWN = new Set(['color-contrast', 'label-content-name-mismatch']);
    const serious = results.violations.filter(
      (v) => ['serious', 'critical'].includes(v.impact ?? '') && !KNOWN.has(v.id)
    );
    expect(
      serious.map(
        (v) => `${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')})`
      )
    ).toEqual([]);
  });
});

test.describe('booking detail — read-only member @ci', () => {
  test.use({ viewport: { width: 1440, height: 960 } });
  test.setTimeout(90_000);

  test('no edit and no workflow actions are offered', async ({ page }) => {
    await installBookingsWorkspaceMocks(page, { permissionTemplate: 'read_only' });
    await openDetail(page, BOOKING_ROW_IDS.pendingReview);
    await expect(page.getByRole('heading', { name: 'Ana Villanueva' })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByRole('button', { name: 'Edit booking' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Proceed to/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Cancel booking$/i })).toHaveCount(0);
    // Review write access is a separate leaf (`reviews.guests:edit`).
    await expect(page.getByRole('button', { name: /^(Write|Edit review)$/ })).toHaveCount(0);
  });

  /**
   * Known defect (open): the door-code field renders an editable input + Save for a
   * view-only member, and the server rejects the write with 403. Flip this to a normal
   * assertion once `GuestAccessCodeField` is permission-gated.
   */
  test('door code field is read-only for a viewer', async ({ page }) => {
    test.fail();
    await installBookingsWorkspaceMocks(page, { permissionTemplate: 'read_only' });
    await openDetail(page, BOOKING_ROW_IDS.pendingReview);
    await expect(page.getByRole('heading', { name: 'Ana Villanueva' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: /^Save$/ })).toHaveCount(0);
  });
});

test.describe('bookings list — phone @ci', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.setTimeout(90_000);

  test('card view is the default, table and kanban are not offered', async ({ page }) => {
    await openList(page);
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByText('Maria Santos').first()).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
    await expectNoUnnamedInteractiveControls(page);

    await visibleSearch(page).fill('Sofia');
    await expect(page.getByText('Sofia Reyes').first()).toBeVisible();
    await expect(page.getByText('Maria Santos')).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
  });

  test('primary actions meet the touch target contract', async ({ page }) => {
    await openList(page);
    // Hero icon actions ship a 36px visual with an invisible 44px hit pad.
    for (const name of ['New booking', 'Import bookings']) {
      const control = page.getByRole('button', { name }).first();
      await expect(control).toBeVisible();
      expect((await control.boundingBox())!.height, `${name} visual height`).toBeGreaterThanOrEqual(
        36
      );
    }
    // Search and refine render full 44px controls.
    expect((await visibleSearch(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      (await page.getByRole('button', { name: 'Refine bookings' }).boundingBox())!.height
    ).toBeGreaterThanOrEqual(44);
  });

  test('detail puts Progress above the fold and can expand the details', async ({ page }) => {
    await installBookingsWorkspaceMocks(page);
    await page.goto(bookingsPaths.detail());
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 30_000,
    });
    await expectNoPageHorizontalOverflow(page);

    const workflow = page.locator('[data-booking-detail-workflow]').first();
    await expect(workflow).toBeVisible();
    expect((await workflow.boundingBox())!.y).toBeLessThan(844);

    // Primary workflow CTA must stay inside the phone viewport.
    const cta = workflow.getByRole('button', { name: /Mark GAF as complete/i }).first();
    const box = await cta.boundingBox();
    expect(box!.x + box!.width, 'primary CTA right edge').toBeLessThanOrEqual(382);
  });

  /**
   * Known defect (open): at 390px the primary workflow CTA renders its label with
   * `whitespace-nowrap` inside a two-button row, so "Mark GAF as complete" is clipped
   * to "Mark GAF as comple". Flip to a normal assertion when the row stacks.
   */
  test('primary workflow CTA label is not clipped', async ({ page }) => {
    test.fail();
    await installBookingsWorkspaceMocks(page);
    await page.goto(bookingsPaths.detail());
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 30_000,
    });
    const cta = page
      .locator('[data-booking-detail-workflow]')
      .getByRole('button', { name: /Mark GAF as complete/i })
      .first();
    const clipped = await cta.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped, 'CTA label is clipped').toBe(false);
  });
});
