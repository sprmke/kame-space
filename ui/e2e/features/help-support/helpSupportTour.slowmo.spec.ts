import { expect, test } from '@playwright/test';

import {
  dismissConsent,
  HELP_E2E_PROPERTY_PATH,
  TICKET_CLOSED,
  TICKET_OPEN,
  TICKET_RESOLVED,
  demoPause,
  demoScrollTo,
  installHelpSupportMocks,
  openHelpSupport,
  settleForCapture,
} from './shared/helpSupportHarness';

/**
 * Slow-motion walkthrough of Help & Support across its three mounts.
 * `@demo` — headed, never CI.
 *
 *   bun run test:e2e:help:tour:video
 *
 * Videos land in `test-results/playwright/<scenario>/video.webm`.
 */

test.describe('help & support tour @demo', () => {
  test.use({ viewport: { width: 1440, height: 960 }, actionTimeout: 8_000 });

  test('01 FAQs: browse, open a topic, search, dead-end recovery', async ({ page }) => {
    test.setTimeout(300_000);
    await installHelpSupportMocks(page);
    await openHelpSupport(page, 'property');
    await expect(page.getByRole('textbox', { name: 'Search FAQs' })).toBeVisible();
    await dismissConsent(page);
    await demoPause(page, 1.6);

    await demoScrollTo(page, 'text=Bookings');
    await page.getByRole('button', { name: /^Bookings/ }).hover();
    await demoPause(page, 0.7);
    await page.getByRole('button', { name: /^Bookings/ }).click();
    await demoPause(page, 1.2);

    const question = page.locator('summary').filter({ hasText: 'Why is a booking waiting' });
    await question.click();
    await demoPause(page, 1.6);
    await question.click();
    await demoPause(page, 0.6);

    await page.getByRole('button', { name: 'All topics' }).click();
    await demoPause(page, 0.9);

    const search = page.getByRole('textbox', { name: 'Search FAQs' });
    await search.fill('profit');
    await demoPause(page, 1.4);
    await page.locator('summary').filter({ hasText: 'How is net profit calculated?' }).click();
    await demoPause(page, 1.4);

    await search.fill('no answer for this');
    await demoPause(page, 1.4);
    await page.getByRole('link', { name: 'New ticket' }).hover();
    await demoPause(page, 1);
    await page.getByRole('link', { name: 'New ticket' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await demoPause(page, 1.6);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.8);
  });

  test('02 guides: groups, article, in-topic search', async ({ page }) => {
    test.setTimeout(300_000);
    await installHelpSupportMocks(page);
    await page.goto(`${HELP_E2E_PROPERTY_PATH}/docs`);
    await dismissConsent(page);
    await expect(page.getByRole('heading', { name: 'Guides', exact: true })).toBeVisible();
    await demoPause(page, 1.6);

    await page.getByRole('button', { name: /^Property/ }).hover();
    await demoPause(page, 0.7);
    await page.getByRole('button', { name: /^Property/ }).click();
    await demoPause(page, 1.2);

    const finance = page.locator('summary').filter({ hasText: 'Finance' }).first();
    await finance.click();
    await demoPause(page, 1.8);
    await demoScrollTo(page, 'text=Does the ledger include stays?');
    await demoPause(page, 1.2);

    await page.getByRole('textbox', { name: 'Search Property' }).fill('settings');
    await demoPause(page, 1.4);
    await page.getByRole('textbox', { name: 'Search Property' }).fill('');
    await demoPause(page, 0.8);
  });

  test('03 tickets: list, thread, reply, resolved, reopen', async ({ page }) => {
    test.setTimeout(300_000);
    const state = await installHelpSupportMocks(page);
    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_OPEN}`);
    await dismissConsent(page);
    await expect(page.getByText('My Tickets')).toBeVisible();
    await demoPause(page, 1.8);

    for (const status of ['Open', 'In progress', 'Resolved', 'Closed']) {
      await page.getByText(status, { exact: true }).first().hover();
      await demoPause(page, 0.5);
    }

    await demoScrollTo(page, 'text=Here it is.');
    await demoPause(page, 1.2);

    const reply = page.getByRole('textbox', { name: 'Reply' });
    await reply.click();
    await reply.type('Thanks, sending the console log now. ', { delay: 25 });
    await demoPause(page, 1);
    await page.getByRole('button', { name: 'Send reply' }).click();
    await demoPause(page, 1.8);
    expect(state.replies.length).toBeGreaterThan(0);

    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_RESOLVED}`);
    await demoPause(page, 1.6);
    await demoScrollTo(page, 'text=Marked resolved.');

    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_CLOSED}`);
    await demoPause(page, 1.6);
    await page.getByRole('button', { name: 'Reopen ticket' }).hover();
    await demoPause(page, 0.8);
    await page.getByRole('button', { name: 'Reopen ticket' }).click();
    await demoPause(page, 1.8);
    await expect(page.getByRole('textbox', { name: 'Reply' })).toBeVisible();
  });

  test('04 new ticket: categories, validation, submit', async ({ page }) => {
    test.setTimeout(300_000);
    const state = await installHelpSupportMocks(page);
    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets?compose=1`);
    await dismissConsent(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await demoPause(page, 1.6);

    for (const category of ['Idea', 'Question', 'Business', 'Broken']) {
      await dialog.getByRole('button', { name: new RegExp(category) }).hover();
      await demoPause(page, 0.45);
    }

    await dialog.getByRole('button', { name: /Business/ }).click();
    await demoPause(page, 1.1);
    await dialog.getByLabel('Subject').click();
    await dialog.getByLabel('Subject').type('Partnership for two more units', { delay: 30 });
    await demoPause(page, 0.7);
    await dialog
      .getByLabel('Details')
      .fill('We would like to add two properties to our account this quarter.');
    await demoPause(page, 0.9);
    await demoScrollTo(page, 'role=dialog');
    await dialog.getByLabel('How should we reach you?').fill('owner@example.test');
    await demoPause(page, 0.8);
    await dialog.getByRole('button', { name: 'Submit' }).click();
    await demoPause(page, 2.2);
    expect(state.submitted).toHaveLength(1);
  });

  test('05 the same module at org and parking scope', async ({ page }) => {
    test.setTimeout(300_000);

    await installHelpSupportMocks(page, { scope: 'org' });
    await openHelpSupport(page, 'org');
    await expect(page.getByRole('textbox', { name: 'Search FAQs' })).toBeVisible();
    await dismissConsent(page);
    await demoPause(page, 1.8);
    await page.getByRole('button', { name: /^Plans & Billing/ }).hover();
    await demoPause(page, 1.2);
    await page.getByRole('button', { name: /^Plans & Billing/ }).click();
    await demoPause(page, 1.6);
    await page.getByRole('button', { name: 'All topics' }).click();
    await demoPause(page, 1);

    await installHelpSupportMocks(page, { scope: 'parking' });
    await openHelpSupport(page, 'parking');
    await expect(page.getByRole('textbox', { name: 'Search FAQs' })).toBeVisible();
    await demoPause(page, 1.8);
    await page.getByRole('button', { name: /^Parking\b/ }).hover();
    await demoPause(page, 0.8);
    await page.getByRole('button', { name: /^Parking\b/ }).click();
    await demoPause(page, 1.6);
    await page.getByRole('button', { name: 'All topics' }).click();
    await demoPause(page, 1.2);
  });

  test('06 phone: FAQs, tickets, full-height thread, compose sheet', async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await installHelpSupportMocks(page);
    await openHelpSupport(page, 'property');
    await expect(page.getByRole('textbox', { name: 'Search FAQs' })).toBeVisible();
    await dismissConsent(page);
    await demoPause(page, 1.8);

    await demoScrollTo(page, 'text=Bookings');
    await demoPause(page, 1.2);
    await page.getByRole('link', { name: /Tickets/ }).click();
    await expect(page.getByText('My Tickets')).toBeVisible();
    await demoPause(page, 1.6);

    await page.getByRole('link', { name: /Booking form freezes/ }).click();
    await expect(page.getByRole('button', { name: 'Back to list' })).toBeVisible();
    await demoPause(page, 1.8);
    await demoScrollTo(page, 'text=Here it is.');
    await demoPause(page, 1.4);

    const reply = page.getByRole('textbox', { name: 'Reply' });
    await reply.click();
    await reply.type('On my way.', { delay: 40 });
    await demoPause(page, 0.9);
    await page.getByRole('button', { name: 'Send reply' }).click();
    await demoPause(page, 1.6);

    await page.goto(`${HELP_E2E_PROPERTY_PATH}/tickets?compose=1`);
    await expect(page.getByRole('dialog')).toBeVisible();
    await settleForCapture(page, 500);
    await demoPause(page, 1.8);
    await page.keyboard.press('Escape');
    await demoPause(page, 1);
  });
});
