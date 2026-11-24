import { expect, test, type Page } from '@playwright/test';

import {
  HELP_E2E_ORG_PATH,
  HELP_E2E_PROPERTY_PATH,
  TICKET_CLOSED,
  TICKET_OPEN,
  TICKET_RESOLVED,
  demoPause,
  helpPath,
  installHelpSupportMocks,
  openHelpSupport,
  settleForCapture,
  type HelpScope,
} from './shared/helpSupportHarness';

/**
 * Fixed-corpus captures for the Help & Support UI review. `@demo` — never CI.
 *
 *   HELP_SHOTS_DIR=docs/workflow/in-progress/help-support-ux-review/screenshots \
 *     playwright test ui/e2e/features/help-support/helpSupportScreens.spec.ts --project=chromium
 */

const OUT = process.env.HELP_SHOTS_DIR ?? 'test-results/help-support-shots';

async function shot(page: Page, name: string, opts?: { fullPage?: boolean }) {
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    fullPage: opts?.fullPage ?? false,
    animations: 'disabled',
  });
}

/** The FAQ home settles on topic tiles; wait for one so captures never catch skeletons. */
async function waitForFaqHome(page: Page) {
  await expect(page.getByRole('textbox', { name: 'Search FAQs' })).toBeVisible();
}

test.describe('help support screens @demo', () => {
  test.setTimeout(240_000);

  test('faqs across widths', async ({ page }) => {
    await installHelpSupportMocks(page, { scope: 'property' });

    // Boot once at desktop and resize: a reload per width recompiles every route
    // chunk and adds nothing a media-query breakpoint would not show.
    await page.setViewportSize({ width: 1440, height: 960 });
    await openHelpSupport(page, 'property');
    await waitForFaqHome(page);
    await settleForCapture(page);

    for (const width of [1440, 1920, 1280, 1024, 768, 430, 390, 360] as const) {
      await page.setViewportSize({ width, height: width >= 768 ? 960 : 844 });
      await expect(page.getByRole('textbox', { name: 'Search FAQs' })).toBeVisible({
        timeout: 15_000,
      });
      await settleForCapture(page, 180);
      await shot(page, `faqs-property-${width}`);
    }
  });

  test('faqs at org and parking scope', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    for (const scope of ['org', 'parking'] as HelpScope[]) {
      await installHelpSupportMocks(page, { scope });
      await openHelpSupport(page, scope);
      await waitForFaqHome(page);
      await settleForCapture(page);
      await shot(page, `faqs-${scope}-1440`);
    }
  });

  test('faq category, search, guides', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installHelpSupportMocks(page);
    await openHelpSupport(page, 'property');
    await waitForFaqHome(page);
    await settleForCapture(page);

    await page.getByRole('button', { name: /Bookings/ }).click();
    await settleForCapture(page);
    await shot(page, 'faq-category-property-1440');

    await page.getByRole('button', { name: 'All topics' }).click();
    await settleForCapture(page);

    const search = page.getByRole('textbox', { name: 'Search FAQs' });
    await search.fill('profit');
    await settleForCapture(page);
    await shot(page, 'faq-search-1440');

    await search.fill('nothing matches this');
    await settleForCapture(page);
    await shot(page, 'faq-search-empty-1440');

    await page.goto(`${HELP_E2E_PROPERTY_PATH}/docs`);
    await expect(page.getByRole('heading', { name: 'Guides', exact: true })).toBeVisible();
    await settleForCapture(page);
    await shot(page, 'guides-1440');

    await page.getByRole('button', { name: /Property/ }).click();
    await settleForCapture(page);
    await page.locator('summary').filter({ hasText: 'Finance' }).first().click();
    await settleForCapture(page, 350);
    await shot(page, 'guides-group-open-1440');
  });

  test('tickets: list, thread, closed, new ticket', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installHelpSupportMocks(page);
    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_OPEN}`);
    await expect(page.getByRole('heading', { name: 'Tickets', exact: true })).toBeVisible();
    await settleForCapture(page, 500);
    await shot(page, 'tickets-thread-1440');

    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_CLOSED}`);
    await settleForCapture(page, 500);
    await shot(page, 'tickets-closed-1440');

    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_RESOLVED}`);
    await settleForCapture(page, 500);
    await shot(page, 'tickets-resolved-1440');

    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets?compose=1`);
    await expect(page.getByRole('dialog')).toBeVisible();
    await settleForCapture(page, 500);
    await shot(page, 'tickets-new-modal-1440');

    await page.setViewportSize({ width: 390, height: 844 });
    await settleForCapture(page, 300);
    await shot(page, 'tickets-new-modal-390');
  });

  test('tickets on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installHelpSupportMocks(page);
    await openHelpSupport(page, 'property');
    await waitForFaqHome(page);
    await page.getByRole('link', { name: /Tickets/ }).click();
    await expect(page.getByText('My Tickets')).toBeVisible();
    await settleForCapture(page, 500);
    await shot(page, 'tickets-list-390');

    await page.getByRole('link', { name: /Booking form freezes/ }).click();
    await settleForCapture(page, 500);
    await shot(page, 'tickets-thread-390');

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_OPEN}`);
    await settleForCapture(page, 500);
    await shot(page, 'tickets-thread-360');
  });

  test('org and parking tickets', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });

    await installHelpSupportMocks(page, { scope: 'org' });
    await page.goto(`${HELP_E2E_ORG_PATH}/tickets/${TICKET_OPEN}`);
    await expect(page.getByRole('heading', { name: 'Help & Support', exact: true })).toBeVisible();
    await settleForCapture(page, 500);
    await shot(page, 'tickets-thread-org-1440');

    await installHelpSupportMocks(page, { scope: 'parking' });
    await page.goto(`${helpPath('parking')}/tickets/${TICKET_OPEN}`);
    await expect(page.getByRole('heading', { name: 'Help & Support', exact: true })).toBeVisible();
    await settleForCapture(page, 500);
    await shot(page, 'tickets-thread-parking-1440');
  });

  test('empty ticket list', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installHelpSupportMocks(page, { emptyTickets: true });
    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets`);
    await expect(page.getByText('No tickets yet')).toBeVisible();
    await settleForCapture(page);
    await shot(page, 'tickets-empty-1440');

    await page.setViewportSize({ width: 390, height: 844 });
    await settleForCapture(page, 250);
    await shot(page, 'tickets-empty-390');
  });

  test('faqs error state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installHelpSupportMocks(page, { failFaqs: true });
    await openHelpSupport(page, 'property');
    await expect(page.getByText("Couldn't load FAQs")).toBeVisible();
    await settleForCapture(page);
    await shot(page, 'faqs-error-1440');
  });

  test('tickets error state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installHelpSupportMocks(page, { failTickets: true });
    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets`);
    await expect(page.getByText("Couldn't load tickets")).toBeVisible({ timeout: 15_000 });
    await settleForCapture(page);
    await shot(page, 'tickets-error-1440');
  });

  test('faqs empty catalogue', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installHelpSupportMocks(page, { emptyFaqs: true });
    await openHelpSupport(page, 'property');
    await expect(page.getByText('No FAQs yet')).toBeVisible();
    await settleForCapture(page);
    await shot(page, 'faqs-empty-1440');
  });

  test('first paint skeleton', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await installHelpSupportMocks(page);
    // Hold the FAQ response so the section skeleton is observable.
    await page.route('**/functions/v1/list-help-center-faqs', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      await route.fallback();
    });
    await page.goto(HELP_E2E_PROPERTY_PATH);
    await page.getByRole('heading', { name: 'Help & Support', exact: true }).waitFor();
    await demoPause(page, 0.4);
    await shot(page, 'faqs-loading-1440');
  });
});
